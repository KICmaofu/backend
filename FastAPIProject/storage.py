"""文件存储配置与安全工具：上传/静态目录、扩展名白名单与路径穿越防护。

与 dependencies.py、exceptions.py 同级放在根目录，供 routers/files.py 与 main.py 共用：
- `uploads/`：上传文件的落盘目录，由 main.py 挂载为 /uploads 提供直链访问；
- `static/`：随服务发布的静态资源目录（前端产物、图片等），挂载为 /static。
"""

import re
from pathlib import Path
from uuid import uuid4

from fastapi import status

from exceptions import BusinessException

# 以本文件所在目录（项目根目录）为基准，避免受启动时工作目录影响
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"

# 扩展名白名单（小写、含点）：只放行明确允许的类型，其余一律拒绝
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".txt", ".md", ".csv", ".zip"}

# 单个文件大小上限与分段读取块大小：
# UploadFile 会被 Starlette 先落到临时文件，必须「边读边计数」才能拦住超大文件
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MiB
CHUNK_SIZE = 1024 * 1024  # 1 MiB

# 不安全字符：只保留字母/数字/下划线/中划线/点/空格（\w 默认含中文等 Unicode 字符）
_UNSAFE_CHARS = re.compile(r"[^\w.\- ]+")


def ensure_directories() -> None:
    """确保上传与静态目录存在：StaticFiles 挂载时目录不存在会在启动阶段直接报错（check_dir=True）。"""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    STATIC_DIR.mkdir(parents=True, exist_ok=True)


def build_stored_name(original_name: str) -> str:
    """由客户端原始文件名生成安全存储名：`uuid_安全化原名`。

    - uuid 前缀保证唯一（重名上传互不覆盖）且不可被猜测；
    - 原名仅保留安全字符，`../`、盘符、路径分隔符等在使用前已被清洗，
      从源头杜绝「文件名即路径」的注入；保留原名只为下载时展示友好名称
      （真实项目应把原名等元数据存数据库，这里为演示从简）。
    """
    stem = _UNSAFE_CHARS.sub("_", Path(original_name).stem).strip(". ")[:50] or "file"
    return f"{uuid4().hex}_{stem}{Path(original_name).suffix.lower()}"


def display_name_of(stored_name: str) -> str:
    """从存储名反解展示名（下载的 Content-Disposition 与列表接口使用）。"""
    _, _, display = stored_name.partition("_")
    return display or stored_name


def safe_resolve(directory: Path, filename: str) -> Path:
    """把用户提供的文件名解析为 directory 内的路径，并阻止路径穿越。

    双层防御，任一不满足即抛业务异常（由全局处理器转为 400）：
    1. 只接受不含路径分隔符的纯文件名——`a/b`、`..\\x` 等在此被拒；
    2. 解析后的真实路径必须仍在 directory 内——防盘符、符号链接等绕过。
    """
    candidate = directory / filename
    if not filename or Path(filename).name != filename or not candidate.resolve().is_relative_to(directory.resolve()):
        raise BusinessException("非法的文件名", status_code=status.HTTP_400_BAD_REQUEST)
    return candidate

"""文件接口：演示 UploadFile 流式上传、FileResponse 下载与文件安全校验。

- 上传：multipart/form-data（由 python-multipart 解析），落盘到 uploads/；
- 下载：FileResponse 文件流——二进制内容无法套用 ApiResponse 统一响应，
  仅错误分支（如文件不存在）仍返回统一 JSON；
- 列表：便于取回 stored_name，分页参数复用 dependencies.Pagination。
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Path as PathParam, UploadFile, status
from fastapi.responses import FileResponse

from dependencies import Pagination, get_current_user
from exceptions import BusinessException
from schemas.files import FileInfo
from schemas.response import ApiResponse
from storage import (
    ALLOWED_EXTENSIONS,
    CHUNK_SIZE,
    MAX_FILE_SIZE,
    UPLOAD_DIR,
    build_stored_name,
    display_name_of,
    safe_resolve,
)

router = APIRouter(prefix="/files", tags=["files"])


def _to_file_info(path: Path) -> FileInfo:
    """由磁盘文件还原元信息：演示用近似实现（真实项目应查数据库）。"""
    stat = path.stat()
    return FileInfo(
        original_name=display_name_of(path.name),
        stored_name=path.name,
        size=stat.st_size,
        content_type=None,
        uploaded_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        url=f"/uploads/{path.name}",
        download_url=f"/files/download/{path.name}",
    )


@router.post(
    "/upload",
    summary="上传文件",
    description=(
        "以 `multipart/form-data` 上传单个文件，表单字段名固定为 `file`。服务端安全策略：\n"
        "1. 扩展名白名单校验（jpg/jpeg/png/gif/webp/pdf/txt/md/csv/zip）；\n"
        "2. 读取时按块累计大小，超过 5 MiB 立即中断并清理已写入的半成品；\n"
        "3. 落盘名由 `uuid_安全化原名` 生成，杜绝重名覆盖与路径穿越。\n"
        "写操作需携带 `X-Token: secret`（复用鉴权依赖）。"
    ),
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[FileInfo],
    responses={
        400: {"description": "扩展名为空或不在白名单、文件内容为空"},
        401: {"description": "令牌无效（依赖注入鉴权）"},
        413: {"description": "文件大小超过 5 MiB 限制"},
    },
    dependencies=[Depends(get_current_user)],
)
async def upload_file(
    file: Annotated[UploadFile, File(description="待上传文件，表单字段名固定为 file")],
) -> ApiResponse[FileInfo]:
    original_name = file.filename or ""
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise BusinessException(
            f"不支持的扩展名 {suffix or '(无)'}，允许：{', '.join(sorted(ALLOWED_EXTENSIONS))}",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # 上传内容不整体读入内存：分块读写，边读边做大小校验
    stored_name = build_stored_name(original_name)
    dest = UPLOAD_DIR / stored_name
    size = 0
    try:
        with dest.open("wb") as out:
            while chunk := await file.read(CHUNK_SIZE):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise BusinessException(
                        f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024} MiB）",
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    )
                out.write(chunk)
        if size == 0:
            raise BusinessException("文件内容为空", status_code=status.HTTP_400_BAD_REQUEST)
    except BusinessException:
        dest.unlink(missing_ok=True)  # 校验失败时清理写了一半的文件，避免留下脏数据
        raise
    finally:
        await file.close()  # 释放 Starlette 写入的临时文件

    return ApiResponse.ok(
        data=FileInfo(
            original_name=original_name,
            stored_name=stored_name,
            size=size,
            content_type=file.content_type,
            uploaded_at=datetime.now(timezone.utc),
            url=f"/uploads/{stored_name}",
            download_url=f"/files/download/{stored_name}",
        ),
        message="上传成功",
    )


@router.get(
    "/download/{filename}",
    summary="下载文件",
    description=(
        "以文件流返回 `uploads/` 中的文件，`Content-Disposition: attachment` 让浏览器直接下载。注意两点：\n"
        "1. 文件流响应不是 ApiResponse（二进制内容无法套统一 JSON），仅错误分支返回统一 JSON；\n"
        "2. 路径参数只接受不含路径分隔符的纯文件名：`..\\` 等非法名由服务层拒绝（400），"
        "含 `/` 的输入在路由层就匹配不到（404），两者都无法读到目标目录之外的文件。"
    ),
    response_class=FileResponse,
    responses={
        200: {"description": "文件二进制流", "content": {"application/octet-stream": {}}},
        400: {"description": "非法文件名（路径穿越防护）"},
        404: {"description": "文件不存在"},
    },
)
async def download_file(
    filename: Annotated[str, PathParam(description="存储文件名，取自上传接口返回的 stored_name")],
) -> FileResponse:
    path = safe_resolve(UPLOAD_DIR, filename)
    if not path.is_file():
        raise BusinessException("文件不存在", status_code=status.HTTP_404_NOT_FOUND)
    # filename 参数决定 Content-Disposition 中的展示名（非 ASCII 字符会被自动 URL 编码）
    return FileResponse(path, filename=display_name_of(filename), media_type="application/octet-stream")


@router.get(
    "/",
    summary="查询已上传文件",
    description="按最后修改时间倒序分页列出 `uploads/` 中的文件；分页参数复用 `Pagination` 依赖，返回的 stored_name 可直接用于下载接口。",
    response_model=ApiResponse[list[FileInfo]],
)
async def list_files(pagination: Pagination) -> ApiResponse[list[FileInfo]]:
    skip, limit = pagination
    files = sorted(
        (path for path in UPLOAD_DIR.iterdir() if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,  # 最近上传的排前面
    )
    return ApiResponse.ok(data=[_to_file_info(path) for path in files[skip : skip + limit]])

"""文件服务层：上传/下载/列表的业务逻辑（从原 routers/files.py 迁入）。

文件模块当前无数据库实体，落盘到 uploads/ 目录（见 storage.py）；
安全策略（扩展名白名单、大小上限、路径穿越防护）全部收敛在本层，
controller 只负责接收表单与返回响应对象。
"""

from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile, status

from exceptions import BusinessException
from schemas.files import FileInfo
from storage import (
    ALLOWED_EXTENSIONS,
    CHUNK_SIZE,
    MAX_FILE_SIZE,
    UPLOAD_DIR,
    build_stored_name,
    display_name_of,
    safe_resolve,
)


class FileService:
    """文件业务服务：上传落盘、下载路径解析与文件列表。"""

    async def upload(self, file: UploadFile) -> FileInfo:
        """上传单个文件：校验扩展名 → 分块落盘（边读边限流）→ 返回元信息。

        失败时清理写了一半的文件，避免留下脏数据；所有业务失败统一抛
        BusinessException（400 扩展名/空文件、413 超限），由全局处理器转统一 JSON。
        """
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

        return FileInfo(
            original_name=original_name,
            stored_name=stored_name,
            size=size,
            content_type=file.content_type,
            uploaded_at=datetime.now(timezone.utc),
            url=f"/uploads/{stored_name}",
            download_url=f"/files/download/{stored_name}",
        )

    def resolve_download_path(self, filename: str) -> Path:
        """把存储名解析为可下载的本地路径：先防路径穿越（400），再查存在性（404）。

        返回 Path 交由 controller 用 FileResponse 包装——HTTP 响应构造属于
        controller 职责，service 不接触 FileResponse。
        """
        path = safe_resolve(UPLOAD_DIR, filename)
        if not path.is_file():
            raise BusinessException("文件不存在", status_code=status.HTTP_404_NOT_FOUND)
        return path

    def list_files(self, *, skip: int = 0, limit: int | None = None) -> list[FileInfo]:
        """按最后修改时间倒序分页列出 uploads/ 中的文件。"""
        files = sorted(
            (path for path in UPLOAD_DIR.iterdir() if path.is_file()),
            key=lambda path: path.stat().st_mtime,
            reverse=True,  # 最近上传的排前面
        )
        return [self._to_file_info(path) for path in files[skip : skip + limit]]

    @staticmethod
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

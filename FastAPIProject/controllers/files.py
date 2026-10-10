"""文件接口（controller 层）：只做 HTTP 边界处理。

业务逻辑（扩展名白名单、大小上限、路径穿越防护、落盘策略）全部在
services.FileService；本层只负责：
- 上传：接收 UploadFile 表单 → 交给 service → 包装 ApiResponse；
- 下载：向 service 要路径 → 用 FileResponse 组装文件流（二进制无法套 ApiResponse，
  仅错误分支经全局异常处理器返回统一 JSON）；
- 列表：分页参数复用 dependencies.Pagination。
"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Path as PathParam, UploadFile, status
from fastapi.responses import FileResponse

from dependencies import Pagination, get_current_active_user
from schemas.files import FileInfo
from schemas.response import ApiResponse
from services import file_service
from storage import display_name_of

router = APIRouter(prefix="/files", tags=["files"])


@router.post(
    "/upload",
    summary="上传文件",
    description=(
        "以 `multipart/form-data` 上传单个文件，表单字段名固定为 `file`。服务端安全策略：\n"
        "1. 扩展名白名单校验（jpg/jpeg/png/gif/webp/pdf/txt/md/csv/zip）；\n"
        "2. 读取时按块累计大小，超过 5 MiB 立即中断并清理已写入的半成品；\n"
        "3. 落盘名由 `uuid_安全化原名` 生成，杜绝重名覆盖与路径穿越。\n"
        "写操作需登录鉴权：携带 `Authorization: Bearer <JWT>`（登录接口签发）。"
    ),
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[FileInfo],
    responses={
        400: {"description": "扩展名为空或不在白名单、文件内容为空"},
        401: {"description": "未认证或令牌无效"},
        403: {"description": "账号已禁用"},
        413: {"description": "文件大小超过 5 MiB 限制"},
    },
    dependencies=[Depends(get_current_active_user)],
)
async def upload_file(
    file: Annotated[UploadFile, File(description="待上传文件，表单字段名固定为 file")],
) -> ApiResponse[FileInfo]:
    return ApiResponse.ok(data=await file_service.upload(file), message="上传成功")


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
    path = file_service.resolve_download_path(filename)
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
    return ApiResponse.ok(data=file_service.list_files(skip=skip, limit=limit))

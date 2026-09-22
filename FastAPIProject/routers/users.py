"""用户接口：复用 SQLAlchemy 异步 ORM 的单表 CRUD 模式（与 items 同构）。

数据流：请求体经 Pydantic 校验（schemas.users）→ CRUD 层操作数据库（crud.UserCRUD）→
ORM 对象经 from_attributes 转回响应模型；提交/回滚由 database.get_db 依赖统一管理，
路由层只负责编排，不接触提交与回滚细节。
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from crud import user_crud
from database import DbSession
from dependencies import Pagination, get_current_user
from schemas.response import ApiResponse
from schemas.users import User, UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    summary="查询用户列表",
    description="支持按用户名或邮箱模糊过滤（`q`）与分页（`skip`/`limit`）；分页参数由依赖注入统一提供。",
    response_model=ApiResponse[list[User]],
)
async def list_users(
    session: DbSession,
    pagination: Pagination,
    q: Annotated[str | None, Query(max_length=50, description="按用户名/邮箱模糊过滤")] = None,
) -> ApiResponse[list[User]]:
    skip, limit = pagination
    users = await user_crud.search(session, q, skip=skip, limit=limit)
    return ApiResponse.ok(data=users)


@router.post(
    "/",
    summary="创建用户",
    description=(
        "接收用户 JSON，校验通过后写入数据库；username/email 撞唯一约束返回 409。"
        "写操作通过依赖注入鉴权：需携带 `X-Token: secret`。"
    ),
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[User],
    responses={
        401: {"description": "令牌无效（依赖注入鉴权示例）"},
        409: {"description": "用户名或邮箱已存在"},
        422: {"description": "请求参数校验失败"},
    },
    dependencies=[Depends(get_current_user)],
)
async def create_user(session: DbSession, payload: UserCreate) -> ApiResponse[User]:
    user = await user_crud.create(session, payload)
    return ApiResponse.ok(data=user, message="创建成功")


@router.get(
    "/{user_id}",
    summary="查询单个用户",
    description="按 ID 查询用户，ID 必须为正整数。",
    response_model=ApiResponse[User],
    responses={404: {"description": "用户不存在"}},
)
async def get_user(
    session: DbSession, user_id: Annotated[int, Path(ge=1, description="用户 ID")]
) -> ApiResponse[User]:
    return ApiResponse.ok(data=await user_crud.get_or_404(session, user_id))


@router.put(
    "/{user_id}",
    summary="更新用户",
    description="仅更新请求体中传入的字段，未传字段保持不变；至少需要提交一个字段且不允许为 null。",
    response_model=ApiResponse[User],
    responses={
        404: {"description": "用户不存在"},
        409: {"description": "用户名或邮箱已存在"},
        422: {"description": "请求参数校验失败或未提交任何字段"},
    },
)
async def update_user(
    session: DbSession,
    user_id: Annotated[int, Path(ge=1, description="用户 ID")],
    patch: UserUpdate,
) -> ApiResponse[User]:
    user = await user_crud.update(session, user_id, patch)
    return ApiResponse.ok(data=user, message="更新成功")


@router.delete(
    "/{user_id}",
    summary="删除用户",
    description="删除成功后返回统一响应体，因此使用 200 而非 204（204 不允许响应体）。",
    response_model=ApiResponse[None],
    responses={404: {"description": "用户不存在"}},
)
async def delete_user(
    session: DbSession, user_id: Annotated[int, Path(ge=1, description="用户 ID")]
) -> ApiResponse[None]:
    await user_crud.delete(session, user_id)
    return ApiResponse.ok(message="删除成功")

"""用户接口（controller 层）：只做 HTTP 边界处理（与 items 同构）。

数据流：请求体经 Pydantic 校验（schemas.users）→ 服务层执行业务（services.UserService）→
DAO 层操作数据库（dao.UserDAO）；提交/回滚由 database.get_db 依赖统一管理，
controller 只负责编排调用与响应包装，不接触 SQL 与业务规则。
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from database import DbSession
from dependencies import CurrentActiveUser, Pagination, get_current_active_user
from schemas.response import ApiResponse
from schemas.users import User, UserCreate, UserUpdate
from services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    summary="查询当前登录用户",
    description=(
        "返回令牌对应的用户信息（按 JWT 的 sub 从数据库加载最新状态）；"
        "令牌缺失/无效返回 401，账号被禁用返回 403。"
    ),
    response_model=ApiResponse[User],
    responses={
        401: {"description": "未认证或令牌无效"},
        403: {"description": "账号已禁用"},
    },
)
async def get_me(current_user: CurrentActiveUser) -> ApiResponse[User]:
    return ApiResponse.ok(data=current_user)


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
    users = await user_service.search(session, q, skip=skip, limit=limit)
    return ApiResponse.ok(data=users)


@router.post(
    "/",
    summary="创建用户",
    description=(
        "接收用户 JSON（含密码），密码在服务端哈希后入库，响应不返回密码字段；"
        "username/email 撞唯一约束返回 409。"
        "写操作需登录鉴权：携带 `Authorization: Bearer <JWT>`（登录接口签发）。"
    ),
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[User],
    responses={
        401: {"description": "未认证或令牌无效"},
        403: {"description": "账号已禁用"},
        409: {"description": "用户名或邮箱已存在"},
        422: {"description": "请求参数校验失败"},
    },
    dependencies=[Depends(get_current_active_user)],
)
async def create_user(session: DbSession, payload: UserCreate) -> ApiResponse[User]:
    user = await user_service.create(session, payload)
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
    return ApiResponse.ok(data=await user_service.get(session, user_id))


@router.put(
    "/{user_id}",
    summary="更新用户",
    description=(
        "仅更新请求体中传入的字段，未传字段保持不变；至少需要提交一个字段且不允许为 null。"
        "写操作需登录鉴权：携带 `Authorization: Bearer <JWT>`。"
    ),
    response_model=ApiResponse[User],
    responses={
        401: {"description": "未认证或令牌无效"},
        403: {"description": "账号已禁用"},
        404: {"description": "用户不存在"},
        409: {"description": "用户名或邮箱已存在"},
        422: {"description": "请求参数校验失败或未提交任何字段"},
    },
    dependencies=[Depends(get_current_active_user)],
)
async def update_user(
    session: DbSession,
    user_id: Annotated[int, Path(ge=1, description="用户 ID")],
    patch: UserUpdate,
) -> ApiResponse[User]:
    user = await user_service.update(session, user_id, patch)
    return ApiResponse.ok(data=user, message="更新成功")


@router.delete(
    "/{user_id}",
    summary="删除用户",
    description=(
        "删除成功后返回统一响应体，因此使用 200 而非 204（204 不允许响应体）。"
        "写操作需登录鉴权：携带 `Authorization: Bearer <JWT>`。"
    ),
    response_model=ApiResponse[None],
    responses={
        401: {"description": "未认证或令牌无效"},
        403: {"description": "账号已禁用"},
        404: {"description": "用户不存在"},
    },
    dependencies=[Depends(get_current_active_user)],
)
async def delete_user(
    session: DbSession, user_id: Annotated[int, Path(ge=1, description="用户 ID")]
) -> ApiResponse[None]:
    await user_service.delete(session, user_id)
    return ApiResponse.ok(message="删除成功")

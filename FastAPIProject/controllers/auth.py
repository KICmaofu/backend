"""认证接口（controller 层）：注册与登录的 HTTP 边界。

数据流：请求体经 Pydantic 校验（schemas.auth）→ 服务层执行业务（services.UserService）：
- 注册：密码在 service 层哈希后经 DAO 写入，返回用户信息（不含任何密码字段）；
- 登录：service 层校验凭证并签发 JWT，返回令牌（后续请求放 Authorization: Bearer <token>）。
提交/回滚由 database.get_db 依赖统一管理，controller 只负责编排调用与响应包装。
"""

from fastapi import APIRouter, status

from database import DbSession
from schemas.auth import Token, UserLogin, UserRegister
from schemas.response import ApiResponse
from schemas.users import User
from services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    summary="用户注册",
    description=(
        "注册即创建用户：密码在服务端经 bcrypt 哈希后入库，响应不返回密码字段；"
        "username/email 撞唯一约束返回 409。注册成功后需调用 `/auth/login` 获取令牌。"
    ),
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[User],
    responses={
        409: {"description": "用户名或邮箱已存在"},
        422: {"description": "请求参数校验失败"},
    },
)
async def register(session: DbSession, payload: UserRegister) -> ApiResponse[User]:
    user = await user_service.register(session, payload)
    return ApiResponse.ok(data=user, message="注册成功")


@router.post(
    "/login",
    summary="用户登录",
    description=(
        "校验用户名与密码（错误统一返回 401），通过后签发 JWT 访问令牌（默认有效期 60 分钟）；"
        "被禁用账号（is_active=false）拒绝登录返回 403。"
    ),
    response_model=ApiResponse[Token],
    responses={
        401: {"description": "用户名或密码错误"},
        403: {"description": "账号已禁用"},
        422: {"description": "请求参数校验失败"},
    },
)
async def login(session: DbSession, payload: UserLogin) -> ApiResponse[Token]:
    token = await user_service.login(session, payload)
    return ApiResponse.ok(data=token, message="登录成功")

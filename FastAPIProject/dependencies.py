"""可复用依赖：演示 FastAPI 依赖注入（Depends）的常见用法。

依赖与中间件的分工：
- 依赖：作用粒度是「路由」，能读取路径/查询参数与请求体，适合参数复用、鉴权、注入资源；
- 中间件：作用粒度是「每个请求」，在路由前后织入逻辑，适合日志、计时、CORS。

依赖执行规则速记：
- 路由函数执行前，FastAPI 先按依赖树自下而上解析所有依赖（依赖先于请求体校验执行）；
- 同一请求内，同一个依赖默认只执行一次（结果被缓存复用），可用 use_cache=False 关闭缓存；
- 带 yield 的依赖在响应生成后执行清理逻辑（相当于路由的「上下文管理器」），
  请求级数据库会话就是典型的 yield 依赖，见 database.get_db。

鉴权链（JWT）：
- get_current_user：解析 Authorization: Bearer <JWT> → 按 sub 加载用户实体，
  未携带/无效/过期令牌 401，用户不存在 401；返回 models.User；
- get_current_active_user：在 get_current_user 基础上校验 is_active，禁用账号 403；
- 同一请求内依赖结果缓存：两个依赖都依赖 get_db 与 get_current_user，
  会话与用户查询只执行一次，与路由主体的业务读写天然处于同一事务。
"""

from typing import Annotated

from fastapi import Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from dao import user_dao
from database import DbSession
from exceptions import BusinessException
from models import User
from security import decode_access_token

# auto_error=False：令牌缺失时不自动抛 HTTPException，改为手动抛 BusinessException，
# 保证 401 也走全局异常处理器的统一响应结构（{"code": 401, ...}）
bearer_scheme = HTTPBearer(auto_error=False)


# ---------- 示例 1：参数复用（分页依赖） ----------

async def pagination(
    skip: Annotated[int, Query(ge=0, description="跳过条数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回条数上限")] = 10,
) -> tuple[int, int]:
    """函数式依赖：把分页参数的解析与校验收敛到一处，任意路由声明即可复用，Swagger 参数说明随之一并复用。"""
    return skip, limit


# Annotated 别名：路由签名写 `pagination: Pagination` 即可，声明与用法分离
Pagination = Annotated[tuple[int, int], Depends(pagination)]


# ---------- 示例 2：yield 依赖（依赖链）与 JWT 鉴权 ----------

async def get_current_user(
    session: DbSession,  # 依赖链演示：鉴权同时建立数据库会话（与路由声明的 session 复用同一实例，见下）
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    """JWT 鉴权依赖，同时演示「子依赖」：get_current_user 依赖 get_db（yield 依赖），形成依赖链。

    - 校验流程：取出 Bearer 令牌 → security.decode_access_token 验签/验过期（失败 401）→
      按 payload 的 sub（用户主键）加载用户实体（不存在 401，兼容「用户已被删除」场景）；
    - 挂在路由参数上可拿到用户实体：`current_user: CurrentUser`；
    - 挂 `dependencies=[Depends(get_current_user)]` 则只做校验、丢弃返回值，
      挂在路由或 APIRouter 上均可（对整个 router 的所有接口生效）；
    - get_db 的结果在同一请求内被缓存复用：这里注入的 session 与路由参数里的 session 是同一个，
      因此「鉴权校验」与「业务读写」天然处于同一事务。
    """
    if credentials is None:
        raise BusinessException("未提供认证令牌", status_code=status.HTTP_401_UNAUTHORIZED)
    payload = decode_access_token(credentials.credentials)
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        # 令牌合法但缺少可用的用户标识：与令牌无效同等对待
        raise BusinessException(
            "令牌无效或已过期", status_code=status.HTTP_401_UNAUTHORIZED
        ) from exc
    user = await user_dao.get(session, user_id)
    if user is None:
        raise BusinessException("用户不存在或令牌无效", status_code=status.HTTP_401_UNAUTHORIZED)
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """启用状态校验依赖：在 JWT 认证之上追加授权判断——账号被禁用时拒绝访问（403）。

    依赖缓存保证 get_current_user 不会重复执行：本依赖的 current_user 与
    路由里注入的 current_user 是同一个对象。
    """
    if not current_user.is_active:
        raise BusinessException("账号已禁用", status_code=status.HTTP_403_FORBIDDEN)
    return current_user


# Annotated 别名：路由签名写 `current_user: CurrentUser` 即可，声明与用法分离
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]

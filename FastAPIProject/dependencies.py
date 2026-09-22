"""可复用依赖：演示 FastAPI 依赖注入（Depends）的常见用法。

依赖与中间件的分工：
- 依赖：作用粒度是「路由」，能读取路径/查询参数与请求体，适合参数复用、鉴权、注入资源；
- 中间件：作用粒度是「每个请求」，在路由前后织入逻辑，适合日志、计时、CORS。

依赖执行规则速记：
- 路由函数执行前，FastAPI 先按依赖树自下而上解析所有依赖（依赖先于请求体校验执行）；
- 同一请求内，同一个依赖默认只执行一次（结果被缓存复用），可用 use_cache=False 关闭缓存；
- 带 yield 的依赖在响应生成后执行清理逻辑（相当于路由的「上下文管理器」），
  请求级数据库会话就是典型的 yield 依赖，见 database.get_db。
"""

from typing import Annotated

from fastapi import Depends, Header, Query, status

from database import DbSession
from exceptions import BusinessException


# ---------- 示例 1：参数复用（分页依赖） ----------

async def pagination(
    skip: Annotated[int, Query(ge=0, description="跳过条数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回条数上限")] = 10,
) -> tuple[int, int]:
    """函数式依赖：把分页参数的解析与校验收敛到一处，任意路由声明即可复用，Swagger 参数说明随之一并复用。"""
    return skip, limit


# Annotated 别名：路由签名写 `pagination: Pagination` 即可，声明与用法分离
Pagination = Annotated[tuple[int, int], Depends(pagination)]


# ---------- 示例 2：yield 依赖（依赖链）与鉴权 ----------

async def get_current_user(
    session: DbSession,  # 依赖链演示：鉴权同时建立数据库会话（与路由声明的 session 复用同一实例，见下）
    x_token: Annotated[str | None, Header(description="演示令牌，值为 secret 时通过鉴权")] = None,
) -> str:
    """鉴权依赖，同时演示「子依赖」：get_current_user 依赖 get_db（yield 依赖），形成依赖链。

    - 挂在路由参数上可拿到返回值：`user: Annotated[str, Depends(get_current_user)]`；
    - 挂 `dependencies=[Depends(get_current_user)]` 则只做校验、丢弃返回值，挂在路由或 APIRouter 上均可；
    - get_db 的结果在同一请求内被缓存复用：这里注入的 session 与路由参数里的 session 是同一个，
      因此「鉴权校验」与「业务读写」天然处于同一事务。
    """
    if x_token != "secret":
        raise BusinessException("无效的令牌", status_code=status.HTTP_401_UNAUTHORIZED)
    return "demo-user"

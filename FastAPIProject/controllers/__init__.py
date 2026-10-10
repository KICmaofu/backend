"""控制层（Controller）包：HTTP 边界，按业务模块拆分 APIRouter。

controller 职责（三层架构约定）：
1. 参数解析：路径/查询/请求体参数、依赖注入（会话、鉴权、分页）；
2. 调用 service：每个端点只调用一个业务动词，不做业务判断；
3. 组装响应：ApiResponse.ok(...) 包装与 Swagger 元信息（summary/description/response_model）。

禁止事项：不写 SQL、不 import dao/models、不处理业务规则（统一交给 service）。
"""

from controllers import auth, files, items, users

__all__ = ["auth", "files", "items", "users"]

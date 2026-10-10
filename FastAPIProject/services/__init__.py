"""业务逻辑层（Service）包：承载业务规则与编排，向上对 controller 屏蔽数据细节。

分层依赖方向：controllers → services → dao，上层可调用下层，反之禁止。
- service 不 import FastAPI/APIRouter/ApiResponse：HTTP 只属于 controller 层；
- service 不直接写 SQL：SQL 全部收敛在 dao 层；
- 请求级事务由 controller 注入的 session 贯穿（database.get_db 统一提交/回滚），
  service 只使用 session，不管理 session 生命周期。
模块级单例：service 是无状态组件，全部实例共享即可。
"""

from services.files import FileService
from services.items import ItemService
from services.users import UserService

__all__ = ["FileService", "ItemService", "UserService", "file_service", "item_service", "user_service"]

item_service = ItemService()
user_service = UserService()
file_service = FileService()

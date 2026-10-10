"""数据访问层（DAO）包：只负责与数据库/存储打交道，不含业务规则。

分层依赖方向：controllers → services → dao，上层可调用下层，反之禁止。
模块级单例：DAO 是无状态组件，全部实例共享即可。
"""

from dao.items import ItemDAO
from dao.users import UserDAO

__all__ = ["ItemDAO", "UserDAO", "item_dao", "user_dao"]

item_dao = ItemDAO()
user_dao = UserDAO()

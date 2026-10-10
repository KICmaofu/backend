"""ORM 实体类：Python 类与数据库表的一一映射（SQLAlchemy 2.0 Declarative 风格）。

映射要点：
- 继承 database.Base 即注册到统一 metadata，create_all 据此建表；
- 每个 Mapped[...] 类属性对应一列：类型注解声明 Python 侧类型，
  mapped_column(...) 补充数据库侧细节（主键、长度、默认值、约束等）；
- server_default 是「数据库端默认值」，default 是「ORM 端默认值」，两者可同时出现；
- 表结构变更应由 Alembic 迁移管理，create_all 仅适合开发/演示阶段。
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Item(Base):
    """商品实体，映射到 items 表。"""

    __tablename__ = "items"
    # eager_defaults：INSERT 时通过 RETURNING 子句立即取回数据库生成的默认值
    # （如 created_at），免去 flush 后再发 SELECT 刷新；注意它是 Mapper 级参数，不能写在列上
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键")
    name: Mapped[str] = mapped_column(String(50), comment="商品名称")
    # 金额类字段生产环境建议用 Numeric(10, 2) 避免浮点误差，演示项目用 float 简化
    price: Mapped[float] = mapped_column(comment="单价，必须大于 0")
    # tags 用 PG 特有的 JSONB 列存数组，自动完成 list[str] 与 JSON 的互转；
    # 换 MySQL/SQLite 时把 JSONB 改为 JSON 类型即可，实体与上层代码无需改动
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]", comment="标签列表（JSONB 数组）")
    # 时间戳交给数据库生成（server_default/onupdate）：server_default 在 INSERT 时生成，
    # onupdate 在 UPDATE 时刷新（由 crud 层在 flush 后 refresh 取回，见 crud.BaseCRUD.update）
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),  # 插入时的默认值
        onupdate=func.now(),  # 行更新时自动刷新
        comment="更新时间",
    )

    def __repr__(self) -> str:
        return f"<Item id={self.id} name={self.name!r} price={self.price}>"


class User(Base):
    """用户实体，映射到 users 表。

    与 Item 的差异演示：
    - username/email 建唯一约束与索引，靠数据库保证不重复（见 crud.UserCRUD 的冲突转换）；
    - is_active 是布尔列，演示 server_default 对非时间戳字段同样适用。
    """

    __tablename__ = "users"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键")
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, comment="用户名，唯一")
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, comment="邮箱，唯一")
    # 只存 bcrypt 哈希不存明文（见 security.hash_password）；响应模型不包含本字段，永不对外返回
    password_hash: Mapped[str] = mapped_column(String(255), comment="密码哈希（bcrypt）")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", comment="是否启用")
    # 时间戳与 Item 同套路：数据库生成，crud 层 flush 后 refresh 取回
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r} email={self.email!r}>"

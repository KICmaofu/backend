"""DAO 基类：通用单表数据访问封装（原 crud.py 的 BaseCRUD）。

三层架构中 DAO 层的职责边界：
- 只做数据访问：SQL 构建、行读写、数据层错误转换，不掺任何业务规则；
- 写操作只 flush 不 commit：提交/回滚统一由 database.get_db 依赖管理（请求级事务），
  flush 保证数据库生成的主键与默认值（如 created_at）立即可用；
- 资源不存在统一抛 BusinessException(404)，由全局异常处理器转为统一响应；
- 查询不存在返回 None（get），需要直接 404 的场景用 get_or_404。
"""

from typing import Any, Generic, TypeVar

from fastapi import status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Base
from exceptions import BusinessException

# 泛型参数：实体类型、创建入参类型、更新入参类型，由子类实例化时确定
ModelT = TypeVar("ModelT", bound=Base)
CreateT = TypeVar("CreateT", bound=BaseModel)
UpdateT = TypeVar("UpdateT", bound=BaseModel)


class BaseDAO(Generic[ModelT, CreateT, UpdateT]):
    """单表 DAO 基类。

    子类只需声明实体类即可获得通用增删改查能力：

        class ItemDAO(BaseDAO[Item, ItemCreate, ItemUpdate]):
            model = Item
    """

    model: type[ModelT]

    async def get(self, session: AsyncSession, entity_id: int) -> ModelT | None:
        """按主键查询，不存在返回 None。

        session.get 优先查同一会话的身份映射（identity map），同一请求内
        重复读取同一行不会重复打 SQL。
        """
        return await session.get(self.model, entity_id)

    async def get_or_404(self, session: AsyncSession, entity_id: int) -> ModelT:
        """按主键查询，不存在时抛 404 业务异常。"""
        obj = await self.get(session, entity_id)
        if obj is None:
            raise BusinessException(f"{self.model.__name__}不存在", status_code=status.HTTP_404_NOT_FOUND)
        return obj

    async def list(
        self,
        session: AsyncSession,
        *,
        skip: int = 0,
        limit: int | None = None,
        **filters: Any,
    ) -> list[ModelT]:
        """分页查询，按主键升序；filters 按「字段名=值」做等值过滤，如 list(session, name="键盘")。"""
        stmt = select(self.model)
        for field, value in filters.items():
            column = getattr(self.model, field, None)
            if column is None:
                raise ValueError(f"{self.model.__name__} 没有字段 {field}")
            stmt = stmt.where(column == value)
        stmt = stmt.order_by(self.model.id).offset(skip)
        if limit is not None:
            stmt = stmt.limit(limit)
        return list((await session.scalars(stmt)).all())

    async def create(self, session: AsyncSession, data: CreateT) -> ModelT:
        """新增一行。先 flush 让数据库生成主键与默认值（如 created_at），
        提交由 get_db 依赖在响应后统一完成。"""
        obj = self.model(**data.model_dump())
        session.add(obj)
        await session.flush()
        return obj

    async def update(self, session: AsyncSession, entity_id: int, patch: UpdateT) -> ModelT:
        """按主键更新：只更新显式传入的字段（exclude_unset=True），返回更新后的对象。

        updated_at 等 onupdate 默认值由数据库生成：flush 后这些属性被标记过期，
        直接访问会在异步会话中触发隐式 IO（MissingGreenlet 报错），因此显式 refresh 取回。
        """
        obj = await self.get_or_404(session, entity_id)
        for field, value in patch.model_dump(exclude_unset=True).items():
            setattr(obj, field, value)
        await session.flush()
        await session.refresh(obj)
        return obj

    async def delete(self, session: AsyncSession, entity_id: int) -> None:
        """按主键删除：不存在抛 404。删除只是把对象标记为 deleted，
        真正发出 DELETE 由请求结束时的统一 commit 完成。"""
        obj = await self.get_or_404(session, entity_id)
        await session.delete(obj)

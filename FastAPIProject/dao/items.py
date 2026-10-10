"""商品 DAO：基类已提供通用增删改查，此处只补充商品特有的查询。"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dao.base import BaseDAO
from models import Item
from schemas.items import ItemCreate, ItemUpdate


class ItemDAO(BaseDAO[Item, ItemCreate, ItemUpdate]):
    """商品数据访问：通用 CRUD 之外，补充按名称模糊过滤的分页查询。"""

    model = Item

    async def search(
        self,
        session: AsyncSession,
        q: str | None = None,
        *,
        skip: int = 0,
        limit: int | None = None,
    ) -> list[Item]:
        """按名称模糊过滤的分页查询；ilike 在 PG 下大小写不敏感。"""
        stmt = select(Item)
        if q:
            stmt = stmt.where(Item.name.ilike(f"%{q}%"))
        stmt = stmt.order_by(Item.id).offset(skip)
        if limit is not None:
            stmt = stmt.limit(limit)
        return list((await session.scalars(stmt)).all())

"""商品服务层：商品相关的业务规则与编排。

当前商品业务较简单，方法主要是对 DAO 的语义化封装；随着业务演进，
跨实体的规则（如「创建商品前检查库存」、「删除商品时级联清理关联数据」）
都应沉淀到本层，而不是散落在 controller。
"""

from sqlalchemy.ext.asyncio import AsyncSession

from dao import item_dao
from models import Item
from schemas.items import ItemCreate, ItemUpdate


class ItemService:
    """商品业务服务：对 controller 暴露业务动词，对下编排 DAO。"""

    async def search(
        self,
        session: AsyncSession,
        q: str | None = None,
        *,
        skip: int = 0,
        limit: int | None = None,
    ) -> list[Item]:
        """按名称模糊过滤的分页查询。"""
        return await item_dao.search(session, q, skip=skip, limit=limit)

    async def get(self, session: AsyncSession, item_id: int) -> Item:
        """按 ID 查询，不存在抛 404（由 DAO 层统一转换）。"""
        return await item_dao.get_or_404(session, item_id)

    async def create(self, session: AsyncSession, data: ItemCreate) -> Item:
        """创建商品：入参已由 Pydantic 校验（去空白、标签去重），此处只负责落库。"""
        return await item_dao.create(session, data)

    async def update(self, session: AsyncSession, item_id: int, patch: ItemUpdate) -> Item:
        """更新商品：只更新显式传入的字段。"""
        return await item_dao.update(session, item_id, patch)

    async def delete(self, session: AsyncSession, item_id: int) -> None:
        """删除商品。"""
        await item_dao.delete(session, item_id)

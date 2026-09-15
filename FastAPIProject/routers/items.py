from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/items", tags=["items"])


class Item(BaseModel):
    """商品模型"""

    name: str = Field(min_length=1, max_length=50, description="商品名称", examples=["无线鼠标"])
    price: float = Field(gt=0, description="单价，必须大于 0", examples=[99.9])
    tags: list[str] = Field(default_factory=list, description="标签列表", examples=[["电子产品", "外设"]])


class ItemUpdate(BaseModel):
    """商品更新模型，所有字段选填，仅更新传入的字段"""

    name: str | None = Field(default=None, min_length=1, max_length=50, description="商品名称")
    price: float | None = Field(default=None, gt=0, description="单价，必须大于 0")
    tags: list[str] | None = Field(default=None, description="标签列表")


# 内存存储，仅用于演示，后续可替换为数据库
items_db: dict[int, Item] = {
    1: Item(name="机械键盘", price=299.0, tags=["电子产品", "外设"]),
}


@router.get(
    "/",
    summary="查询商品列表",
    description="支持按名称模糊过滤（`q`）与分页（`skip`/`limit`）。",
    response_model=list[Item],
)
async def list_items(
    q: Annotated[str | None, Query(max_length=20, description="按名称模糊过滤")] = None,
    skip: Annotated[int, Query(ge=0, description="跳过条数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回条数上限")] = 10,
):
    result = list(items_db.values())
    if q:
        result = [item for item in result if q in item.name]
    return result[skip : skip + limit]


@router.post(
    "/",
    summary="创建商品",
    description="接收商品 JSON，校验通过后写入内存存储。",
    status_code=status.HTTP_201_CREATED,
    response_model=Item,
    responses={422: {"description": "参数校验失败"}},
)
async def create_item(item: Item):
    item_id = max(items_db) + 1 if items_db else 1
    items_db[item_id] = item
    return item


@router.get(
    "/{item_id}",
    summary="查询单个商品",
    description="按 ID 查询商品，ID 必须为正整数。",
    response_model=Item,
    responses={404: {"description": "商品不存在"}},
)
async def get_item(item_id: Annotated[int, Path(ge=1, description="商品 ID")]):
    if item_id not in items_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    return items_db[item_id]


@router.put(
    "/{item_id}",
    summary="更新商品",
    description="仅更新请求体中传入的字段，未传字段保持不变。",
    response_model=Item,
    responses={404: {"description": "商品不存在"}},
)
async def update_item(
    item_id: Annotated[int, Path(ge=1, description="商品 ID")],
    patch: ItemUpdate,
):
    if item_id not in items_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    updated = items_db[item_id].model_copy(update=patch.model_dump(exclude_unset=True))
    items_db[item_id] = updated
    return updated


@router.delete(
    "/{item_id}",
    summary="删除商品",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "商品不存在"}},
)
async def delete_item(item_id: Annotated[int, Path(ge=1, description="商品 ID")]):
    if item_id not in items_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    del items_db[item_id]

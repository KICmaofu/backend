"""商品接口：演示 Pydantic 校验、统一响应格式与业务异常处理。"""

from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from exceptions import BusinessException
from schemas.items import Item, ItemUpdate
from schemas.response import ApiResponse

router = APIRouter(prefix="/items", tags=["items"])

# 内存存储，仅用于演示，后续可替换为数据库
items_db: dict[int, Item] = {
    1: Item(name="机械键盘", price=299.0, tags=["电子产品", "外设"]),
}


def _get_or_404(item_id: int) -> Item:
    """取出商品，不存在时抛出业务异常，由全局处理器统一转为 404 响应。"""
    if item_id not in items_db:
        raise BusinessException("商品不存在", status_code=status.HTTP_404_NOT_FOUND)
    return items_db[item_id]


@router.get(
    "/",
    summary="查询商品列表",
    description="支持按名称模糊过滤（`q`）与分页（`skip`/`limit`）。",
    response_model=ApiResponse[list[Item]],
)
async def list_items(
    q: Annotated[str | None, Query(max_length=20, description="按名称模糊过滤")] = None,
    skip: Annotated[int, Query(ge=0, description="跳过条数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回条数上限")] = 10,
) -> ApiResponse[list[Item]]:
    result = list(items_db.values())
    if q:
        result = [item for item in result if q in item.name]
    return ApiResponse.ok(data=result[skip : skip + limit])


@router.post(
    "/",
    summary="创建商品",
    description="接收商品 JSON，校验通过后写入内存存储。名称会自动去除首尾空白，标签会去重。",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[Item],
    responses={422: {"description": "请求参数校验失败"}},
)
async def create_item(item: Item) -> ApiResponse[Item]:
    item_id = max(items_db) + 1 if items_db else 1
    items_db[item_id] = item
    return ApiResponse.ok(data=item, message="创建成功")


@router.get(
    "/{item_id}",
    summary="查询单个商品",
    description="按 ID 查询商品，ID 必须为正整数。",
    response_model=ApiResponse[Item],
    responses={404: {"description": "商品不存在"}},
)
async def get_item(item_id: Annotated[int, Path(ge=1, description="商品 ID")]) -> ApiResponse[Item]:
    return ApiResponse.ok(data=_get_or_404(item_id))


@router.put(
    "/{item_id}",
    summary="更新商品",
    description="仅更新请求体中传入的字段，未传字段保持不变；至少需要提交一个字段且不允许为 null。",
    response_model=ApiResponse[Item],
    responses={
        404: {"description": "商品不存在"},
        422: {"description": "请求参数校验失败或未提交任何字段"},
    },
)
async def update_item(
    item_id: Annotated[int, Path(ge=1, description="商品 ID")],
    patch: ItemUpdate,
) -> ApiResponse[Item]:
    current = _get_or_404(item_id)
    updated = current.model_copy(update=patch.model_dump(exclude_unset=True))
    items_db[item_id] = updated
    return ApiResponse.ok(data=updated, message="更新成功")


@router.delete(
    "/{item_id}",
    summary="删除商品",
    description="删除成功后返回统一响应体，因此使用 200 而非 204（204 不允许响应体）。",
    response_model=ApiResponse[None],
    responses={404: {"description": "商品不存在"}},
)
async def delete_item(item_id: Annotated[int, Path(ge=1, description="商品 ID")]) -> ApiResponse[None]:
    _get_or_404(item_id)
    del items_db[item_id]
    return ApiResponse.ok(message="删除成功")

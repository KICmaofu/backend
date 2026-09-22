"""商品接口：演示 SQLAlchemy 异步 ORM 的单表 CRUD。

数据流：请求体经 Pydantic 校验（schemas）→ CRUD 层操作数据库（crud）→
ORM 对象经 from_attributes 转回响应模型；提交/回滚由 database.get_db 依赖统一管理，
路由层只负责编排，不接触提交与回滚细节。
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from crud import item_crud
from database import DbSession
from dependencies import Pagination, get_current_user
from schemas.items import Item, ItemCreate, ItemUpdate
from schemas.response import ApiResponse

router = APIRouter(prefix="/items", tags=["items"])


@router.get(
    "/",
    summary="查询商品列表",
    description="支持按名称模糊过滤（`q`）与分页（`skip`/`limit`）；分页参数由依赖注入统一提供。",
    response_model=ApiResponse[list[Item]],
)
async def list_items(
    session: DbSession,
    pagination: Pagination,
    q: Annotated[str | None, Query(max_length=20, description="按名称模糊过滤")] = None,
) -> ApiResponse[list[Item]]:
    skip, limit = pagination
    items = await item_crud.search(session, q, skip=skip, limit=limit)
    return ApiResponse.ok(data=items)


@router.post(
    "/",
    summary="创建商品",
    description=(
        "接收商品 JSON，校验通过后写入数据库；名称自动去除首尾空白，标签去重。"
        "写操作通过依赖注入鉴权：需携带 `X-Token: secret`。"
    ),
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[Item],
    responses={
        401: {"description": "令牌无效（依赖注入鉴权示例）"},
        422: {"description": "请求参数校验失败"},
    },
    dependencies=[Depends(get_current_user)],
)
async def create_item(session: DbSession, payload: ItemCreate) -> ApiResponse[Item]:
    item = await item_crud.create(session, payload)
    return ApiResponse.ok(data=item, message="创建成功")


@router.get(
    "/{item_id}",
    summary="查询单个商品",
    description="按 ID 查询商品，ID 必须为正整数。",
    response_model=ApiResponse[Item],
    responses={404: {"description": "商品不存在"}},
)
async def get_item(
    session: DbSession, item_id: Annotated[int, Path(ge=1, description="商品 ID")]
) -> ApiResponse[Item]:
    return ApiResponse.ok(data=await item_crud.get_or_404(session, item_id))


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
    session: DbSession,
    item_id: Annotated[int, Path(ge=1, description="商品 ID")],
    patch: ItemUpdate,
) -> ApiResponse[Item]:
    item = await item_crud.update(session, item_id, patch)
    return ApiResponse.ok(data=item, message="更新成功")


@router.delete(
    "/{item_id}",
    summary="删除商品",
    description="删除成功后返回统一响应体，因此使用 200 而非 204（204 不允许响应体）。",
    response_model=ApiResponse[None],
    responses={404: {"description": "商品不存在"}},
)
async def delete_item(
    session: DbSession, item_id: Annotated[int, Path(ge=1, description="商品 ID")]
) -> ApiResponse[None]:
    await item_crud.delete(session, item_id)
    return ApiResponse.ok(message="删除成功")

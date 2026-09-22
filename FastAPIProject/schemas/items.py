"""商品相关的 Pydantic 模型：请求/响应的结构定义，与 ORM 实体（models.Item）分层解耦。

分层职责：
- schemas（本文件）：入参校验与出参序列化，面向 HTTP 边界；
- models：数据库表结构映射，面向持久化；
- 两者通过 Item 响应模型的 from_attributes 衔接：可直接由 ORM 对象构造，路由层无需手写转换。
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _clean_name(value: str) -> str:
    """去除名称首尾空白；"   " 这类纯空白名称视为非法。"""
    value = value.strip()
    if not value:
        raise ValueError("商品名称不能为纯空白")
    return value


def _clean_tags(value: list[str]) -> list[str]:
    """去除空白标签并按首次出现的顺序去重。"""
    return list(dict.fromkeys(tag.strip() for tag in value if tag.strip()))


class ItemBase(BaseModel):
    """商品公共字段：创建入参与响应模型共用，避免同一组字段多处重复定义。"""

    name: str = Field(min_length=1, max_length=50, description="商品名称", examples=["无线鼠标"])
    price: float = Field(gt=0, description="单价，必须大于 0", examples=[99.9])
    tags: list[str] = Field(default_factory=list, description="标签列表", examples=[["电子产品", "外设"]])

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        return _clean_tags(value)


class ItemCreate(ItemBase):
    """创建商品入参：字段与 ItemBase 一致，语义上作为创建接口的请求体。"""


class ItemUpdate(BaseModel):
    """商品更新模型：所有字段选填，仅更新传入的字段"""

    name: str | None = Field(default=None, min_length=1, max_length=50, description="商品名称")
    price: float | None = Field(default=None, gt=0, description="单价，必须大于 0")
    tags: list[str] | None = Field(default=None, description="标签列表")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return None if value is None else _clean_name(value)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _clean_tags(value)

    @model_validator(mode="after")
    def validate_patch(self) -> "ItemUpdate":
        """至少提交一个字段，且显式传入的字段不允许为 null（避免把已有字段置空）。"""
        if not self.model_fields_set:
            raise ValueError("至少需要提交一个待更新字段")
        null_fields = sorted(field for field in self.model_fields_set if getattr(self, field) is None)
        if null_fields:
            raise ValueError(f"字段不允许为 null：{', '.join(null_fields)}")
        return self


class Item(ItemBase):
    """商品响应模型：在公共字段基础上补充数据库生成的只读字段。

    from_attributes=True：允许由 ORM 对象（models.Item）直接构造，
    配合 response_model 自动完成 ORM 对象 → JSON 的序列化。
    """

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="主键，数据库自增")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")

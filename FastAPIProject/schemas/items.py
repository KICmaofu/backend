"""商品相关的 Pydantic 模型：请求体的校验规则集中定义在此。"""

from pydantic import BaseModel, Field, field_validator, model_validator


def _clean_name(value: str) -> str:
    """去除名称首尾空白；"   " 这类纯空白名称视为非法。"""
    value = value.strip()
    if not value:
        raise ValueError("商品名称不能为纯空白")
    return value


def _clean_tags(value: list[str]) -> list[str]:
    """去除空白标签并按首次出现的顺序去重。"""
    return list(dict.fromkeys(tag.strip() for tag in value if tag.strip()))


class Item(BaseModel):
    """商品模型"""

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

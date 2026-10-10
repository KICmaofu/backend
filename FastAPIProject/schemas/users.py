"""用户相关的 Pydantic 模型：请求/响应的结构定义，与 ORM 实体（models.User）分层解耦。

与 schemas.items 同构：UserBase 承载公共字段，UserCreate 作为创建入参，
UserUpdate 全选填（至少提交一个字段且不允许 null），User 响应模型经 from_attributes
由 ORM 对象直接构造。email 用正则做轻量格式校验（环境未装 email-validator，
避免为单一字段引入依赖；需要更严格校验时改用 EmailStr）。
"""

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# 轻量邮箱格式校验：前缀@域名.后缀，域名与后缀不含空白与 @
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_username(value: str) -> str:
    """去除用户名首尾空白；"   " 这类纯空白名称视为非法。"""
    value = value.strip()
    if not value:
        raise ValueError("用户名不能为纯空白")
    return value


def _clean_email(value: str) -> str:
    """去空白并统一小写（邮箱大小写不敏感），校验基本格式。"""
    value = value.strip().lower()
    if not _EMAIL_RE.fullmatch(value):
        raise ValueError("邮箱格式不正确")
    return value


class UserBase(BaseModel):
    """用户公共字段：创建入参与响应模型共用。"""

    username: str = Field(min_length=1, max_length=50, description="用户名", examples=["alice"])
    email: str = Field(max_length=100, description="邮箱，唯一", examples=["alice@example.com"])
    is_active: bool = Field(default=True, description="是否启用")

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return _clean_username(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _clean_email(value)


class UserCreate(UserBase):
    """创建用户入参：公共字段之外必须提供密码（注册/创建共用）。

    密码只在入参出现：入库前由 service 层哈希为 password_hash，
    响应模型（User）不包含任何密码相关字段，永不对客户端返回。
    """

    password: str = Field(
        min_length=8,  # 最低强度要求
        max_length=72,  # bcrypt 只处理前 72 字节，更长的部分被静默截断
        description="密码，8-72 个字符",
        examples=["secret123"],
    )


class UserUpdate(BaseModel):
    """用户更新模型：所有字段选填，仅更新传入的字段。"""

    username: str | None = Field(default=None, min_length=1, max_length=50, description="用户名")
    email: str | None = Field(default=None, max_length=100, description="邮箱，唯一")
    is_active: bool | None = Field(default=None, description="是否启用")

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str | None) -> str | None:
        return None if value is None else _clean_username(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return None if value is None else _clean_email(value)

    @model_validator(mode="after")
    def validate_patch(self) -> "UserUpdate":
        """至少提交一个字段，且显式传入的字段不允许为 null（避免把已有字段置空）。"""
        if not self.model_fields_set:
            raise ValueError("至少需要提交一个待更新字段")
        null_fields = sorted(field for field in self.model_fields_set if getattr(self, field) is None)
        if null_fields:
            raise ValueError(f"字段不允许为 null：{', '.join(null_fields)}")
        return self


class User(UserBase):
    """用户响应模型：在公共字段基础上补充数据库生成的只读字段。"""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="主键，数据库自增")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")

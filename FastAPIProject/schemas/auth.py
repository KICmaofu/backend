"""认证相关的 Pydantic 模型：注册/登录入参与令牌响应结构。

与 schemas.users 的关系：
- UserRegister 继承 UserCreate（复用字段与校验规则），注册本质上是「创建用户」，
  走同一条 service → dao 链路，避免两套创建逻辑；
- 登录入参与注册入参不同：登录只需 username + password（邮箱可作为后续扩展）；
- Token 是令牌响应模型，由 service 层签发后经 ApiResponse[Token] 包装返回。
"""

from pydantic import BaseModel, Field

from schemas.users import UserCreate


class UserRegister(UserCreate):
    """注册入参：与创建用户字段一致（username/email/password），语义上作为注册接口请求体。"""


class UserLogin(BaseModel):
    """登录入参：用户名 + 密码。"""

    username: str = Field(min_length=1, max_length=50, description="用户名", examples=["alice"])
    password: str = Field(min_length=1, max_length=72, description="密码", examples=["secret123"])


class Token(BaseModel):
    """令牌响应模型：access_token 为 JWT 字符串，token_type 按惯例固定为 bearer。"""

    access_token: str = Field(description="访问令牌（JWT），后续请求放入 Authorization 头")
    token_type: str = Field(default="bearer", description="令牌类型")

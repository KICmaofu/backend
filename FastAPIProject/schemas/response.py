"""统一响应模型：所有接口（含异常响应）使用同一结构，便于前端统一处理。"""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一响应格式。

    - 成功时 code=0；失败时为对应的 HTTP 状态码（如 404、422、500），
      后续如需细分业务码（如 10001 余额不足），可在此基础上扩展 code 字段的取值约定。
    - data 承载业务数据；失败时可为 None，校验错误时会放入错误详情列表。
    """

    code: int = Field(default=0, description="业务状态码，0 表示成功")
    message: str = Field(default="success", description="提示信息")
    data: T | None = Field(default=None, description="业务数据")

    @classmethod
    def ok(cls, data: T | None = None, message: str = "success") -> "ApiResponse[T]":
        """构造成功响应，路由中直接 return ApiResponse.ok(data=...) 即可。"""
        return cls(code=0, message=message, data=data)

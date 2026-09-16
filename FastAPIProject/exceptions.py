"""全局异常处理：将各类异常统一转换为 ApiResponse 结构，避免错误响应格式不一致。"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from schemas.response import ApiResponse

logger = logging.getLogger(__name__)


class BusinessException(Exception):
    """业务异常：业务规则不满足时在任意层抛出，由全局处理器统一转换。

    用法：raise BusinessException("商品不存在", status_code=status.HTTP_404_NOT_FOUND)
    """

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    """在应用实例上注册全局异常处理器，应在创建 app 后尽早调用。"""

    @app.exception_handler(BusinessException)
    async def business_exception_handler(request: Request, exc: BusinessException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder(ApiResponse(code=exc.status_code, message=exc.message)),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Pydantic 请求校验失败：提取「字段 -> 原因」，仍返回 422。"""
        errors = [
            {
                "field": ".".join(str(part) for part in error["loc"]) or "body",
                "message": error["msg"],
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=jsonable_encoder(ApiResponse(code=422, message="请求参数校验失败", data=errors)),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        """FastAPI/Starlette 抛出的 HTTPException（如路由 404、405）统一为同一结构。"""
        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder(ApiResponse(code=exc.status_code, message=str(exc.detail))),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """兜底：未预期的异常不向客户端暴露细节，记录日志后返回统一的 500 响应。"""
        logger.error("未处理的异常：%s %s", request.method, request.url.path, exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=jsonable_encoder(ApiResponse(code=500, message="服务器内部错误")),
        )

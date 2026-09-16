from fastapi import FastAPI

from exceptions import register_exception_handlers
from routers import items
from schemas.response import ApiResponse

app = FastAPI(
    title="FastAPIProject API",
    description="演示路由定义、参数自动解析、Swagger 自动文档生成、统一响应格式与全局异常处理。",
    version="1.0.0",
    # 在文档中为所有接口补充 500 兜底响应说明
    responses={500: {"description": "服务器内部错误（未捕获异常的兜底响应）"}},
)

# 注册全局异常处理器：业务异常、请求校验失败、HTTP 异常、未知异常兜底
register_exception_handlers(app)


@app.get("/", tags=["default"], summary="健康检查", response_model=ApiResponse[dict[str, str]])
async def root() -> ApiResponse[dict[str, str]]:
    return ApiResponse.ok(data={"message": "Hello World"})


@app.get("/hello/{name}", tags=["default"], summary="打招呼", response_model=ApiResponse[dict[str, str]])
async def say_hello(name: str) -> ApiResponse[dict[str, str]]:
    return ApiResponse.ok(data={"message": f"Hello {name}"})


# 注册业务路由：接口在 Swagger 中会按 tags 分组展示
app.include_router(items.router)

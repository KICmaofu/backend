import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from exceptions import register_exception_handlers
from routers import items
from schemas.response import ApiResponse

app = FastAPI(
    title="FastAPIProject API",
    description="演示路由定义、参数自动解析、Swagger 自动文档生成、统一响应格式、全局异常处理、依赖注入、中间件与 CORS 跨域配置。",
    version="1.0.0",
    # 在文档中为所有接口补充 500 兜底响应说明
    responses={500: {"description": "服务器内部错误（未捕获异常的兜底响应）"}},
)

# 注册全局异常处理器：业务异常、请求校验失败、HTTP 异常、未知异常兜底
register_exception_handlers(app)

# CORS 跨域配置：浏览器前端访问后端时的通行证（协议/域名/端口任一不同即为跨域）。
# - 简单请求：响应自动补 Access-Control-Allow-Origin 头；
# - 带自定义头（如 X-Token）或 JSON 的请求会先发 OPTIONS 预检，由该中间件直接应答、不进入路由；
# - allow_credentials=True 时不能用 "*" 通配源（浏览器规范限制），应列出具体源或用 allow_origin_regex。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 前端开发服务器地址，按需增删
    allow_credentials=True,  # 允许携带 Cookie / Authorization
    allow_methods=["*"],  # 允许的请求方法
    allow_headers=["*"],  # 允许的请求头（含 X-Token）
)

# 中间件按「洋葱模型」生效：后注册的在更外层，请求先经过外层、响应最后离开外层。
# 计时中间件：请求进入时打点，响应返回前写入耗时头，对所有接口生效。
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{time.perf_counter() - start:.4f}"
    return response


@app.get("/", tags=["default"], summary="健康检查", response_model=ApiResponse[dict[str, str]])
async def root() -> ApiResponse[dict[str, str]]:
    return ApiResponse.ok(data={"message": "Hello World"})


@app.get("/hello/{name}", tags=["default"], summary="打招呼", response_model=ApiResponse[dict[str, str]])
async def say_hello(name: str) -> ApiResponse[dict[str, str]]:
    return ApiResponse.ok(data={"message": f"Hello {name}"})


# 注册业务路由：接口在 Swagger 中会按 tags 分组展示
app.include_router(items.router)

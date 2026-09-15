from fastapi import FastAPI

from routers import items

app = FastAPI(
    title="FastAPIProject API",
    description="演示路由定义、参数自动解析与 Swagger 自动文档生成。",
    version="1.0.0",
)


@app.get("/", tags=["default"])
async def root():
    return {"message": "Hello World"}


@app.get("/hello/{name}", tags=["default"])
async def say_hello(name: str):
    return {"message": f"Hello {name}"}


# 注册业务路由：接口在 Swagger 中会按 tags 分组展示
app.include_router(items.router)

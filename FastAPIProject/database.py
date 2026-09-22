"""数据库接入层：异步引擎、会话工厂与请求级会话依赖。

技术选型：
- 数据库：PostgreSQL 18，驱动 asyncpg（官方推荐的异步驱动，连接池高效）；
- ORM：SQLAlchemy 2.0 异步风格（create_async_engine + AsyncSession），全程不阻塞事件循环；
- 表结构：开发阶段用 create_all 自动建表，生产环境应改用 Alembic 做版本化迁移。

会话管理约定（与全局异常处理的配合）：
- get_db 是 yield 依赖：路由正常返回 → 自动 commit；抛异常 → 自动 rollback；
  无论成败，响应后都会关闭会话，因此路由层无需（也不应）手动提交/回滚；
- BusinessException（如「商品不存在」）同样触发 rollback，并由全局处理器转为统一 JSON，
  业务校验失败不会留下半截事务。
"""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# 连接串：数据库名/账号信息集中在此，后续可迁移到环境变量或配置文件
DATABASE_URL = "postgresql+asyncpg://postgres:12305@localhost:5432/fastapi_project"

engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=False,  # 置 True 可打印每条执行的 SQL，便于调试
    pool_pre_ping=True,  # 取出连接前先探活，避免拿到已被服务端断开的连接
)

# 会话工厂：async_sessionmaker 是 AsyncSession 的「工厂」，每次调用产出独立会话
# expire_on_commit=False：commit 后对象属性不过期，响应序列化阶段仍可直接读取
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    """所有 ORM 实体的共同基类：实体继承它即被注册到 metadata，create_all 据此建表。"""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """请求级数据库会话依赖（yield 依赖）。

    - 进入：开启新会话（懒连接，首个 SQL 时才真正从连接池取连接）；
    - 正常退出：统一 commit，把路由中累积的增删改落库；
    - 异常退出：统一 rollback，丢弃本次请求的全部未提交变更；
    - 无论成败：async with 退出时关闭会话，连接归还连接池。
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Annotated 别名：路由签名写 `session: DbSession` 即可注入请求级会话（与 dependencies.Pagination 同风格）
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def ensure_database_exists() -> None:
    """目标数据库不存在时自动创建：连接 PG 自带的 postgres 库执行 CREATE DATABASE。

    create_all 只会建表不会建库；本函数让「PG 装好即可直接启动」成为可能。
    admin_engine 以 AUTOCOMMIT 模式连接，因为 CREATE DATABASE 不允许在事务块内执行。
    """
    url = make_url(DATABASE_URL)
    target_db = url.database
    admin_engine = create_async_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        async with admin_engine.connect() as conn:
            exists = (await conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target_db}
            )).scalar()
            if not exists:
                # 数据库名是标识符，无法参数化；名称来自本文件配置而非用户输入，直接拼接安全
                await conn.execute(text(f'CREATE DATABASE "{target_db}"'))
    finally:
        await admin_engine.dispose()


async def init_db() -> None:
    """应用启动时调用（见 main.py 的 lifespan）：确保数据库存在，并创建所有声明过的表。"""
    await ensure_database_exists()
    import models  # noqa: F401  函数内导入，确保实体类已注册到 Base.metadata 且避免循环导入

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

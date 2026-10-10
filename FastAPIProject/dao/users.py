"""用户 DAO：通用增删改查之外，补充按关键字搜索、按用户名查询与唯一约束冲突转换。

username/email 的唯一性由数据库唯一约束保证（而非先查后插，后者存在竞态）：
flush 触发 IntegrityError 时统一转为 409 业务异常，get_db 依赖会自动 rollback 失败事务。
密码哈希的生成属于 service 层职责（见 security.hash_password），本层只负责把
service 传入的 password_hash 原样写入。
"""

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from dao.base import BaseDAO
from exceptions import BusinessException
from models import User
from schemas.users import UserCreate, UserUpdate


class UserDAO(BaseDAO[User, UserCreate, UserUpdate]):
    """用户数据访问：通用 CRUD 之外，补充关键字搜索、按用户名查询与唯一约束冲突转换。"""

    model = User

    async def create(self, session: AsyncSession, data: UserCreate, password_hash: str) -> User:
        """创建用户；password 在 service 层哈希后以 password_hash 传入，撞唯一约束时抛 409。"""
        try:
            obj = User(**data.model_dump(exclude={"password"}), password_hash=password_hash)
            session.add(obj)
            await session.flush()
            return obj
        except IntegrityError as exc:
            raise BusinessException(
                "用户名或邮箱已存在", status_code=status.HTTP_409_CONFLICT
            ) from exc

    async def get_by_username(self, session: AsyncSession, username: str) -> User | None:
        """按用户名精确查询（登录校验用）；不存在返回 None，由 service 层转 401。"""
        stmt = select(User).where(User.username == username)
        return (await session.scalars(stmt)).first()

    async def update(self, session: AsyncSession, entity_id: int, patch: UserUpdate) -> User:
        """更新用户；改出的 username/email 撞唯一约束时抛 409。"""
        try:
            return await super().update(session, entity_id, patch)
        except IntegrityError as exc:
            raise BusinessException(
                "用户名或邮箱已存在", status_code=status.HTTP_409_CONFLICT
            ) from exc

    async def search(
        self,
        session: AsyncSession,
        q: str | None = None,
        *,
        skip: int = 0,
        limit: int | None = None,
    ) -> list[User]:
        """按用户名或邮箱模糊过滤的分页查询（OR 条件）。"""
        stmt = select(User)
        if q:
            pattern = f"%{q}%"
            stmt = stmt.where(User.username.ilike(pattern) | User.email.ilike(pattern))
        stmt = stmt.order_by(User.id).offset(skip)
        if limit is not None:
            stmt = stmt.limit(limit)
        return list((await session.scalars(stmt)).all())

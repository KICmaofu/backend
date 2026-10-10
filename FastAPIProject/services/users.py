"""用户服务层：用户相关的业务规则与编排（含注册/登录认证）。

唯一性冲突（409）由 DAO 层在 flush 时捕获 IntegrityError 统一转换，
本层无需重复处理；密码哈希与 JWT 签发调用 security 的无状态原语，
认证失败（用户名不存在/密码错误/账号禁用）在本层统一转 401/403 业务异常。
"""

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from dao import user_dao
from exceptions import BusinessException
from models import User
from schemas.auth import Token, UserLogin, UserRegister
from schemas.users import UserCreate, UserUpdate
from security import create_access_token, hash_password, verify_password


class UserService:
    """用户业务服务：对 controller 暴露业务动词，对下编排 DAO。"""

    async def search(
        self,
        session: AsyncSession,
        q: str | None = None,
        *,
        skip: int = 0,
        limit: int | None = None,
    ) -> list[User]:
        """按用户名或邮箱模糊过滤的分页查询。"""
        return await user_dao.search(session, q, skip=skip, limit=limit)

    async def get(self, session: AsyncSession, user_id: int) -> User:
        """按 ID 查询，不存在抛 404（由 DAO 层统一转换）。"""
        return await user_dao.get_or_404(session, user_id)

    async def create(self, session: AsyncSession, data: UserCreate) -> User:
        """创建用户：密码入库前哈希为 bcrypt 摘要；username/email 撞唯一约束时由 DAO 层转 409。"""
        return await user_dao.create(session, data, hash_password(data.password))

    async def register(self, session: AsyncSession, data: UserRegister) -> User:
        """注册用户：与创建同一条链路（UserRegister 继承 UserCreate），语义上单独成方法。"""
        return await self.create(session, data)

    async def authenticate(self, session: AsyncSession, data: UserLogin) -> User:
        """校验用户名与密码，通过返回用户实体。

        用户不存在与密码错误返回同一提示（不暴露「哪个错了」，防用户名枚举）；
        密码比对用 constant-time 的 bcrypt.checkpw，无明文对比。
        """
        user = await user_dao.get_by_username(session, data.username)
        if user is None or not verify_password(data.password, user.password_hash):
            raise BusinessException("用户名或密码错误", status_code=status.HTTP_401_UNAUTHORIZED)
        return user

    async def login(self, session: AsyncSession, data: UserLogin) -> Token:
        """登录：认证通过且账号启用后签发 JWT；被禁用账号拒绝登录（403）。"""
        user = await self.authenticate(session, data)
        if not user.is_active:
            raise BusinessException("账号已禁用", status_code=status.HTTP_403_FORBIDDEN)
        return Token(access_token=create_access_token(user.id, user.username))

    async def update(self, session: AsyncSession, user_id: int, patch: UserUpdate) -> User:
        """更新用户：只更新显式传入的字段。"""
        return await user_dao.update(session, user_id, patch)

    async def delete(self, session: AsyncSession, user_id: int) -> None:
        """删除用户。"""
        await user_dao.delete(session, user_id)

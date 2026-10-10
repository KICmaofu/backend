"""安全基础设施：密码哈希与 JWT 令牌的签发/校验。

技术选型：
- 密码哈希：bcrypt（自动加盐 + 内置迭代成本因子，单向不可逆）；
- JWT：PyJWT + HS256（对称签名，签名与校验共用同一密钥）。

分层边界：本模块只提供「无状态原语」，不接触数据库与 HTTP——
- 密码哈希的调用时机（注册/登录）由 service 层编排；
- 令牌解析后的用户加载由 dependencies.get_current_user 负责；
- 令牌验证失败统一转 BusinessException(401)，由全局异常处理器转统一响应。
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import status

from exceptions import BusinessException

# 演示项目硬编码；生产环境必须改由环境变量/密钥管理服务注入，且定期轮换
SECRET_KEY = "dev-only-secret-key-change-me-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 令牌有效期（分钟）

# 令牌携带的用户标识字段：sub 存用户主键（字符串），username 便于日志排查
_TOKEN_SUB = "sub"
_TOKEN_USERNAME = "username"


def hash_password(password: str) -> str:
    """对明文密码做 bcrypt 哈希，返回可直接入库的哈希字符串。

    bcrypt 只处理前 72 字节，超长密码在 schema 层已限制（max_length=72）。
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """校验明文密码与库中哈希是否匹配（登录时使用）。"""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # 库中哈希格式损坏时 checkpw 抛 ValueError，视为不匹配而非 500
        return False


def create_access_token(user_id: int, username: str) -> str:
    """为指定用户签发访问令牌（含过期时间 exp）。"""
    now = datetime.now(timezone.utc)
    payload = {
        _TOKEN_SUB: str(user_id),
        _TOKEN_USERNAME: username,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """校验并解码访问令牌，返回 payload；签名错误/过期/格式非法统一抛 401。"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise BusinessException("令牌无效或已过期", status_code=status.HTTP_401_UNAUTHORIZED) from exc

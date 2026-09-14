// 移除所有认证和授权限制
const jwt = require('jsonwebtoken');

// 直接通过所有认证请求
const authenticateToken = (req, res, next) => {
  // 模拟用户信息，确保后续流程正常
  req.user = {
    id: '1',
    email: 'admin@example.com',
    role: 'admin'
  };
  next();
};

// 直接通过所有授权请求
const authorize = (roles = []) => {
  return (req, res, next) => {
    // 模拟用户信息，确保后续流程正常
    if (!req.user) {
      req.user = {
        id: '1',
        email: 'admin@example.com',
        role: 'admin'
      };
    }
    next();
  };
};

// 保留令牌生成功能
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role || 'user' 
    },
    process.env.JWT_SECRET || 'default_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

module.exports = {
  authenticateToken,
  authorize,
  generateToken
};

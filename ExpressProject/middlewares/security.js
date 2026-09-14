// 移除所有安全限制
const securityMiddleware = (app) => {
  // 移除所有安全头设置
  
  // 移除所有速率限制
  
  // 移除所有自定义安全头
  
  // 保留并增强CORS配置，确保完全开放
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Real-IP');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    next();
  });
};

module.exports = securityMiddleware;
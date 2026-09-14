// 移除所有缓存限制

// 直接通过所有请求，不进行任何缓存
const cacheMiddleware = (ttl = 3600) => {
  return async (req, res, next) => {
    // 直接通过，不进行任何缓存操作
    next();
  };
};

// 保留缓存清理功能，但实际上不执行任何操作
const clearCache = (pattern) => {
  return Promise.resolve(true);
};

const clearApiCache = () => {
  return Promise.resolve(true);
};

module.exports = {
  cacheMiddleware,
  clearCache,
  clearApiCache
};
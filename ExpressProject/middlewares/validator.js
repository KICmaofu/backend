// 移除所有验证限制

// 直接通过所有请求体验证
const validateRequest = (schema) => {
  return (req, res, next) => {
    // 直接通过，不进行任何验证
    next();
  };
};

// 直接通过所有查询参数验证
const validateQuery = (schema) => {
  return (req, res, next) => {
    // 直接通过，不进行任何验证
    next();
  };
};

module.exports = {
  validateRequest,
  validateQuery
};
const winston = require('../config/logger');

// 自定义错误类
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

// API处理中间件
const apiHandler = (handler) => {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res, next);
      if (result !== undefined) {
        res.json({
          success: true,
          code: 200,
          message: '操作成功',
          data: result,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      // 记录错误详情
      winston.error('API处理错误:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        params: req.params,
        query: req.query,
        body: req.body
      });
      
      // 处理不同类型的错误
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          code: error.statusCode,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString()
        });
      }
      
      // 处理Joi验证错误
      if (error.isJoi) {
        const details = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        return res.status(400).json({
          success: false,
          code: 400,
          message: '请求数据验证失败',
          details: details,
          timestamp: new Date().toISOString()
        });
      }
      
      // 处理数据库错误
      if (error.code && error.code.startsWith('ER_')) {
        winston.error('数据库错误:', {
          errorCode: error.code,
          sqlMessage: error.sqlMessage,
          sql: error.sql
        });
        return res.status(500).json({
          success: false,
          code: 500,
          message: '数据库操作失败',
          timestamp: new Date().toISOString()
        });
      }
      
      // 默认错误处理
      res.status(500).json({
        success: false,
        code: 500,
        message: '服务器内部错误',
        timestamp: new Date().toISOString()
      });
    }
  };
};

// 全局错误处理中间件
const apiErrorHandler = (err, req, res, next) => {
  // 记录错误详情
  winston.error('API错误处理:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    status: err.status
  });
  
  // 处理不同类型的错误
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.statusCode,
      message: err.message,
      details: err.details,
      timestamp: new Date().toISOString()
    });
  }
  
  // 处理404错误
  if (err.status === 404) {
    return res.status(404).json({
      success: false,
      code: 404,
      message: '请求的资源不存在',
      timestamp: new Date().toISOString()
    });
  }
  
  // 处理401错误
  if (err.status === 401) {
    return res.status(401).json({
      success: false,
      code: 401,
      message: '未授权访问',
      timestamp: new Date().toISOString()
    });
  }
  
  // 处理403错误
  if (err.status === 403) {
    return res.status(403).json({
      success: false,
      code: 403,
      message: '权限不足',
      timestamp: new Date().toISOString()
    });
  }
  
  // 默认错误处理
  res.status(err.status || 500).json({
    success: false,
    code: err.status || 500,
    message: err.message || '服务器内部错误',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  apiHandler,
  apiErrorHandler,
  ApiError
};
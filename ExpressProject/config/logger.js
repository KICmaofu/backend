const winston = require('winston');
const path = require('path');
const logDir = path.join(__dirname, '../logs');
const fs = require('fs');

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['timestamp', 'service', 'level', 'message']
  }),
  winston.format.json()
);

// 控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, metadata }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    if (metadata && Object.keys(metadata).length > 0) {
      logMessage += ` ${JSON.stringify(metadata)}`;
    }
    return logMessage;
  })
);

// 创建日志记录器
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'ai-project' },
  transports: [
    // 错误日志
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
      zippedArchive: true
    }),
    // 警告日志
    new winston.transports.File({
      filename: path.join(logDir, 'warn.log'),
      level: 'warn',
      maxsize: 5242880,
      maxFiles: 5,
      tailable: true,
      zippedArchive: true
    }),
    // 信息日志
    new winston.transports.File({
      filename: path.join(logDir, 'info.log'),
      level: 'info',
      maxsize: 5242880,
      maxFiles: 5,
      tailable: true,
      zippedArchive: true
    }),
    // 综合日志
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true,
      zippedArchive: true
    })
  ]
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 扩展logger，添加更多方法
logger.infoWithCtx = (message, context = {}) => {
  logger.info(message, { ...context });
};

logger.errorWithCtx = (message, error, context = {}) => {
  logger.error(message, {
    ...context,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    }
  });
};

logger.warnWithCtx = (message, context = {}) => {
  logger.warn(message, { ...context });
};

logger.debugWithCtx = (message, context = {}) => {
  logger.debug(message, { ...context });
};

module.exports = logger;
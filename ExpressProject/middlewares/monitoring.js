const winston = require('../config/logger');
const os = require('os');

const monitoringMiddleware = (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(body) {
    const end = Date.now();
    const responseTime = end - start;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = os.loadavg();
    
    const monitoringData = {
      path: req.path,
      method: req.method,
      status: res.statusCode,
      responseTime: responseTime,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100
      },
      cpu: {
        '1min': cpuUsage[0],
        '5min': cpuUsage[1],
        '15min': cpuUsage[2]
      },
      timestamp: new Date().toISOString()
    };
    
    if (responseTime > 1000) {
      winston.warn('API响应时间过长:', monitoringData);
    } else {
      winston.debug('API请求监控:', monitoringData);
    }
    
    if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.8) {
    }
    
    if (cpuUsage[0] > 1.0) {
      winston.warn('CPU负载过高:', {
        '1min': cpuUsage[0],
        '5min': cpuUsage[1],
        '15min': cpuUsage[2]
      });
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

const getSystemStatus = () => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = os.loadavg();
  const uptime = process.uptime();
  
  return {
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    },
    cpu: {
      '1min': cpuUsage[0],
      '5min': cpuUsage[1],
      '15min': cpuUsage[2]
    },
    uptime: {
      seconds: Math.round(uptime),
      formatted: formatUptime(uptime)
    },
    os: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 * 100) / 100,
      freeMemory: Math.round(os.freemem() / 1024 / 1024 * 100) / 100
    }
  };
};

const formatUptime = (uptime) => {
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
};

module.exports = {
  monitoringMiddleware,
  getSystemStatus
};
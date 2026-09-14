const net = require('net');
require('dotenv').config();
const winston = require('../config/logger');
const dataProcessor = require('./data-processor');
const pako = require('pako');
const zlib = require('zlib');
const PORT=process.env.SOCKET_PORT || 8888;
const HOST=process.env.SOCKET_HOST || '0.0.0.0';
const SOCKET_TIMEOUT = parseInt(process.env.SOCKET_TIMEOUT) || 300000;
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS) || 1000;
const clients = new Map();
let clientIdCounter = 0;
// 连接池
const connectionPool = {
  activeConnections: 0,
  maxConnections: MAX_CONNECTIONS,
  connectionStats: {
    totalConnections: 0,
    failedConnections: 0,
    closedConnections: 0,
    peakConnections: 0
  },
  connectionGroups: {
    highPriority: [],
    normalPriority: [],
    lowPriority: []
  },
  getConnectionCount() {
    return this.activeConnections;
  },
  getAvailableSlots() {
    return this.maxConnections - this.activeConnections;
  },
  isFull() {
    return this.activeConnections >= this.maxConnections;
  },
  updatePeakConnections() {
    if (this.activeConnections > this.connectionStats.peakConnections) {
      this.connectionStats.peakConnections = this.activeConnections;
    }
  }
};
const BATCH_PROCESSING_ENABLED = process.env.BATCH_PROCESSING_ENABLED === 'true' || false;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 10;
const COMPRESSION_ENABLED = process.env.COMPRESSION_ENABLED === 'true' || false;
const ERROR_RETRY_LIMIT = parseInt(process.env.ERROR_RETRY_LIMIT) || 3;
const ERROR_RETRY_DELAY = parseInt(process.env.ERROR_RETRY_DELAY) || 1000;
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL) || 30000;
const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT) || 90000;
const clientBatches = new Map();
const clientErrors = new Map();
const clientHeartbeats = new Map();
// 性能指标
const performanceMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDataReceived: 0,
  totalDataSent: 0,
  avgResponseTime: 0,
  responseTimes: [],
  startTime: Date.now()
};
// 性能指标记录
const METRICS_INTERVAL = 60000;
// 数据压缩
function compressData(data) {
  try {
    if (typeof data === 'string') {
      data = Buffer.from(data, 'utf8');
    }
    return zlib.gzipSync(data);
  } catch (error) {
    logger.error('数据压缩失败', { error: error.message });
    return data;
  }
}
// 数据解压
function decompressData(data) {
  try {
    return zlib.gunzipSync(data).toString('utf8');
  } catch (error) {
    logger.error('数据解压失败', { error: error.message });
    return data.toString('utf8');
  }
}
// 发送心跳
function sendHeartbeat(clientId, clientData) {
  try {
    if (clientData && clientData.socket && !clientData.socket.destroyed) {
      clientData.socket.write('PING\n');
      clientHeartbeats.set(clientId, {
        lastSent: new Date(),
        lastReceived: clientHeartbeats.get(clientId)?.lastReceived || new Date()
      });
      logger.debug(`发送心跳到客户端 #${clientId}`, { clientInfo: clientData.clientInfo });
    }
  } catch (error) {
    logger.error(`发送心跳到客户端 #${clientId} 失败`, { error: error.message });
  }
}
// 检查心跳超时
function checkHeartbeatTimeouts() {
  const now = new Date();
  clientHeartbeats.forEach((heartbeat, clientId) => {
    const clientData = clients.get(clientId);
    if (clientData && clientData.socket) {
      const timeSinceLastReceived = now - heartbeat.lastReceived;
      if (timeSinceLastReceived > HEARTBEAT_TIMEOUT) {
        logger.warn(`客户端 #${clientId} 心跳超时，断开连接`, {
          clientInfo: clientData.clientInfo,
          timeSinceLastReceived
        });
        clientData.socket.end();
      }
    } else {
      clientHeartbeats.delete(clientId);
    }
  });
}
// 处理心跳响应
function handleHeartbeatResponse(clientId) {
  clientHeartbeats.set(clientId, {
    ...clientHeartbeats.get(clientId),
    lastReceived: new Date()
  });
  logger.debug(`收到客户端 #${clientId} 的心跳响应`);
}
// 记录性能指标
function recordPerformanceMetrics(startTime, success, dataReceived, dataSent) {
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  performanceMetrics.totalRequests++;
  performanceMetrics.totalDataReceived += dataReceived;
  performanceMetrics.totalDataSent += dataSent;
  performanceMetrics.responseTimes.push(responseTime);
  
  if (performanceMetrics.responseTimes.length > 100) {
    performanceMetrics.responseTimes.shift();
  }
  
  if (success) {
    performanceMetrics.successfulRequests++;
  } else {
    performanceMetrics.failedRequests++;
  }
  
  performanceMetrics.avgResponseTime = performanceMetrics.responseTimes.reduce((sum, time) => sum + time, 0) / performanceMetrics.responseTimes.length;
}
//记录性能指标
function logPerformanceMetrics() {
  const uptime = Math.floor((Date.now() - performanceMetrics.startTime) / 1000);
  const requestsPerSecond = performanceMetrics.totalRequests / uptime;
  const successRate = performanceMetrics.totalRequests > 0 ? (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100 : 0;

  logger.info('='.repeat(80));
  logger.info('性能监控指标');
  logger.info('='.repeat(80));
  logger.info(`服务器运行时间: ${uptime} 秒`);
  logger.info(`总请求数: ${performanceMetrics.totalRequests}`);
  logger.info(`成功请求数: ${performanceMetrics.successfulRequests}`);
  logger.info(`失败请求数: ${performanceMetrics.failedRequests}`);
  logger.info(`请求成功率: ${successRate.toFixed(2)}%`);
  logger.info(`平均响应时间: ${performanceMetrics.avgResponseTime.toFixed(2)} ms`);
  logger.info(`总接收数据: ${(performanceMetrics.totalDataReceived / 1024).toFixed(2)} KB`);
  logger.info(`总发送数据: ${(performanceMetrics.totalDataSent / 1024).toFixed(2)} KB`);
  logger.info(`当前连接数: ${connectionPool.activeConnections}`);
  logger.info(`连接池使用率: ${(connectionPool.activeConnections / connectionPool.maxConnections * 100).toFixed(2)}%`);
  logger.info(`连接池峰值: ${connectionPool.connectionStats.peakConnections}`);
  logger.info(`总连接数: ${connectionPool.connectionStats.totalConnections}`);
  logger.info(`失败连接数: ${connectionPool.connectionStats.failedConnections}`);
  logger.info(`已关闭连接数: ${connectionPool.connectionStats.closedConnections}`);
  logger.info('='.repeat(80));
}
//处理批量数据
function processBatch(clientId, clientInfo) {
  const batch = clientBatches.get(clientId);
  if (!batch || batch.length === 0) return;
  logger.info(`处理客户端 #${clientId} 的批量数据，共 ${batch.length} 条`, { clientInfo });
  batch.forEach(data => {
    handleClientDataDirect(data.socket, clientId, clientInfo, data.data);
  });
  clientBatches.delete(clientId);
}

function handleClientDataDirect(socket, clientId, clientInfo, data, retryCount = 0) {
  return new Promise(async (resolve) => {
    const startTime = Date.now();
    const dataReceived = data.length;
    let dataSent = 0;
    let success = false;
    try {
      logger.debug(`处理客户端 #${clientId} 数据，重试次数: ${retryCount}`, { dataLength: data.length });
      const result = await dataProcessor.processRawData(data, clientInfo);

      if (result.success) {
        let response = `数据处理成功 [ID: ${result.processingId}]\n`;
        if (COMPRESSION_ENABLED) {
          const compressedResponse = compressData(response);
          socket.write(compressedResponse);
          dataSent = compressedResponse.length;
          logger.debug(`发送压缩响应，原始大小: ${response.length}, 压缩后: ${compressedResponse.length}`);
        } else {
          socket.write(response);
          dataSent = response.length;
        }
        clientErrors.delete(clientId);
        success = true;
      } else {
        let response = `数据处理失败: ${result.error}\n`;
        if (COMPRESSION_ENABLED) {
          const compressedResponse = compressData(response);
          socket.write(compressedResponse);
          dataSent = compressedResponse.length;
        } else {
          socket.write(response);
          dataSent = response.length;
        }
      }
    } catch (error) {
      logger.error(`处理客户端 #${clientId} 数据时出错`, {
        clientId,
        clientInfo,
        error: error.message,
        retryCount
      });

      if (!clientErrors.has(clientId)) {
        clientErrors.set(clientId, 0);
      }
      const errorCount = clientErrors.get(clientId) + 1;
      clientErrors.set(clientId, errorCount);
      if (errorCount <= ERROR_RETRY_LIMIT) {
        logger.info(`将重试处理客户端 #${clientId} 的数据，第 ${errorCount} 次`, { clientInfo });
        setTimeout(() => {
          handleClientDataDirect(socket, clientId, clientInfo, data, errorCount).then(resolve);
        }, ERROR_RETRY_DELAY * errorCount);
        return;
      } else {
        logger.warn(`客户端 #${clientId} 数据处理失败，已达到最大重试次数`, { clientInfo });
        let response = `服务器处理错误: ${error.message} (已达到最大重试次数)\n`;
        if (COMPRESSION_ENABLED) {
          const compressedResponse = compressData(response);
          socket.write(compressedResponse);
          dataSent = compressedResponse.length;
        } else {
          socket.write(response);
          dataSent = response.length;
        }
        clientErrors.delete(clientId);
      }
    } finally {
      recordPerformanceMetrics(startTime, success, dataReceived, dataSent);
      resolve();
    }
  });
}
//处理客户端数据
const logger = winston.child({ service: 'socket-server' });
//获取客户端信息
function getClientInfo(socket) {
  const remoteAddress = socket.remoteAddress;
  const remotePort = socket.remotePort;
  return `${remoteAddress}:${remotePort}`;
}
// 处理客户端数据
function handleClientData(socket, clientId, clientInfo, data) {
  return new Promise(async (resolve) => {
    try {
      let processedData = data;
      
      if (Buffer.isBuffer(data) && COMPRESSION_ENABLED) {
        processedData = decompressData(data);
        logger.debug(`解压数据，原始大小: ${data.length}, 解压后: ${processedData.length}`);
      }
      
      const trimmedData = processedData.toString().trim();
      
      if (trimmedData === 'PONG') {
        handleHeartbeatResponse(clientId);
        resolve();
        return;
      }
      
      if (BATCH_PROCESSING_ENABLED) {
        if (!clientBatches.has(clientId)) {
          clientBatches.set(clientId, []);
        }
        
        const batch = clientBatches.get(clientId);
        batch.push({ socket, data: processedData });
        
        if (batch.length >= BATCH_SIZE) {
          processBatch(clientId, clientInfo);
        }
      } else {
        await handleClientDataDirect(socket, clientId, clientInfo, processedData);
      }
      
      resolve();
    } catch (error) {
      logger.error(`处理客户端 #${clientId} 数据时出错`, {
        clientId,
        clientInfo,
        error: error.message
      });
      let response = `服务器处理错误: ${error.message}\n`;
      if (COMPRESSION_ENABLED) {
        const compressedResponse = compressData(response);
        socket.write(compressedResponse);
      } else {
        socket.write(response);
      }
      resolve();
    }
  });
}
// 清理客户端连接
function cleanupClient(clientId, clientInfo, hadError = false) {
  const clientData = clients.get(clientId);
  if (clientData) {
    connectionPool.activeConnections--;
    connectionPool.connectionStats.closedConnections++;
    clients.delete(clientId);
    
    if (connectionPool.activeConnections < 0) {
      connectionPool.activeConnections = 0;
    }
    
    if (BATCH_PROCESSING_ENABLED && clientBatches.has(clientId)) {
      processBatch(clientId, clientInfo);
    }
    
    if (clientErrors.has(clientId)) {
      clientErrors.delete(clientId);
    }
    
    if (clientHeartbeats.has(clientId)) {
      clientHeartbeats.delete(clientId);
    }
    
    logger.debug(`客户端 #${clientId} 连接已清理`, {
      currentConnections: connectionPool.activeConnections,
      dataReceived: clientData.dataReceived,
      dataSent: clientData.dataSent,
      connectionDuration: Math.floor((new Date() - clientData.connectedAt) / 1000) + 's'
    });
  }
}
// 处理客户端断开连接
function handleClientDisconnect(clientId, clientInfo, hadError = false) {
  if (hadError) {
    logger.warn(`客户端 #${clientId} (${clientInfo}) 连接异常关闭`, { 
      currentConnections: connectionPool.activeConnections - 1 
    });
  } else {
    logger.info(`客户端 #${clientId} (${clientInfo}) 连接正常关闭`, { 
      currentConnections: connectionPool.activeConnections - 1 
    });
  }
}
// 处理客户端错误
function handleClientError(clientId, clientInfo, error) {
  logger.error(`客户端 #${clientId} (${clientInfo}) 连接错误`, {
    errorCode: error.code,
    errorMessage: error.message
  });
  if (error.code === 'ECONNRESET') {
    logger.info(`连接被客户端重置`, { clientId, clientInfo });
  } else if (error.code === 'ETIMEDOUT') {
    logger.info(`连接超时`, { clientId, clientInfo });
  } else if (error.code === 'EPIPE') {
    logger.info(`管道断裂，客户端可能已关闭连接`, { clientId, clientInfo });
  }
  logger.info(`当前连接数: ${connectionPool.activeConnections - 1}`, { clientId, clientInfo });
}
dataProcessor.initialize();
// 创建服务器
const server = net.createServer((socket) => {
  connectionPool.connectionStats.totalConnections++;
  
  if (connectionPool.activeConnections >= connectionPool.maxConnections) {
    logger.warn('连接池已满，拒绝新连接', {
      maxConnections: connectionPool.maxConnections,
      currentConnections: connectionPool.activeConnections
    });
    socket.write('服务器连接数已满，请稍后再试\n');
    socket.end();
    connectionPool.connectionStats.failedConnections++;
    return;
  }
  
  connectionPool.activeConnections++;
  connectionPool.updatePeakConnections();
  const clientId = ++clientIdCounter;
  const clientInfo = getClientInfo(socket);
  
  const clientData = {
    socket,
    clientId,
    clientInfo,
    connectedAt: new Date(),
    lastActivity: new Date(),
    dataReceived: 0,
    dataSent: 0
  };
  
  clients.set(clientId, clientData);
  
  socket.setEncoding('utf8');
  socket.setKeepAlive(true, 60000);
  socket.setNoDelay(true);
  
  logger.info(`客户端 #${clientId} 已连接 - ${clientInfo}`, {
    currentConnections: connectionPool.activeConnections,
    maxConnections: connectionPool.maxConnections
  });
  
  socket.on('data', (data) => {
    clientData.lastActivity = new Date();
    clientData.dataReceived += data.length;
    handleClientData(socket, clientId, clientInfo, data);
  });
  
  socket.on('end', () => {
    logger.info(`客户端 #${clientId} (${clientInfo}) 主动断开连接`, {
      currentConnections: connectionPool.activeConnections - 1
    });
    cleanupClient(clientId, clientInfo, false);
  });
  
  socket.on('error', (error) => {
    handleClientError(clientId, clientInfo, error);
    cleanupClient(clientId, clientInfo, true);
  });
  
  socket.on('timeout', () => {
    logger.warn(`客户端 #${clientId} (${clientInfo}) 连接超时`, { clientId, clientInfo });
    socket.end();
  });
  
  socket.on('close', (hadError) => {
    handleClientDisconnect(clientId, clientInfo, hadError);
    cleanupClient(clientId, clientInfo, hadError);
  });
  
  const welcomeMessage = `欢迎连接到热成像传感器数据服务器！\n` +
                        `你的客户端ID: ${clientId}\n` +
                        `当前连接数: ${connectionPool.activeConnections}\n` +
                        `最大连接数: ${connectionPool.maxConnections}\n` +
                        `请发送JSON格式的传感器数据\n\n`;
  
  socket.write(welcomeMessage);
  clientData.dataSent += welcomeMessage.length;
});
// 处理服务器错误
server.on('error', (error) => {
  logger.error('服务器错误', {
    errorCode: error.code,
    errorMessage: error.message
  });
  if (error.code === 'EADDRINUSE') {
    logger.error(`端口 ${PORT} 已被占用，请检查是否有其他程序正在使用该端口`);
  } else if (error.code === 'EACCES') {
    logger.error(`权限不足，无法绑定到端口 ${PORT}`);
  }
  dataProcessor.closeDatabase();
  process.exit(1);
});
// 处理服务器关闭
server.on('close', () => {
  logger.info('服务器已关闭');
});
// 处理服务器关闭信号
process.on('SIGINT', () => {
  logger.info('收到退出信号，正在关闭服务器...', {
    activeConnections: connectionPool.activeConnections,
    totalConnections: connectionPool.connectionStats.totalConnections
  });
  
  let closedConnections = 0;
  const totalClients = clients.size;
  
  if (totalClients === 0) {
    dataProcessor.closeDatabase();
    server.close(() => {
      logger.info('服务器已成功关闭');
      process.exit(0);
    });
    return;
  }
  
  clients.forEach((clientData, clientId) => {
    try {
      clientData.socket.write('服务器即将关闭，再见！\n');
      clientData.socket.end(() => {
        closedConnections++;
        if (closedConnections === totalClients) {
          dataProcessor.closeDatabase();
          server.close(() => {
            logger.info('服务器已成功关闭', {
              connectionsClosed: closedConnections
            });
            process.exit(0);
          });
        }
      });
    } catch (error) {
      logger.error(`关闭客户端 #${clientId} 连接时出错`, { error: error.message });
      closedConnections++;
      if (closedConnections === totalClients) {
        dataProcessor.closeDatabase();
        server.close(() => {
          logger.info('服务器已成功关闭', {
            connectionsClosed: closedConnections
          });
          process.exit(0);
        });
      }
    }
  });
  
  setTimeout(() => {
    logger.error('强制退出，部分连接可能未正常关闭');
    dataProcessor.closeDatabase();
    process.exit(1);
  }, 5000);
});
// 启动服务器
server.listen(PORT, HOST, () => {
  logger.info('='.repeat(60));
  logger.info('热成像传感器数据服务器已成功启动');
  logger.info(`监听地址: ${HOST}:${PORT}`);
  logger.info(`等待客户端连接...`);
  logger.info('='.repeat(60));
  setInterval(() => {
    clients.forEach((clientData, clientId) => {
      sendHeartbeat(clientId, clientData);
    });
  }, HEARTBEAT_INTERVAL);
  setInterval(() => {
    checkHeartbeatTimeouts();
  }, HEARTBEAT_INTERVAL * 2);
  logger.info(`心跳机制已启动，间隔: ${HEARTBEAT_INTERVAL}ms, 超时: ${HEARTBEAT_TIMEOUT}ms`);
  setInterval(() => {
    logPerformanceMetrics();
  }, METRICS_INTERVAL);
  logger.info(`性能监控已启动，间隔: ${METRICS_INTERVAL}ms`);
});
// 处理客户端连接
server.on('connection', (socket) => {
  socket.setTimeout(SOCKET_TIMEOUT);
});
// 导出服务器
module.exports = server;
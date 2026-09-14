const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const LOG_DIR = path.join(__dirname, 'logs');
const DATA_DIR = path.join(__dirname, 'data');
const RAW_DATA_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DATA_DIR = path.join(DATA_DIR, 'processed');
const VALID_FIRE_RISKS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_ENV_STATUSES = ['NORMAL', 'WARNING', 'ALERT', 'EMERGENCY'];
let dbPool = null;
let dataBuffer = [];
const BATCH_SIZE = 100;

const DB_POOL_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '12305',
  database: 'kpl',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  acquireTimeout: 10000
};
const eventEmitter = require('events');
// 数据事件发射器
const dataEmitter = new eventEmitter();
// 初始化数据处理器
async function initialize() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      await fs.promises.mkdir(LOG_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(RAW_DATA_DIR)) {
      await fs.promises.mkdir(RAW_DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PROCESSED_DATA_DIR)) {
      await fs.promises.mkdir(PROCESSED_DATA_DIR, { recursive: true });
    }
  } catch (error) {
    await log('ERROR', `创建目录失败: ${error.message}`);
  }
  await initializeDatabase(); 
  await log('INFO', '数据处理器初始化完成');
}
// 初始化数据库连接池
async function initializeDatabase() {
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 2000;
  
  while (retryCount < maxRetries) {
    try {
      dbPool = mysql.createPool(DB_POOL_CONFIG);
      
      const connection = await dbPool.getConnection();
      await log('INFO', `数据库连接池初始化成功，连接ID: ${connection.threadId}`);
      connection.release();
      
      dbPool.on('error', async (err) => {
        await log('ERROR', `数据库连接池错误: ${err.message}`);
      });
      
      return;
    } catch (err) {
      retryCount++;
      await log('ERROR', `数据库连接池初始化失败 (${retryCount}/${maxRetries}): ${err.message}`);
      if (retryCount < maxRetries) {
        await log('INFO', `等待 ${retryDelay * retryCount}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
      } else {
        await log('ERROR', '达到最大重试次数，数据库连接池初始化失败');
        dbPool = null;
      }
    }
  }
}
// 记录日志 - 只保存异常日志（ERROR, WARNING）
async function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  console.log(logMessage.trim());

  // 只保存 ERROR 和 WARNING 级别的日志
  if (level !== 'ERROR' && level !== 'WARNING') {
    return;
  }

  const logFile = path.join(LOG_DIR, `processor_${getDateString()}.log`);
  try {
    await fs.promises.appendFile(logFile, logMessage, 'utf8');
  } catch (error) {
    console.error(`写入日志文件失败: ${error.message}`);
  }
}
// 获取当前日期字符串
function getDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
// 获取当前时间戳字符串
function getTimestampString() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
// 获取数据库连接
function getDbConnection() {
  return dbPool;
}
// 处理原始数据
async function processRawData(rawData, clientInfo) {
  const processingId = getTimestampString();

  // 打印机器人发来的数据到控制台（始终打印）
  console.log(clientInfo);
  console.log(rawData);
  try {
    const dataStorage = require('./data-storage');

    // 直接解析数据，不进行验证
    let jsonData;
    try {
      let jsonString = rawData.toString().trim();
      
      // 找到第一个JSON对象或数组的开始位置
      let startIndex = -1;
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        if (char === '{' || char === '[') {
          startIndex = i;
          break;
        }
      }
      
      // 如果没有找到JSON开始标记，尝试直接解析
      if (startIndex === -1) {
        jsonData = JSON.parse(jsonString);
      } else {
        // 从找到的JSON开始位置截取
        jsonString = jsonString.substring(startIndex);
        
        // 处理多个JSON对象/数组拼接的情况，提取第一个有效的JSON
        const isArray = jsonString[0] === '[';
        const openChar = isArray ? '[' : '{';
        const closeChar = isArray ? ']' : '}';
        
        let bracketCount = 0;
        let inString = false;
        let escapeNext = false;
        let endIndex = -1;
        
        for (let i = 0; i < jsonString.length; i++) {
          const char = jsonString[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === openChar) {
              bracketCount++;
            } else if (char === closeChar) {
              bracketCount--;
              if (bracketCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }
        }
        
        // 如果找到了完整的JSON，只取第一部分
        if (endIndex > 0 && endIndex < jsonString.length) {
          jsonString = jsonString.substring(0, endIndex);
        }
        
        jsonData = JSON.parse(jsonString);
      }
    } catch (error) {
      throw new Error(`JSON解析失败: ${error.message}`);
    }

    // 构建数据对象
    const parsedData = {
      processingId,
      timestamp: new Date().toISOString(),
      deviceId: jsonData.device_id || jsonData.deviceId || 'unknown',
      temperature: jsonData.temperature,
      humidity: jsonData.humidity,
      smokeLevel: jsonData.smoke_level,
      maxTemp: jsonData.max_temp,
      humanDetected: jsonData.human_detected,
      fireRisk: jsonData.fire_risk,
      envStatus: jsonData.env_status,
      battery: jsonData.battery
    };

    // 保存到数据库（所有数据都保存到数据库）
    await dataStorage.saveToDatabase(parsedData, processingId);

    // 只保存异常数据到文件
    await dataStorage.saveRawData(rawData, processingId, clientInfo, parsedData);
    await dataStorage.saveProcessedData(parsedData, processingId);

    return { success: true, processingId, data: parsedData };
  } catch (error) {
    await log('ERROR', `数据处理失败 [ID: ${processingId}]: ${error.message}`);
    return { success: false, processingId, error: error.message };
  }
}
// 关闭数据库连接池
async function closeDatabase() {
  if (dbPool) {
    try {
      await dbPool.end();
      await log('INFO', '数据库连接池已关闭');
    } catch (err) {
      await log('ERROR', `关闭数据库连接池失败: ${err.message}`);
    }
  }
}
// 导出数据处理器模块
module.exports = {
  initialize,
  log,
  getDateString,
  getTimestampString,
  getDbConnection,
  processRawData,
  closeDatabase,
  LOG_DIR,
  DATA_DIR,
  RAW_DATA_DIR,
  PROCESSED_DATA_DIR,
  VALID_FIRE_RISKS,
  VALID_ENV_STATUSES
};
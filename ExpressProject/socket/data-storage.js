const fs = require('fs');
const path = require('path');
const dataProcessor = require('./data-processor');
// 判断是否为异常数据
function isAbnormalData(parsedData) {
  if (!parsedData) return false;

  // 火灾风险 HIGH (2) 或 CRITICAL (3) 视为异常
  const fireRisk = parsedData.fireRisk;
  if (fireRisk === 2 || fireRisk === 3) {
    return true;
  }

  // 环境状态 ALERT (2) 或 EMERGENCY (3) 视为异常
  const envStatus = parsedData.envStatus;
  if (envStatus === '2' || envStatus === '3' || envStatus === 2 || envStatus === 3) {
    return true;
  }

  return false;
}
// 保存原始数据 - 只保存异常数据
async function saveRawData(rawData, processingId, clientInfo, parsedData = null) {
  // 如果不是异常数据，则不保存
  if (!parsedData || !isAbnormalData(parsedData)) {
    return;
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const rawFilePath = path.join(dataProcessor.RAW_DATA_DIR, `${dateStr}.json`);
  const rawRecord = {
    processingId,
    timestamp: new Date().toISOString(),
    clientInfo,
    rawData: rawData.toString(),
    dataSize: rawData.length,
    abnormalType: parsedData.fireRisk >= 2 ? 'FIRE_RISK' : 'ENV_STATUS'
  };
  let existingData = [];
  try {
    const fileExists = await fs.promises.access(rawFilePath, fs.constants.F_OK).then(() => true).catch(() => false);
    if (fileExists) {
      try {
        const existingContent = await fs.promises.readFile(rawFilePath, 'utf8');
        existingData = JSON.parse(existingContent);
        if (!Array.isArray(existingData)) {
          existingData = [];
        }
      } catch (error) {
        await dataProcessor.log('WARNING', `读取现有原始数据文件失败: ${error.message}`);
        existingData = [];
      }
    }
    existingData.push(rawRecord);
    await fs.promises.writeFile(rawFilePath, JSON.stringify(existingData, null, 2), 'utf8');
    await dataProcessor.log('WARNING', `异常原始数据已保存到: ${rawFilePath}`);
  } catch (error) {
    await dataProcessor.log('ERROR', `保存原始数据失败: ${error.message}`);
  }
}
// 保存处理后的数据 - 只保存异常数据
async function saveProcessedData(processedData, processingId) {
  // 如果不是异常数据，则不保存
  if (!isAbnormalData(processedData)) {
    return;
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const processedFilePath = path.join(dataProcessor.PROCESSED_DATA_DIR, `${dateStr}.json`);
  const processedRecord = {
    processingId,
    timestamp: new Date().toISOString(),
    data: processedData,
    abnormalType: processedData.fireRisk >= 2 ? 'FIRE_RISK' : 'ENV_STATUS'
  };
  let existingData = [];
  try {
    const fileExists = await fs.promises.access(processedFilePath, fs.constants.F_OK).then(() => true).catch(() => false);
    if (fileExists) {
      try {
        const existingContent = await fs.promises.readFile(processedFilePath, 'utf8');
        existingData = JSON.parse(existingContent);
        if (!Array.isArray(existingData)) {
          existingData = [];
        }
      } catch (error) {
        await dataProcessor.log('WARNING', `读取现有处理数据文件失败: ${error.message}`);
        existingData = [];
      }
    }
    existingData.push(processedRecord);
    await fs.promises.writeFile(processedFilePath, JSON.stringify(existingData, null, 2), 'utf8');
    await dataProcessor.log('WARNING', `异常处理数据已保存到: ${processedFilePath}`);
  } catch (error) {
    await dataProcessor.log('ERROR', `保存处理数据失败: ${error.message}`);
  }
}
// 保存处理后的数据到数据库
async function saveToDatabase(parsedData, processingId) {
  const dbPool = dataProcessor.getDbConnection();
  if (!dbPool) {
    throw new Error('数据库连接池不可用');
  }
  let retryCount = 0;
  const maxRetries = 3;
  while (retryCount < maxRetries) {
    try {
      const query = `
        INSERT INTO sensor_data 
        (device_id, type, temperature, humidity, smoke_level, max_temp, human_detected, fire_risk, env_status, battery)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [
        parsedData.deviceId || 'unknown',
        'sensor_data',
        parsedData.temperature,
        parsedData.humidity,
        parsedData.smokeLevel,
        parsedData.maxTemp,
        parsedData.humanDetected ? 1 : 0,
        parsedData.fireRisk,
        parsedData.envStatus,
        parsedData.battery
      ];
      await dbPool.execute(query, values);
      //await dataProcessor.log('INFO', `数据已保存到数据库 [ID: ${processingId}]`);
      return;
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        await dataProcessor.log('ERROR', `保存到数据库失败（重试${maxRetries}次后仍失败）: ${error.message}`);
        throw error;
      }
      await dataProcessor.log('WARNING', `保存到数据库失败，第${retryCount}次重试: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
}
// 导出数据存储模块
module.exports = {
  saveRawData,
  saveProcessedData,
  saveToDatabase
};
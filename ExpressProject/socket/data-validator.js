const dataProcessor = require('./data-processor');
// 风险等级映射
const FIRE_RISK_MAP = {
  'LOW': 0,
  'MEDIUM': 1,
  'HIGH': 2,
  'CRITICAL': 3
};
// 环境状态映射
const ENV_STATUS_MAP = {
  'NORMAL': 0,
  'WARNING': 1,
  'ALERT': 2,
  'EMERGENCY': 3
};
// 解析并验证数据
async function parseAndValidateData(rawData, processingId) {
  let jsonData;
  try {
    let jsonString = rawData.toString().trim();
    jsonString = fixUnquotedEnumValues(jsonString);
    jsonData = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`JSON解析失败: ${error.message}`);
  }
  if (!jsonData.type) {
    throw new Error('缺少数据类型');
  }
  if (!jsonData.type.includes('SENSOR') && jsonData.type !== 'sensor_data') {
    await dataProcessor.log('WARNING', `未知的数据类型: ${jsonData.type}`); 
  }
  const parsedData = {
    processingId,
    timestamp: new Date().toISOString(),
    deviceId: validateDeviceId(jsonData.device_id || jsonData.deviceId),
    temperature: validateTemperature(jsonData.temperature),
    humidity: validateHumidity(jsonData.humidity),
    smokeLevel: validateSmokeLevel(jsonData.smoke_level),
    maxTemp: await validateMaxTemp(jsonData.max_temp),
    humanDetected: validateBoolean(jsonData.human_detected, 'human_detected'),
    fireRisk: validateFireRisk(jsonData.fire_risk),
    envStatus: validateEnvStatus(jsonData.env_status),
    battery: validateBattery(jsonData.battery)
  };
  await dataProcessor.log('INFO', `数据验证通过 [ID: ${processingId}]`);
  return parsedData;
}
// 修复未引号的枚举值
function fixUnquotedEnumValues(jsonString) {
  let fixed = jsonString;
  const fireRiskValues = Object.keys(FIRE_RISK_MAP).join('|');
  const envStatusValues = Object.keys(ENV_STATUS_MAP).join('|');
  const fireRiskRegex = new RegExp(`"fire_risk":\\s*(${fireRiskValues})`, 'g');
  fixed = fixed.replace(fireRiskRegex, '"fire_risk":"$1"');
  const envStatusRegex = new RegExp(`"env_status":\\s*(${envStatusValues})`, 'g');
  fixed = fixed.replace(envStatusRegex, '"env_status":"$1"');
  return fixed;
}
// 验证温度值
function validateTemperature(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('温度必须是有效的数字');
  }
  if (value < -40 || value > 130) {
    throw new Error(`温度值超出合理范围: ${value}°C`);
  }
  return parseFloat(value.toFixed(2));
}
// 验证湿度值
function validateHumidity(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('湿度必须是有效的数字');
  }
  if (value < 0 || value > 100) {
    throw new Error(`湿度值超出合理范围: ${value}%`);
  }
  return parseFloat(value.toFixed(2));
}
// 验证烟雾浓度值
function validateSmokeLevel(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('烟雾浓度必须是有效的数字');
  }
  if (value < 0 || value > 10000.00) {
    throw new Error(`烟雾浓度值超出合理范围: ${value}`);
  }
  return parseFloat(value.toFixed(2));
}
// 验证最高温度数组
async function validateMaxTemp(value) {
  if (!Array.isArray(value)) {
    throw new Error('最高温度数组格式错误');
  }
  if (value.length !== 8) {
    throw new Error(`最高温度数组长度错误: ${value.length}，应为8`);
  }
  for (let i = 0; i < value.length; i++) {
    if (!Array.isArray(value[i]) || value[i].length !== 8) {
      throw new Error(`最高温度数组第${i}行格式错误`);
    }
    for (let j = 0; j < value[i].length; j++) {
      if (typeof value[i][j] !== 'number' || isNaN(value[i][j])) {
        throw new Error(`最高温度数组[${i}][${j}]必须是有效的数字`);
      }
      if (value[i][j] < -100 || value[i][j] > 200) {
        await dataProcessor.log('WARNING', `最高温度数组[${i}][${j}]超出正常范围: ${value[i][j]}°C，但允许通过`);
      }
    }
  }
  return value;
}
// 验证布尔值
function validateBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName}必须是布尔值`);
  }
  return value;
}
// 验证火灾风险等级
function validateFireRisk(value) {
  if (typeof value === 'number') {
    if (!Object.values(FIRE_RISK_MAP).includes(value)) {
      throw new Error(`无效的火灾风险等级: ${value}`);
    }
    return value;
  }
  if (typeof value === 'string') {
    const upperValue = value.toUpperCase();
    if (!FIRE_RISK_MAP.hasOwnProperty(upperValue)) {
      throw new Error(`无效的火灾风险等级: ${value}，有效值为: ${Object.keys(FIRE_RISK_MAP).join(', ')}`);
    }
    return FIRE_RISK_MAP[upperValue];
  }
  throw new Error('火灾风险等级必须是字符串或数字');
}
// 验证环境状态
function validateEnvStatus(value) {
  if (typeof value === 'number') {
    // 数字类型，转换为两位小数的字符串
    return value.toFixed(2);
  }
  if (typeof value === 'string') {
    // 检查是否是数字字符串
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      // 数字字符串，转换为两位小数的字符串
      return numValue.toFixed(2);
    }
    // 非数字字符串，检查是否是有效的状态
    const upperValue = value.toUpperCase();
    if (!ENV_STATUS_MAP.hasOwnProperty(upperValue)) {
      throw new Error(`无效的环境状态: ${value}，有效值为: ${Object.keys(ENV_STATUS_MAP).join(', ')}`);
    }
    return ENV_STATUS_MAP[upperValue].toString();
  }
  throw new Error('环境状态必须是字符串或数字');
}
// 验证电池电量
function validateBattery(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('电池电量必须是有效的数字');
  }
  if (value < 0 || value > 100) {
    throw new Error(`电池电量超出合理范围: ${value}%`);
  }
  return Math.round(value);
}
// 验证设备ID
function validateDeviceId(value) {
  if (!value) {
    return 'unknown';
  }
  if (typeof value !== 'string') {
    return String(value);
  }
  // 限制设备ID长度为50个字符
  return value.substring(0, 50);
}
// 导出验证函数
module.exports = {
  parseAndValidateData,
  FIRE_RISK_MAP,
  ENV_STATUS_MAP
};
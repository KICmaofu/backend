const db = require('../config/db');
const winston = require('winston');
async function createIndexes() {
  try {
    winston.info('开始创建数据库索引...');
    const indexes = [
      {
        table: 'sensor_data',
        index: 'idx_sensor_record_time',
        columns: 'record_time'
      },
      {
        table: 'sensor_data',
        index: 'idx_sensor_device_id',
        columns: 'device_id'
      },
      {
        table: 'alerts',
        index: 'idx_alerts_created_at',
        columns: 'created_at'
      },
      {
        table: 'devices',
        index: 'idx_devices_status',
        columns: 'status'
      },
      {
        table: 'users',
        index: 'idx_users_email',
        columns: 'email'
      }
    ];
    for (const index of indexes) {
      try {
        await db.query(
          `CREATE INDEX ${index.index} ON ${index.table} (${index.columns})`
        );
        winston.info(`成功创建索引: ${index.index} on ${index.table}`);
      } catch (error) {
        winston.error(`创建索引失败 ${index.index}:`, error);
      }
    }
    winston.info('数据库索引创建完成');
  } catch (error) {
    winston.error('创建索引时发生错误:', error);
  }
}
async function optimizeTables() {
  try {
    winston.info('开始优化数据库表...');
    const tables = [
      'sensor_data',
      'alerts',
      'devices',
      'users',
      'messages'
    ];
    for (const table of tables) {
      try {
        await db.query(`OPTIMIZE TABLE ${table}`);
        winston.info(`成功优化表: ${table}`);
      } catch (error) {
        winston.error(`优化表失败 ${table}:`, error);
      }
    }
    winston.info('数据库表优化完成');
  } catch (error) {
    winston.error('优化表时发生错误:', error);
  }
}
async function analyzeTables() {
  try {
    winston.info('开始分析数据库表...');
    const tables = [
      'sensor_data',
      'alerts',
      'devices',
      'users',
      'messages'
    ];
    for (const table of tables) {
      try {
        await db.query(`ANALYZE TABLE ${table}`);
        winston.info(`成功分析表: ${table}`);
      } catch (error) {
        winston.error(`分析表失败 ${table}:`, error);
      }
    }
    winston.info('数据库表分析完成');
  } catch (error) {
    winston.error('分析表时发生错误:', error);
  }
}
async function runOptimization() {
  try {
    await createIndexes();
    await analyzeTables();
    await optimizeTables();
    winston.info('数据库优化完成');
  } catch (error) {
    winston.error('数据库优化失败:', error);
  } finally {
    process.exit(0);
  }
}
if (require.main === module) {
  runOptimization();
}
module.exports = {
  createIndexes,
  optimizeTables,
  analyzeTables,
  runOptimization
};
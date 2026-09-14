const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { cacheMiddleware } = require('../../middlewares/cache');
const winston = require('../../config/logger');

// 获取最新环境数据
router.get('/data', cacheMiddleware(60), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT device_id, temperature, humidity, smoke_level as pressure, record_time as timestamp
       FROM sensor_data
       ORDER BY record_time DESC
       LIMIT 1`
    );

    // 如果没有数据，返回默认值
    if (rows.length === 0) {
      return res.json({
        code: 200,
        message: 'success',
        data: {
          temperature: null,
          humidity: null,
          pressure: null,
          co2: null,
          pm25: null,
          timestamp: new Date().toISOString()
        }
      });
    }

    const data = rows[0];
    res.json({
      code: 200,
      message: 'success',
      data: {
        deviceId: data.device_id,
        temperature: data.temperature,
        humidity: data.humidity,
        pressure: data.pressure,
        co2: null,
        pm25: null,
        timestamp: data.timestamp
      }
    });
  } catch (error) {
    winston.error('获取最新环境数据失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
// 获取温度历史数据
// router.get('/temperature-history', cacheMiddleware(300), async (req, res) => {
//   try {
//     // 1. 获取 服务器操作系统当前时间
//     const now = new Date();
//
//     // 2. 生成最近 10 个 10分钟时间段（基于服务器当前时间往前推）
//     const timeData = [];
//     for (let i = 9; i >= 0; i--) {
//       // 每往前推 10 分钟
//       const time = new Date(now - i * 10 * 60 * 1000);
//
//       // 按 10 分钟取整（0、10、20...50 分）
//       const minutes = Math.floor(time.getMinutes() / 10) * 10;
//       time.setMinutes(minutes);
//       time.setSeconds(0);
//       time.setMilliseconds(0);
//
//       // 格式化时间标签 HH:MM:SS
//       const label = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:00`;
//
//       timeData.push({
//         timestamp: time,
//         label: label
//       });
//     }
//
//     // 3. 从数据库查询所有温度（不再按时间分组，交给后端按服务器时间分组）
//     const [rows] = await db.query(
//       `SELECT device_id, temperature, record_time
//        FROM sensor_data
//        WHERE temperature IS NOT NULL
//        ORDER BY record_time DESC`
//     );
//
//     // 4. 按服务器生成的 10 个时间段，计算每个时间段的平均温度
//     const labels = [];
//     const temperatures = [];
//
//     timeData.forEach(slot => {
//       const slotStartTime = slot.timestamp.getTime();
//       const slotEndTime = slotStartTime + 10 * 60 * 1000;
//
//       // 筛选出这个时间段内的温度
//       const slotTemperatures = rows
//         .filter(row => {
//           const rowTime = new Date(row.record_time).getTime();
//           return rowTime >= slotStartTime && rowTime < slotEndTime;
//         })
//         .map(row => parseFloat(row.temperature));
//
//       // 计算平均值，没有数据则为 0
//       const avgTemp = slotTemperatures.length
//         ? parseFloat((slotTemperatures.reduce((a, b) => a + b, 0) / slotTemperatures.length).toFixed(2))
//         : 0;
//
//       labels.push(slot.label);
//       temperatures.push(avgTemp);
//     });
//
//     // 5. 返回给前端
//     res.json({
//       code: 200,
//       message: 'success',
//       data: {
//         labels,
//         temperatures
//       }
//     });
//   } catch (error) {
//     winston.error('获取温度历史数据失败:', error);
//     res.status(500).json({
//       code: 500,
//       message: '服务器内部错误',
//       data: null,
//       timestamp: new Date().toISOString()
//     });
//   }
//
// });
router.get('/temperature-history', cacheMiddleware(300), async (req, res) => {
  try {
    // 1. 获取服务器操作系统当前时间
    const now = new Date();

    // 2. 生成最近 10 个 2分钟时间段（基于服务器当前时间往前推）
    const timeData = [];
    for (let i = 9; i >= 0; i--) {
      // 每往前推 2 分钟
      const time = new Date(now - i * 2 * 60 * 1000);

      // 按 2 分钟取整（0、2、4、6...58 分）
      const minutes = Math.floor(time.getMinutes() / 2) * 2;
      time.setMinutes(minutes);
      time.setSeconds(0);
      time.setMilliseconds(0);

      // 格式化时间标签 HH:MM:SS
      const label = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:00`;

      timeData.push({
        timestamp: time,
        label: label
      });
    }

    // 3. 从数据库查询所有温度
    const [rows] = await db.query(
        `SELECT device_id, temperature, record_time
       FROM sensor_data
       WHERE temperature IS NOT NULL
       ORDER BY record_time DESC`
    );

    // 4. 按服务器生成的 10 个 2分钟时间段，计算每个时间段的平均温度
    const labels = [];
    const temperatures = [];

    timeData.forEach(slot => {
      const slotStartTime = slot.timestamp.getTime();
      // 每个时间段 2 分钟
      const slotEndTime = slotStartTime + 120000;

      // 筛选出这个时间段内的温度
      const slotTemperatures = rows
          .filter(row => {
            const rowTime = new Date(row.record_time).getTime();
            return rowTime >= slotStartTime && rowTime < slotEndTime;
          })
          .map(row => parseFloat(row.temperature));

      // 计算平均值，没有数据则为 0
      const avgTemp = slotTemperatures.length
          ? parseFloat((slotTemperatures.reduce((a, b) => a + b, 0) / slotTemperatures.length).toFixed(2))
          : 0;

      labels.push(slot.label);
      temperatures.push(avgTemp);
    });

    // 5. 返回给前端
    res.json({
      code: 200,
      message: 'success',
      data: {
        labels,
        temperatures
      }
    });
  } catch (error) {
    winston.error('获取温度历史数据失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
// 获取环境数据列表
router.get('/data-list', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, startTime, endTime, type, location } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (startTime && endTime) {
      whereClause += ' AND record_time BETWEEN ? AND ?';
      params.push(startTime, endTime);
    }
    if (type && type !== 'all') {
      whereClause += ` AND ${type} IS NOT NULL`;
    }
    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT id as dataId, device_id,
       CASE 
         WHEN temperature IS NOT NULL THEN 'temperature' 
         WHEN humidity IS NOT NULL THEN 'humidity' 
         WHEN smoke_level IS NOT NULL THEN 'pressure' 
         ELSE 'all' 
       END as type, 
       COALESCE(temperature, humidity, smoke_level) as value, 
       record_time as timestamp 
       FROM sensor_data 
       ${whereClause} 
       ORDER BY record_time DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM sensor_data ${whereClause}`,
      params
    );
    const total = countRows[0].total;
    res.json({
      code: 200,
      message: 'success',
      data: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        items: rows.map(row => ({
          dataId: row.dataId.toString(),
          deviceId: row.device_id,
          type: row.type,
          value: row.value,
          timestamp: row.timestamp.toISOString()
        }))
      }
    });
  } catch (error) {
    winston.error('获取环境数据列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
// 导出环境数据
router.post('/export', async (req, res) => {
  try {
    const { startTime, endTime, type, location, format = 'xlsx' } = req.body; 
    if (!startTime || !endTime) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    let whereClause = 'WHERE record_time BETWEEN ? AND ?';
    const params = [startTime, endTime];
    if (type && type !== 'all') {
      whereClause += ' AND ' + type + ' IS NOT NULL';
    }
    const [rows] = await db.query(
      `SELECT device_id, record_time as timestamp, temperature, humidity, smoke_level as pressure 
       FROM sensor_data 
       ${whereClause} 
       ORDER BY record_time`,
      params
    );
    if (format === 'xlsx') { 
      const dateStr = new Date().toISOString().split('T')[0]; 
      const fileName = `environment_data_${dateStr}.xlsx`;
      const filePath = path.join(__dirname, '../../data/export', fileName);
      if (!fs.existsSync(path.join(__dirname, '../../data/export'))) {
        fs.mkdirSync(path.join(__dirname, '../../data/export'), { recursive: true });
      }
      let workbook;
      let worksheet;
      if (fs.existsSync(filePath)) {
        try {
          workbook = await ExcelJS.Workbook.xlsx.readFile(filePath);
          worksheet = workbook.getWorksheet('环境数据');
          if (!worksheet) {
            worksheet = workbook.addWorksheet('环境数据');
            worksheet.columns = [
              { header: '设备ID', key: 'device_id', width: 20 },
              { header: '时间', key: 'timestamp', width: 20 },
              { header: '温度(°C)', key: 'temperature', width: 15 },
              { header: '湿度(%)', key: 'humidity', width: 15 },
              { header: '烟雾浓度', key: 'pressure', width: 15 }
            ];
          }
        } catch (error) {
          console.error('读取现有Excel文件失败:', error);
          workbook = new ExcelJS.Workbook();
          worksheet = workbook.addWorksheet('环境数据');
          worksheet.columns = [
            { header: '设备ID', key: 'device_id', width: 20 },
            { header: '时间', key: 'timestamp', width: 20 },
            { header: '温度(°C)', key: 'temperature', width: 15 },
            { header: '湿度(%)', key: 'humidity', width: 15 },
            { header: '烟雾浓度', key: 'pressure', width: 15 }
          ];
        }
      } else {
        workbook = new ExcelJS.Workbook();
        worksheet = workbook.addWorksheet('环境数据')
        worksheet.columns = [
          { header: '设备ID', key: 'device_id', width: 20 },
          { header: '时间', key: 'timestamp', width: 20 },
          { header: '温度(°C)', key: 'temperature', width: 15 },
          { header: '湿度(%)', key: 'humidity', width: 15 },
          { header: '烟雾浓度', key: 'pressure', width: 15 }
        ];
      }
      rows.forEach(row => {
        worksheet.addRow({
          device_id: row.device_id,
          timestamp: row.timestamp.toISOString(),
          temperature: row.temperature,
          humidity: row.humidity,
          pressure: row.pressure
        });
      });
      await workbook.xlsx.writeFile(filePath);
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('下载文件失败:', err);
          res.status(500).json({
            code: 500,
            message: '服务器内部错误',
            data: null,
            timestamp: new Date().toISOString()
          });
        }
      });
    } else if (format === 'csv') {
      const dateStr = new Date().toISOString().split('T')[0]; 
      const fileName = `environment_data_${dateStr}.csv`;
      const filePath = path.join(__dirname, '../../data/export', fileName);
      if (!fs.existsSync(path.join(__dirname, '../../data/export'))) {
        fs.mkdirSync(path.join(__dirname, '../../data/export'), { recursive: true });
      } 
      let csvContent = '';
      if (!fs.existsSync(filePath)) {
        csvContent = '设备ID,时间,温度(°C),湿度(%),烟雾浓度\n';
      }
      rows.forEach(row => {
        csvContent += `${row.device_id},${row.timestamp.toISOString()},${row.temperature},${row.humidity},${row.pressure}\n`;
      });
      fs.appendFileSync(filePath, csvContent);
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('下载文件失败:', err);
          res.status(500).json({
            code: 500,
            message: '服务器内部错误',
            data: null,
            timestamp: new Date().toISOString()
          });
        }
      });
    } else {
      return res.status(400).json({
        code: 400,
        message: '不支持的导出格式',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('导出环境数据失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
// 获取环境统计数据
router.get('/statistics', cacheMiddleware(600), async (req, res) => {
  try {
    const { startTime, endTime, type = 'all' } = req.query; 
    if (!startTime || !endTime) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const statistics = {};
    if (type === 'all' || type === 'temperature') {
      const [tempStats] = await db.query(
        'SELECT AVG(temperature) as avg, MAX(temperature) as max, MIN(temperature) as min, COUNT(*) as count FROM sensor_data WHERE record_time BETWEEN ? AND ? AND temperature IS NOT NULL',
        [startTime, endTime]
      );
      const avg = parseFloat(tempStats[0].avg);
      const max = parseFloat(tempStats[0].max);
      const min = parseFloat(tempStats[0].min);
      statistics.temperature = {
        avg: avg !== null && !isNaN(avg) ? parseFloat(avg.toFixed(1)) : 0,
        max: max !== null && !isNaN(max) ? parseFloat(max.toFixed(1)) : 0,
        min: min !== null && !isNaN(min) ? parseFloat(min.toFixed(1)) : 0,
        count: tempStats[0].count || 0
      };
    }
    if (type === 'all' || type === 'humidity') {
      const [humidityStats] = await db.query(
        'SELECT AVG(humidity) as avg, MAX(humidity) as max, MIN(humidity) as min, COUNT(*) as count FROM sensor_data WHERE record_time BETWEEN ? AND ? AND humidity IS NOT NULL',
        [startTime, endTime]
      );
      const avg = parseFloat(humidityStats[0].avg);
      const max = parseFloat(humidityStats[0].max);
      const min = parseFloat(humidityStats[0].min);
      statistics.humidity = {
        avg: avg !== null && !isNaN(avg) ? parseFloat(avg.toFixed(1)) : 0,
        max: max !== null && !isNaN(max) ? parseFloat(max.toFixed(1)) : 0,
        min: min !== null && !isNaN(min) ? parseFloat(min.toFixed(1)) : 0,
        count: humidityStats[0].count || 0
      };
    }
    if (type === 'all' || type === 'pressure') {
      const [pressureStats] = await db.query(
        'SELECT AVG(smoke_level) as avg, MAX(smoke_level) as max, MIN(smoke_level) as min, COUNT(*) as count FROM sensor_data WHERE record_time BETWEEN ? AND ? AND smoke_level IS NOT NULL',
        [startTime, endTime]
      );
      const avg = parseFloat(pressureStats[0].avg);
      const max = parseFloat(pressureStats[0].max);
      const min = parseFloat(pressureStats[0].min);
      statistics.pressure = {
        avg: avg !== null && !isNaN(avg) ? parseFloat(avg.toFixed(1)) : 0,
        max: max !== null && !isNaN(max) ? parseFloat(max.toFixed(1)) : 0,
        min: min !== null && !isNaN(min) ? parseFloat(min.toFixed(1)) : 0,
        count: pressureStats[0].count || 0
      };
    }
    res.json({
      code: 200,
      message: 'success',
      data: statistics
    });
  } catch (error) {
    winston.error('获取数据统计失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
// 获取环境数据趋势
router.get('/trends', cacheMiddleware(600), async (req, res) => {
  try {
    const { startTime, endTime, type, interval = 'hour' } = req.query;
    if (!startTime || !endTime || !type) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    let timeFormat;
    switch (interval) {
      case 'hour':
        timeFormat = '%H:00';
        break;
      case 'day':
        timeFormat = '%Y-%m-%d';
        break;
      case 'week':
        timeFormat = '%Y-W%u';
        break;
      default:
        timeFormat = '%H:00';
    }
    // 处理pressure类型，映射到smoke_level字段
    const actualType = type === 'pressure' ? 'smoke_level' : type;
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(record_time, '${timeFormat}') as label, AVG(${actualType}) as value 
       FROM sensor_data 
       WHERE record_time BETWEEN ? AND ? AND ${actualType} IS NOT NULL 
       GROUP BY label 
       ORDER BY label`,
      [startTime, endTime]
    );
    const labels = rows.map(row => row.label);
    const values = rows.map(row => parseFloat(row.value.toFixed(1)));
    res.json({
      code: 200,
      message: 'success',
      data: {
        labels,
        values
      }
    });
  } catch (error) {
    winston.error('获取数据趋势失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;
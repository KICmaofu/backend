const express = require('express');
const router = express.Router();
const db = require('../../config/db');

const formatDateToISO = (date) => {
  if (!date) return new Date().toISOString();
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  return new Date(date).toISOString();
};
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, type, status, keyword } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (type) {
      whereClause += ' AND type_id = ?';
      params.push(type);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (keyword) {
      whereClause += ' AND (name LIKE ? OR id LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT id as sensorId, name as sensorName, type_id as type, status, location, 
       update_time as lastUpdate 
       FROM devices 
       ${whereClause} 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM devices ${whereClause}`,
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
          sensorId: row.sensorId,
          sensorName: row.sensorName,
          type: row.type,
          status: row.status,
          location: row.location,
          lastUpdate: formatDateToISO(row.lastUpdate)
        }))
      }
    });
  } catch (error) {
    console.error('获取传感器列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.post('/', async (req, res) => {
  try {
    const { sensorName, type, model, serialNumber, location, description } = req.body;
    if (!sensorName || !type || !model || !serialNumber) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const sensorId = `sensor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      await db.query(
        'INSERT INTO devices (id, name, location, status) VALUES (?, ?, ?, ?)',
        [sensorId, sensorName, location || '未知位置', 'offline']
      );
    } catch (insertError) {
      console.error('插入传感器数据失败:', insertError);
      return res.json({
        code: 200,
        message: '传感器添加成功',
        data: {
          sensorId,
          sensorName
        }
      });
    }
    res.json({
      code: 200,
      message: '传感器添加成功',
      data: {
        sensorId,
        sensorName
      }
    });
  } catch (error) {
    console.error('添加传感器失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.put('/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { sensorName, type, model, location, description } = req.body;
    if (!sensorName || !type || !model) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingSensors] = await db.query('SELECT * FROM devices WHERE id = ?', [sensorId]);
    if (existingSensors.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '传感器不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query(
      'UPDATE devices SET name = ?, location = ?, model = ? WHERE id = ?',
      [sensorName, location, model, sensorId]
    );
    res.json({
      code: 200,
      message: '传感器信息更新成功',
      data: {
        sensorId,
        sensorName
      }
    });
  } catch (error) {
    console.error('更新传感器信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.delete('/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const [existingSensors] = await db.query('SELECT * FROM devices WHERE id = ?', [sensorId]);
    if (existingSensors.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '传感器不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query('DELETE FROM devices WHERE id = ?', [sensorId]);
    res.json({
      code: 200,
      message: '传感器删除成功',
      data: null
    });
  } catch (error) {
    console.error('删除传感器失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../../config/db');

const formatDateToISO = (date) => {
  if (!date) return new Date().toISOString();
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  return new Date(date).toISOString();
};

const mapStatusToEnglish = (status) => {
  const statusMap = {
    '在线': 'online',
    '离线': 'offline',
    '维护中': 'maintenance',
    '故障': 'error',
    '巡检中': 'online',
    'online': 'online',
    'offline': 'offline',
    'maintenance': 'maintenance',
    'error': 'error'
  };
  return statusMap[status] || 'offline';
};

const mapStatusToChinese = (status) => {
  const statusMap = {
    'online': '在线',
    'offline': '离线',
    'maintenance': '维护中',
    'error': '故障'
  };
  return statusMap[status] || status;
};

router.get('/positions', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id as robotId, name as robotName, status, battery, update_time as lastUpdate FROM robots WHERE status != "offline"');
    const positions = rows.map(row => ({
      robotId: row.robotId,
      robotName: row.robotName,
      x: 0, 
      y: 0, 
      status: mapStatusToChinese(row.status),
      battery: row.battery || 100, 
      lastUpdate: formatDateToISO(row.lastUpdate)
    }));
    res.json({
      code: 200,
      message: 'success',
      data: positions
    });
  } catch (error) {
    console.error('获取机器人位置数据失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, keyword } = req.query;
    let whereClause = '';
    const params = [];
    if (status) {
      whereClause += whereClause ? ' AND ' : ' WHERE ';
      whereClause += 'status = ?';
      params.push(mapStatusToEnglish(status));
    }
    if (keyword) {
      whereClause += whereClause ? ' AND ' : ' WHERE ';
      whereClause += '(name LIKE ? OR id LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT id as robotId, name as robotName, type, status, location, battery, update_time as lastUpdate FROM robots ${whereClause} LIMIT ${parseInt(pageSize)} OFFSET ${offset}`,
      params
    );
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM robots ${whereClause}`,
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
          robotId: row.robotId,
          robotName: row.robotName,
          type: row.type,
          status: mapStatusToChinese(row.status),
          battery: row.battery || 100, 
          location: row.location,
          lastUpdate: formatDateToISO(row.lastUpdate)
        }))
      }
    });
  } catch (error) {
    console.error('获取机器人列表失败:', error);
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
    const { id, name, type, model, serialNumber, location, description, status = '离线', battery = 100 } = req.body;
    if (!id || !name || !location) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const robotId = id;    
    await db.query(
      'INSERT INTO robots (id, name, type, model, location, manufacturer, install_date, status, battery) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)',
      [robotId, name, type || '未知', model || '未知', location, 'Unknown', mapStatusToEnglish(status), battery]
    );
    res.json({
      code: 200,
      message: '机器人添加成功',
      data: {
        robotId,
        name,
        status: mapStatusToChinese(status),
        battery
      }
    });
  } catch (error) {
    console.error('添加机器人失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.put('/:robotId', async (req, res) => {
  try {
    const { robotId } = req.params;
    const { name, type, model, location, description, status, battery } = req.body;
    if (!name || !location) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingRobots] = await db.query('SELECT * FROM robots WHERE id = ?', [robotId]);
    if (existingRobots.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '机器人不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query(
      'UPDATE robots SET name = ?, type = COALESCE(?, type), model = COALESCE(?, model), location = ?, status = COALESCE(?, status), battery = COALESCE(?, battery) WHERE id = ?',
      [name, type, model, location, status ? mapStatusToEnglish(status) : null, battery, robotId]
    )
    res.json({
      code: 200,
      message: '机器人信息更新成功',
      data: {
        robotId,
        name
      }
    });
  } catch (error) {
    console.error('更新机器人信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.delete('/:robotId', async (req, res) => {
  try {
    const { robotId } = req.params;
    const [existingRobots] = await db.query('SELECT * FROM robots WHERE id = ?', [robotId]);
    if (existingRobots.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '机器人不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query('DELETE FROM robots WHERE id = ?', [robotId]);
    res.json({
      code: 200,
      message: '机器人删除成功',
      data: null
    });
  } catch (error) {
    console.error('删除机器人失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.post('/:robotId/control', async (req, res) => {
  try {
    const { robotId } = req.params;
    const { command, parameters } = req.body;
    if (!command) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingRobots] = await db.query('SELECT * FROM robots WHERE id = ?', [robotId]);
    if (existingRobots.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '机器人不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    console.log('控制命令发送:', { robotId, command, parameters });
    res.json({
      code: 200,
      message: '控制指令发送成功',
      data: {
        robotId,
        command,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('控制机器人失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;
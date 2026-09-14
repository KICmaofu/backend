const express = require('express');
const router = express.Router();
const db = require('../../config/db');
router.get('/active', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id as alertId, alarm_item as type, level, device_name as message, location, alarm_time as timestamp, status as processed FROM alarms WHERE status != "resolved" ORDER BY alarm_time DESC'
    );
    const alerts = rows.map(row => ({
      alertId: row.alertId.toString(),
      type: row.type,
      level: row.level,
      message: row.message,
      location: row.location,
      timestamp: row.timestamp.toISOString(),
      processed: row.processed === 'resolved'
    }));
    res.json({
      code: 200,
      message: 'success',
      data: alerts
    });
  } catch (error) {
    console.error('获取报警信息失败:', error);
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
    const { page = 1, pageSize = 10, level, status, type, keyword } = req.query; 
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (level) {
      whereClause += ' AND level = ?';
      params.push(level);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status === 'processed' ? 'resolved' : 'pending');
    }
    if (type) {
      whereClause += ' AND alarm_item = ?';
      params.push(type);
    }
    if (keyword) {
      whereClause += ' AND (device_name LIKE ? OR location LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT id as alertId, alarm_item as type, level, device_name as message, location, status as processed, alarm_time as timestamp 
       FROM alarms 
       ${whereClause} 
       ORDER BY alarm_time DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM alarms ${whereClause}`,
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
          alertId: row.alertId.toString(),
          type: row.type,
          level: row.level,
          message: row.message,
          location: row.location,
          processed: row.processed === 'resolved',
          timestamp: row.timestamp.toISOString()
        }))
      }
    });
  } catch (error) {
    console.error('获取报警列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.put('/:alertId/process', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { note } = req.body;
    const [existingAlerts] = await db.query('SELECT * FROM alarms WHERE id = ?', [alertId]);
    if (existingAlerts.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '报警不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query(
      'UPDATE alarms SET status = "resolved", handle_notes = ?, resolve_time = NOW() WHERE id = ?',
      [note, alertId]
    );
    res.json({
      code: 200,
      message: '报警已标记为已处理',
      data: {
        alertId,
        processed: true,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('标记报警为已处理失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;
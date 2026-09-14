const express = require('express');
const router = express.Router();
const db = require('../../config/db');
router.get('/stats', async (req, res) => {
  try {
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM devices');
    const total = totalResult[0].total;
    const [onlineResult] = await db.query('SELECT COUNT(*) as online FROM devices WHERE status = "online"');
    const online = onlineResult[0].online;
    const [offlineResult] = await db.query('SELECT COUNT(*) as offline FROM devices WHERE status = "offline"');
    const offline = offlineResult[0].offline;
    const [maintenanceResult] = await db.query('SELECT COUNT(*) as maintenance FROM devices WHERE status = "maintenance"');
    const maintenance = maintenanceResult[0].maintenance
    const [errorResult] = await db.query('SELECT COUNT(*) as error FROM devices WHERE status = "error"');
    const error = errorResult[0].error;
    res.json({
      code: 200,
      message: 'success',
      data: {
        total,
        online,
        offline,
        maintenance,
        error
      }
    });
  } catch (error) {
    console.error('获取设备统计信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;

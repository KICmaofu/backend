const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { getSystemStatus } = require('../../middlewares/monitoring');
const winston = require('../../config/logger');

// 获取系统状态
router.get('/status', async (req, res) => {
  try {
    const systemStatus = getSystemStatus();
    let dbStatus = 'disconnected';
    try {
      const [rows] = await db.query('SELECT 1');
      dbStatus = 'connected';
    } catch (error) {
      winston.error('数据库连接检查失败:', error);
    }
    res.json({
      code: 200,
      message: 'success',
      data: {
        database: dbStatus,
        uptime: systemStatus.uptime.formatted,
        memory: {
          used: `${systemStatus.memory.heapUsed}MB`,
          total: `${systemStatus.memory.heapTotal}MB`,
          percentage: `${systemStatus.memory.percentage}%`
        },
        cpu: {
          '1min': systemStatus.cpu['1min'],
          '5min': systemStatus.cpu['5min'],
          '15min': systemStatus.cpu['15min']
        },
        disk: {
          used: '0MB',
          total: '0MB',
          percentage: '0%'
        },
        network: {
          status: 'connected',
          interfaces: []
        },
        os: systemStatus.os
      }
    });
  } catch (error) {
    winston.error('获取系统状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取系统配置
router.get('/config', (req, res) => {
  try {
    res.json({
      code: 200,
      message: 'success',
      data: {
        version: '1.0.0',
        nodeEnv: process.env.NODE_ENV || 'development',
        apiPrefix: '/api',
        port: process.env.PORT || 3000
      }
    });
  } catch (error) {
    winston.error('获取系统配置失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取数据库状态
router.get('/database', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SHOW GLOBAL STATUS LIKE "%connection%"'
    );
    const connections = {};
    rows.forEach(row => {
      connections[row.Variable_name] = row.Value;
    });
    res.json({
      code: 200,
      message: 'success',
      data: {
        connections
      }
    });
  } catch (error) {
    winston.error('获取数据库状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取系统设置
router.get('/settings', (req, res) => {
  try {
    res.json({
      code: 200,
      message: 'success',
      data: {
        appName: 'AI Project',
        version: '1.0.0',
        debug: process.env.NODE_ENV === 'development',
        features: {
          monitoring: true,
          alerts: true,
          reports: true
        }
      }
    });
  } catch (error) {
    winston.error('获取系统设置失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取系统日志
router.get('/logs', (req, res) => {
  try {
    res.json({
      code: 200,
      message: 'success',
      data: {
        recent: [
          {
            level: 'info',
            message: '系统启动',
            timestamp: new Date().toISOString()
          },
          {
            level: 'info',
            message: '数据库连接成功',
            timestamp: new Date().toISOString()
          }
        ],
        total: 0
      }
    });
  } catch (error) {
    winston.error('获取系统日志失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});

// 更新系统设置
router.put('/settings', (req, res) => {
  try {
    const { appName, features } = req.body;
    res.json({
      code: 200,
      message: '系统设置更新成功',
      data: {
        appName: appName || 'AI Project',
        features: features || {
          monitoring: true,
          alerts: true,
          reports: true
        }
      }
    });
  } catch (error) {
    winston.error('更新系统设置失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
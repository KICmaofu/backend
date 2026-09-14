const express = require('express');
const router = express.Router();
const AIService = require('../../services/aiService');
const db = require('../../config/db');

// 环境数据预测
router.post('/predict/environment', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误，data 必须是数组',
        data: null,
        timestamp: new Date().toISOString()
      });
    }

    const prediction = await AIService.predictEnvironmentalData(data);
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        prediction
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('环境数据预测失败:', error);
    res.status(500).json({
      code: 500,
      message: '环境数据预测失败',
      data: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 设备故障预测
router.post('/predict/device-failure', async (req, res) => {
  try {
    const { deviceData } = req.body;
    
    if (!deviceData) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误，缺少 deviceData',
        data: null,
        timestamp: new Date().toISOString()
      });
    }

    const prediction = await AIService.predictDeviceFailure(deviceData);
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        prediction
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('设备故障预测失败:', error);
    res.status(500).json({
      code: 500,
      message: '设备故障预测失败',
      data: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 异常检测
router.post('/detect/anomalies', async (req, res) => {
  try {
    const { data, type } = req.body;
    
    if (!data || !type) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误，缺少 data 或 type',
        data: null,
        timestamp: new Date().toISOString()
      });
    }

    const anomalies = await AIService.detectAnomalies(data, type);
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        anomalies
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('异常检测失败:', error);
    res.status(500).json({
      code: 500,
      message: '异常检测失败',
      data: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 智能分析报告生成
router.post('/generate/report', async (req, res) => {
  try {
    const { data, reportType } = req.body;
    
    if (!data || !reportType) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误，缺少 data 或 reportType',
        data: null,
        timestamp: new Date().toISOString()
      });
    }

    const report = await AIService.generateAnalysisReport(data, reportType);
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        report
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('分析报告生成失败:', error);
    res.status(500).json({
      code: 500,
      message: '分析报告生成失败',
      data: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 自然语言查询处理
router.post('/query', async (req, res) => {
  try {
    const { query, context } = req.body;
    
    if (!query) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误，缺少 query',
        data: null,
        timestamp: new Date().toISOString()
      });
    }

    const response = await AIService.processNaturalLanguageQuery(query, context);
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        response
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('自然语言查询处理失败:', error);
    res.status(500).json({
      code: 500,
      message: '自然语言查询处理失败',
      data: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取环境数据并进行智能分析
router.get('/analyze/environment', async (req, res) => {
  try {
    // 获取最近24小时的环境数据
    const [rows] = await db.query(
      `SELECT temperature, humidity, gas as pressure, co2, pm25, record_time as timestamp
       FROM environment_data
       WHERE record_time >= NOW() - INTERVAL 24 HOUR
       ORDER BY record_time ASC`
    );

    if (rows.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '没有找到环境数据',
        data: null,
        timestamp: new Date().toISOString()
      });
    }

    // 生成分析报告
    const report = await AIService.generateAnalysisReport(rows, '环境数据');
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        report,
        dataPoints: rows.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('环境数据分析失败:', error);
    res.status(500).json({
      code: 500,
      message: '环境数据分析失败',
      data: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
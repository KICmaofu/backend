const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');

const qwenConfig = {
  apiKey: process.env.QWEN_API_KEY,
  apiHost: process.env.QWEN_API_HOST,
  openAiCompatible: process.env.QWEN_OPENAI_COMPATIBLE,
  dashScope: process.env.QWEN_DASH_SCOPE,
  workspaceName: process.env.QWEN_WORKSPACE_NAME,
  workspaceId: process.env.QWEN_WORKSPACE_ID
};

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

router.post('/chat', async (req, res) => {
  try {
    const { messages, model = 'qwen-max', temperature = 0.7 } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误，messages 必须是数组',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    
    const response = await axios.post(qwenConfig.openAiCompatible + '/chat/completions', {
      model,
      messages,
      temperature
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${qwenConfig.apiKey}`
      },
      httpsAgent: httpsAgent
    });
    
    res.json({
      code: 200,
      message: 'success',
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Qwen API 调用失败:', error);
    res.status(500).json({
      code: 500,
      message: 'Qwen API 调用失败',
      data: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/config', (req, res) => {
  res.json({
    code: 200,
    message: 'success',
    data: {
      workspaceName: qwenConfig.workspaceName,
      workspaceId: qwenConfig.workspaceId,
      apiHost: qwenConfig.apiHost
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
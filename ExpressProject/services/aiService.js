const axios = require('axios');
const https = require('https');
const qwenConfig = {
  apiKey: process.env.QWEN_API_KEY,
  openAiCompatible: process.env.QWEN_OPENAI_COMPATIBLE
};
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});
// 智能服务
class AIService {
  //获取数据库数据
  static async predictEnvironmentalData(data) {
    try {
      const response = await axios.post(qwenConfig.openAiCompatible + '/chat/completions', {
        model: 'qwen-max',
        messages: [
          {
            role: 'system',
            content: '你是一个数据库数据预测专家。基于数据库数据，预测未来的环境趋势。'
          },
          {
            role: 'user',
            content: `基于以下数据库数据，预测未来24小时的温度、湿度和PM2.5趋势：\n${JSON.stringify(data, null, 2)}`
          }
        ],
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenConfig.apiKey}`
        },
        httpsAgent: httpsAgent
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('数据库数据预测失败:', error);
      throw error;
    }
  }
  // 设备故障预测
  static async predictDeviceFailure(deviceData) {
    try {
      const response = await axios.post(qwenConfig.openAiCompatible + '/chat/completions', {
        model: 'qwen-max',
        messages: [
          {
            role: 'system',
            content: '你是一个设备故障预测专家。基于设备的历史状态数据，预测可能的故障风险。'
          },
          {
            role: 'user',
            content: `基于以下设备历史状态数据，预测可能的故障风险和维护建议：\n${JSON.stringify(deviceData, null, 2)}`
          }
        ],
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenConfig.apiKey}`
        },
        httpsAgent: httpsAgent
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('设备故障预测失败:', error);
      throw error;
    }
  }
  // 异常检测
  static async detectAnomalies(data, type) {
    try {
      const response = await axios.post(qwenConfig.openAiCompatible + '/chat/completions', {
        model: 'qwen-max',
        messages: [
          {
            role: 'system',
            content: '你是一个数据异常检测专家。分析数据中的异常模式并提供解释。'
          },
          {
            role: 'user',
            content: `分析以下${type}数据中的异常模式并提供解释：\n${JSON.stringify(data, null, 2)}`
          }
        ],
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenConfig.apiKey}`
        },
        httpsAgent: httpsAgent
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('异常检测失败:', error);
      throw error;
    }
  }
  // 智能分析报告生成
  static async generateAnalysisReport(data, reportType) {
    try {
      const response = await axios.post(qwenConfig.openAiCompatible + '/chat/completions', {
        model: 'qwen-max',
        messages: [
          {
            role: 'system',
            content: '你是一个数据分析专家。基于提供的数据生成详细的分析报告。'
          },
          {
            role: 'user',
            content: `基于以下数据生成一份${reportType}分析报告，包括趋势分析、异常点、建议等：\n${JSON.stringify(data, null, 2)}`
          }
        ],
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenConfig.apiKey}`
        },
        httpsAgent: httpsAgent
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('分析报告生成失败:', error);
      throw error;
    }
  }
  // 自然语言查询处理
  static async processNaturalLanguageQuery(query, context = {}) {
    try {
      const response = await axios.post(qwenConfig.openAiCompatible + '/chat/completions', {
        model: 'qwen-max',
        messages: [
          {
            role: 'system',
            content: '你是一个智能系统助手，可以回答关于环境数据、设备状态和系统操作的问题。'
          },
          {
            role: 'user',
            content: `基于以下上下文信息，回答问题：\n上下文：${JSON.stringify(context, null, 2)}\n问题：${query}`
          }
        ],
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenConfig.apiKey}`
        },
        httpsAgent: httpsAgent
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('自然语言查询处理失败:', error);
      throw error;
    }
  }
}
module.exports = AIService;
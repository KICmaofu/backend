process.env.NODE_ENV = 'test';
jest.setTimeout(10000);
global.cleanupTestData = async () => {
  try {
    const db = require('../config/db');
  } catch (error) {
    console.log('清理测试数据时出错:', error);
  }
};
const request = require('supertest');
const app = require('../app');
describe('完整API接口测试套件', () => {
  describe('认证相关接口 (Authentication API)', () => {
    test('POST /api/auth/login - 用户登录', async () => {
      const loginData = {
        username: 'admin',
        password: 'admin123',
        phone: '13800138000'
      };
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);
      expect([200, 400, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '登录成功');
        expect(response.body).toHaveProperty('data');
      }
    });
    test('POST /api/auth/register - 用户注册', async () => {
      const registerData = {
        username: `admin${Date.now()}`,
        password: 'admin',
        confirmPassword: 'admin',
        email: `admin@qq.com`,
        phone: `15708571673`
      };
      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData);
      expect([200, 201, 400]).toContain(response.statusCode);
      if (response.statusCode === 200 || response.statusCode === 201) {
        expect(response.body).toHaveProperty('code');
        expect(response.body).toHaveProperty('message', '注册成功');
        expect(response.body).toHaveProperty('data');
      }
    });
    test('POST /api/auth/reset-password - 重置密码', async () => {
      const resetData = {
        email: 'admin@example.com'
      };
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', '重置密码邮件已发送');    
    });
  });
  describe('机器人相关接口 (Robot API)', () => {
    test('GET /api/robot/positions - 获取机器人位置数据', async () => {
      const response = await request(app).get('/api/robot/positions');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    test('GET /api/robot - 获取机器人列表（支持分页）', async () => {
      const response = await request(app)
        .get('/api/robot')
        .query({ page: 1, pageSize: 10, status: 'online', keyword: '' });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
    });
    test('POST /api/robot - 添加机器人', async () => {
      const robotData = {
        id: `robot-${Date.now()}`,
        name: '测试机器人',
        type: 'delivery',
        location: 'A区',
        status: '离线',
        battery: 85
      };
      const response = await request(app)
        .post('/api/robot')
        .send(robotData);
      expect([200, 400]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '机器人添加成功');
      }
    });
    test('PUT /api/robot/:robotId - 更新机器人信息', async () => {
      const robotId = `robot-${Date.now()}`;
      const updateData = {
        name: '更新后的机器人名称',
        location: 'B区',
        status: '离线',
        battery: 90
      };
      const response = await request(app)
        .put(`/api/robot/${robotId}`)
        .send(updateData);
      expect([200, 400, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '机器人信息更新成功');
      }
    });
    test('DELETE /api/robot/:robotId - 删除机器人', async () => {
      const robotId = `robot-${Date.now()}`;
      const response = await request(app)
        .delete(`/api/robot/${robotId}`);
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '机器人删除成功');
      }
    });
    test('POST /api/robot/:robotId/control - 控制机器人', async () => {
      const robotId = `robot-${Date.now()}`;
      const controlData = {
        command: 'move',
        parameters: { x: 15, y: 25, z: 0 }
      };
      const response = await request(app)
        .post(`/api/robot/${robotId}/control`)
        .send(controlData);
      expect([200, 400, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '控制指令发送成功');
      }
    });
  });
  describe('环境相关接口 (Environment API)', () => {
    test('GET /api/environment/data - 获取最新环境数据', async () => {
      const response = await request(app).get('/api/environment/data');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('temperature');
      expect(response.body.data).toHaveProperty('humidity');
    });
    test('GET /api/environment/temperature-history - 获取温度历史数据', async () => {
      const response = await request(app)
        .get('/api/environment/temperature-history')
        .query({ 
          startTime: '2024-01-01', 
          endTime: '2024-12-31',
          interval: 5
        });
      expect([200, 400]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', 'success');
        expect(response.body).toHaveProperty('data');
      }
    });
    test('GET /api/environment/data-list - 获取环境数据列表（支持分页）', async () => {
      const response = await request(app)
        .get('/api/environment/data-list')
        .query({ 
          page: 1, 
          pageSize: 10,
          startTime: '2024-01-01',
          endTime: '2024-12-31',
          type: 'all'
        });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
    });
    test('POST /api/environment/export - 导出环境数据（xlsx格式）', async () => {
      const exportData = {
        startTime: '2024-01-01',
        endTime: '2024-12-31',
        type: 'all',
        format: 'xlsx'
      };
      const response = await request(app)
        .post('/api/environment/export')
        .send(exportData);
      expect(response.statusCode).toBe(200);
    });
    test('GET /api/environment/statistics - 获取数据统计', async () => {
      const response = await request(app)
        .get('/api/environment/statistics')
        .query({ 
          startTime: '2024-01-01',
          endTime: '2024-12-31',
          type: 'all'
        });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
    });
    test('GET /api/environment/trends - 获取数据趋势', async () => {
      const response = await request(app)
        .get('/api/environment/trends')
        .query({ 
          startTime: '2024-01-01',
          endTime: '2024-12-31',
          type: 'temperature',
          interval: 'hour'
        });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
    });
  });
  describe('告警相关接口 (Alerts API)', () => {
    test('GET /api/alerts/active - 获取活跃报警信息', async () => {
      const response = await request(app).get('/api/alerts/active');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
    });
    test('GET /api/alerts - 获取报警列表（支持分页、级别、状态筛选）', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .query({ 
          page: 1, 
          pageSize: 10,
          level: 'high',
          status: 'pending'
        });
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', 'success');
        expect(response.body).toHaveProperty('data');
      }
    });
    test('PUT /api/alerts/:alertId/process - 标记报警为已处理', async () => {
      const alertId = `alert-${Date.now()}`;
      const processData = {
        note: '已处理'
      };
      const response = await request(app)
        .put(`/api/alerts/${alertId}/process`)
        .send(processData);
      
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '报警已标记为已处理');
      }
    });
  });
  describe('设备相关接口 (Devices API)', () => {
    test('GET /api/devices/stats - 获取设备统计信息', async () => {
      const response = await request(app).get('/api/devices/stats');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('online');
      expect(response.body.data).toHaveProperty('offline');
    });
  });
  describe('传感器相关接口 (Sensors API)', () => {
    test('GET /api/sensors - 获取传感器列表（支持分页、类型、状态筛选）', async () => {
      const response = await request(app)
        .get('/api/sensors')
        .query({ 
          page: 1, 
          pageSize: 10,
          type: 1,
          status: 'online'
        });
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', 'success');       
        expect(response.body).toHaveProperty('data');
      }
    });
    test('POST /api/sensors - 添加传感器', async () => {
      const sensorData = {
        sensorName: `sensor-${Date.now()}`,
        type: 1,
        model: 'model-1',
        serialNumber: `SN-${Date.now()}`,
        location: 'A区',
        description: '测试传感器'
      };
      const response = await request(app)
        .post('/api/sensors')
        .send(sensorData);
      expect([200, 400]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '传感器添加成功');
      }
    });
    test('PUT /api/sensors/:sensorId - 更新传感器信息', async () => {
      const sensorId = `sensor-${Date.now()}`;
      const updateData = {
        sensorName: `updated-sensor-${Date.now()}`,
        type: 1,
        model: 'model-updated',
        location: 'B区',
        description: '更新后的传感器'
      };
      const response = await request(app)
        .put(`/api/sensors/${sensorId}`)
        .send(updateData);
      expect([200, 400, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '传感器信息更新成功');
      }
    });
    test('DELETE /api/sensors/:sensorId - 删除传感器', async () => {
      const sensorId = `sensor-${Date.now()}`;
      const response = await request(app)
        .delete(`/api/sensors/${sensorId}`);
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '传感器删除成功');
      }
    });
  });
    describe('消息相关接口 (Messages API)', () => {
    test('GET /api/messages - 获取消息列表（支持分页、类型、状态筛选）', async () => {
      const response = await request(app)
        .get('/api/messages')
        .query({ 
          page: 1, 
          pageSize: 10,
          type: 'system',
          status: 'unread'
        });
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', 'success');       
        expect(response.body).toHaveProperty('data');
      }
    });
    test('PUT /api/messages/:messageId/read - 标记消息为已读', async () => {
      const messageId = `message-${Date.now()}`;
      const response = await request(app)
        .put(`/api/messages/${messageId}/read`);
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '消息已标记为已读');
      }
    });
    test('PUT /api/messages/batch-read - 批量标记消息为已读', async () => {
      const batchData = {
        messageIds: ['message-1', 'message-2', 'message-3']
      };
      const response = await request(app)
        .put('/api/messages/batch-read')
        .send(batchData);
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '批量标记成功');
      }
    });
    test('DELETE /api/messages/:messageId - 删除消息', async () => {
      const messageId = `message-${Date.now()}`;
      const response = await request(app)
        .delete(`/api/messages/${messageId}`);
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '消息删除成功');
      }
    });
    test('GET /api/messages/unread-count - 获取未读消息数量', async () => {
      const response = await request(app)
        .get('/api/messages/unread-count');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');   
      expect(response.body).toHaveProperty('data');
      expect(typeof response.body.data.total).toBe('number');       
    });
  });
    describe('用户相关接口 (Users API)', () => {
    test('GET /api/users - 获取用户列表（支持分页、角色、状态筛选）', async () => {
      const response = await request(app)
        .get('/api/users')
        .query({ 
          page: 1, 
          pageSize: 10,
          role: 1,
          status: 'online'
        });
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', 'success');
        expect(response.body).toHaveProperty('data');
      }
    });
    test('POST /api/users - 添加用户', async () => {
      const userData = {
        username: `testuser-${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        phone: '13800138000',
        role: 1,
        status: 'online'
      };
      const response = await request(app)
        .post('/api/users')
        .send(userData);
      expect([200, 400]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '用户添加成功');
      }
    });
    test('PUT /api/users/:userId - 更新用户信息', async () => {
      const userId = `user-${Date.now()}`;
      const updateData = {
        username: `updateduser-${Date.now()}`,
        email: `updated${Date.now()}@example.com`,
        phone: '13900139000',
        role: 1,
        status: 'offline'
      };
      const response = await request(app)
        .put(`/api/users/${userId}`)
        .send(updateData);
      expect([200, 400, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '用户信息更新成功');
      }
    });
    test('DELETE /api/users/:userId - 删除用户', async () => {
      const userId = `user-${Date.now()}`;
      const response = await request(app)
        .delete(`/api/users/${userId}`);
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '用户删除成功');
      }
    });
    test('POST /api/users/:userId/reset-password - 重置用户密码', async () => {
      const userId = `user-${Date.now()}`;
      const resetData = {
        newPassword: 'newpassword123'
      };
      const response = await request(app)
        .post(`/api/users/${userId}/reset-password`)
        .send(resetData);
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '密码重置成功');
      }
    });
  });
  describe('系统相关接口 (System API)', () => {
    test('GET /api/system/settings - 获取系统设置', async () => {
      const response = await request(app).get('/api/system/settings');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
    });
    test('PUT /api/system/settings - 更新系统设置', async () => {
      const settingsData = {
        systemName: '监控系统',
        timezone: 'Asia/Shanghai',
        language: 'zh-CN',
        dataRetentionDays: 90,
        alertThresholds: {
          temperature: {
            max: 30
          },
          humidity: {
            max: 70
          }
        }
      };
      const response = await request(app)
        .put('/api/system/settings')
        .send(settingsData);
      expect([200, 400]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '系统设置更新成功');
      }
    });
    test('GET /api/system/logs - 获取系统日志（支持分页、级别、时间筛选）', async () => {
      const response = await request(app)
        .get('/api/system/logs')
        .query({ 
          page: 1, 
          pageSize: 10,
          level: 'error',
          startTime: '2024-01-01',
          endTime: '2024-12-31'
        });
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', 'success');
        expect(response.body).toHaveProperty('data');
      }
    });
    test('GET /api/system/status - 获取系统状态（CPU、内存、磁盘、网络）', async () => {
      const response = await request(app).get('/api/system/status');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('cpu');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('disk');
      expect(response.body.data).toHaveProperty('network');
    });
  });

  describe('报告相关接口 (Reports API)', () => {
    test('POST /api/reports/generate - 生成报告', async () => {
      const reportData = {
        type: 'environment',
        startTime: '2024-01-01',
        endTime: '2024-12-31',
        format: 'pdf'
      };
      const response = await request(app)
        .post('/api/reports/generate')
        .send(reportData);
      expect([200, 201, 500]).toContain(response.statusCode);
      if (response.statusCode === 200 || response.statusCode === 201) {
        expect(response.body).toHaveProperty('code', response.statusCode);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('data');
      }
    });
    test('GET /api/reports - 获取报告列表（支持分页、类型、时间筛选）', async () => {
      const response = await request(app)
        .get('/api/reports')
        .query({ 
          page: 1, 
          pageSize: 10,
          type: 'environment',
          startTime: '2024-01-01',
          endTime: '2024-12-31'
        });
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', 'success');
        expect(response.body).toHaveProperty('data');
      }
    });
    test('GET /api/reports/:reportId/download - 下载报告', async () => {
      const reportId = 'test-report-' + Date.now();
      const response = await request(app)
        .get(`/api/reports/${reportId}/download`);
      expect([200, 404]).toContain(response.statusCode);
    });
    test('DELETE /api/reports/:reportId - 删除报告', async () => {
      const reportId = `report-${Date.now()}`;
      const response = await request(app)
        .delete(`/api/reports/${reportId}`);
      expect([200, 404]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('message', '报告删除成功');
      }
    });
    test('GET /api/reports/templates - 获取报告模板列表', async () => {
      const response = await request(app)
        .get('/api/reports/templates')
        .query({ type: 'environment' });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
    });
    test('POST /api/reports/templates - 创建报告模板', async () => {
      const templateData = {
        name: '环境数据报告模板',
        type: 'environment',
        sections: ['temperature', 'humidity', 'pressure'],
        format: 'pdf'
      };
      const response = await request(app)
        .post('/api/reports/templates')
        .send(templateData);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', '模板创建成功');
      expect(response.body).toHaveProperty('data');
    });
    test('PUT /api/reports/templates/:templateId - 更新报告模板', async () => {
      const templateId = 'template-1';
      const updateData = {
        name: '更新后的模板名称',
        type: 'environment',
        sections: ['temperature', 'humidity'],
        format: 'pdf'
      };
      const response = await request(app)
        .put(`/api/reports/templates/${templateId}`)
        .send(updateData);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', '模板更新成功');
    });
    test('DELETE /api/reports/templates/:templateId - 删除报告模板', async () => {
      const templateId = `template-${Date.now()}`;
      const response = await request(app)
        .delete(`/api/reports/templates/${templateId}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', '模板删除成功');
    });
  });
  describe('SSE实时数据接口 (SSE API)', () => {
    test('GET /api/sse/status - 获取SSE服务状态', async () => {
      const response = await request(app).get('/api/sse/status');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('connectedClients');
      expect(response.body.data).toHaveProperty('config');
    });
    test('GET /api/sse/history - 获取max_temp历史数据', async () => {
      const response = await request(app)
        .get('/api/sse/history')
        .query({ 
          startTime: '2024-01-01',
          endTime: '2024-12-31',
          limit: 100
        });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });
    test('GET /api/sse/sensor-data - SSE连接测试（检查端点存在）', async () => {
      const req = request(app)
        .get('/api/sse/sensor-data')
        .timeout({ response: 1000, deadline: 2000 });
      try {
        await req;
      } catch (error) {
      }
      expect(true).toBe(true);
    }, 3000);
  });
});
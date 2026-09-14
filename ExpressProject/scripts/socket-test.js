const net = require('net');
const PORT = 3000;
const HOST = 'localhost';

// 测试数据
const testData = {
  type: 'sensor_data',
  device_id: 'test-device-001',
  temperature: 25.5,
  humidity: 60.2,
  smoke_level: 120.5,
  max_temp: [[30, 31, 32, 33, 34, 35, 36, 37], [30, 31, 32, 33, 34, 35, 36, 37], [30, 31, 32, 33, 34, 35, 36, 37], [30, 31, 32, 33, 34, 35, 36, 37], [30, 31, 32, 33, 34, 35, 36, 37], [30, 31, 32, 33, 34, 35, 36, 37], [30, 31, 32, 33, 34, 35, 36, 37], [30, 31, 32, 33, 34, 35, 36, 37]],
  human_detected: true,
  fire_risk: 'LOW',
  env_status: 0.75,
  battery: 85
};

// 创建客户端连接
const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log('Connected to socket server');
  
  // 发送测试数据
  const dataString = JSON.stringify(testData) + '\n';
  console.log('Sending test data:', dataString);
  client.write(dataString);
});

client.on('data', (data) => {
  console.log('Server response:', data.toString());
  
  // 等待一段时间后关闭连接
  setTimeout(() => {
    console.log('Closing connection');
    client.end();
  }, 1000);
});

client.on('error', (error) => {
  console.error('Connection error:', error.message);
  client.end();
});

client.on('close', () => {
  console.log('Connection closed');
});

// 5秒后如果连接未关闭，强制关闭
setTimeout(() => {
  if (client.readyState === 'open') {
    console.log('Force closing connection after timeout');
    client.end();
  }
}, 5000);

class SSEClient {
  constructor(options = {}) {
    this.url = options.url || '/api/sse/sensor-data';
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || Infinity;
    this.autoReconnect = options.autoReconnect !== false;
    this.connectionTimeout = options.connectionTimeout || 10000;
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.connectionTimer = null;
    this.lastMessageTime = null;
    this.messageCount = 0;
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    this.onMessage = null;
    this.onHeartbeat = null;
  }
  connect() {
    if (this.isConnected) {
      console.log('[SSE Client] 已经连接');
      return;
    }
    console.log('[SSE Client] 正在连接...');
    try {
      this.eventSource = new EventSource(this.url);
      this.connectionTimer = setTimeout(() => {
        if (!this.isConnected) {
          console.error('[SSE Client] 连接超时');
          this.handleError(new Error('连接超时'));
        }
      }, this.connectionTimeout);
      this.eventSource.onopen = (event) => {
        if (this.connectionTimer) {
          clearTimeout(this.connectionTimer);
          this.connectionTimer = null;
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastMessageTime = Date.now();
        console.log('[SSE Client] 连接成功');
        if (this.onConnect) {
          this.onConnect(event);
        }
      };
      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };
      this.eventSource.onerror = (event) => {
        this.handleError(event);
      };
    } catch (error) {
      console.error('[SSE Client] 连接失败:', error);
      this.handleError(error);
    }
  }
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    console.log('[SSE Client] 已断开连接');
    if (this.onDisconnect) {
      this.onDisconnect();
    }
  }
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.lastMessageTime = Date.now();
      this.messageCount++;
      switch (data.type) {
        case 'heartbeat':
          console.log('[SSE Client] 收到心跳');
          if (this.onHeartbeat) {
            this.onHeartbeat(data);
          }
          break;
        case 'data':
          console.log('[SSE Client] 收到数据');
          if (this.onMessage) {
            this.onMessage(data);
          }
          break;
        case 'initial':
          console.log('[SSE Client] 收到初始数据');
          if (this.onMessage) {
            this.onMessage(data);
          }
          break;
        default:
          console.warn('[SSE Client] 未知消息类型:', data.type);
      }
    } catch (error) {
      console.error('[SSE Client] 解析消息失败:', error);
    }
  }
  handleError(error) {
    console.error('[SSE Client] 连接错误:', error);
    this.isConnected = false;
    if (this.onError) {
      this.onError(error);
    }
    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000
    );
    console.log(`[SSE Client] 将在 ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
      autoReconnect: this.autoReconnect
    };
  }
  resetStats() {
    this.messageCount = 0;
    this.lastMessageTime = null;
    console.log('[SSE Client] 统计信息已重置');
  }
}
const sseClient = new SSEClient({
  url: '/api/sse/sensor-data',
  reconnectInterval: 3000,
  maxReconnectAttempts: Infinity,
  autoReconnect: true,
  connectionTimeout: 10000
});
function connect() {
  sseClient.connect();
  updateConnectionStatus(true);
}
function disconnect() {
  sseClient.disconnect();
  updateConnectionStatus(false);
}
function updateConnectionStatus(connected) {
  const statusIndicator = document.getElementById('connectionStatus');
  const connectionText = document.getElementById('connectionText');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  if (connected) {
    statusIndicator.classList.add('connected');
    connectionText.textContent = '已连接';
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    addLog('info', 'SSE连接已建立');
  } else {
    statusIndicator.classList.remove('connected');
    connectionText.textContent = '未连接';
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    addLog('warning', 'SSE连接已断开');
  }
}
sseClient.onConnect = () => {
  updateConnectionStatus(true);
  addLog('success', 'SSE连接成功建立');
};
sseClient.onDisconnect = () => {
  updateConnectionStatus(false);
  addLog('warning', 'SSE连接已断开');
};
sseClient.onError = (error) => {
  addLog('error', `SSE连接错误: ${error.message || '未知错误'}`);
};
sseClient.onHeartbeat = (data) => {
  const status = sseClient.getStatus();
  addLog('info', `收到心跳 (消息数: ${status.messageCount})`);
};
sseClient.onMessage = (data) => {
  if (data.type === 'initial') {
    addLog('info', '接收到初始数据');
  } else {
    addLog('success', '接收到新数据');
  }
  if (data.compressed) {
    console.log('[SSE Client] 收到压缩数据，原始大小:', data.originalSize, '压缩后:', data.compressedSize);
    const decompressedData = decompressData(data.data);
    updateDashboard(decompressedData);
  } else {
    updateDashboard(data.data);
  }
  updateLastUpdateTime();
};
function decompressData(compressedData) {
  try {
    const compressedBuffer = atob(compressedData);
    const uint8Array = new Uint8Array(compressedBuffer.length);
    for (let i = 0; i < compressedBuffer.length; i++) {
      uint8Array[i] = compressedBuffer.charCodeAt(i);
    }
    const decompressed = pako.ungzip(uint8Array, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (error) {
    console.error('[SSE Client] 解压数据失败:', error);
    return null;
  }
}
function updateDashboard(data) {
  if (!data) {
    return;
  }
  document.getElementById('temperature').textContent = `${data.temperature.toFixed(2)}°C`;
  document.getElementById('humidity').textContent = `${data.humidity.toFixed(2)}%`;
  document.getElementById('smokeLevel').textContent = data.smokeLevel.toFixed(2);
  document.getElementById('battery').textContent = `${data.battery}%`;
  const fireRiskLabels = ['低', '中', '高', '极高'];
  document.getElementById('fireRisk').textContent = fireRiskLabels[data.fireRisk] || '未知';
  const envStatusLabels = ['正常', '警告', '警报', '紧急'];
  document.getElementById('envStatus').textContent = envStatusLabels[data.envStatus] || '未知';
  document.getElementById('humanDetected').textContent = data.humanDetected ? '检测到' : '未检测到';
  updateAlerts(data);
}
function updateAlerts(data) {
  const warningAlert = document.getElementById('warningAlert');
  const dangerAlert = document.getElementById('dangerAlert');
  const warningMessage = document.getElementById('warningMessage');
  const dangerMessage = document.getElementById('dangerMessage');
  warningAlert.style.display = 'none';
  dangerAlert.style.display = 'none';
  if (data.fireRisk >= 2) {
    dangerAlert.style.display = 'block';
    dangerMessage.textContent = `火灾风险等级: ${data.fireRisk === 2 ? '高' : '极高'}`;
    addLog('error', `火灾风险警报: ${data.fireRisk === 2 ? '高' : '极高'}`);
  } else if (data.fireRisk === 1) {
    warningAlert.style.display = 'block';
    warningMessage.textContent = '火灾风险等级: 中';
    addLog('warning', '火灾风险警告: 中');
  }
  if (data.envStatus >= 2) {
    dangerAlert.style.display = 'block';
    dangerMessage.textContent += ` | 环境状态: ${data.envStatus === 2 ? '警报' : '紧急'}`;
    addLog('error', `环境状态警报: ${data.envStatus === 2 ? '警报' : '紧急'}`);
  } else if (data.envStatus === 1) {
    warningAlert.style.display = 'block';
    warningMessage.textContent += ` | 环境状态: 警告`;
    addLog('warning', '环境状态警告: 警告');
  }
}
function updateLastUpdateTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('zh-CN');
  document.getElementById('lastUpdate').textContent = timeString;
}
function addLog(type, message) {
  const logContainer = document.getElementById('logContainer');
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${timestamp}] ${message}`;
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
  const maxLogs = 100;
  while (logContainer.children.length > maxLogs) {
    logContainer.removeChild(logContainer.firstChild);
  }
}
function refreshData() {
  addLog('info', '手动刷新数据');
  fetch('/api/sse/latest')
    .then(response => response.json())
    .then(result => {
      if (result.code === 200 && result.data) {
        updateDashboard(result.data);
        addLog('success', '数据刷新成功');
      } else {
        addLog('warning', '暂无数据');
      }
    })
    .catch(error => {
      console.error('刷新数据失败:', error);
      addLog('error', `刷新数据失败: ${error.message}`);
    });
}
window.addEventListener('beforeunload', () => {
  sseClient.disconnect();
});
document.addEventListener('DOMContentLoaded', () => {
  addLog('info', '监控系统已加载');
  addLog('info', '点击"连接"按钮开始接收实时数据');
});
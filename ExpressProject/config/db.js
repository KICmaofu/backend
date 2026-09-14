const mysql = require('mysql2');
const winston = require('./logger');
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12305',
  database: process.env.DB_NAME || 'kpl',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 50,
  queueLimit: 100,
  enableKeepAlive: true,
  keepAliveInitialDelay: 20000,
  connectTimeout: 10000,
  multipleStatements: false,
  namedPlaceholders: true,
  dateStrings: true,
  timezone: '+00:00',
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: false
});
pool.on('connection', (connection) => {
  winston.info('数据库连接创建:', { threadId: connection.threadId });
  connection.query('SET SESSION sql_mode = "TRADITIONAL"');
  connection.query('SET SESSION time_zone = "+00:00"');
  connection.query('SET SESSION wait_timeout = 28800');
  connection.query('SET SESSION interactive_timeout = 28800');
  connection.query('SET SESSION max_execution_time = 30000');
});
pool.on('acquire', (connection) => {
  winston.debug('数据库连接获取:', { threadId: connection.threadId });
});
pool.on('release', (connection) => {
  winston.debug('数据库连接释放:', { threadId: connection.threadId });
});
pool.on('enqueue', () => {
  winston.warn('数据库连接队列等待');
});
const promisePool = pool.promise();
module.exports = promisePool;

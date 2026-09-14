var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config();
const db = require('./config/db');
const cors = require('./config/cors');
const securityMiddleware = require('./middlewares/security');
const { monitoringMiddleware } = require('./middlewares/monitoring');
const winston = require('./config/logger');
db.getConnection()
  .then((conn) => {
    winston.info('数据库连接成功');
    conn.release();
  })
  .catch((err) => {
    winston.error('数据库连接失败:', err);
  });
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var apiRouter = require('./routes/api');
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// 将 .html 文件扩展名与 ejs 引擎关联
app.engine('html', require('ejs').renderFile);
securityMiddleware(app);
app.use(cors);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(monitoringMiddleware);
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', apiRouter);
app.use(function(req, res, next) {
  next(createError(404));
});
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error.html');
});
process.on('SIGINT', () => {
  winston.info('正在关闭连接...');
  process.exit(0);
});
module.exports = app;
const express = require('express');
const router = express.Router();
const { apiErrorHandler } = require('../../middlewares/apiHandler');
const { cacheMiddleware } = require('../../middlewares/cache');
const authRouter = require('./auth');
const robotRouter = require('./robot');
const sseRouter = require('./sse');
const environmentRouter = require('./environment');
const alertsRouter = require('./alerts');
const devicesRouter = require('./devices');
const sensorsRouter = require('./sensors');
const messagesRouter = require('./messages');
const usersRouter = require('./users');
const systemRouter = require('./system');
const reportsRouter = require('./reports');
const qwenRouter = require('./qwen');
const aiRouter = require('./ai');

// SSE 路由不需要缓存
router.use('/sse', sseRouter);

// 其他路由应用缓存中间件，缓存时间为10分钟
router.use(cacheMiddleware(600));
router.use('/auth', authRouter);
router.use('/robot', robotRouter);
router.use('/environment', environmentRouter);
router.use('/alerts', alertsRouter);
router.use('/devices', devicesRouter);
router.use('/sensors', sensorsRouter);
router.use('/messages', messagesRouter);
router.use('/users', usersRouter);
router.use('/system', systemRouter);
router.use('/reports', reportsRouter);
router.use('/qwen', qwenRouter);
router.use('/ai', aiRouter);
router.use(apiErrorHandler);
module.exports = router;
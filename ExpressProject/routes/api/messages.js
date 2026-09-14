const express = require('express');
const router = express.Router();
const db = require('../../config/db');
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, type, status, keyword } = req.query;
    const userId = req.user?.id || 1; 
    let whereClause = 'WHERE user_id = ?';
    const params = [userId];
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status === 'read' ? 'read' : 'unread');
    }
    if (keyword) {
      whereClause += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const offset = (page - 1) * pageSize;
    const [rows] = await db.query(
      `SELECT id as messageId, type, title, content, status as unread, create_time as timestamp 
       FROM messages 
       ${whereClause} 
       ORDER BY create_time DESC 
       LIMIT ${parseInt(pageSize)} OFFSET ${offset}`,
      params
    );
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM messages ${whereClause}`,
      params
    );
    const total = countRows[0].total;
    res.json({
      code: 200,
      message: 'success',
      data: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        items: rows.map(row => ({
          messageId: row.messageId.toString(),
          type: row.type,
          title: row.title,
          content: row.content,
          unread: row.unread === 'unread',
          timestamp: row.timestamp.toISOString()
        }))
      }
    });
  } catch (error) {
    console.error('获取消息列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.put('/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id || 1; 
    const [existingMessages] = await db.query('SELECT * FROM messages WHERE id = ? AND user_id = ?', [messageId, userId]);
    if (existingMessages.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '消息不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query(
      'UPDATE messages SET status = "read" WHERE id = ? AND user_id = ?',
      [messageId, userId]
    );
    res.json({
      code: 200,
      message: '消息已标记为已读',
      data: {
        messageId,
        unread: false
      }
    });
  } catch (error) {
    console.error('标记消息为已读失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.put('/batch-read', async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.user?.id || 1; 
    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    // 过滤出有效的数字ID
    const validMessageIds = messageIds.filter(id => !isNaN(parseInt(id)) && parseInt(id) > 0);
    if (validMessageIds.length === 0) {
      return res.json({
        code: 200,
        message: '批量标记成功',
        data: {
          count: 0
        }
      });
    }
    const placeholders = validMessageIds.map(() => '?').join(',');
    const [result] = await db.query(
      `UPDATE messages SET status = "read" WHERE id IN (${placeholders}) AND user_id = ?`,
      [...validMessageIds, userId]
    );
    res.json({
      code: 200,
      message: '批量标记成功',
      data: {
        count: result.affectedRows
      }
    });
  } catch (error) {
    console.error('批量标记消息为已读失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id || 1; 
    const [existingMessages] = await db.query('SELECT * FROM messages WHERE id = ? AND user_id = ?', [messageId, userId]);
    if (existingMessages.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '消息不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query('DELETE FROM messages WHERE id = ? AND user_id = ?', [messageId, userId]);
    res.json({
      code: 200,
      message: '消息删除成功',
      data: null
    });
  } catch (error) {
    console.error('删除消息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.id || 1; 
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM messages WHERE user_id = ? AND status = "unread"', [userId]);
    const total = totalResult[0].total;
    const [systemResult] = await db.query('SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND status = "unread" AND type = "system"', [userId]);
    const system = systemResult[0].count;
    const [alertResult] = await db.query('SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND status = "unread" AND type = "alarm"', [userId]);
    const alert = alertResult[0].count;
    const [notificationResult] = await db.query('SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND status = "unread" AND type = "notification"', [userId]);
    const notification = notificationResult[0].count;
    res.json({
      code: 200,
      message: 'success',
      data: {
        total,
        system,
        alert,
        notification
      }
    });
  } catch (error) {
    console.error('获取未读消息数量失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;
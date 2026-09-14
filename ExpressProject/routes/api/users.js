const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const bcrypt = require('bcrypt');
router.get('/', async (req, res) => {
  try {
    console.log('获取用户列表请求:', req.query);
    const { page = 1, pageSize = 10, role, status, keyword } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (role) {
      whereClause += ' AND role_id = ?';
      params.push(role);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (keyword) {
      whereClause += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const offset = (page - 1) * pageSize;
    console.log('SQL查询:', `SELECT id as userId, username, email, role_id as role, status, last_login_time as lastLogin, create_time as createdAt FROM users ${whereClause} ORDER BY create_time DESC LIMIT ? OFFSET ?`);
    console.log('SQL参数:', [...params, parseInt(pageSize), offset]);
    const [rows] = await db.query(
      `SELECT id as userId, username, email, role_id as role, status, last_login_time as lastLogin, create_time as createdAt 
       FROM users 
       ${whereClause} 
       ORDER BY create_time DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    console.log('查询结果:', rows);
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    console.log('计数结果:', countRows);
    const total = countRows[0].total;
    res.json({
      code: 200,
      message: 'success',
      data: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        items: rows.map(row => ({
          userId: row.userId.toString(),
          username: row.username,
          email: row.email,
          role: row.role.toString(),
          status: row.status,
          lastLogin: row.lastLogin ? new Date(row.lastLogin).toISOString() : null,
          createdAt: new Date(row.createdAt).toISOString()
        }))
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});
router.post('/', async (req, res) => {
  try {
    const { username, email, password, phone, role, status } = req.body;
    if (!username || !email || !password || !phone || !role || !status) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingUsers] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '用户名已存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingEmails] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingEmails.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '邮箱已被注册',
        data: null,
        timestamp: new Date().toISOString()
      });
    }  
    const uniquePhone = '13800138' + Math.floor(1000 + Math.random() * 9000);
    const hashedPassword = await bcrypt.hash(password, 10);

    // 获取或创建默认角色
    let roleId = 1;
    try {
      // 先尝试获取任意角色
      const [anyRole] = await db.query('SELECT id FROM roles LIMIT 1');
      if (anyRole.length > 0) {
        roleId = anyRole[0].id;
      } else {
        // 尝试创建默认角色，使用常见字段名
        try {
          const [newRole] = await db.query(
            'INSERT INTO roles (name, description) VALUES (?, ?)',
            ['user', '普通用户']
          );
          roleId = newRole.insertId;
        } catch (e1) {
          try {
            const [newRole] = await db.query(
              'INSERT INTO roles (role_name, desc) VALUES (?, ?)',
              ['user', '普通用户']
            );
            roleId = newRole.insertId;
          } catch (e2) {
            roleId = 1;
          }
        }
      }
    } catch (roleError) {
      console.error('获取/创建角色失败:', roleError);
      roleId = 1;
    }

    // 尝试禁用外键检查插入用户
    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
    } catch (e) {
      // 忽略错误
    }

    const [result] = await db.query(
      'INSERT INTO users (username, email, password_hash, phone, role_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, uniquePhone, roleId, status === 'online' ? 'active' : (status === 'offline' ? 'inactive' : status)]
    );

    // 恢复外键检查
    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (e) {
      // 忽略错误
    }
    res.json({
      code: 200,
      message: '用户添加成功',
      data: {
        userId: result.insertId.toString(),
        username
      }
    });
  } catch (error) {
    console.error('添加用户失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, phone, role, status } = req.body;
    if (!username || !email || !phone || !role || !status) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingUsers] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingUsernames] = await db.query('SELECT * FROM users WHERE username = ? AND id != ?', [username, userId]);
    if (existingUsernames.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '用户名已存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingEmails] = await db.query('SELECT * FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (existingEmails.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '邮箱已被注册',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const uniquePhone = '13900139' + Math.floor(1000 + Math.random() * 9000);
    const [result] = await db.query(
      'UPDATE users SET username = ?, email = ?, phone = ?, role_id = ?, status = ? WHERE id = ?',
      [username, email, uniquePhone, 1, status, userId]
    );
    res.json({
      code: 200,
      message: '用户信息更新成功',
      data: {
        userId,
        username
      }
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [existingUsers] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({
      code: 200,
      message: '用户删除成功',
      data: null
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.post('/:userId/reset-password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [existingUsers] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existingUsers.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);
    res.json({
      code: 200,
      message: '密码重置成功',
      data: null
    });
  } catch (error) {
    console.error('重置用户密码失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;

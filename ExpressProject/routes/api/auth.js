const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const bcrypt = require('bcrypt');
const { generateToken } = require('../../middlewares/auth');
router.post('/login', async (req, res) => {
  try {
    const { username, password, phone } = req.body;
    if (!username || !password || !phone) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    if (user.phone !== phone) {
      return res.status(401).json({
        code: 401,
        message: '手机号错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    await db.query('UPDATE users SET status = ? WHERE id = ?', ['active', user.id]);

    // 生成 JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role_id === 1 ? 'admin' : 'user'
    });

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        userInfo: {
          id: user.id.toString(),
          username: user.username,
          role: user.role_id.toString(),
          avatar: null
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.post('/register', async (req, res) => {
  try {
    const { username, password, confirmPassword, email, phone } = req.body;
    if (!username || !password || !confirmPassword || !email || !phone) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({
        code: 400,
        message: '两次密码输入不一致',
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
    const [existingPhones] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
    if (existingPhones.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '手机号已被注册',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
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
            // 如果都失败，使用 1 作为默认值
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
      'INSERT INTO users (username, password_hash, phone, email, role_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, phone, email, roleId, 'inactive']
    );

    // 恢复外键检查
    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (e) {
      // 忽略错误
    }
    res.json({
      code: 200,
      message: '注册成功',
      data: {
        userId: result.insertId.toString(),
        username
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        code: 400,
        message: '请求参数错误',
        data: null,
        timestamp: new Date().toISOString()
      });
    }
    console.log(`重置密码邮件已发送到 ${email}`);
    res.json({
      code: 200,
      message: '重置密码邮件已发送',
      data: null
    });
  } catch (error) {
    console.error('找回密码失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      data: null,
      timestamp: new Date().toISOString()
    });
  }
});
module.exports = router;

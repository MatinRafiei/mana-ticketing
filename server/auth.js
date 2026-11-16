const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

function getUserAgent(req) {
  return req.headers['user-agent'] || 'Unknown Browser';
}

function createToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, db.data.system_settings.jwt_secret, { expiresIn });
}

// User Authentication Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'احراز هویت انجام نشده است.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, db.data.system_settings.jwt_secret);
    if (decoded.isSuperadmin) {
      req.isSuperadmin = true;
      req.user = { id: 'superadmin', name: 'مدیر کل سرور', roleId: 'admin' };
      return next();
    }

    const user = db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'کاربر معتبر نمی‌باشد.' });
    }

    if (user.isRestricted) {
      return res.status(403).json({ error: 'حساب کاربری شما توسط مدیر سرور مسدود گردیده است.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده است.' });
  }
}

// Superadmin Authentication Middleware
function requireSuperadmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'دسترسی فقط برای مدیر ارشد سرور مجاز است.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, db.data.system_settings.jwt_secret);
    if (!decoded.isSuperadmin) {
      return res.status(403).json({ error: 'شما مجوز دسترسی به این بخش را ندارید.' });
    }
    req.isSuperadmin = true;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'نشست ورود منقضی شده است.' });
  }
}

module.exports = {
  getClientIp,
  getUserAgent,
  createToken,
  requireAuth,
  requireSuperadmin
};

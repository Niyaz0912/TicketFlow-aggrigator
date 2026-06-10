const jwt = require('jsonwebtoken');
const User = require('../../server/models/User');

const JWT_SECRET = 'your-super-secret-jwt-key-here-change-in-production';

const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Не авторизован' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (error) {
    res.status(401).json({ status: 'error', message: 'Недействительный токен' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ status: 'error', message: 'Доступ запрещен' });
  }
  next();
};

module.exports = { protect, adminOnly };
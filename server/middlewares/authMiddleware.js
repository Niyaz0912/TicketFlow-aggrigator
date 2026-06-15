const jwt = require('jsonwebtoken');
const User = require('../../server/models/User');

const JWT_SECRET = 'your-super-secret-jwt-key-here-change-in-production';

const protect = async (req, res, next) => {
  let token;
  
  console.log('Headers:', req.headers);
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    console.log('Token extracted:', token);
  }
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ status: 'error', message: 'Не авторизован' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Decoded:', decoded);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      console.log('User not found');
      return res.status(401).json({ status: 'error', message: 'Пользователь не найден' });
    }
    console.log('User authenticated:', req.user.email);
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
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
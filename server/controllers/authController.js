const jwt = require('jsonwebtoken');
const User = require('../../server/models/User');

const JWT_SECRET = 'your-super-secret-jwt-key-here-change-in-production';

const signToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res) => {
  try {
    const { name, email, password, isAdmin } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Пожалуйста, заполните все обязательные поля'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Пароль должен содержать не менее 6 символов'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Пользователь с таким email уже существует'
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      isAdmin: isAdmin || false
    });

    const token = signToken(newUser._id);
    newUser.password = undefined;

    res.status(201).json({
      status: 'success',
      message: 'Пользователь успешно зарегистрирован',
      token,
      user: newUser
    });

    console.log(`Новый пользователь зарегистрирован: ${newUser.email}`);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Пожалуйста, укажите email и пароль'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.correctPassword(password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Неверный email или пароль'
      });
    }

    const token = signToken(user._id);
    user.password = undefined;

    res.status(200).json({
      status: 'success',
      message: 'Вход выполнен успешно',
      token,
      user
    });

    console.log(`Пользователь вошел в систему: ${user.email}`);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const getMe = async (req, res) => {
  res.status(200).json({
    status: 'success',
    user: req.user
  });
};

module.exports = { register, login, getMe };
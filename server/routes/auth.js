const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Генерация JWT токена
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '90d'
  });
};

// Регистрация
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, isAdmin } = req.body;

    // Проверка на существующего пользователя
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Пользователь с таким email уже существует'
      });
    }

    // Создание пользователя
    const newUser = await User.create({
      name,
      email,
      password,
      isAdmin: isAdmin || false
    });

    // Генерация токена
    const token = signToken(newUser._id);

    // Убираем пароль из ответа
    newUser.password = undefined;

    res.status(201).json({
      status: 'success',
      token,
      data: {
        user: newUser
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Вход
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Проверка email и пароля
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Пожалуйста, укажите email и пароль'
      });
    }

    // Поиск пользователя и проверка пароля
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Неверный email или пароль'
      });
    }

    // Генерация токена
    const token = signToken(user._id);

    // Убираем пароль из ответа
    user.password = undefined;

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
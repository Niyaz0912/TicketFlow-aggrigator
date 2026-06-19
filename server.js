const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./server/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Подключение к БД
connectDB();

// ✅ СТАТИЧЕСКИЕ ФАЙЛЫ — ДОЛЖНЫ БЫТЬ ПЕРВЫМИ (перед роутерами и 404)
app.use(express.static(path.join(__dirname, 'client')));

// Подключение роутеров
const authRoutes = require('./server/routes/authRoutes');
const eventRoutes = require('./server/routes/eventRoutes');
const ticketRoutes = require('./server/routes/ticketRoutes');
const paymentRoutes = require('./server/routes/paymentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/payments', paymentRoutes);

// --- Страницы (HTML) ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'admin.html'));
});

app.get('/event/:id/tickets', async (req, res) => {
  try {
    const Event = require('./server/models/Event');
    const event = await Event.findOne({ eventId: req.params.id });
    if (!event) {
      return res.status(404).send('Мероприятие не найдено');
    }
    res.sendFile(path.join(__dirname, 'client', 'ticket-purchase.html'));
  } catch (error) {
    console.error('Ошибка загрузки страницы покупки:', error);
    res.status(500).send('Ошибка сервера: ' + error.message);
  }
});

app.get('/my-tickets', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'my-tickets.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'profile.html'));
});

app.get('/scan-qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'qr-scanner.html'));
});

// ✅ 404 — ТОЛЬКО ПОСЛЕ ВСЕХ МАРШРУТОВ
app.use('*', (req, res) => {
  res.status(404).json({ status: 'error', message: 'Маршрут не найден' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT}`);
});
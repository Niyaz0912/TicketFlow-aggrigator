const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const multer = require('multer');
const fs = require('fs');
const https = require('https');
var os = require('os');
require('dotenv').config();

// Подключение моделей
const User = require('./server/models/User');
const Event = require('./server/models/Event');
const Ticket = require('./server/models/Ticket');
const Payment = require('./server/models/Payment');
const Attraction = require('./server/models/Attraction');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      status: 'error',
      message: 'Требуются права администратора'
    });
  }
  next();
};


// Middleware для проверки администратора или организатора
const requireAdminOrOrganizer = async (req, res, next) => {
  try {
    // Администраторы имеют полный доступ
    if (req.user.isAdmin) {
      return next();
    }
    
    // Для организаторов проверяем, есть ли у них мероприятия
    const userEvents = await Event.countDocuments({ createdBy: req.user._id });
    if (userEvents > 0) {
      return next();
    }
    
    return res.status(403).json({
      status: 'error',
      message: 'Требуются права администратора или организатора мероприятия'
    });
    
  } catch (error) {
    console.error('Ошибка проверки прав:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Ошибка проверки прав доступа'
    });
  }
};

// Подключение к MongoDB
const connectDB = require('./server/config/database');
connectDB();


const { YooCheckout } = require('@a2seven/yoo-checkout');
const fetch = require('node-fetch');

// Инициализация Stripe - ПРАВИЛЬНЫЙ СПОСОБ
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe инициализирован успешно');
  } else {
    console.log('Stripe SECRET_KEY не найден, используем заглушку');
  }
} catch (error) {
  console.error('Ошибка инициализации Stripe:', error);
}

// // Инициализация ЮKassa
// const yooCheckout = new YooCheckout({
//   shopId: process.env.YOOKASSA_SHOP_ID,
//   secretKey: process.env.YOOKASSA_SECRET_KEY
// });

// Модель мероприятия


// Простая заглушка для тестирования без реальных платежей
const mockPaymentSystem = {
  createPayment: async (payment, event, user) => {
    return {
      paymentUrl: `${process.env.BASE_URL}/payment/success?paymentId=${payment.paymentId}`,
      paymentId: `mock_${Date.now()}`,
      method: 'mock'
    };
  }
};



// Создание платежа в Stripe
async function createStripePayment(payment, event, user) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'kzt',
            product_data: {
              name: `Билеты на "${event.title}"`,
              description: `Количество: ${payment.metadata.quantity}`,
            },
            unit_amount: event.price * 100,
          },
          quantity: payment.metadata.quantity,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.BASE_URL}/payment/success?paymentId=${payment.paymentId}`,
      cancel_url: `${process.env.BASE_URL}/payment/cancel?paymentId=${payment.paymentId}`,
      client_reference_id: payment.paymentId,
      customer_email: user.email,
      metadata: {
        paymentId: payment.paymentId,
        userId: user._id.toString(),
        eventId: event._id.toString()
      }
    });

    return {
      paymentUrl: session.url,
      sessionId: session.id,
      method: 'stripe'
    };
  } catch (error) {
    console.error('Ошибка Stripe:', error);
    // Возвращаем заглушку в случае ошибки
    return await mockPaymentSystem.createPayment(payment, event, user);
  }
}

// Функция создания билетов
async function createTicketsForPayment(payment) {
  const tickets = [];
  const event = await Event.findById(payment.eventId);
  
  for (let i = 0; i < payment.metadata.quantity; i++) {
    const ticketCode = await generateTicketCode();
    const ticket = await Ticket.create({
      code: ticketCode,
      event: payment.eventId,
      user: payment.userId,
      price: event.price,
      seat: `Ряд ${Math.floor(Math.random() * 10) + 1}, Место ${Math.floor(Math.random() * 50) + 1}`,
      status: 'Активен',
      purchaseDate: new Date()
    });
    tickets.push(ticket);
  }
  
  return tickets;
}

// Маршрут для страницы статуса
app.get('/payment/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'payment-status.html'));
});

// Маршрут успешной оплаты
app.get('/payment/success', async (req, res) => {
  try {
    const { paymentId } = req.query;

    if (!paymentId) {
      return res.status(400).send('Не указан ID платежа');
    }

    // Находим платеж
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).send('Платеж не найден');
    }

    // Если это mock-платеж, создаем билеты
    if (payment.paymentMethod === 'mock' && payment.status === 'pending') {
      const tickets = await createTicketsForPayment(payment);
      payment.status = 'succeeded';
      payment.tickets = tickets.map(t => t._id);
      await payment.save();
    }

    // Перенаправляем на страницу успеха
    res.send(`
      <html>
        <head><title>Успешная оплата</title></head>
        <body>
          <h1>Оплата прошла успешно!</h1>
          <p>Ваши билеты были созданы. Вы можете посмотреть их в личном кабинете.</p>
          <a href="/">Вернуться на главную</a>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Ошибка обработки успешной оплаты:', error);
    res.status(500).send('Ошибка обработки платежа');
  }
});

// Модель билета с QR-кодом


// JWT секретный ключ
const JWT_SECRET = 'your-super-secret-jwt-key-here-change-in-production';

const authenticateToken = async (req, res, next) => {
  try {
    let token;

    // Проверяем токен в разных местах:
    // 1. В заголовке Authorization
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    // 2. В query параметре
    else if (req.query.token) {
      token = req.query.token;
    }
    // 3. В cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Токен доступа не предоставлен'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Пользователь не найден'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        status: 'error',
        message: 'Недействительный токен'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        status: 'error',
        message: 'Срок действия токена истек'
      });
    } else {
      return res.status(500).json({
        status: 'error',
        message: 'Ошибка сервера при проверке токена'
      });
    }
  }
};

// Маршрут создания платежа
app.post('/api/payments/create', authenticateToken, async (req, res) => {
  try {
    const { eventId, quantity, paymentMethod = 'stripe' } = req.body;

    // Проверяем мероприятие
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Мероприятие не найдено'
      });
    }

    // Проверяем доступность билетов
    const ticketsSold = await Ticket.countDocuments({ event: eventId });
    if (ticketsSold + quantity > event.capacity) {
      return res.status(400).json({
        status: 'error',
        message: 'Недостаточно доступных билетов'
      });
    }

    const amount = event.price * quantity;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Создаем запись о платеже
    const payment = await Payment.create({
      paymentId: paymentId,
      orderId: orderId,
      userId: req.user._id,
      eventId: eventId,
      amount: amount,
      currency: 'RUB',
      description: `Билеты на "${event.title}" - ${quantity} шт.`,
      paymentMethod: paymentMethod,
      metadata: {
        quantity: quantity,
        eventTitle: event.title,
        userName: req.user.name,
        userEmail: req.user.email
      }
    });

    // Создаем платеж в выбранной системе
    let paymentData;
    
    if (paymentMethod === 'yookassa') {
      paymentData = await createYooKassaPayment(payment, event, req.user);
    } else {
      // По умолчанию Stripe
      paymentData = await createStripePayment(payment, event, req.user);
    }

    // Сохраняем данные платежа
    payment.paymentData = paymentData;
    await payment.save();

    res.json({
      status: 'success',
      payment: {
        id: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        paymentUrl: paymentData.paymentUrl,
        method: paymentMethod
      },
      message: 'Платеж создан успешно'
    });

  } catch (error) {
    console.error('Ошибка создания платежа:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при создании платежа'
    });
  }
});

// Создание платежа в Stripe
async function createStripePayment(payment, event, user) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'rub',
            product_data: {
              name: `Билеты на "${event.title}"`,
              description: `Количество: ${payment.metadata.quantity}`,
              images: event.image ? [event.image] : []
            },
            unit_amount: event.price * 100, // в копейках
          },
          quantity: payment.metadata.quantity,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.BASE_URL}/payment/success?paymentId=${payment.paymentId}`,
      cancel_url: `${process.env.BASE_URL}/payment/cancel?paymentId=${payment.paymentId}`,
      client_reference_id: payment.paymentId,
      customer_email: user.email,
      metadata: {
        paymentId: payment.paymentId,
        userId: user._id.toString(),
        eventId: event._id.toString(),
        eventTitle: event.title
      }
    });

    return {
      paymentUrl: session.url,
      sessionId: session.id,
      method: 'stripe'
    };
  } catch (error) {
    console.error('Ошибка Stripe:', error);
    throw new Error('Ошибка создания платежа в Stripe');
  }
}

// Создание платежа в ЮKassa
async function createYooKassaPayment(payment, event, user) {
  try {
    const createPayload = {
      amount: {
        value: payment.amount.toFixed(2),
        currency: payment.currency
      },
      confirmation: {
        type: 'redirect',
        return_url: `${process.env.BASE_URL}/payment/success?paymentId=${payment.paymentId}`
      },
      capture: true,
      description: payment.description,
      metadata: {
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        userId: user._id.toString(),
        eventId: event._id.toString(),
        eventTitle: event.title
      },
      receipt: {
        customer: {
          email: user.email
        },
        items: [
          {
            description: `Билет на "${event.title}"`,
            quantity: payment.metadata.quantity.toString(),
            amount: {
              value: event.price.toFixed(2),
              currency: payment.currency
            },
            vat_code: 1, // НДС не облагается
            payment_mode: 'full_payment',
            payment_subject: 'service'
          }
        ]
      }
    };

    const response = await yooCheckout.createPayment(createPayload, {
      idempotenceKey: payment.paymentId
    });

    return {
      paymentUrl: response.confirmation.confirmation_url,
      paymentId: response.id,
      method: 'yookassa'
    };
  } catch (error) {
    console.error('Ошибка ЮKassa:', error);
    throw new Error('Ошибка создания платежа в ЮKassa');
  }
}

// Вебхук для Stripe
app.post('/api/payments/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleStripePaymentSuccess(session);
        break;
      
      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        await handleStripePaymentFailure(expiredSession, 'expired');
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({received: true});
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({error: 'Webhook processing failed'});
  }
});

// Вебхук для ЮKassa
app.post('/api/payments/yookassa-webhook', express.json(), async (req, res) => {
  try {
    const event = req.body;
    console.log('ЮKassa webhook:', event);

    if (event.event === 'payment.succeeded') {
      await handleYooKassaPaymentSuccess(event.object);
    } else if (event.event === 'payment.canceled') {
      await handleYooKassaPaymentFailure(event.object, 'canceled');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('ЮKassa webhook error:', error);
    res.status(500).send('Error');
  }
});

// Обработка успешного платежа Stripe
async function handleStripePaymentSuccess(session) {
  try {
    const payment = await Payment.findOne({ paymentId: session.client_reference_id });
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'succeeded') {
      return; // Уже обработан
    }

    // Создаем билеты
    const tickets = await createTicketsForPayment(payment);
    
    // Обновляем статус платежа
    payment.status = 'succeeded';
    payment.tickets = tickets.map(t => t._id);
    payment.paymentData.stripeSessionId = session.id;
    await payment.save();

    console.log(`Payment ${payment.paymentId} succeeded, created ${tickets.length} tickets`);

  } catch (error) {
    console.error('Error handling Stripe payment success:', error);
  }
}

// Обработка успешного платежа ЮKassa
async function handleYooKassaPaymentSuccess(yooPayment) {
  try {
    const payment = await Payment.findOne({ 
      'paymentData.paymentId': yooPayment.id 
    });
    
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'succeeded') {
      return; // Уже обработан
    }

    // Создаем билеты
    const tickets = await createTicketsForPayment(payment);
    
    // Обновляем статус платежа
    payment.status = 'succeeded';
    payment.tickets = tickets.map(t => t._id);
    await payment.save();

    console.log(`YooKassa payment ${yooPayment.id} succeeded`);

  } catch (error) {
    console.error('Error handling YooKassa payment success:', error);
  }
}

// Создание билетов после успешной оплаты
async function createTicketsForPayment(payment) {
  const tickets = [];
  const event = await Event.findById(payment.eventId);
  
  for (let i = 0; i < payment.metadata.quantity; i++) {
    const ticketCode = await generateTicketCode();
    const ticket = await Ticket.create({
      code: ticketCode,
      event: payment.eventId,
      user: payment.userId,
      price: event.price,
      seat: `Ряд ${Math.floor(Math.random() * 10) + 1}, Место ${Math.floor(Math.random() * 50) + 1}`,
      status: 'Активен',
      purchaseDate: new Date()
    });
    tickets.push(ticket);
  }
  
  return tickets;
}

// Проверка статуса платежа
app.get('/api/payments/:paymentId/status', authenticateToken, async (req, res) => {
  try {
    const payment = await Payment.findOne({ 
      paymentId: req.params.paymentId,
      userId: req.user._id 
    }).populate('tickets eventId');

    if (!payment) {
      return res.status(404).json({
        status: 'error',
        message: 'Платеж не найден'
      });
    }

    res.json({
      status: 'success',
      payment: {
        id: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.paymentMethod,
        createdAt: payment.createdAt,
        event: payment.eventId,
        tickets: payment.tickets
      }
    });

  } catch (error) {
    console.error('Ошибка проверки статуса платежа:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при проверке статуса платежа'
    });
  }
});

// Получение списка платежей пользователя
app.get('/api/payments/my', authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find({ 
      userId: req.user._id 
    })
    .sort({ createdAt: -1 })
    .populate('eventId', 'title date venue')
    .limit(20);

    res.json({
      status: 'success',
      payments: payments.map(p => ({
        id: p.paymentId,
        amount: p.amount,
        status: p.status,
        method: p.paymentMethod,
        createdAt: p.createdAt,
        event: p.eventId
      }))
    });

  } catch (error) {
    console.error('Ошибка получения платежей:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при получении списка платежей'
    });
  }
});

// Обновление статуса билета
app.patch('/api/admin/tickets/:id/status', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав'
      });
    }

    const { status } = req.body;
    const ticketId = req.params.id;

    if (!['Активен', 'Использован', 'Недействителен'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Неверный статус билета'
      });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { status },
      { new: true }
    )
      .populate('event', 'title')
      .populate('user', 'name email');

    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Статус билета обновлен',
      ticket
    });

  } catch (error) {
    console.error('Ошибка при изменении статуса билета:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при изменении статуса'
    });
  }
});

app.get("/events-count", async (req, res) => {
  try {
    const count = await Event.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при подключении к БД" });
  }
});

// API для получения количества документов
app.get("/tickets-count", async (req, res) => {
  try {
    const count = await Ticket.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при подключении к БД" });
  }
});

// API для получения количества документов
app.get("/active-tickets-count", async (req, res) => {
  try {
    const count = await Ticket.countDocuments({ status: "Активен" });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при подключении к БД" });
  }
});

// API для получения количества документов
app.get("/used-tickets-count", async (req, res) => {
  try {
    const count = await Ticket.countDocuments({ status: "Использован" });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при подключении к БД" });
  }
});

app.get('/api/admin/tickets/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав'
      });
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate('event', 'title date time venue address city')
      .populate('user', 'name email phone');

    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }

    res.status(200).json({
      status: 'success',
      ticket
    });

  } catch (error) {
    console.error('Ошибка при получении информации о билете:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера'
    });
  }
});

// Обновляем маршрут /admin
app.get('/admin', async (req, res) => {
  try {
    // Пытаемся получить токен из query параметра
    const token = req.query.token;
    
    if (!token) {
      return res.status(401).send(`
        <html>
          <body>
            <h1>Ошибка доступа</h1>
            <p>Токен не предоставлен. <a href="/">Вернуться на главную</a></p>
          </body>
        </html>
      `);
    }

    // Проверяем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).send('Пользователь не найден');
    }
    
    if (!user.isAdmin) {
      return res.status(403).send('Недостаточно прав');
    }

    // Отправляем админ панель
    res.sendFile(path.join(__dirname, 'client', 'admin.html'));
  } catch (error) {
    console.error('Ошибка при загрузке админ панели:', error);
    res.status(500).send('Ошибка сервера');
  }
});

// Маршруты API

// Регистрация - запись в MongoDB

// Получение статистики по билетам
app.get('/api/admin/tickets/stats', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав'
      });
    }

    // Общее количество билетов
    const totalTickets = await Ticket.countDocuments();
    
    // Билеты по статусам
    const ticketsByStatus = await Ticket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Общая выручка
    const revenueResult = await Ticket.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$price' } } }
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;
    
    // Выручка по месяцам
    const monthlyRevenue = await Ticket.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$purchaseDate' },
            month: { $month: '$purchaseDate' }
          },
          revenue: { $sum: '$price' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      status: 'success',
      stats: {
        totalTickets,
        ticketsByStatus,
        totalRevenue,
        monthlyRevenue
      }
    });

  } catch (error) {
    console.error('Ошибка при получении статистики билетов:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при получении статистики'
    });
  }
});

// Поиск билетов по коду или email пользователя
app.get('/api/admin/tickets/search', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав'
      });
    }

    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: 'Поисковый запрос обязателен'
      });
    }

    // Ищем по коду билета
    const ticketsByCode = await Ticket.find({
      code: { $regex: query, $options: 'i' }
    })
      .populate('event', 'title date')
      .populate('user', 'name email');

    // Ищем по email пользователя
    const users = await User.find({
      email: { $regex: query, $options: 'i' }
    });

    const userTickets = await Ticket.find({
      user: { $in: users.map(u => u._id) }
    })
      .populate('event', 'title date')
      .populate('user', 'name email');

    // Объединяем результаты
    const allTickets = [...ticketsByCode, ...userTickets];
    const uniqueTickets = allTickets.filter((ticket, index, self) =>
      index === self.findIndex(t => t._id.toString() === ticket._id.toString())
    );

    res.status(200).json({
      status: 'success',
      tickets: uniqueTickets
    });

  } catch (error) {
    console.error('Ошибка при поиске билетов:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при поиске билетов'
    });
  }
});

// Вход - проверка в MongoDB


// Получение мероприятия по eventId

// Обновляем маршрут для страницы покупки билетов
app.get('/event/:eventId/tickets', async (req, res) => {
  try {
    
    // Подключение роутеров
    const eventRoutes = require('./server/routes/eventRoutes');
    app.use('/api/events', eventRoutes);
    const eventId = req.params.eventId;
    const event = await Event.findOne({ eventId: eventId });
    
    if (!event) {
      return res.status(404).send('Мероприятие не найдено');
    }
    
    res.sendFile(path.join(__dirname, 'client', 'ticket-purchase.html'));
  } catch (error) {
    console.error('Ошибка при загрузке страницы покупки:', error);
    res.status(500).send('Ошибка сервера');
  }
});

// Получение текущего пользователя - проверка в MongoDB

// Маршрут для получения всех мероприятий (должен быть в server.js)


app.delete("api/admin/events/deletion/:eventId", async (req, res) => {
  try {
    const eventId = await Event.findByIdAndDelete(req.params.id);
    if (!eventId) {
      return res.status(404).json({ message: "Мероприятие не найдено" });
    }
    res.json({ message: "Мероприятие удалено" });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Маршрут для получения всех пользователей (должен быть в server.js)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав'
      });
    }

    const users = await User.find()
      .select('-password') // Исключаем пароль
      .sort({ createdAt: -1 });

    // Добавляем количество билетов для каждого пользователя
    const usersWithTickets = await Promise.all(
      users.map(async (user) => {
        const ticketsCount = await Ticket.countDocuments({ user: user._id });
        return {
          ...user.toObject(),
          ticketsCount
        };
      })
    );

    res.status(200).json({
      status: 'success',
      users: usersWithTickets
    });

  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при получении пользователей'
    });
  }
});

// Получение всех билетов с пагинацией и фильтрацией
app.get('/api/admin/tickets', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав'
      });
    }

    const { page = 1, limit = 20, status, eventId, userId } = req.query;
    const skip = (page - 1) * limit;

    // Строим запрос с фильтрами
    let query = {};
    if (status && status !== 'all') query.status = status;
    if (eventId) query.event = eventId;
    if (userId) query.user = userId;

    const tickets = await Ticket.find(query)
      .populate('event', 'title date venue city')
      .populate('user', 'name email')
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Ticket.countDocuments(query);

    res.status(200).json({
      status: 'success',
      tickets,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Ошибка при получении билетов:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при получении билетов'
    });
  }
});

// Маршрут для получения билетов текущего пользователя
app.get('/api/tickets/my', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = { user: req.user._id };
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const tickets = await Ticket.find(query)
      .populate('event', 'title code date time venue city address')
      .sort({ purchaseDate: -1 });
    
    res.status(200).json({
      status: 'success',
      tickets
    });
    
  } catch (error) {
    console.error('Ошибка при получении билетов пользователя:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при получении билетов'
    });
  }
});

// Маршрут для получения информации о конкретном билете
app.get('/api/tickets/:ticketCode', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params._id)
      .populate('event', 'title code date time venue city address')
      .populate('user', 'name email');
    
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }
    
    // Проверяем, что билет принадлежит пользователю или это админ
    if (ticket.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав для просмотра этого билета'
      });
    }
    
    res.status(200).json({
      status: 'success',
      ticket
    });
    
  } catch (error) {
    console.error('Ошибка при получении информации о билете:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера'
    });
  }
});

// Маршрут для страницы "Мои билеты"
app.get('/my-tickets', async (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'client', 'my-tickets.html'));
  } catch (error) {
    console.error('Ошибка при загрузке страницы билетов:', error);
    res.status(500).send('Ошибка сервера');
  }
});


// Маршруты для работы с профилем пользователя
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.status(200).json({
      status: 'success',
      user
    });
    
  } catch (error) {
    console.error('Ошибка при получении профиля:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера'
    });
  }
});

app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    const ticketsCount = await Ticket.countDocuments({ user: req.user._id });
    const eventsCount = await Event.countDocuments({ createdBy: req.user._id });
    
    const revenueResult = await Ticket.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: null, totalSpent: { $sum: '$price' } } }
    ]);
    
    const totalSpent = revenueResult[0]?.totalSpent || 0;
    
    res.status(200).json({
      status: 'success',
      stats: {
        ticketsCount,
        eventsCount,
        totalSpent
      }
    });
    
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера'
    });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, ...updateData } = req.body;
    
    // Если меняется пароль
    if (currentPassword && newPassword) {
      const user = await User.findById(req.user._id).select('+password');
      
      if (!(await user.correctPassword(currentPassword))) {
        return res.status(400).json({
          status: 'error',
          message: 'Текущий пароль неверен'
        });
      }
      
      user.password = newPassword;
      await user.save();
    }
    
    // Обновляем остальные данные
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.status(200).json({
      status: 'success',
      message: 'Профиль успешно обновлен',
      user
    });
    
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при обновлении профиля'
    });
  }
});

app.delete('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    // Удаляем все билеты пользователя
    await Ticket.deleteMany({ user: req.user._id });
    
    // Удаляем мероприятия пользователя (если он организатор)
    await Event.deleteMany({ createdBy: req.user._id });
    
    // Удаляем пользователя
    await User.findByIdAndDelete(req.user._id);
    
    res.status(200).json({
      status: 'success',
      message: 'Аккаунт успешно удален'
    });
    
  } catch (error) {
    console.error('Ошибка при удалении аккаунта:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при удалении аккаунта'
    });
  }
});

// Маршрут для страницы профиля
app.get('/profile', async (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'client', 'profile.html'));
  } catch (error) {
    console.error('Ошибка при загрузке страницы профиля:', error);
    res.status(500).send('Ошибка сервера');
  }
});


// Создание мероприятия
// Создание мероприятия


// Получение популярных мероприятий (ближайшие 6)

// Чиним покупку билетов

const generateTicketCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code, existing;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    existing = await Ticket.findOne({ code });
  } while (existing);
  return code;
};

// Покупка билета - ОБНОВИТЕ ЭТОТ МАРШРУТ
app.post('/api/tickets/purchase', authenticateToken, async (req, res) => {
    try {
        console.log('Получен запрос на покупку билетов:', req.body);
        
        const { eventId, quantity = 1, zoneId, zoneName } = req.body;

        // Проверяем обязательные поля
        if (!eventId) {
            return res.status(400).json({
                status: 'error',
                message: 'ID мероприятия обязательно'
            });
        }

        // Проверяем валидность eventId
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Неверный формат ID мероприятия'
            });
        }

        // Ищем мероприятие
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                status: 'error',
                message: 'Мероприятие не найдено'
            });
        }

        // Определяем цену в зависимости от типа рассадки и зоны
        let ticketPrice = 0;
        
        if (event.seatingType === 'free') {
            ticketPrice = event.freeSeating.price;
        } else if (event.seatingType === 'zones' && zoneId) {
            // Находим зону по ID или имени
            const zone = event.zones.find(z => 
                z._id.toString() === zoneId || z.name === zoneName
            );
            
            if (!zone) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Указанная зона не найдена'
                });
            }
            ticketPrice = zone.price;
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Для зональной рассадки необходимо указать зону'
            });
        }

        // Проверяем доступность билетов
        const ticketsSold = await Ticket.countDocuments({ event: eventId });
        const availableTickets = event.capacity - ticketsSold;

        if (quantity > availableTickets) {
            return res.status(400).json({
                status: 'error',
                message: `Доступно только ${availableTickets} билетов`
            });
        }

        // Создаем билеты
        const tickets = [];
        for (let i = 0; i < quantity; i++) {
            const ticketCode = await generateTicketCode();
            
            const ticketData = {
                code: ticketCode,
                event: eventId,
                user: req.user._id,
                price: ticketPrice,
                status: 'Активен',
                purchaseDate: new Date(),
                zone: zoneName || 'free'
            };

            // Если есть зональная рассадка с указанием мест
            if (event.seatingType === 'zones' && zoneName) {
                const zone = event.zones.find(z => z.name === zoneName);
                if (zone && zone.rows > 0 && zone.seatsPerRow > 0) {
                    // Здесь можно добавить логику выбора конкретного места
                    ticketData.section = zoneName;
                    // ticketData.seatRow = ...;
                    // ticketData.seatNumber = ...;
                }
            }

            const ticket = await Ticket.create(ticketData);
            await ticket.populate('event', 'title date time venue');
            tickets.push(ticket);
        }

        console.log(`Создано ${tickets.length} билетов для пользователя ${req.user.email}`);

        res.status(201).json({
            status: 'success',
            message: `Билет${quantity > 1 ? 'ы' : ''} успешно приобретен${quantity > 1 ? 'ы' : ''}`,
            tickets: tickets
        });

    } catch (error) {
        console.error('Ошибка при покупке билетов:', error);
        res.status(500).json({
            status: 'error',
            message: 'Внутренняя ошибка сервера при покупке билетов'
        });
    }
});

// В server.js добавляем endpoint
app.get('/api/events/:eventId/taken-seats', async (req, res) => {
  try {
    const eventId = req.params.id;
    
    const takenSeats = await Ticket.find({
      event: eventId,
      status: { $in: ['Активен', 'Забронирован'] }
    }).select('section seatRow seatNumber -_id');
    
    res.json({
      status: 'success',
      takenSeats: takenSeats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при получении занятых мест'
    });
  }
});



// Получение билетов пользователя
// Маршрут для получения билетов текущего пользователя
app.get('/api/tickets/my', authenticateToken, async (req, res) => {
  try {
    console.log('Запрос билетов пользователя:', req.user.email);
    
    const { status } = req.query;
    
    let query = { user: req.user._id };
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const tickets = await Ticket.find(query)
      .populate('event', 'title date time venue city address')
      .sort({ purchaseDate: -1 });
    
    console.log('Найдено билетов:', tickets.length);
    
    res.status(200).json({
      status: 'success',
      message: 'Билеты успешно получены',
      tickets: tickets || [] // Всегда возвращаем массив
    });
    
  } catch (error) {
    console.error('Ошибка при получении билетов пользователя:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при получении билетов',
      tickets: [] // Возвращаем пустой массив при ошибке
    });
  }
});

// Получение информации о конкретном билете
app.get('/api/tickets/:ticketCode', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ code: req.params.ticketCode.toUpperCase() })
      .populate('event', 'title date time venue city')
      .populate('user', 'name email');
    
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }
    
    res.status(200).json({
      status: 'success',
      ticket
    });
  } catch (error) {
    console.error('Ошибка при получении информации о билете:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при получении информации о билете'
    });
  }
});

// Проверка билета (для организаторов)
app.post('/api/tickets/validate', authenticateToken, async (req, res) => {
  try {
    const { ticketCode } = req.body;
    
    if (!ticketCode) {
      return res.status(400).json({
        status: 'error',
        message: 'Код билета обязателен'
      });
    }
    
    const ticket = await Ticket.findOne({ code: ticketCode.toUpperCase() })
      .populate('event', 'title date time venue city createdBy')
      .populate('user', 'name email');
    
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }
    
    // Проверяем, является ли пользователь организатором мероприятия или администратором
    const isOrganizer = ticket.event.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.isAdmin;
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав для проверки этого билета'
      });
    }
    
    res.status(200).json({
      status: 'success',
      ticket,
      isValid: ticket.status === 'Активен'
    });
    
  } catch (error) {
    console.error('Ошибка при проверке билета:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при проверке билета'
    });
  }
});

// Маршрут создания платежа
app.post('/api/payments/create', authenticateToken, async (req, res) => {
  try {
    const { eventId, quantity = 1, paymentMethod = 'mock' } = req.body;

    console.log('Создание платежа:', { eventId, quantity, paymentMethod });

    // Проверяем мероприятие
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Мероприятие не найдено'
      });
    }

    // Проверяем доступность билетов
    const ticketsSold = await Ticket.countDocuments({ event: eventId });
    if (ticketsSold + quantity > event.capacity) {
      return res.status(400).json({
        status: 'error',
        message: 'Недостаточно доступных билетов'
      });
    }

    const amount = event.price * quantity;
    const orderId = `order_${Date.now()}`;
    const paymentId = `pay_${Date.now()}`;

    // Создаем запись о платеже
    const payment = await Payment.create({
      paymentId: paymentId,
      orderId: orderId,
      userId: req.user._id,
      eventId: eventId,
      amount: amount,
      currency: 'RUB',
      description: `Билеты на "${event.title}"`,
      paymentMethod: paymentMethod,
      metadata: {
        quantity: quantity,
        eventTitle: event.title,
        userName: req.user.name,
        userEmail: req.user.email
      }
    });

    let paymentData;

    // Выбираем платежную систему
    if (paymentMethod === 'stripe' && stripe) {
      paymentData = await createStripePayment(payment, event, req.user);
    } else {
      // Используем заглушку для тестирования
      paymentData = await mockPaymentSystem.createPayment(payment, event, req.user);
    }

    // Сохраняем данные платежа
    payment.paymentData = paymentData;
    await payment.save();

    res.json({
      status: 'success',
      payment: {
        id: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        paymentUrl: paymentData.paymentUrl,
        method: paymentMethod
      },
      message: 'Платеж создан успешно'
    });

  } catch (error) {
    console.error('Ошибка создания платежа:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при создании платежа'
    });
  }
});

// Маршрут для страницы сканирования QR-кодов
// app.get('/scan-qr', async (req, res) => {
//     try {
//         const token = req.query.token;
        
//         if (!token) {
//             // Если токена нет, перенаправляем на главную с параметром login
//             return res.redirect('/?login=true&redirect=/scan-qr');
//         }
        
//         // Проверяем токен
//         try {
//             const decoded = jwt.verify(token, JWT_SECRET);
//             const user = await User.findById(decoded.id);
            
//             if (!user) {
//                 return res.redirect('/?login=true&message=Пользователь не найден');
//             }
            
//             // Проверяем права доступа
//             if (!user.isAdmin) {
//                 // Проверяем, является ли организатором
//                 const eventsCount = await Event.countDocuments({ createdBy: user._id });
//                 if (eventsCount === 0) {
//                     return res.redirect('/?message=Доступ запрещен. Только администраторы и организаторы');
//                 }
//             }
            
//             // Отправляем страницу сканирования
//             res.sendFile(path.join(__dirname, 'client', 'qr-scanner.html'));
            
//         } catch (tokenError) {
//             console.error('Ошибка проверки токена:', tokenError);
//             return res.redirect('/?login=true&message=Недействительный токен');
//         }
        
//     } catch (error) {
//         console.error('Ошибка загрузки страницы сканирования:', error);
//         res.redirect('/?error=Ошибка загрузки страницы');
//     }
// });

// With this:
app.get('/scan-qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'qr-scanner.html'));
});

// Маршрут для проверки прав администратора
app.get('/api/check-admin', authenticateToken, (req, res) => {
  res.json({
    status: 'success',
    isAdmin: req.user.isAdmin
  });
});

// Изменение статуса билета
app.patch('/api/tickets/:ticketCode/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const { ticketCode } = req.params;
    
    if (!['Активен', 'Использован', 'Недействителен'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Неверный статус билета'
      });
    }
    
    const ticket = await Ticket.findOne({ code: ticketCode.toUpperCase() })
      .populate('event', 'createdBy');
    
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }
    
    // Проверяем права доступа
    const isOrganizer = ticket.event.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.isAdmin;
    const isOwner = ticket.user.toString() === req.user._id.toString();
    
    if (!isOrganizer && !isAdmin && !isOwner) {
      return res.status(403).json({
        status: 'error',
        message: 'Недостаточно прав для изменения статуса билета'
      });
    }
    
    // Владелец может только сделать билет недействительным
    if (isOwner && !isOrganizer && !isAdmin && status !== 'Недействителен') {
      return res.status(403).json({
        status: 'error',
        message: 'Вы можете только сделать билет недействительным'
      });
    }
    
    ticket.status = status;
    await ticket.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Статус билета успешно обновлен',
      ticket
    });
    
  } catch (error) {
    console.error('Ошибка при изменении статуса билета:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при изменении статуса билета'
    });
  }
});

// Получение мероприятий по категории из MongoDB


app.use('/api/tickets/scan', authenticateToken, requireAdminOrOrganizer);
app.use('/api/tickets/check/:ticketCode', authenticateToken, requireAdminOrOrganizer);
app.use('/scan-qr', authenticateToken, requireAdminOrOrganizer);

// Подключение роутеров
const authRoutes = require('./server/routes/authRoutes');
const eventRoutes = require('./server/routes/eventRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

// Страница покупки билета
app.get('/event/:id/tickets', async (req, res) => {
  try {
    const eventId = req.params.id;
    
    // Проверяем что это валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).send('Неверный ID мероприятия');
    }
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).send('Мероприятие не найдено');
    }
    
    res.sendFile(path.join(__dirname, 'client', 'ticket-purchase.html'));
  } catch (error) {
    console.error('Ошибка при загрузке страницы покупки:', error);
    res.status(500).send('Ошибка сервера');
  }
});

// Получение информации о мероприятии
app.get('/api/events/:eventId/tickets', async (req, res) => {
  try {
    const eventId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Неверный ID мероприятия'
      });
    }
    
    const event = await Event.findById(eventId).populate('createdBy', 'name');
    
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Мероприятие не найдено'
      });
    }
    
    // Получаем количество проданных билетов
    const ticketsSold = await Ticket.countDocuments({ event: eventId });
    const ticketsAvailable = event.capacity - ticketsSold;
    
    res.status(200).json({
      status: 'success',
      event: {
        _id: event._id,
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        venue: event.venue,
        address: event.address,
        city: event.city,
        price: event.price,
        capacity: event.capacity,
        ticketsAvailable: ticketsAvailable,
        image: event.image,
        organizer: event.createdBy.name
      }
    });
  } catch (error) {
    console.error('Ошибка при получении информации о мероприятии:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера'
    });
  }
});





// Функция для генерации QR-кода если он не создался автоматически
async function generateQRCodeForTicket(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}/generate-qr`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.token}`
            }
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            return result.qrCodeUrl;
        } else {
            console.error('Ошибка генерации QR-кода:', result.message);
            return null;
        }
    } catch (error) {
        console.error('Ошибка генерации QR-кода:', error);
        return null;
    }
}

// Добавляем endpoint для генерации QR-кода
app.post('/api/tickets/:ticketId/generate-qr', authenticateToken, async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.ticketId);
        
        if (!ticket) {
            return res.status(404).json({
                status: 'error',
                message: 'Билет не найден'
            });
        }
        
        // Генерируем QR-код
        await generateQRCodeForTicket(ticket);
        await ticket.save();
        
        res.json({
            status: 'success',
            qrCodeUrl: ticket.qrCode,
            message: 'QR-код успешно сгенерирован'
        });
        
    } catch (error) {
        console.error('Ошибка генерации QR-кода:', error);
        res.status(500).json({
            status: 'error',
            message: 'Ошибка при генерации QR-кода'
        });
    }
});

// Маршрут для получения QR-кода билета
app.get('/api/tickets/:ticketId/qrcode', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }
    
    if (!ticket.qrCode) {
      // Генерируем QR-код если его нет
      await generateQRCodeForTicket(ticket);
      await ticket.save();
    }
    
    res.json({
      status: 'success',
      qrCodeUrl: ticket.qrCode,
      ticket: {
        code: ticket.code,
        status: ticket.status,
        event: ticket.event,
        purchaseDate: ticket.purchaseDate
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения QR-кода:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при получении QR-кода'
    });
  }
});

// Маршрут для проверки билета по QR-коду
app.post('/api/tickets/scan', authenticateToken, async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({
        status: 'error',
        message: 'Данные QR-кода не предоставлены'
      });
    }
    
    // Парсим данные из QR-кода
    let ticketData;
    try {
      ticketData = JSON.parse(qrData);
    } catch (e) {
      return res.status(400).json({
        status: 'error',
        message: 'Неверный формат данных QR-кода'
      });
    }
    
    // Находим билет
    const ticket = await Ticket.findById(ticketData.ticketId)
      .populate('event', 'title date time venue')
      .populate('user', 'name email');
    
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }
    
    // Проверяем валидность данных
    if (ticket.code !== ticketData.code) {
      return res.status(400).json({
        status: 'error',
        message: 'Неверные данные билета'
      });
    }
    
    res.json({
      status: 'success',
      ticket: {
        code: ticket.code,
        status: ticket.status,
        event: ticket.event,
        user: ticket.user,
        purchaseDate: ticket.purchaseDate,
        seat: ticket.seat,
        price: ticket.price
      },
      isValid: ticket.status === 'Активен'
    });
    
  } catch (error) {
    console.error('Ошибка сканирования билета:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при сканировании билета'
    });
  }
});

// Маршрут для проверки билета по коду
app.get('/api/tickets/check/:ticketCode', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ code: req.params.ticketCode.toUpperCase() })
      .populate('event', 'title date time venue')
      .populate('user', 'name email');
    
    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: 'Билет не найден'
      });
    }
    
    res.json({
      status: 'success',
      ticket: {
        code: ticket.code,
        status: ticket.status,
        event: ticket.event,
        user: ticket.user,
        purchaseDate: ticket.purchaseDate,
        seat: ticket.seat,
        price: ticket.price,
        qrCodeUrl: ticket.qrCode
      },
      isValid: ticket.status === 'Активен'
    });
    
  } catch (error) {
    console.error('Ошибка проверки билета:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при проверке билета'
    });
  }
});

// Функция для генерации QR-кода
async function generateQRCodeForTicket(ticket) {
  try {
    const qrData = ticket.generateQRData ? ticket.generateQRData() : JSON.stringify({
      ticketId: ticket._id.toString(),
      code: ticket.code,
      event: ticket.event.toString(),
      purchaseDate: ticket.purchaseDate.toISOString()
    });
    
    const qrCodeFileName = `ticket-${ticket.code}-${Date.now()}.png`;
    const qrCodePath = path.join(qrCodesDir, qrCodeFileName);
    
    await QRCode.toFile(qrCodePath, qrData, {
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300,
      height: 300,
      margin: 1
    });
    
    ticket.qrCode = `/qr-codes/${qrCodeFileName}`;
    ticket.qrCodeData = qrData;
    
  } catch (error) {
    console.error('Ошибка генерации QR-кода:', error);
    throw error;
  }
}

// Генерация уникального eventId (8 символов)
const generateEventId = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let eventId;
  let isUnique = false;
  
  while (!isUnique) {
    eventId = '';
    for (let i = 0; i < 8; i++) {
      eventId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Проверяем уникальность eventId в базе данных
    const existingEvent = await Event.findOne({ eventId });
    if (!existingEvent) {
      isUnique = true;
    }
  }
  
  return eventId;
};

// Получение мероприятий пользователя из MongoDB



// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, 'client')));



// Обработка несуществующих маршрутов
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Маршрут не найден'
  });
});

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('Необработанная ошибка:', error);
  res.status(500).json({
    status: 'error',
    message: 'Внутренняя ошибка сервера'
  });
});

// Создаем папку для QR-кодов если ее нет
const qrCodesDir = path.join(__dirname, 'client', 'qr-codes');
if (!fs.existsSync(qrCodesDir)) {
  fs.mkdirSync(qrCodesDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, qrCodesDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Получение зон мероприятия
// Получение зон мероприятия


// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});


// const options = {
//   key: fs.readFileSync("server.key"),   // приватный
//   cert: fs.readFileSync("server.crt") // сертификат SLL
// };

//Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT} в браузере`);
});

// https.createServer(options, app).listen(3000, () => {
  
//   os.hostname();
//   console.log("HTTPS сервер запущен: https://localhost:3000");
// });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Завершение работы сервера...');
  await mongoose.connection.close();
  process.exit(0);
});
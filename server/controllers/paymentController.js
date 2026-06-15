const Payment = require('../models/Payment');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { generateTicketCode } = require('../utils/idGenerator');

const createPayment = async (req, res) => {
  try {
    const { eventId, quantity = 1, paymentMethod = 'mock' } = req.body;
    console.log('Создание платежа:', { eventId, quantity, paymentMethod });

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ status: 'error', message: 'Мероприятие не найдено' });
    }

    // ВРЕМЕННО: принудительная цена
    const amount = 100 * quantity;
    console.log('Принудительная цена (тест):', amount);

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const payment = await Payment.create({
      paymentId,
      orderId,
      userId: req.user._id,
      eventId,
      amount,
      currency: 'RUB',
      description: `Билеты на "${event.title}" - ${quantity} шт.`,
      paymentMethod,
      metadata: { quantity, eventTitle: event.title, userName: req.user.name, userEmail: req.user.email },
      status: 'pending'
    });

    if (paymentMethod === 'mock') {
      const tickets = [];
      for (let i = 0; i < quantity; i++) {
        const ticketCode = await generateTicketCode();
        const ticket = await Ticket.create({
          code: ticketCode,
          event: eventId,
          user: req.user._id,
          price: 100,
          status: 'Активен'
        });
        tickets.push(ticket);
      }
      payment.status = 'succeeded';
      payment.tickets = tickets.map(t => t._id);
      await payment.save();

      return res.status(201).json({
        status: 'success',
        payment: { id: payment.paymentId, amount, status: 'succeeded' },
        tickets
      });
    }

    res.status(201).json({
      status: 'success',
      payment: { id: payment.paymentId, amount, status: 'pending', paymentUrl: null }
    });

  } catch (error) {
    console.error('Ошибка создания платежа:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({ paymentId: req.params.paymentId, userId: req.user._id })
      .populate('tickets eventId');
    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Платеж не найден' });
    }
    res.json({ status: 'success', payment });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('eventId', 'title date venue');
    res.json({ status: 'success', payments });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { createPayment, getPaymentStatus, getMyPayments };
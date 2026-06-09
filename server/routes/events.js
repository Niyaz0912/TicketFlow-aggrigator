const express = require('express');
const Event = require('../models/Event');

const router = express.Router();

// Получение всех мероприятий
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().populate('createdBy', 'name email');
    res.status(200).json({
      status: 'success',
      results: events.length,
      data: {
        events
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Создание мероприятия
router.post('/', async (req, res) => {
  try {
    const eventData = req.body;
    const newEvent = await Event.create(eventData);
    
    await newEvent.populate('createdBy', 'name email');
    
    res.status(201).json({
      status: 'success',
      data: {
        event: newEvent
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Получение мероприятий по категории
router.get('/category/:category', async (req, res) => {
  try {
    const events = await Event.find({ category: req.params.category }).populate('createdBy', 'name email');
    res.status(200).json({
      status: 'success',
      results: events.length,
      data: {
        events
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Получение мероприятий пользователя
router.get('/user/:userId', async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.params.userId }).populate('createdBy', 'name email');
    res.status(200).json({
      status: 'success',
      results: events.length,
      data: {
        events
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
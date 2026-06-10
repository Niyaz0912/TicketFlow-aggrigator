const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { generateId } = require('../utils/idGenerator');

const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find().populate('createdBy', 'name email');
    res.json({ status: 'success', events });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await Event.findOne({ eventId: req.params.eventId }).populate('createdBy', 'name');
    if (!event) return res.status(404).json({ status: 'error', message: 'Мероприятие не найдено' });
    
    const ticketsSold = await Ticket.countDocuments({ event: event._id });
    res.json({
      status: 'success',
      event: {
        ...event.toObject(),
        ticketsAvailable: event.capacity - ticketsSold,
        ticketsSold
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const createEvent = async (req, res) => {
  try {
    const eventData = { ...req.body, createdBy: req.user._id };
    eventData.eventId = await generateId(Event, '', 8);
    
    const newEvent = await Event.create(eventData);
    await newEvent.populate('createdBy', 'name email');
    
    res.status(201).json({ status: 'success', event: newEvent });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ status: 'error', message: 'Ошибка валидации', errors: Object.values(error.errors).map(e => e.message) });
    }
    if (error.code === 11000) {
      return res.status(400).json({ status: 'error', message: 'Мероприятие с таким ID уже существует' });
    }
    res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { getAllEvents, getEventById, createEvent };
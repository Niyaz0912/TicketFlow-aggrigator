const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { generateTicketCode } = require('../utils/idGenerator');

const purchaseTicket = async (req, res) => {
  try {
    const { eventId, quantity = 1, zoneId, zoneName } = req.body;
    
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ status: 'error', message: 'Мероприятие не найдено' });
    
    let ticketPrice = 0;
    if (event.seatingType === 'free') {
      ticketPrice = event.freeSeating.price;
    } else if (event.seatingType === 'zones' && zoneId) {
      const zone = event.zones.find(z => z._id.toString() === zoneId || z.name === zoneName);
      if (!zone) return res.status(400).json({ status: 'error', message: 'Указанная зона не найдена' });
      ticketPrice = zone.price;
    } else {
      return res.status(400).json({ status: 'error', message: 'Для зональной рассадки необходимо указать зону' });
    }
    
    const ticketsSold = await Ticket.countDocuments({ event: eventId });
    if (quantity > event.capacity - ticketsSold) {
      return res.status(400).json({ status: 'error', message: `Доступно только ${event.capacity - ticketsSold} билетов` });
    }
    
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      const ticketCode = await generateTicketCode();
      const ticket = await Ticket.create({
        code: ticketCode,
        event: eventId,
        user: req.user._id,
        price: ticketPrice,
        zone: zoneName || 'free'
      });
      tickets.push(ticket);
    }
    
    res.status(201).json({ status: 'success', tickets });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id })
      .populate('event', 'title date time venue city address')
      .sort({ purchaseDate: -1 });
    res.json({ status: 'success', tickets });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const getTicketByCode = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ code: req.params.code.toUpperCase() })
      .populate('event', 'title date time venue city')
      .populate('user', 'name email');
    if (!ticket) return res.status(404).json({ status: 'error', message: 'Билет не найден' });
    res.json({ status: 'success', ticket });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const validateTicket = async (req, res) => {
  try {
    const { ticketCode } = req.body;
    const ticket = await Ticket.findOne({ code: ticketCode.toUpperCase() })
      .populate('event', 'title createdBy');
    
    if (!ticket) return res.status(404).json({ status: 'error', message: 'Билет не найден' });
    
    const isOrganizer = ticket.event.createdBy.toString() === req.user._id.toString();
    if (!req.user.isAdmin && !isOrganizer) {
      return res.status(403).json({ status: 'error', message: 'Недостаточно прав' });
    }
    
    res.json({ status: 'success', isValid: ticket.status === 'Активен', ticket });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { purchaseTicket, getMyTickets, getTicketByCode, validateTicket };
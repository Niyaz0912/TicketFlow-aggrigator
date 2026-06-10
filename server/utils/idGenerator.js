const Event = require('../models/Event');
const Attraction = require('../models/Attraction');
const Ticket = require('../models/Ticket');

const generateId = async (model, prefix = '', length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id, exists;
  do {
    id = prefix + Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    exists = await model.findOne({ eventId: id });
  } while (exists);
  return id;
};

const generateTicketCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code, exists;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    exists = await Ticket.findOne({ code });
  } while (exists);
  return code;
};

module.exports = { generateId, generateTicketCode };
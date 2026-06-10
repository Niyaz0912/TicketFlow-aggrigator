const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Активен', 'Использован', 'Недействителен'],
    default: 'Активен'
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  price: {
    type: Number,
    required: true
  },
  seat: {
    type: String,
    default: ''
  },
  zone: {
    type: String,
    default: 'free'
  },
  qrCode: {
    type: String,
    default: ''
  },
  qrCodeData: {
    type: String,
    default: ''
  },
  seatRow: { type: Number },
  seatNumber: { type: Number },
  section: { type: String }
});

module.exports = mongoose.model('Ticket', TicketSchema);
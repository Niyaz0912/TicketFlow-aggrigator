const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['concert', 'theater', 'sport', 'exhibition', 'conference', 'festival', 'other']
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  endTime: {
    type: String
  },
  venue: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  country: {
    type: String,
    default: 'Казахстан'
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  seatingType: {
    type: String,
    enum: ['free', 'zones'],
    default: 'free'
  },
  freeSeating: {
    price: {
      type: Number,
      default: 0
    }
  },
  zones: [{
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 1 },
    rows: { type: Number, default: 0 },
    seatsPerRow: { type: Number, default: 0 },
    color: { type: String, default: '#3a86ff' }
  }]
}, {
  timestamps: true  // добавит createdAt и updatedAt автоматически
});

// Индексы для быстрого поиска
EventSchema.index({ eventId: 1 });
EventSchema.index({ date: 1 });
EventSchema.index({ createdBy: 1 });

// Метод проверки занятости места
EventSchema.methods.isSeatTaken = async function(section, row, seat) {
  try {
    const Ticket = mongoose.model('Ticket');
    const count = await Ticket.countDocuments({
      event: this._id,
      section: section,
      seatRow: row,
      seatNumber: seat,
      status: { $in: ['Активен', 'Забронирован'] }
    });
    return count > 0;
  } catch (error) {
    console.error('Ошибка проверки места:', error);
    return false;
  }
};

// Виртуальное поле: количество проданных билетов
EventSchema.virtual('ticketsSold').get(async function() {
  const Ticket = mongoose.model('Ticket');
  return await Ticket.countDocuments({ event: this._id });
});

// Виртуальное поле: количество доступных билетов
EventSchema.virtual('ticketsAvailable').get(async function() {
  const Ticket = mongoose.model('Ticket');
  const sold = await Ticket.countDocuments({ event: this._id });
  return this.capacity - sold;
});

// Чтобы виртуальные поля включались в JSON
EventSchema.set('toJSON', { virtuals: true });
EventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', EventSchema);
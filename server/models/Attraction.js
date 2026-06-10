const mongoose = require('mongoose');

// Тариф (для аттракционов с разной продолжительностью)
const TariffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number,  // продолжительность в минутах (0 = без ограничения)
    default: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  capacity: {
    type: Number,  // сколько человек может одновременно
    default: 1
  }
});

// Аттракцион
const AttractionSchema = new mongoose.Schema({
  attractionId: {
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
    default: ''
  },
  type: {
    type: String,
    enum: ['attraction', 'rental', 'area'],
    default: 'attraction'
  },
  // Правила
  minHeight: {
    type: Number,
    default: 0
  },
  maxHeight: {
    type: Number,
    default: 250
  },
  requiresAdult: {
    type: Boolean,
    default: false
  },
  minAge: {
    type: Number,
    default: 0
  },
  // Тарифы
  tariffs: [TariffSchema],
  // Фиксированная цена
  fixedPrice: {
    type: Number,
    default: 0
  },
  priceType: {
    type: String,
    enum: ['fixed', 'tariffs'],
    default: 'fixed'
  },
  capacity: {
    type: Number,
    default: 1
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
  }
});

module.exports = mongoose.model('Attraction', AttractionSchema);
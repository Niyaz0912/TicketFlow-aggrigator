const express = require('express');
const { getAllEvents, getEventById, createEvent } = require('../controllers/eventController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', getAllEvents);
router.get('/id/:eventId', getEventById);
router.post('/', protect, adminOnly, createEvent);

module.exports = router;
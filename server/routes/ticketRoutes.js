const express = require('express');
const { purchaseTicket, getMyTickets, getTicketByCode, validateTicket } = require('../controllers/ticketController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/purchase', protect, purchaseTicket);
router.get('/my', protect, getMyTickets);
router.get('/code/:code', protect, getTicketByCode);
router.post('/validate', protect, validateTicket);

module.exports = router;
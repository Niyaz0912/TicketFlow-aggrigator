const express = require('express');
const { createPayment, getPaymentStatus, getMyPayments } = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/create', protect, createPayment);
router.get('/status/:paymentId', protect, getPaymentStatus);
router.get('/my', protect, getMyPayments);

module.exports = router;
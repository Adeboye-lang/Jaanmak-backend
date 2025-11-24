import express from 'express';
import { addOrderItems, getOrderById, getMyOrders, getOrders, updateOrderStatus, verifyOrderPayment, cancelOrder } from '../controllers/orderController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, addOrderItems).get(protect, admin, getOrders);
router.route('/myorders').get(protect, getMyOrders);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/status').put(protect, admin, updateOrderStatus);
router.route('/:id/pay').put(protect, verifyOrderPayment);
router.route('/:id/cancel').put(protect, cancelOrder);

export default router;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const Order_1 = require("../models/Order");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const kafka_1 = require("../config/kafka");
const router = express_1.default.Router();
// Get all orders with pagination
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const orders = await Order_1.Order.find()
            .populate('customerId', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        // Calculate total amount for each order if not set
        const ordersWithTotal = orders.map(order => {
            if (!order.totalAmount && Array.isArray(order.items)) {
                order.totalAmount = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            }
            return order;
        });
        const total = await Order_1.Order.countDocuments();
        res.json({
            orders: ordersWithTotal,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// Get orders for a specific customer
router.get('/customer/:customerId', auth_1.authenticate, async (req, res, next) => {
    try {
        const orders = await Order_1.Order.find({ customerId: req.params.customerId })
            .populate('customerId', 'name email')
            .sort({ createdAt: -1 });
        res.json(orders);
    }
    catch (error) {
        next(error);
    }
});
// Create a new order
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('customerId').isMongoId(),
    (0, express_validator_1.body)('items').isArray().notEmpty(),
    (0, express_validator_1.body)('items.*.name').trim().notEmpty(),
    (0, express_validator_1.body)('items.*.quantity').isInt({ min: 1 }),
    (0, express_validator_1.body)('items.*.price').isFloat({ min: 0 }),
    (0, express_validator_1.body)('shippingAddress.street').trim().notEmpty(),
    (0, express_validator_1.body)('shippingAddress.city').trim().notEmpty(),
    (0, express_validator_1.body)('shippingAddress.state').trim().notEmpty(),
    (0, express_validator_1.body)('shippingAddress.zipCode').trim().notEmpty(),
    (0, express_validator_1.body)('shippingAddress.country').trim().notEmpty(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError('Validation failed', 400);
        }
        // Always calculate totalAmount from items
        const items = req.body.items || [];
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const order = await Order_1.Order.create({
            ...req.body,
            totalAmount,
            orderNumber,
        });
        // Send order creation event to Kafka if available
        if (kafka_1.producer) {
            const kafkaProducer = kafka_1.producer;
            await kafkaProducer.send({
                topic: 'order-events',
                messages: [
                    {
                        value: JSON.stringify({
                            type: 'ORDER_CREATED',
                            data: order
                        })
                    }
                ]
            });
        }
        res.status(201).json(order);
    }
    catch (error) {
        next(error);
    }
});
// Update order status
router.patch('/:id/status', auth_1.authenticate, [
    (0, express_validator_1.body)('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError('Validation failed', 400);
        }
        const order = await Order_1.Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).populate('customerId', 'name email');
        if (!order) {
            throw new errorHandler_1.AppError('Order not found', 404);
        }
        // Send order status update event to Kafka if available
        if (kafka_1.producer) {
            const kafkaProducer = kafka_1.producer;
            await kafkaProducer.send({
                topic: 'order-events',
                messages: [
                    {
                        value: JSON.stringify({
                            type: 'ORDER_STATUS_UPDATED',
                            data: order
                        })
                    }
                ]
            });
        }
        res.json(order);
    }
    catch (error) {
        next(error);
    }
});
// Update order
router.put('/:id', auth_1.authenticate, [
    (0, express_validator_1.body)('customerId').isMongoId(),
    (0, express_validator_1.body)('items').isArray().notEmpty(),
    (0, express_validator_1.body)('items.*.name').trim().notEmpty(),
    (0, express_validator_1.body)('items.*.quantity').isInt({ min: 1 }),
    (0, express_validator_1.body)('items.*.price').isFloat({ min: 0 }),
    (0, express_validator_1.body)('shippingAddress.street').trim().notEmpty(),
    (0, express_validator_1.body)('shippingAddress.city').trim().notEmpty(),
    (0, express_validator_1.body)('shippingAddress.state').trim().notEmpty(),
    (0, express_validator_1.body)('shippingAddress.zipCode').trim().notEmpty(),
    (0, express_validator_1.body)('shippingAddress.country').trim().notEmpty(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError('Validation failed', 400);
        }
        // Calculate totalAmount from items
        const items = req.body.items || [];
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const order = await Order_1.Order.findByIdAndUpdate(req.params.id, {
            ...req.body,
            totalAmount,
        }, { new: true }).populate('customerId', 'name email');
        if (!order) {
            throw new errorHandler_1.AppError('Order not found', 404);
        }
        // Send order update event to Kafka if available
        if (kafka_1.producer) {
            const kafkaProducer = kafka_1.producer;
            await kafkaProducer.send({
                topic: 'order-events',
                messages: [
                    {
                        value: JSON.stringify({
                            type: 'ORDER_UPDATED',
                            data: order
                        })
                    }
                ]
            });
        }
        res.json(order);
    }
    catch (error) {
        next(error);
    }
});
// Delete an order
router.delete('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const order = await Order_1.Order.findByIdAndDelete(req.params.id);
        if (!order) {
            throw new errorHandler_1.AppError('Order not found', 404);
        }
        // Send order deletion event to Kafka if available
        if (kafka_1.producer) {
            const kafkaProducer = kafka_1.producer;
            await kafkaProducer.send({
                topic: 'order-events',
                messages: [
                    {
                        value: JSON.stringify({
                            type: 'ORDER_DELETED',
                            data: { id: req.params.id }
                        })
                    }
                ]
            });
        }
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

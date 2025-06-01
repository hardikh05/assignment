"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const Customer_1 = require("../models/Customer");
const kafka_1 = require("../config/kafka");
const errorHandler_1 = require("../middleware/errorHandler");
const Order_1 = require("../models/Order");
const router = express_1.default.Router();
// Get all customers with pagination
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        // Get customers with pagination
        const customers = await Customer_1.Customer.find()
            .select('name email phone totalSpent visits createdAt updatedAt')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        // Get total spent for each customer from delivered orders
        const customersWithTotalSpent = await Promise.all(customers.map(async (customer) => {
            const deliveredOrders = await Order_1.Order.find({
                customerId: customer._id,
                status: 'delivered'
            });
            const totalSpent = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            // Update customer's totalSpent
            customer.totalSpent = totalSpent;
            await customer.save();
            return customer;
        }));
        const total = await Customer_1.Customer.countDocuments();
        res.json({
            customers: customersWithTotalSpent,
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
// Create a new customer
router.post('/', [
    (0, express_validator_1.body)('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
        .withMessage('Please provide a valid email address (e.g., user@example.com)')
        .normalizeEmail(),
    (0, express_validator_1.body)('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2 })
        .withMessage('Name must be at least 2 characters long'),
    (0, express_validator_1.body)('phone')
        .optional()
        .trim()
        .matches(/^[0-9]{10,}$/)
        .withMessage('Phone number must be at least 10 digits and contain only numbers'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            console.error('Validation errors:', errors.array());
            const errorMessage = errors.array().map(err => err.msg).join(', ');
            throw new errorHandler_1.AppError(errorMessage, 400);
        }
        // Generate random number of visits between 1 and 50
        const randomVisits = Math.floor(Math.random() * 50) + 1;
        // Create customer with required fields
        const customerData = {
            name: req.body.name.trim(),
            email: req.body.email.trim().toLowerCase(),
            phone: req.body.phone ? req.body.phone.trim() : '',
            visits: randomVisits,
            totalSpent: 0,
        };
        console.log('Creating customer with data:', customerData);
        const customer = await Customer_1.Customer.create(customerData);
        console.log('Customer created successfully:', customer);
        // Send customer creation event to Kafka if available
        if (kafka_1.producer) {
            const kafkaProducer = kafka_1.producer;
            await kafkaProducer.send({
                topic: 'customer-events',
                messages: [
                    {
                        value: JSON.stringify({
                            type: 'CUSTOMER_CREATED',
                            data: customer
                        })
                    }
                ]
            });
        }
        res.status(201).json(customer);
    }
    catch (error) {
        console.error('Error creating customer:', error);
        next(error);
    }
});
// Update a customer
router.put('/:id', [
    (0, express_validator_1.body)('email').optional().isEmail().normalizeEmail(),
    (0, express_validator_1.body)('name').optional().trim().notEmpty(),
    (0, express_validator_1.body)('phone').optional().trim(),
    (0, express_validator_1.body)('visits').optional().isInt({ min: 0 }),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError('Validation failed', 400);
        }
        const customer = await Customer_1.Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!customer) {
            throw new errorHandler_1.AppError('Customer not found', 404);
        }
        // Send customer update event to Kafka if available
        if (kafka_1.producer) {
            const kafkaProducer = kafka_1.producer;
            await kafkaProducer.send({
                topic: 'customer-events',
                messages: [
                    {
                        value: JSON.stringify({
                            type: 'CUSTOMER_UPDATED',
                            data: customer
                        })
                    }
                ]
            });
        }
        res.json(customer);
    }
    catch (error) {
        next(error);
    }
});
// Delete a customer
router.delete('/:id', async (req, res, next) => {
    try {
        // First delete all orders associated with this customer
        const deletedOrders = await Order_1.Order.deleteMany({ customerId: req.params.id });
        console.log(`Deleted ${deletedOrders.deletedCount} orders for customer ${req.params.id}`);
        // Then delete the customer
        const customer = await Customer_1.Customer.findByIdAndDelete(req.params.id);
        if (!customer) {
            throw new errorHandler_1.AppError('Customer not found', 404);
        }
        // Send customer deletion event to Kafka if available
        if (kafka_1.producer) {
            const kafkaProducer = kafka_1.producer;
            await kafkaProducer.send({
                topic: 'customer-events',
                messages: [
                    {
                        value: JSON.stringify({
                            type: 'CUSTOMER_DELETED',
                            data: {
                                id: req.params.id,
                                deletedOrdersCount: deletedOrders.deletedCount
                            }
                        })
                    }
                ]
            });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting customer:', error);
        next(error);
    }
});
exports.default = router;

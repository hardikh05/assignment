"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const passport_1 = __importDefault(require("passport"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const customers_1 = __importDefault(require("./routes/customers"));
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const segments_1 = __importDefault(require("./routes/segments"));
const orders_1 = __importDefault(require("./routes/orders"));
const messages_1 = __importDefault(require("./routes/messages"));
const ai_1 = __importDefault(require("./routes/ai"));
const ai_test_1 = __importDefault(require("./routes/ai-test"));
// Import middleware
const errorHandler_1 = require("./middleware/errorHandler");
const kafka_1 = require("./config/kafka");
const passport_2 = require("./config/passport");
// Load environment variables with explicit path
const envPath = path_1.default.resolve(__dirname, '../.env');
console.log('Looking for .env file at:', envPath);
const result = dotenv_1.default.config({ path: envPath });
if (result.error) {
    console.error('Error loading .env file:', result.error);
}
else {
    console.log('.env file loaded successfully');
}
// Debug logging
console.log('Environment variables loaded:', {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not set',
    MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV,
    KAFKA_BROKERS: process.env.KAFKA_BROKERS ? 'Set' : 'Not set',
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID ? 'Set' : 'Not set',
    KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID ? 'Set' : 'Not set',
    JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set'
});
// Initialize Kafka after environment variables are loaded
(0, kafka_1.initializeKafka)();
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(passport_1.default.initialize());
// Setup Passport
(0, passport_2.setupPassport)();
// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Mini CRM API',
            version: '1.0.0',
            description: 'API documentation for Mini CRM Platform',
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 5000}`,
            },
        ],
    },
    apis: ['./src/routes/*.ts'],
};
const swaggerDocs = (0, swagger_jsdoc_1.default)(swaggerOptions);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocs));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/customers', customers_1.default);
app.use('/api/campaigns', campaigns_1.default);
app.use('/api/segments', segments_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/messages', messages_1.default);
app.use('/api/ai', ai_1.default);
app.use('/api/ai-test', ai_test_1.default);
// Error handling
app.use(errorHandler_1.errorHandler);
// Connect to MongoDB
mongoose_1.default
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mini-crm')
    .then(() => {
    console.log('Connected to MongoDB');
})
    .catch((error) => {
    console.error('MongoDB connection error:', error);
});
// Setup Kafka
(0, kafka_1.setupKafka)().catch(console.error);
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

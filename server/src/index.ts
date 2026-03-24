import dns from 'dns';
// Use Google Public DNS to resolve MongoDB Atlas hostnames
// (default system DNS may not resolve *.mongodb.net SRV records)
dns.setServers(['8.8.8.8', '8.8.4.4']);

import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import passport from 'passport';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import campaignRoutes from './routes/campaigns';
import segmentRoutes from './routes/segments';
import orderRoutes from './routes/orders';
import messageRoutes from './routes/messages';
import aiRoutes from './routes/ai';
import webhookRoutes from './routes/webhooks';
import auditLogRoutes from './routes/auditLogs';
import templateRoutes from './routes/templates';
import trackingRoutes from './routes/tracking';
import aiChatRoutes from './routes/aiChat';
import csvRoutes from './routes/csvImportExport';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { setupKafka, initializeKafka } from './config/kafka';
import { setupPassport } from './config/passport';
import { initializeSocket } from './config/socket';
import { startScheduler } from './services/scheduler';

// Load environment variables with explicit path
const envPath = path.resolve(__dirname, '../.env');
console.log('Looking for .env file at:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('.env file loaded successfully');
}

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Exiting.');
  process.exit(1);
}

// Debug logging (no secrets)
console.log('Environment variables loaded:', {
  GROQ_API_KEY: process.env.GROQ_API_KEY ? 'Set' : 'Not set',
  MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
  NODE_ENV: process.env.NODE_ENV,
  KAFKA_BROKERS: process.env.KAFKA_BROKERS ? 'Set' : 'Not set',
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID ? 'Set' : 'Not set',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID ? 'Set' : 'Not set',
  JWT_SECRET: 'Set',
  FRONTEND_URL: process.env.FRONTEND_URL ? 'Set' : 'Not set',
});

// Initialize Kafka after environment variables are loaded
initializeKafka();

const app = express();

// CORS configuration with allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body size limit to prevent large payload DoS
app.use(express.json({ limit: '1mb' }));
app.use(passport.initialize());

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Stricter rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many authentication attempts, please try again later.' },
});

// Stricter rate limiter for AI routes
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many AI requests, please try again later.' },
});

// Setup Passport
setupPassport();

// Swagger configuration - only in development
if (process.env.NODE_ENV !== 'production') {
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
          url: process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`,
        },
      ],
    },
    apis: ['./src/routes/*.ts'],
  };

  const swaggerDocs = swaggerJsDoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
}

// Routes
app.use('/api/auth', authLimiter, authRoutes);

// Redirect /auth/callback and /dashboard to frontend
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

app.get('/auth/callback', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('Token is required');
  }
  // Forward token to frontend callback handler
  return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
});

// Redirect /dashboard to frontend root (dashboard is at /)
app.get('/dashboard', (_req, res) => {
  return res.redirect(`${frontendUrl}/`);
});

app.use('/api/customers', customerRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/ai-chat', aiLimiter, aiChatRoutes);
app.use('/api/csv', csvRoutes);

// Error handling
app.use(errorHandler);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mini-crm')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Setup Kafka
setupKafka().catch(console.error);

// Start server with Socket.io
const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Start campaign scheduler
  startScheduler();
});

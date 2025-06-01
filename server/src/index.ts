import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import passport from 'passport';
import jwt from 'jsonwebtoken';

// Import routes
import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import campaignRoutes from './routes/campaigns';
import segmentRoutes from './routes/segments';
import orderRoutes from './routes/orders';
import messageRoutes from './routes/messages';
import aiRoutes from './routes/ai';
import aiTestRoutes from './routes/ai-test';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { setupKafka, initializeKafka } from './config/kafka';
import { setupPassport } from './config/passport';

// Load environment variables with explicit path
const envPath = path.resolve(__dirname, '../.env');
console.log('Looking for .env file at:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
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
initializeKafka();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Setup Passport
setupPassport();

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
        url: process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`,
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
app.use('/api/auth', authRoutes);

// Add direct route for /auth/callback to handle the frontend callback
app.get('/auth/callback', (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).send('Token is required');
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token as string, process.env.JWT_SECRET || 'your-secret-key') as any;
    
    // If token is valid, redirect to the frontend dashboard
    return res.redirect(`https://echoassign.onrender.com/dashboard`);
  } catch (error) {
    console.error('Invalid token:', error);
    return res.status(401).send('Invalid or expired token');
  }
});

app.use('/api/customers', customerRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-test', aiTestRoutes);

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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
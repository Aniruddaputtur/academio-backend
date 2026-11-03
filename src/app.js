import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment.js';
import { checkDatabaseHealth } from './config/database.js';
import { authRouter } from './routes/authRoutes.js';
import { academicRouter } from './routes/academicRoutes.js';
import { aiRouter } from './routes/aiRoutes.js';
import { errorHandler } from './middleware/authAndError.js';
import { isOpenAIConfigured } from './ai/openaiClient.js';

export const app = express();

// 1. Security Headers via Helmet
app.use(helmet());

// 2. Strict / Configurable CORS
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server) or listed origins
    if (!origin || allowedOrigins.includes(origin) || config.nodeEnv === 'development') {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 3. Request body parsing with strict size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. Global API Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalLimiter);

// 5. Root Info Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Academio API Platform',
    version: '2.0.0',
    description: 'Frontend-independent Academic Management and AI Platform',
    status: 'online',
    healthEndpoint: '/api/health'
  });
});

// 6. Comprehensive Health Check Endpoint
app.get('/api/health', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const aiReady = isOpenAIConfigured();

  const isHealthy = dbHealth.connected;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    database: {
      type: 'SQLite (Prisma ORM)',
      ...dbHealth
    },
    ai: {
      provider: 'OpenAI',
      model: config.openaiModel,
      configured: aiReady,
      status: aiReady ? 'ready' : 'key_not_configured'
    }
  });
});

// 7. Mount Core REST Modules
app.use('/api/auth', authRouter);
app.use('/api/academic', academicRouter);
app.use('/api/ai', aiRouter);

// 8. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found on this server.`
  });
});

// 9. Centralized Error Handler
app.use(errorHandler);

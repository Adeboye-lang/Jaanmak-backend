import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';

import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

// Database Connection
connectDB();

const app = express();

// Trust the first proxy (Render/Cloudflare)
app.set('trust proxy', 1);

// ================= SECURITY MIDDLEWARE =================

// 1. Set security HTTP headers
// We disable contentSecurityPolicy by default here because we are serving inline scripts (Tailwind)
// In a strict production environment, you would configure CSP to allow your specific CDNs.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 2. Rate Limiting
// Limit requests from same IP to 100 per 10 minutes
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again after 10 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// 3. Body Parsing
app.use(express.json({ limit: '50mb' })); // Limit body size to prevent DoS (increased for Base64 images)

// 4. Data Sanitization against NoSQL query injection
// Note: In Express 5, req.query is a getter, so we need to be careful.
// We will use a custom middleware wrapper or just rely on Mongoose's built-in casting for now if this fails.
// For now, let's try to use it without modifying req.query directly if possible, or disable it temporarily if it causes issues.
// // 4. Data Sanitization against NoSQL query injection
// app.use(mongoSanitize()); 
// Note: Disabled temporarily due to incompatibility with Express 5 (req.query is read-only)
/*
app.use((req, res, next) => {
  mongoSanitize().call(null, req, res, (err) => {
    if(err) return next(err);
    next();
  });
});
*/

// 5. Prevent Parameter Pollution
app.use(hpp());

// 6. CORS Configuration
// In production, replace '*' with your actual frontend domain (e.g., https://jaanmak.com)
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};
app.use(cors(corsOptions));

// Routes
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/email', emailRoutes);

// Root Route
app.get('/', (req, res) => {
  res.send('JAANMAK API is running securely...');
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
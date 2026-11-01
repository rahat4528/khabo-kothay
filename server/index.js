// Must be the first import: ES imports are hoisted, so a later dotenv.config()
// would run after modules that read process.env at load time (feature flags, logger, env config).
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import apiRouter, { healthHandler, readyHandler } from './routes/api.js';
import { httpLogger, logger } from './services/logger.js';
import { initSentry } from './services/sentry.js';
import envConfig from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

const app = express();
const PORT = process.env.PORT || 3000;

// Behind a reverse proxy (Render, Fly, nginx) req.ip is the proxy's address unless this is set,
// which would make every user share one rate-limit and quota bucket. Set TRUST_PROXY to the
// number of proxy hops (Render: 1). Left off by default so X-Forwarded-For can't be spoofed locally.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

// Security Middleware: Helmet with configured CSP for Google Maps and fonts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://maps.googleapis.com",
          "https://maps.gstatic.com",
          "https://unpkg.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://unpkg.com"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://maps.googleapis.com",
          "https://maps.gstatic.com",
          "https://*.googleusercontent.com",
          "https://*.openstreetmap.org",
          "https://*.tile.openstreetmap.org",
          "https://*.basemaps.cartocdn.com",
          "https://unpkg.com"
        ],
        connectSrc: [
          "'self'",
          "https://maps.googleapis.com",
          "https://api.open-meteo.com",
          "https://*.tile.openstreetmap.org",
          "https://*.basemaps.cartocdn.com"
        ]
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// CORS for mobile app and cross-origin access
app.use(cors());

// Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Sentry Request Handler (if enabled via feature flag & DSN)
const sentry = initSentry(app);
app.use(sentry.requestHandler());

// Structured HTTP Request Logging with Request IDs (pino)
app.use(httpLogger);

// Rate Limiting: 120 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: envConfig.rateLimit?.windowMs || 15 * 60 * 1000,
  max: envConfig.rateLimit?.max || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
// '/api' also matches '/api/v1/*'; mounting twice would count each v1 request twice.
app.use('/api', limiter);

// Mobile client deterrent authentication token check middleware
// Mobile client deterrent authentication token check middleware
// Note: APP_CLIENT_TOKEN is a client identifier (soft deterrent against automated scrapers), not a secret credential.
export const authCheckMiddleware = (req, res, next) => {
  // Public metadata, health, and APK download endpoints
  if (
    req.path === '/health' ||
    req.path === '/ready' ||
    req.path === '/config' ||
    req.path === '/places/photo' ||
    req.path === '/download-info' ||
    req.path === '/apk/meta' ||
    req.path.startsWith('/qr')
  ) {
    return next();
  }

  const isMobileClient =
    req.headers['user-agent']?.includes('Expo') ||
    req.headers['x-requested-with'] === 'com.khabokothay.app' ||
    req.headers['x-client-platform'] === 'mobile';

  if (isMobileClient) {
    const appToken = process.env.APP_CLIENT_TOKEN;
    if (!appToken) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('APP_CLIENT_TOKEN is unset in production. Failing closed for mobile request.');
        return res.status(500).json({
          error: 'Server configuration error: client authentication token is not configured.'
        });
      }
      return next();
    }

    const clientToken = req.headers['x-app-token'];
    if (!clientToken || clientToken !== appToken) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or missing X-App-Token header.'
      });
    }
  }

  next();
};

app.use('/api', authCheckMiddleware);

// Root Liveness & Readiness Probes (for orchestrators, load balancers, and monitoring)
app.get('/health', healthHandler);
app.get('/ready', readyHandler);

// APK Download & QR Sharing Landing Pages
app.get(['/download', '/apk'], (req, res) => {
  res.sendFile(path.join(publicDir, 'download.html'));
});

// Serve frontend static assets
app.use(express.static(publicDir));

// Mount Versioned API Routes (/api/v1 and backwards-compatible /api)
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// Fallback for SPA routing to index.html
// Return 404 for missing static assets/file downloads instead of serving index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || path.extname(req.path)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Sentry Error Handler (if active)
app.use(sentry.errorHandler());

// Centralized error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error({ err, reqId: req.id }, 'Unhandled server error');
  res.status(status).json({
    // Client errors (e.g. malformed JSON) are safe to echo; internal error details are not.
    error: status < 500 ? err.message : 'Internal Server Error',
    status,
    requestId: req.id
  });
});

let server = null;

// Only listen if executed directly (not when imported in supertest)
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`Khabo Kothay? running on http://localhost:${PORT}`);
    logger.info(`Environment: ${envConfig.env} | Mock mode: ${process.env.USE_MOCK_DATA === 'true' ? 'ENABLED' : 'DISABLED'}`);
    if (envConfig.env === 'production' && (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN === 'secret_admin_token')) {
      logger.warn('ADMIN_TOKEN is unset or still the example value; admin endpoints are effectively locked.');
    }
  });

  // Graceful shutdown handling
  const shutdown = (signal) => {
    logger.info({ signal }, 'Received termination signal. Closing HTTP server gracefully...');
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed cleanly. Process exiting.');
        process.exit(0);
      });
      // Force exit if hanging requests exceed 10 seconds
      setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
        process.exit(1);
      }, 10000).unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;

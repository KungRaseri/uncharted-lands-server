/**
 * Uncharted Lands - Game Server
 *
 * Real-time multiplayer game server using Socket.IO
 */

import { Server } from 'socket.io';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/socket-events.js';
import { registerEventHandlers } from './events/handlers.js';
import {
  authenticationMiddleware,
  loggingMiddleware,
  errorHandlingMiddleware,
} from './middleware/socket-middleware.js';
import { logger } from './utils/logger.js';
import { closeDatabase, isDatabaseConnected } from './db/index.js';
import { startGameLoop, stopGameLoop, getGameLoopStatus } from './game/game-loop.js';
import apiRouter from './api/index.js';
import { apiLimiter } from './api/middleware/rateLimit.js';

// Load environment variables
dotenv.config();

// Configuration
const PORT = Number.parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app = express();

// Express middleware
app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json()); // Default limit is sufficient for settings
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// REST API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  const gameLoopStatus = getGameLoopStatus();
  const dbStatus = isDatabaseConnected();
  
  res.json({
    status: dbStatus ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    connections: io?.engine?.clientsCount || 0,
    environment: NODE_ENV,
    database: {
      connected: dbStatus,
      status: dbStatus ? 'operational' : 'unavailable',
    },
    gameLoop: gameLoopStatus,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
  });
});

// Create HTTP server from Express app
const httpServer = http.createServer(app);

// Create Socket.IO server with TypeScript types
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: {
      origin: CORS_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection settings
    pingTimeout: 60000, // 60 seconds before considering connection dead
    pingInterval: 25000, // Send ping every 25 seconds
    upgradeTimeout: 30000, // 30 seconds to complete upgrade
    maxHttpBufferSize: 1e6, // 1MB max message size
    // Enable compression for production
    perMessageDeflate: NODE_ENV === 'production',
    // Transport options
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
  }
);

// Apply middleware
io.use(loggingMiddleware);
io.use(authenticationMiddleware);
io.use(errorHandlingMiddleware);

// Handle new connections
io.on('connection', (socket) => {
  const connectionInfo = {
    socketId: socket.id,
    address: socket.handshake.address,
    transport: socket.conn.transport.name,
    userAgent: socket.handshake.headers['user-agent'],
  };
  
  logger.info('[SOCKET] ✓ Client connected', connectionInfo);

  // Send welcome message
  socket.emit('connected', {
    message: 'Welcome to Uncharted Lands Server',
    socketId: socket.id,
    timestamp: Date.now(),
  });

  // Register all event handlers
  registerEventHandlers(socket);

  // Log transport upgrades
  socket.conn.on('upgrade', (transport) => {
    logger.debug('[SOCKET] Transport upgraded', {
      socketId: socket.id,
      from: socket.conn.transport.name,
      to: transport.name,
    });
  });

  // Track connection duration on disconnect
  socket.on('disconnect', (reason) => {
    const duration = Date.now() - socket.data.connectedAt;
    logger.info('[SOCKET] ✗ Client disconnected', {
      socketId: socket.id,
      reason,
      duration: `${(duration / 1000).toFixed(2)}s`,
      playerId: socket.data.playerId || 'unauthenticated',
    });
  });
});

/**
 * Broadcast message to all clients in a specific world
 */
export function broadcastToWorld(worldId: string, event: string, data: unknown): void {
  io.to(`world:${worldId}`).emit(event as keyof ServerToClientEvents, data as never);
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastToAll(event: string, data: unknown): void {
  io.emit(event as keyof ServerToClientEvents, data as never);
}

/**
 * Get connection statistics
 */
export function getStats() {
  return {
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
    environment: NODE_ENV,
  };
}

// Start server
httpServer.listen(PORT, HOST, () => {
  const dbStatus = isDatabaseConnected();
  
  logger.info('═'.repeat(60));
  logger.info('  🎮 Uncharted Lands - Game Server');
  logger.info('═'.repeat(60));
  logger.info(`  Environment:  ${NODE_ENV}`);
  logger.info(`  Node Version: ${process.version}`);
  logger.info('─'.repeat(60));
  logger.info(`  WebSocket:    ws://${HOST}:${PORT}`);
  logger.info(`  REST API:     http://${HOST}:${PORT}/api`);
  logger.info(`  Health Check: http://${HOST}:${PORT}/health`);
  logger.info('─'.repeat(60));
  logger.info(`  Database:     ${dbStatus ? '✓ Connected' : '✗ Disconnected'}`);
  logger.info(`  CORS Origins: ${CORS_ORIGINS.length} configured`);
  for (const origin of CORS_ORIGINS) {
    logger.info(`    • ${origin}`);
  }
  logger.info('═'.repeat(60));

  if (dbStatus) {
    logger.info('[STARTUP] ✓ All systems operational');
  } else {
    logger.warn('[STARTUP] ⚠️  Server started WITHOUT database connection');
    logger.warn('[STARTUP] Database operations will fail until connection is restored');
  }

  // Start the game loop
  startGameLoop(io);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`[SHUTDOWN] ${signal} signal received`);

  // Stop game loop first
  logger.info('[SHUTDOWN] Stopping game loop...');
  stopGameLoop();

  logger.info('[SHUTDOWN] Closing Socket.IO server...');

  io.close(async () => {
    logger.info('[SHUTDOWN] Socket.IO server closed');

    // Close database connections
    try {
      await closeDatabase();
      logger.info('[SHUTDOWN] Database connections closed');
    } catch (error) {
      logger.error('[SHUTDOWN] Error closing database:', error);
    }

    httpServer.close(() => {
      logger.info('[SHUTDOWN] HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('[SHUTDOWN] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('[FATAL] Uncaught exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  logger.error('[FATAL] Unhandled rejection:', reason);
  shutdown('UNHANDLED_REJECTION');
});

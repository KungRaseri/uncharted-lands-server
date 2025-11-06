/**
 * Uncharted Lands - Game Server
 * 
 * Real-time multiplayer game server using Socket.IO
 */

import { Server } from 'socket.io';
import http from 'node:http';
import * as dotenv from 'dotenv';
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
} from './types/socket-events';
import { registerEventHandlers } from './events/handlers';
import {
	authenticationMiddleware,
	loggingMiddleware,
	errorHandlingMiddleware
} from './middleware/socket-middleware';
import { logger } from './utils/logger';
import { db, closeDatabase } from './db/index';

// Load environment variables
dotenv.config();

// Configuration
const PORT = Number.parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server for health checks and WebSocket upgrade
const httpServer = http.createServer((req, res) => {
	if (req.url === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(
			JSON.stringify({
				status: 'healthy',
				uptime: process.uptime(),
				connections: io.engine.clientsCount,
				environment: NODE_ENV,
				timestamp: new Date().toISOString()
			})
		);
	} else {
		res.writeHead(404, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'Not found' }));
	}
});

// Create Socket.IO server with TypeScript types
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
	httpServer,
	{
		cors: {
			origin: CORS_ORIGINS,
			methods: ['GET', 'POST'],
			credentials: true
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
		allowUpgrades: true
	}
);

// Apply middleware
io.use(loggingMiddleware);
io.use(authenticationMiddleware);
io.use(errorHandlingMiddleware);

// Handle new connections
io.on('connection', (socket) => {
	logger.info(`[CONNECTION] Client connected: ${socket.id}`, {
		address: socket.handshake.address
	});

	// Send welcome message
	socket.emit('connected', {
		message: 'Welcome to Uncharted Lands Server',
		socketId: socket.id,
		timestamp: Date.now()
	});

	// Register all event handlers
	registerEventHandlers(socket);

	// Track connection duration on disconnect
	socket.on('disconnect', () => {
		const duration = Date.now() - socket.data.connectedAt;
		logger.info(`[CONNECTION] Client disconnected: ${socket.id}`, {
			duration: `${(duration / 1000).toFixed(2)}s`,
			playerId: socket.data.playerId
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
		environment: NODE_ENV
	};
}

// Start server
httpServer.listen(PORT, HOST, () => {
	logger.info('═'.repeat(50));
	logger.info('  Uncharted Lands - Game Server');
	logger.info('═'.repeat(50));
	logger.info(`  WebSocket:   ws://${HOST}:${PORT}`);
	logger.info(`  Health:      http://${HOST}:${PORT}/health`);
	logger.info(`  Environment: ${NODE_ENV}`);
	logger.info(`  CORS:        ${CORS_ORIGINS.join(', ')}`);
	logger.info('═'.repeat(50));
});

// Graceful shutdown
const shutdown = async (signal: string) => {
	logger.info(`[SHUTDOWN] ${signal} signal received`);
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

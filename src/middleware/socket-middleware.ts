/**
 * Socket.IO Middleware
 * 
 * Middleware functions for authentication, validation, and error handling
 */

import type { Socket } from 'socket.io';
import type { ExtendedError } from 'socket.io/dist/namespace';
import { logger } from '../utils/logger';

/**
 * Authentication middleware
 * Validates connection before allowing socket to connect
 */
export function authenticationMiddleware(
	socket: Socket,
	next: (err?: ExtendedError) => void
): void {
	try {
		// Extract auth data from handshake
		const { auth } = socket.handshake;

		// For now, allow all connections
		// TODO: Implement JWT validation when auth is ready
		if (process.env.NODE_ENV === 'production') {
			// In production, validate token
			const token = auth?.token as string;
			if (!token) {
				logger.warn('[AUTH] Connection rejected: No token provided', {
					socketId: socket.id
				});
				return next(new Error('Authentication required'));
			}

			// TODO: Validate JWT token
			// const isValid = validateJWT(token);
			// if (!isValid) {
			//   return next(new Error('Invalid token'));
			// }
		}

		// Set initial socket data
		socket.data.authenticated = false;
		socket.data.connectedAt = Date.now();

		logger.debug('[AUTH] Connection allowed', { socketId: socket.id });
		next();
	} catch (error) {
		logger.error('[AUTH] Middleware error:', error);
		next(new Error('Authentication error'));
	}
}

/**
 * Rate limiting middleware
 * Prevents spam by limiting event frequency
 */
export function rateLimitMiddleware(
	socket: Socket,
	next: (err?: ExtendedError) => void
): void {
	// TODO: Implement rate limiting
	// Track events per socket per time window
	// Reject if exceeds threshold
	next();
}

/**
 * Logging middleware
 * Logs all incoming events for debugging
 */
export function loggingMiddleware(
	socket: Socket,
	next: (err?: ExtendedError) => void
): void {
	// Log connection
	logger.info('[CONNECTION] New client connecting', {
		socketId: socket.id,
		address: socket.handshake.address,
		userAgent: socket.handshake.headers['user-agent']
	});

	// Wrap emit to log outgoing events in development
	if (process.env.NODE_ENV === 'development') {
		const originalEmit = socket.emit.bind(socket);
		socket.emit = ((event: string, ...args: unknown[]) => {
			logger.debug(`[EMIT] ${event}`, { socketId: socket.id });
			return originalEmit(event, ...args);
		}) as typeof socket.emit;
	}

	next();
}

/**
 * Error handling middleware
 * Catches and logs errors before they crash the server
 */
export function errorHandlingMiddleware(
	socket: Socket,
	next: (err?: ExtendedError) => void
): void {
	// Wrap socket event handlers with try-catch
	const originalOn = socket.on.bind(socket);
	socket.on = ((event: string, listener: (...args: unknown[]) => void) => {
		const wrappedListener = (...args: unknown[]) => {
			try {
				listener(...args);
			} catch (error) {
				logger.error(`[ERROR] Error in ${event} handler:`, error, {
					socketId: socket.id,
					playerId: socket.data.playerId
				});

				// Emit error to client
				socket.emit('error', {
					code: 'HANDLER_ERROR',
					message: 'An error occurred processing your request',
					timestamp: Date.now()
				});
			}
		};
		return originalOn(event, wrappedListener);
	}) as typeof socket.on;

	next();
}

/**
 * Socket.IO Event Handlers
 * 
 * Organized handlers for all client events
 */

import type { Socket } from 'socket.io';
import type {
	AuthenticateData,
	JoinWorldData,
	LeaveWorldData,
	GameStateRequest,
	BuildStructureData,
	CollectResourcesData
} from '../types/socket-events';
import { logger } from '../utils/logger';

/**
 * Register all event handlers for a socket connection
 */
export function registerEventHandlers(socket: Socket): void {
	// Authentication
	socket.on('authenticate', (data, callback) => handleAuthenticate(socket, data, callback));

	// World Management
	socket.on('join-world', (data) => handleJoinWorld(socket, data));
	socket.on('leave-world', (data) => handleLeaveWorld(socket, data));

	// Game State
	socket.on('request-game-state', (data) => handleGameStateRequest(socket, data));

	// Settlement Actions
	socket.on('build-structure', (data, callback) => handleBuildStructure(socket, data, callback));
	socket.on('collect-resources', (data, callback) => handleCollectResources(socket, data, callback));

	// Disconnect
	socket.on('disconnect', (reason) => handleDisconnect(socket, reason));

	// Errors
	socket.on('error', (error) => handleError(socket, error));
}

/**
 * Handle player authentication
 */
async function handleAuthenticate(
	socket: Socket,
	data: AuthenticateData,
	callback?: (response: any) => void
): Promise<void> {
	try {
		logger.info(`[AUTH] Player authenticating: ${data.playerId}`, { socketId: socket.id });

		// TODO: Validate token if provided
		// For now, accept all authentications
		const isValid = true;

		if (isValid) {
			// Store player data in socket
			socket.data.playerId = data.playerId;
			socket.data.authenticated = true;

			const response = {
				success: true,
				playerId: data.playerId
			};

			// Send response via callback (acknowledgment pattern)
			if (callback) {
				callback(response);
			} else {
				socket.emit('authenticated', response);
			}

			logger.info(`[AUTH] Player authenticated: ${data.playerId}`, { socketId: socket.id });
		} else {
			const response = {
				success: false,
				error: 'Invalid authentication token'
			};

			if (callback) {
				callback(response);
			} else {
				socket.emit('error', {
					code: 'AUTH_FAILED',
					message: 'Authentication failed',
					timestamp: Date.now()
				});
			}
		}
	} catch (error) {
		logger.error('[AUTH] Authentication error:', error);
		socket.emit('error', {
			code: 'AUTH_ERROR',
			message: 'Authentication error occurred',
			timestamp: Date.now()
		});
	}
}

/**
 * Handle player joining a world
 */
async function handleJoinWorld(socket: Socket, data: JoinWorldData): Promise<void> {
	try {
		logger.info(`[WORLD] Player ${data.playerId} joining world ${data.worldId}`, {
			socketId: socket.id
		});

		// Store world ID in socket data
		socket.data.worldId = data.worldId;

		// Join Socket.IO room for world-specific broadcasts
		await socket.join(`world:${data.worldId}`);

		// Notify player they joined
		socket.emit('world-joined', {
			worldId: data.worldId,
			timestamp: Date.now()
		});

		// Notify others in the world
		socket.to(`world:${data.worldId}`).emit('player-joined', {
			playerId: data.playerId,
			timestamp: Date.now()
		});

		logger.info(`[WORLD] Player ${data.playerId} joined world ${data.worldId}`, {
			socketId: socket.id
		});
	} catch (error) {
		logger.error('[WORLD] Error joining world:', error);
		socket.emit('error', {
			code: 'JOIN_WORLD_ERROR',
			message: 'Failed to join world',
			timestamp: Date.now()
		});
	}
}

/**
 * Handle player leaving a world
 */
async function handleLeaveWorld(socket: Socket, data: LeaveWorldData): Promise<void> {
	try {
		logger.info(`[WORLD] Player ${data.playerId} leaving world ${data.worldId}`, {
			socketId: socket.id
		});

		// Leave Socket.IO room
		await socket.leave(`world:${data.worldId}`);

		// Notify others in the world
		socket.to(`world:${data.worldId}`).emit('player-left', {
			playerId: data.playerId,
			timestamp: Date.now()
		});

		// Clear world ID from socket data
		socket.data.worldId = undefined;

		logger.info(`[WORLD] Player ${data.playerId} left world ${data.worldId}`, {
			socketId: socket.id
		});
	} catch (error) {
		logger.error('[WORLD] Error leaving world:', error);
	}
}

/**
 * Handle game state request
 */
async function handleGameStateRequest(socket: Socket, data: GameStateRequest): Promise<void> {
	try {
		logger.info(`[STATE] State requested for world ${data.worldId}`, { socketId: socket.id });

		// TODO: Fetch actual game state from database/cache
		// For now, send placeholder
		socket.emit('game-state', {
			worldId: data.worldId,
			state: {
				// Will be populated with real game state
				message: 'Game state will be implemented'
			},
			timestamp: Date.now()
		});
	} catch (error) {
		logger.error('[STATE] Error fetching game state:', error);
		socket.emit('error', {
			code: 'STATE_ERROR',
			message: 'Failed to fetch game state',
			timestamp: Date.now()
		});
	}
}

/**
 * Handle structure building
 */
async function handleBuildStructure(
	socket: Socket,
	data: BuildStructureData,
	callback?: (response: any) => void
): Promise<void> {
	try {
		logger.info(`[ACTION] Building structure: ${data.structureType} in settlement ${data.settlementId}`, {
			socketId: socket.id
		});

		// TODO: Validate and process structure building
		// - Check if player owns settlement
		// - Check if resources are sufficient
		// - Check if location is valid
		// - Update database
		// - Broadcast to world

		const response = {
			success: true,
			settlementId: data.settlementId,
			structureType: data.structureType,
			timestamp: Date.now()
		};

		// Acknowledge action
		if (callback) {
			callback(response);
		} else {
			socket.emit('structure-built', response);
		}

		// TODO: Broadcast to world when implemented
		// if (socket.data.worldId) {
		//   socket.to(`world:${socket.data.worldId}`).emit('state-update', {...});
		// }
	} catch (error) {
		logger.error('[ACTION] Error building structure:', error);
		const errorResponse = {
			success: false,
			error: 'Failed to build structure',
			timestamp: Date.now()
		};

		if (callback) {
			callback(errorResponse);
		} else {
			socket.emit('error', {
				code: 'BUILD_ERROR',
				message: 'Failed to build structure',
				timestamp: Date.now()
			});
		}
	}
}

/**
 * Handle resource collection
 */
async function handleCollectResources(
	socket: Socket,
	data: CollectResourcesData,
	callback?: (response: any) => void
): Promise<void> {
	try {
		logger.info(`[ACTION] Collecting resources for settlement ${data.settlementId}`, {
			socketId: socket.id
		});

		// TODO: Calculate and update resources
		// - Fetch settlement from database
		// - Calculate production since last collection
		// - Update storage
		// - Return new amounts

		const response = {
			success: true,
			settlementId: data.settlementId,
			resources: {
				food: 0,
				water: 0,
				wood: 0,
				stone: 0,
				ore: 0
			},
			timestamp: Date.now()
		};

		if (callback) {
			callback(response);
		} else {
			socket.emit('resources-collected', response);
		}
	} catch (error) {
		logger.error('[ACTION] Error collecting resources:', error);
		const errorResponse = {
			success: false,
			error: 'Failed to collect resources',
			timestamp: Date.now()
		};

		if (callback) {
			callback(errorResponse);
		} else {
			socket.emit('error', {
				code: 'COLLECT_ERROR',
				message: 'Failed to collect resources',
				timestamp: Date.now()
			});
		}
	}
}

/**
 * Handle socket disconnect
 */
function handleDisconnect(socket: Socket, reason: string): void {
	logger.info(`[DISCONNECT] Client disconnected: ${socket.id} (${reason})`, {
		playerId: socket.data.playerId,
		worldId: socket.data.worldId
	});

	// Notify others in the world if player was in one
	if (socket.data.worldId && socket.data.playerId) {
		socket.to(`world:${socket.data.worldId}`).emit('player-left', {
			playerId: socket.data.playerId,
			timestamp: Date.now()
		});
	}
}

/**
 * Handle socket errors
 */
function handleError(socket: Socket, error: Error): void {
	logger.error(`[ERROR] Socket error for ${socket.id}:`, error, {
		playerId: socket.data.playerId,
		worldId: socket.data.worldId
	});
}

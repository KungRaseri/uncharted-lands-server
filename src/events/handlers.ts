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
import {
	getSettlementWithDetails,
	updateSettlementStorage,
	getPlayerSettlements,
	createStructure
} from '../db/queries';
import { calculateTimedProduction, addResources, subtractResources, hasEnoughResources } from '../game/resource-calculator';
import { registerPlayerSettlements, unregisterPlayerSettlements } from '../game/game-loop';

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

		// Register player's settlements for auto-updates in the game loop
		if (socket.data.playerId) {
			await registerPlayerSettlements(socket.data.playerId, data.worldId);
		}

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

		// Unregister player's settlements from game loop
		if (socket.data.playerId) {
			await unregisterPlayerSettlements(socket.data.playerId);
		}

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
		logger.info(`[STATE] State requested for world ${data.worldId}`, {
			socketId: socket.id,
			playerId: socket.data.playerId
		});

		// Verify player is authenticated
		if (!socket.data.playerId) {
			socket.emit('error', {
				code: 'AUTH_REQUIRED',
				message: 'Authentication required',
				timestamp: Date.now()
			});
			return;
		}

		// Fetch player's settlements
		const settlements = await getPlayerSettlements(socket.data.playerId);

		// Send game state to client
		socket.emit('game-state', {
			worldId: data.worldId,
			state: {
				settlements: settlements,
				playerId: socket.data.playerId
			},
			timestamp: Date.now()
		});

		logger.info('[STATE] Game state sent successfully', {
			playerId: socket.data.playerId,
			settlementCount: settlements.length
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
			socketId: socket.id,
			playerId: socket.data.playerId
		});

		// Verify player is authenticated
		if (!socket.data.playerId) {
			const errorResponse = {
				success: false,
				error: 'Authentication required',
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		// Get settlement with storage
		const settlementData = await getSettlementWithDetails(data.settlementId);
		
		if (!settlementData?.settlement) {
			const errorResponse = {
				success: false,
				error: 'Settlement not found',
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		// Verify ownership
		if (settlementData.settlement.playerProfileId !== socket.data.playerId) {
			const errorResponse = {
				success: false,
				error: 'You do not own this settlement',
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		const storage = settlementData.storage;
		if (!storage) {
			const errorResponse = {
				success: false,
				error: 'Settlement storage not found',
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		// Define structure types and their costs
		// In a real implementation, this would come from a configuration file or database
		const structureTypes: Record<string, {
			name: string;
			description: string;
			cost: { food: number; water: number; wood: number; stone: number; ore: number; };
			requirements: { area: number; solar: number; wind: number; };
			modifiers?: Array<{ name: string; description: string; value: number; }>;
		}> = {
			'house': {
				name: 'House',
				description: 'A basic dwelling for settlers',
				cost: { food: 0, water: 0, wood: 50, stone: 20, ore: 0 },
				requirements: { area: 1, solar: 0, wind: 0 },
				modifiers: [
					{ name: 'population_capacity', description: 'Increases population capacity', value: 5 }
				]
			},
			'farm': {
				name: 'Farm',
				description: 'Produces food over time',
				cost: { food: 0, water: 10, wood: 30, stone: 10, ore: 0 },
				requirements: { area: 2, solar: 1, wind: 0 },
				modifiers: [
					{ name: 'food_production', description: 'Increases food production', value: 10 }
				]
			},
			'well': {
				name: 'Well',
				description: 'Provides access to water',
				cost: { food: 0, water: 0, wood: 20, stone: 40, ore: 5 },
				requirements: { area: 1, solar: 0, wind: 0 },
				modifiers: [
					{ name: 'water_production', description: 'Increases water production', value: 15 }
				]
			},
			'lumbermill': {
				name: 'Lumber Mill',
				description: 'Processes wood more efficiently',
				cost: { food: 0, water: 5, wood: 40, stone: 30, ore: 10 },
				requirements: { area: 2, solar: 0, wind: 1 },
				modifiers: [
					{ name: 'wood_production', description: 'Increases wood production', value: 12 }
				]
			},
			'quarry': {
				name: 'Quarry',
				description: 'Extracts stone from the ground',
				cost: { food: 0, water: 10, wood: 30, stone: 20, ore: 15 },
				requirements: { area: 3, solar: 0, wind: 0 },
				modifiers: [
					{ name: 'stone_production', description: 'Increases stone production', value: 8 }
				]
			},
			'mine': {
				name: 'Mine',
				description: 'Extracts ore from deep underground',
				cost: { food: 0, water: 15, wood: 50, stone: 60, ore: 20 },
				requirements: { area: 3, solar: 0, wind: 0 },
				modifiers: [
					{ name: 'ore_production', description: 'Increases ore production', value: 5 }
				]
			}
		};

		const structureConfig = structureTypes[data.structureType.toLowerCase()];
		if (!structureConfig) {
			const errorResponse = {
				success: false,
				error: `Unknown structure type: ${data.structureType}`,
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		// Check if player has enough resources
		const currentResources = {
			food: storage.food,
			water: storage.water,
			wood: storage.wood,
			stone: storage.stone,
			ore: storage.ore
		};

		const hasResources = hasEnoughResources(currentResources, structureConfig.cost);
		if (!hasResources) {
			const errorResponse = {
				success: false,
				error: 'Insufficient resources to build structure',
				required: structureConfig.cost,
				current: currentResources,
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		// Deduct resources
		const newResources = subtractResources(currentResources, structureConfig.cost);
		await updateSettlementStorage(storage.id, newResources);

		// Create the structure
		const structureResult = await createStructure(
			data.settlementId,
			structureConfig.name,
			structureConfig.description,
			{
				...structureConfig.requirements,
				food: structureConfig.cost.food,
				water: structureConfig.cost.water,
				wood: structureConfig.cost.wood,
				stone: structureConfig.cost.stone,
				ore: structureConfig.cost.ore
			},
			structureConfig.modifiers
		);

		const response = {
			success: true,
			settlementId: data.settlementId,
			structure: structureResult.structure,
			remainingResources: newResources,
			timestamp: Date.now()
		};

		// Acknowledge action
		if (callback) {
			callback(response);
		} else {
			socket.emit('structure-built', response);
		}

		// Broadcast to world
		if (socket.data.worldId) {
			socket.to(`world:${socket.data.worldId}`).emit('state-update', {
				type: 'structure-built',
				settlementId: data.settlementId,
				structureId: structureResult.structure.id,
				structureName: structureConfig.name,
				playerId: socket.data.playerId,
				timestamp: Date.now()
			});
		}

		logger.info('[ACTION] Structure built successfully', {
			settlementId: data.settlementId,
			structureId: structureResult.structure.id,
			structureType: data.structureType,
			playerId: socket.data.playerId
		});
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
			socketId: socket.id,
			playerId: socket.data.playerId
		});

		// Verify player is authenticated
		if (!socket.data.playerId) {
			const errorResponse = {
				success: false,
				error: 'Authentication required',
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		// Fetch settlement with details from database
		const settlementData = await getSettlementWithDetails(data.settlementId);
		
		if (!settlementData?.settlement) {
			const errorResponse = {
				success: false,
				error: 'Settlement not found',
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		// Verify player owns this settlement
		if (settlementData.settlement.playerProfileId !== socket.data.playerId) {
			const errorResponse = {
				success: false,
				error: 'You do not own this settlement',
				timestamp: Date.now()
			};
			logger.warn('[ACTION] Player attempted to collect resources from settlement they do not own', {
				playerId: socket.data.playerId,
				settlementId: data.settlementId,
				ownerId: settlementData.settlement.playerProfileId
			});
			return callback ? callback(errorResponse) : undefined;
		}

		// Get current storage
		const storage = settlementData.storage;
		const plot = settlementData.plot;
		
		if (!storage) {
			const errorResponse = {
				success: false,
				error: 'Settlement storage not found',
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		if (!plot) {
			const errorResponse = {
				success: false,
				error: 'Settlement plot not found',
				timestamp: Date.now()
			};
			return callback ? callback(errorResponse) : undefined;
		}

		// Calculate production since last update
		// Using updatedAt as last collection time
		const lastCollectionTime = settlementData.settlement.updatedAt?.getTime() || Date.now();
		const production = calculateTimedProduction(plot, lastCollectionTime);

		// Add production to current storage
		const newResources = addResources(
			{
				food: storage.food,
				water: storage.water,
				wood: storage.wood,
				stone: storage.stone,
				ore: storage.ore
			},
			production
		);

		// Update storage in database
		await updateSettlementStorage(storage.id, newResources);
		
		const response = {
			success: true,
			settlementId: data.settlementId,
			resources: newResources,
			production: production,
			timestamp: Date.now()
		};

		if (callback) {
			callback(response);
		} else {
			socket.emit('resources-collected', response);
		}

		logger.info('[ACTION] Resources collected successfully', {
			settlementId: data.settlementId,
			playerId: socket.data.playerId
		});
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
async function handleDisconnect(socket: Socket, reason: string): Promise<void> {
	logger.info(`[DISCONNECT] Client disconnected: ${socket.id} (${reason})`, {
		playerId: socket.data.playerId,
		worldId: socket.data.worldId
	});

	// Unregister player's settlements from game loop
	if (socket.data.playerId) {
		await unregisterPlayerSettlements(socket.data.playerId);
	}

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

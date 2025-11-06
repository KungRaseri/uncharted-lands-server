/**
 * Game Loop System
 * 
 * Manages the 60Hz tick system for automatic resource generation
 * and other time-based game mechanics
 */

import type { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';
import { 
	getPlayerSettlements, 
	updateSettlementStorage,
	getSettlementWithDetails
} from '../db/queries';
import { calculateProduction, addResources } from './resource-calculator';

// Game loop configuration
const TICK_RATE = 60; // 60 ticks per second
const TICK_INTERVAL_MS = 1000 / TICK_RATE; // ~16.67ms per tick

// Track active game loop
let gameLoopInterval: NodeJS.Timeout | null = null;
let currentTick = 0;
let isRunning = false;

// Track active settlements that need updates
const activeSettlements = new Map<string, {
	settlementId: string;
	playerId: string;
	worldId: string;
	lastUpdateTick: number;
}>();

/**
 * Start the game loop
 */
export function startGameLoop(io: SocketIOServer): void {
	if (isRunning) {
		logger.warn('[GAME LOOP] Attempted to start game loop that is already running');
		return;
	}

	logger.info('[GAME LOOP] Starting game loop', {
		tickRate: TICK_RATE,
		tickInterval: TICK_INTERVAL_MS
	});

	isRunning = true;
	currentTick = 0;

	gameLoopInterval = setInterval(async () => {
		try {
			await processTick(io);
		} catch (error) {
			logger.error('[GAME LOOP] Error processing tick:', error);
		}
	}, TICK_INTERVAL_MS);

	logger.info('[GAME LOOP] Game loop started successfully');
}

/**
 * Stop the game loop
 */
export function stopGameLoop(): void {
	if (!isRunning) {
		logger.warn('[GAME LOOP] Attempted to stop game loop that is not running');
		return;
	}

	logger.info('[GAME LOOP] Stopping game loop', {
		finalTick: currentTick
	});

	if (gameLoopInterval) {
		clearInterval(gameLoopInterval);
		gameLoopInterval = null;
	}

	isRunning = false;
	currentTick = 0;
	activeSettlements.clear();

	logger.info('[GAME LOOP] Game loop stopped successfully');
}

/**
 * Process a single tick
 */
async function processTick(io: SocketIOServer): Promise<void> {
	currentTick++;

	// Update every 60 ticks (once per second)
	// This prevents overwhelming the database with updates
	if (currentTick % TICK_RATE !== 0) {
		return;
	}

	// Process all active settlements
	if (activeSettlements.size === 0) {
		return;
	}

	const settlements = Array.from(activeSettlements.values());
	
	// Process settlements in batches to avoid overwhelming the database
	const batchSize = 10;
	for (let i = 0; i < settlements.length; i += batchSize) {
		const batch = settlements.slice(i, i + batchSize);
		await Promise.all(batch.map(settlement => 
			processSettlement(settlement, io)
		));
	}
}

/**
 * Process resource generation for a single settlement
 */
async function processSettlement(
	settlement: {
		settlementId: string;
		playerId: string;
		worldId: string;
		lastUpdateTick: number;
	},
	io: SocketIOServer
): Promise<void> {
	try {
		// Fetch settlement details
		const settlementData = await getSettlementWithDetails(settlement.settlementId);
		
		if (!settlementData?.settlement || !settlementData.storage || !settlementData.plot) {
			logger.warn('[GAME LOOP] Settlement data incomplete, removing from active list', {
				settlementId: settlement.settlementId
			});
			activeSettlements.delete(settlement.settlementId);
			return;
		}

		const { storage, plot } = settlementData;

		// Calculate ticks since last update
		const ticksSinceUpdate = currentTick - settlement.lastUpdateTick;
		
		// Calculate production for those ticks
		const production = calculateProduction(plot, ticksSinceUpdate);

		// Add production to storage
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

		// Update last update tick
		settlement.lastUpdateTick = currentTick;

		// Broadcast update to world
		io.to(`world:${settlement.worldId}`).emit('resource-update', {
			type: 'auto-production',
			settlementId: settlement.settlementId,
			resources: newResources,
			production: production,
			timestamp: Date.now()
		});

		logger.debug('[GAME LOOP] Settlement resources updated', {
			settlementId: settlement.settlementId,
			production,
			newResources
		});
	} catch (error) {
		logger.error('[GAME LOOP] Error processing settlement:', error, {
			settlementId: settlement.settlementId
		});
	}
}

/**
 * Register a settlement for automatic updates
 */
export function registerSettlement(
	settlementId: string,
	playerId: string,
	worldId: string
): void {
	if (activeSettlements.has(settlementId)) {
		logger.debug('[GAME LOOP] Settlement already registered', { settlementId });
		return;
	}

	activeSettlements.set(settlementId, {
		settlementId,
		playerId,
		worldId,
		lastUpdateTick: currentTick
	});

	logger.info('[GAME LOOP] Settlement registered for auto-updates', {
		settlementId,
		playerId,
		worldId,
		activeSettlementCount: activeSettlements.size
	});
}

/**
 * Unregister a settlement from automatic updates
 */
export function unregisterSettlement(settlementId: string): void {
	const removed = activeSettlements.delete(settlementId);
	
	if (removed) {
		logger.info('[GAME LOOP] Settlement unregistered from auto-updates', {
			settlementId,
			activeSettlementCount: activeSettlements.size
		});
	}
}

/**
 * Get game loop status
 */
export function getGameLoopStatus(): {
	isRunning: boolean;
	currentTick: number;
	activeSettlements: number;
	tickRate: number;
} {
	return {
		isRunning,
		currentTick,
		activeSettlements: activeSettlements.size,
		tickRate: TICK_RATE
	};
}

/**
 * Register all player settlements when they join a world
 */
export async function registerPlayerSettlements(
	playerId: string,
	worldId: string
): Promise<void> {
	try {
		const settlements = await getPlayerSettlements(playerId);
		
		for (const settlement of settlements) {
			registerSettlement(settlement.id, playerId, worldId);
		}

		logger.info('[GAME LOOP] Registered all player settlements', {
			playerId,
			worldId,
			settlementCount: settlements.length
		});
	} catch (error) {
		logger.error('[GAME LOOP] Error registering player settlements:', error, {
			playerId,
			worldId
		});
	}
}

/**
 * Unregister all player settlements when they leave a world
 */
export async function unregisterPlayerSettlements(playerId: string): Promise<void> {
	try {
		// Find and remove all settlements belonging to this player
		const toRemove: string[] = [];
		
		for (const [settlementId, settlement] of activeSettlements.entries()) {
			if (settlement.playerId === playerId) {
				toRemove.push(settlementId);
			}
		}

		for (const settlementId of toRemove) {
			unregisterSettlement(settlementId);
		}

		logger.info('[GAME LOOP] Unregistered all player settlements', {
			playerId,
			settlementCount: toRemove.length
		});
	} catch (error) {
		logger.error('[GAME LOOP] Error unregistering player settlements:', error, {
			playerId
		});
	}
}

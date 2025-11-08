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
  CollectResourcesData,
  CreateWorldData,
  CreateWorldResponse,
  RequestWorldDataData,
  WorldDataResponse,
  RequestRegionData,
  RegionDataResponse,
} from '../types/socket-events';
import { logger } from '../utils/logger';
import {
  getSettlementWithDetails,
  updateSettlementStorage,
  getPlayerSettlements,
  createStructure,
} from '../db/queries';
import {
  calculateTimedProduction,
  addResources,
  subtractResources,
  hasEnoughResources,
} from '../game/resource-calculator';
import { registerPlayerSettlements, unregisterPlayerSettlements } from '../game/game-loop';
import { createWorld } from '../game/world-creator';

/**
 * Register all event handlers for a socket connection
 */
export function registerEventHandlers(socket: Socket): void {
  // Authentication
  socket.on('authenticate', (data, callback) => handleAuthenticate(socket, data, callback));

  // World Management
  socket.on('join-world', (data) => handleJoinWorld(socket, data));
  socket.on('leave-world', (data) => handleLeaveWorld(socket, data));
  socket.on('create-world', (data, callback) => handleCreateWorld(socket, data, callback));
  socket.on('request-world-data', (data, callback) =>
    handleRequestWorldData(socket, data, callback)
  );
  socket.on('request-region', (data, callback) => handleRequestRegion(socket, data, callback));

  // Game State
  socket.on('request-game-state', (data) => handleGameStateRequest(socket, data));

  // Settlement Actions
  socket.on('build-structure', (data, callback) => handleBuildStructure(socket, data, callback));
  socket.on('collect-resources', (data, callback) =>
    handleCollectResources(socket, data, callback)
  );

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
        playerId: data.playerId,
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
        error: 'Invalid authentication token',
      };

      if (callback) {
        callback(response);
      } else {
        socket.emit('error', {
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
          timestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    logger.error('[AUTH] Authentication error:', error);
    socket.emit('error', {
      code: 'AUTH_ERROR',
      message: 'Authentication error occurred',
      timestamp: Date.now(),
    });
  }
}

/**
 * Handle player joining a world
 */
async function handleJoinWorld(socket: Socket, data: JoinWorldData): Promise<void> {
  try {
    logger.info(`[WORLD] Player ${data.playerId} joining world ${data.worldId}`, {
      socketId: socket.id,
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
      timestamp: Date.now(),
    });

    // Notify others in the world
    socket.to(`world:${data.worldId}`).emit('player-joined', {
      playerId: data.playerId,
      timestamp: Date.now(),
    });

    logger.info(`[WORLD] Player ${data.playerId} joined world ${data.worldId}`, {
      socketId: socket.id,
    });
  } catch (error) {
    logger.error('[WORLD] Error joining world:', error);
    socket.emit('error', {
      code: 'JOIN_WORLD_ERROR',
      message: 'Failed to join world',
      timestamp: Date.now(),
    });
  }
}

/**
 * Handle player leaving a world
 */
async function handleLeaveWorld(socket: Socket, data: LeaveWorldData): Promise<void> {
  try {
    logger.info(`[WORLD] Player ${data.playerId} leaving world ${data.worldId}`, {
      socketId: socket.id,
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
      timestamp: Date.now(),
    });

    // Clear world ID from socket data
    socket.data.worldId = undefined;

    logger.info(`[WORLD] Player ${data.playerId} left world ${data.worldId}`, {
      socketId: socket.id,
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
      playerId: socket.data.playerId,
    });

    // Verify player is authenticated
    if (!socket.data.playerId) {
      socket.emit('error', {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        timestamp: Date.now(),
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
        playerId: socket.data.playerId,
      },
      timestamp: Date.now(),
    });

    logger.info('[STATE] Game state sent successfully', {
      playerId: socket.data.playerId,
      settlementCount: settlements.length,
    });
  } catch (error) {
    logger.error('[STATE] Error fetching game state:', error);
    socket.emit('error', {
      code: 'STATE_ERROR',
      message: 'Failed to fetch game state',
      timestamp: Date.now(),
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
    logger.info(
      `[ACTION] Building structure: ${data.structureType} in settlement ${data.settlementId}`,
      {
        socketId: socket.id,
        playerId: socket.data.playerId,
      }
    );

    // Verify player is authenticated
    if (!socket.data.playerId) {
      const errorResponse = {
        success: false,
        error: 'Authentication required',
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    // Get settlement with storage
    const settlementData = await getSettlementWithDetails(data.settlementId);

    if (!settlementData?.settlement) {
      const errorResponse = {
        success: false,
        error: 'Settlement not found',
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    // Verify ownership
    if (settlementData.settlement.playerProfileId !== socket.data.playerId) {
      const errorResponse = {
        success: false,
        error: 'You do not own this settlement',
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    const storage = settlementData.storage;
    if (!storage) {
      const errorResponse = {
        success: false,
        error: 'Settlement storage not found',
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    // Define structure types and their costs
    // In a real implementation, this would come from a configuration file or database
    const structureTypes: Record<
      string,
      {
        name: string;
        description: string;
        cost: { food: number; water: number; wood: number; stone: number; ore: number };
        requirements: { area: number; solar: number; wind: number };
        modifiers?: Array<{ name: string; description: string; value: number }>;
      }
    > = {
      house: {
        name: 'House',
        description: 'A basic dwelling for settlers',
        cost: { food: 0, water: 0, wood: 50, stone: 20, ore: 0 },
        requirements: { area: 1, solar: 0, wind: 0 },
        modifiers: [
          { name: 'population_capacity', description: 'Increases population capacity', value: 5 },
        ],
      },
      farm: {
        name: 'Farm',
        description: 'Produces food over time',
        cost: { food: 0, water: 10, wood: 30, stone: 10, ore: 0 },
        requirements: { area: 2, solar: 1, wind: 0 },
        modifiers: [
          { name: 'food_production', description: 'Increases food production', value: 10 },
        ],
      },
      well: {
        name: 'Well',
        description: 'Provides access to water',
        cost: { food: 0, water: 0, wood: 20, stone: 40, ore: 5 },
        requirements: { area: 1, solar: 0, wind: 0 },
        modifiers: [
          { name: 'water_production', description: 'Increases water production', value: 15 },
        ],
      },
      lumbermill: {
        name: 'Lumber Mill',
        description: 'Processes wood more efficiently',
        cost: { food: 0, water: 5, wood: 40, stone: 30, ore: 10 },
        requirements: { area: 2, solar: 0, wind: 1 },
        modifiers: [
          { name: 'wood_production', description: 'Increases wood production', value: 12 },
        ],
      },
      quarry: {
        name: 'Quarry',
        description: 'Extracts stone from the ground',
        cost: { food: 0, water: 10, wood: 30, stone: 20, ore: 15 },
        requirements: { area: 3, solar: 0, wind: 0 },
        modifiers: [
          { name: 'stone_production', description: 'Increases stone production', value: 8 },
        ],
      },
      mine: {
        name: 'Mine',
        description: 'Extracts ore from deep underground',
        cost: { food: 0, water: 15, wood: 50, stone: 60, ore: 20 },
        requirements: { area: 3, solar: 0, wind: 0 },
        modifiers: [{ name: 'ore_production', description: 'Increases ore production', value: 5 }],
      },
    };

    const structureConfig = structureTypes[data.structureType.toLowerCase()];
    if (!structureConfig) {
      const errorResponse = {
        success: false,
        error: `Unknown structure type: ${data.structureType}`,
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    // Check if player has enough resources
    const currentResources = {
      food: storage.food,
      water: storage.water,
      wood: storage.wood,
      stone: storage.stone,
      ore: storage.ore,
    };

    const hasResources = hasEnoughResources(currentResources, structureConfig.cost);
    if (!hasResources) {
      const errorResponse = {
        success: false,
        error: 'Insufficient resources to build structure',
        required: structureConfig.cost,
        current: currentResources,
        timestamp: Date.now(),
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
        ore: structureConfig.cost.ore,
      },
      structureConfig.modifiers
    );

    const response = {
      success: true,
      settlementId: data.settlementId,
      structure: structureResult.structure,
      remainingResources: newResources,
      timestamp: Date.now(),
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
        timestamp: Date.now(),
      });
    }

    logger.info('[ACTION] Structure built successfully', {
      settlementId: data.settlementId,
      structureId: structureResult.structure.id,
      structureType: data.structureType,
      playerId: socket.data.playerId,
    });
  } catch (error) {
    logger.error('[ACTION] Error building structure:', error);
    const errorResponse = {
      success: false,
      error: 'Failed to build structure',
      timestamp: Date.now(),
    };

    if (callback) {
      callback(errorResponse);
    } else {
      socket.emit('error', {
        code: 'BUILD_ERROR',
        message: 'Failed to build structure',
        timestamp: Date.now(),
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
      playerId: socket.data.playerId,
    });

    // Verify player is authenticated
    if (!socket.data.playerId) {
      const errorResponse = {
        success: false,
        error: 'Authentication required',
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    // Fetch settlement with details from database
    const settlementData = await getSettlementWithDetails(data.settlementId);

    if (!settlementData?.settlement) {
      const errorResponse = {
        success: false,
        error: 'Settlement not found',
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    // Verify player owns this settlement
    if (settlementData.settlement.playerProfileId !== socket.data.playerId) {
      const errorResponse = {
        success: false,
        error: 'You do not own this settlement',
        timestamp: Date.now(),
      };
      logger.warn(
        '[ACTION] Player attempted to collect resources from settlement they do not own',
        {
          playerId: socket.data.playerId,
          settlementId: data.settlementId,
          ownerId: settlementData.settlement.playerProfileId,
        }
      );
      return callback ? callback(errorResponse) : undefined;
    }

    // Get current storage
    const storage = settlementData.storage;
    const plot = settlementData.plot;

    if (!storage) {
      const errorResponse = {
        success: false,
        error: 'Settlement storage not found',
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    if (!plot) {
      const errorResponse = {
        success: false,
        error: 'Settlement plot not found',
        timestamp: Date.now(),
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
        ore: storage.ore,
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
      timestamp: Date.now(),
    };

    if (callback) {
      callback(response);
    } else {
      socket.emit('resources-collected', response);
    }

    logger.info('[ACTION] Resources collected successfully', {
      settlementId: data.settlementId,
      playerId: socket.data.playerId,
    });
  } catch (error) {
    logger.error('[ACTION] Error collecting resources:', error);
    const errorResponse = {
      success: false,
      error: 'Failed to collect resources',
      timestamp: Date.now(),
    };

    if (callback) {
      callback(errorResponse);
    } else {
      socket.emit('error', {
        code: 'COLLECT_ERROR',
        message: 'Failed to collect resources',
        timestamp: Date.now(),
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
    worldId: socket.data.worldId,
  });

  // Unregister player's settlements from game loop
  if (socket.data.playerId) {
    await unregisterPlayerSettlements(socket.data.playerId);
  }

  // Notify others in the world if player was in one
  if (socket.data.worldId && socket.data.playerId) {
    socket.to(`world:${socket.data.worldId}`).emit('player-left', {
      playerId: socket.data.playerId,
      timestamp: Date.now(),
    });
  }
}

/**
 * Handle socket errors
 */
function handleError(socket: Socket, error: Error): void {
  logger.error(`[ERROR] Socket error for ${socket.id}:`, error, {
    playerId: socket.data.playerId,
    worldId: socket.data.worldId,
  });
}

/**
 * Handle world creation request
 */
async function handleCreateWorld(
  socket: Socket,
  data: CreateWorldData,
  callback?: (response: CreateWorldResponse) => void
): Promise<void> {
  const startTime = Date.now();

  logger.info(`[CREATE WORLD] Request from ${socket.id}:`, {
    worldName: data.worldName,
    serverId: data.serverId,
    seed: data.seed,
    width: data.width,
    height: data.height,
  });

  try {
    // Validate input
    if (!data.worldName?.trim()) {
      const response: CreateWorldResponse = {
        success: false,
        error: 'World name is required',
        timestamp: Date.now(),
      };
      callback?.(response);
      return;
    }

    // Create world with provided or default settings
    const result = await createWorld({
      worldName: data.worldName.trim(),
      serverId: data.serverId ?? null,
      seed: data.seed ?? Math.floor(Math.random() * 1000000),
      width: data.width ?? 100,
      height: data.height ?? 100,
      // Default noise options for natural-looking terrain
      elevationOptions: {
        amplitude: 1,
        persistence: 0.5,
        frequency: 1,
        octaves: 4,
        scale: (x: number) => x / 50,
      },
      precipitationOptions: {
        amplitude: 1,
        persistence: 0.5,
        frequency: 1,
        octaves: 3,
        scale: (x: number) => x / 60,
      },
      temperatureOptions: {
        amplitude: 1,
        persistence: 0.4,
        frequency: 1,
        octaves: 3,
        scale: (x: number) => x / 80,
      },
    });

    const response: CreateWorldResponse = {
      success: true,
      worldId: result.worldId,
      worldName: data.worldName,
      stats: {
        regionCount: result.regionCount,
        tileCount: result.tileCount,
        plotCount: result.plotCount,
        duration: Date.now() - startTime,
      },
      timestamp: Date.now(),
    };

    logger.info(`[CREATE WORLD] World created successfully:`, {
      worldId: result.worldId,
      worldName: data.worldName,
      stats: response.stats,
    });

    callback?.(response);
  } catch (error) {
    logger.error('[CREATE WORLD] Failed to create world:', error, {
      worldName: data.worldName,
      error: error instanceof Error ? error.message : String(error),
    });

    const response: CreateWorldResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create world',
      timestamp: Date.now(),
    };

    callback?.(response);
  }
}

/**
 * Handle world data request
 */
async function handleRequestWorldData(
  socket: Socket,
  data: RequestWorldDataData,
  callback?: (response: WorldDataResponse) => void
): Promise<void> {
  logger.info(`[REQUEST WORLD DATA] Request from ${socket.id}:`, {
    worldId: data.worldId,
    includeRegions: data.includeRegions,
  });

  try {
    // Validate input
    if (!data.worldId?.trim()) {
      const response: WorldDataResponse = {
        success: false,
        error: 'World ID is required',
        timestamp: Date.now(),
      };
      callback?.(response);
      return;
    }

    // Import db and worlds here to avoid circular dependencies
    const { db, worlds, regions } = await import('../db/index.js');
    const { eq } = await import('drizzle-orm');

    // Get world info
    const world = await db.query.worlds.findFirst({
      where: eq(worlds.id, data.worldId),
    });

    if (!world) {
      logger.warn(`[REQUEST WORLD DATA] World not found: ${data.worldId}`);
      const response: WorldDataResponse = {
        success: false,
        error: 'World not found',
        timestamp: Date.now(),
      };
      callback?.(response);
      return;
    }

    // Optionally include region data
    let regionData: WorldDataResponse['regions'] = undefined;
    if (data.includeRegions) {
      const dbRegions = await db.query.regions.findMany({
        where: eq(regions.worldId, data.worldId),
      });

      regionData = dbRegions.map((r) => ({
        id: r.id,
        worldId: r.worldId,
        name: r.name,
        xCoord: r.xCoord,
        yCoord: r.yCoord,
        elevationMap: r.elevationMap,
        precipitationMap: r.precipitationMap,
        temperatureMap: r.temperatureMap,
      }));

      logger.info(`[REQUEST WORLD DATA] Loaded ${regionData.length} regions`);
    }

    const response: WorldDataResponse = {
      success: true,
      world: {
        id: world.id,
        name: world.name,
        serverId: world.serverId,
        elevationSettings: world.elevationSettings,
        precipitationSettings: world.precipitationSettings,
        temperatureSettings: world.temperatureSettings,
        createdAt: world.createdAt,
        updatedAt: world.updatedAt,
      },
      regions: regionData,
      timestamp: Date.now(),
    };

    logger.info(`[REQUEST WORLD DATA] Successfully loaded world: ${world.name}`);
    callback?.(response);
  } catch (error) {
    logger.error('[REQUEST WORLD DATA] Error:', error);

    const response: WorldDataResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load world data',
      timestamp: Date.now(),
    };

    callback?.(response);
  }
}

/**
 * Handle region data request with optional tiles and plots
 */
async function handleRequestRegion(
  socket: Socket,
  data: RequestRegionData,
  callback?: (response: RegionDataResponse) => void
): Promise<void> {
  logger.info(`[REQUEST REGION] Request from ${socket.id}:`, {
    regionId: data.regionId,
    includeTiles: data.includeTiles,
  });

  try {
    // Validate input
    if (!data.regionId?.trim()) {
      const response: RegionDataResponse = {
        success: false,
        error: 'Region ID is required',
        timestamp: Date.now(),
      };
      callback?.(response);
      return;
    }

    // Import db and regions here to avoid circular dependencies
    const { db, regions } = await import('../db/index.js');
    const { eq } = await import('drizzle-orm');

    // Get region with optional tiles
    const region = await db.query.regions.findFirst({
      where: eq(regions.id, data.regionId),
      with: data.includeTiles
        ? {
            tiles: {
              with: {
                plots: true,
              },
            },
          }
        : undefined,
    });

    if (!region) {
      logger.warn(`[REQUEST REGION] Region not found: ${data.regionId}`);
      const response: RegionDataResponse = {
        success: false,
        error: 'Region not found',
        timestamp: Date.now(),
      };
      callback?.(response);
      return;
    }

    // Build response with proper types
    const responseData: RegionDataResponse = {
      success: true,
      region: {
        id: region.id,
        worldId: region.worldId,
        name: region.name,
        xCoord: region.xCoord,
        yCoord: region.yCoord,
        elevationMap: region.elevationMap,
        precipitationMap: region.precipitationMap,
        temperatureMap: region.temperatureMap,
        tiles:
          data.includeTiles && 'tiles' in region && Array.isArray(region.tiles)
            ? region.tiles.map((t: any) => ({
                id: t.id,
                biomeId: t.biomeId,
                regionId: t.regionId,
                elevation: t.elevation,
                temperature: t.temperature,
                precipitation: t.precipitation,
                type: t.type,
                plots:
                  'plots' in t && Array.isArray(t.plots)
                    ? t.plots.map((p: any) => ({
                        id: p.id,
                        tileId: p.tileId,
                        area: p.area,
                        solar: p.solar,
                        wind: p.wind,
                        food: p.food,
                        water: p.water,
                        wood: p.wood,
                        stone: p.stone,
                        ore: p.ore,
                      }))
                    : undefined,
              }))
            : undefined,
      },
      timestamp: Date.now(),
    };

    logger.info(`[REQUEST REGION] Successfully loaded region: ${region.name}`, {
      tileCount: responseData.region?.tiles?.length || 0,
    });

    callback?.(responseData);
  } catch (error) {
    logger.error('[REQUEST REGION] Error:', error);

    const response: RegionDataResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load region data',
      timestamp: Date.now(),
    };

    callback?.(response);
  }
}

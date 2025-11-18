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
} from '../types/socket-events.js';
import { logger } from '../utils/logger.js';
import {
  getSettlementWithDetails,
  updateSettlementStorage,
  getPlayerSettlements,
  createStructure,
  getSettlementStructures,
} from '../db/queries.js';
import { getStructureCostByName, isValidStructure } from '../data/structure-costs.js';
import { getStructureRequirements } from '../data/structure-requirements.js';
import { getStructureModifiers } from '../data/structure-modifiers.js';
import {
  calculateTimedProduction,
  addResources,
  subtractResources,
  hasEnoughResources,
  type Resources,
} from '../game/resource-calculator.js';
import { registerPlayerSettlements, unregisterPlayerSettlements } from '../game/game-loop.js';
import { createWorld } from '../game/world-creator.js';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Validate structure type exists in our centralized config
    const normalizedStructureType = data.structureType.toUpperCase();
    if (!isValidStructure(normalizedStructureType)) {
      const errorResponse = {
        success: false,
        error: `Unknown structure type: ${data.structureType}`,
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    // Get structure configuration from centralized source (GDD-accurate costs)
    const structureConfig = getStructureCostByName(normalizedStructureType);
    if (!structureConfig) {
      const errorResponse = {
        success: false,
        error: `Structure configuration not found: ${data.structureType}`,
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

    // Convert optional costs to required Resources type with defaults
    const requiredResources: Resources = {
      food: structureConfig.costs.food ?? 0,
      water: structureConfig.costs.water ?? 0,
      wood: structureConfig.costs.wood ?? 0,
      stone: structureConfig.costs.stone ?? 0,
      ore: structureConfig.costs.ore ?? 0,
    };

    const hasResources = hasEnoughResources(currentResources, requiredResources);
    if (!hasResources) {
      const errorResponse = {
        success: false,
        error: 'Insufficient resources to build structure',
        required: requiredResources,
        current: currentResources,
        timestamp: Date.now(),
      };
      return callback ? callback(errorResponse) : undefined;
    }

    // Deduct resources
    const newResources = subtractResources(currentResources, requiredResources);
    await updateSettlementStorage(storage.id, newResources);

    // Get structure requirements and modifiers from separate configs
    const requirements = getStructureRequirements(structureConfig.name);
    const modifiers = getStructureModifiers(structureConfig.name);

    // Create the structure with all required data
    const structureResult = await createStructure(
      data.settlementId,
      structureConfig.name,
      structureConfig.description,
      {
        area: requirements.area,
        solar: requirements.solar,
        wind: requirements.wind,
        food: requiredResources.food,
        water: requiredResources.water,
        wood: requiredResources.wood,
        stone: requiredResources.stone,
        ore: requiredResources.ore,
      },
      modifiers
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Fetch settlement structures to get extractors
    const structureData = await getSettlementStructures(data.settlementId);

    // Filter for extractor structures
    const extractors = structureData
      .filter((s) => s.structureDef?.category === 'EXTRACTOR')
      .map((s) => ({
        ...s.structure,
        category: s.structureDef?.category || '',
        extractorType: s.structureDef?.extractorType || '',
      }));

    // Calculate production since last update
    // Using updatedAt as last collection time
    const lastCollectionTime = settlementData.settlement.updatedAt?.getTime() || Date.now();
    const biomeName = settlementData.biome?.name;
    const production = calculateTimedProduction(
      plot,
      extractors,
      lastCollectionTime,
      Date.now(),
      biomeName
    );

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
            ? region.tiles.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (t: any) => ({
                  id: t.id,
                  biomeId: t.biomeId,
                  regionId: t.regionId,
                  elevation: t.elevation,
                  temperature: t.temperature,
                  precipitation: t.precipitation,
                  type: t.type,
                  plots:
                    'plots' in t && Array.isArray(t.plots)
                      ? t.plots.map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (p: any) => ({
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
                          })
                        )
                      : undefined,
                })
              )
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

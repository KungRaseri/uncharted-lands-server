/**
 * Socket Event Type Definitions
 */

// Client -> Server Events
export interface ClientToServerEvents {
  authenticate: (data: AuthenticateData, callback?: (response: AuthResponse) => void) => void;
  'join-world': (data: JoinWorldData) => void;
  'leave-world': (data: LeaveWorldData) => void;
  'request-game-state': (data: GameStateRequest) => void;
  'build-structure': (
    data: BuildStructureData,
    callback?: (response: ActionResponse) => void
  ) => void;
  'collect-resources': (
    data: CollectResourcesData,
    callback?: (response: ResourceResponse) => void
  ) => void;
  'create-world': (
    data: CreateWorldData,
    callback?: (response: CreateWorldResponse) => void
  ) => void;
  'request-world-data': (
    data: RequestWorldDataData,
    callback?: (response: WorldDataResponse) => void
  ) => void;
  'request-region': (
    data: RequestRegionData,
    callback?: (response: RegionDataResponse) => void
  ) => void;
}

// Server -> Client Events
export interface ServerToClientEvents {
  connected: (data: ConnectedData) => void;
  authenticated: (data: AuthResponse) => void;
  'world-joined': (data: WorldJoinedData) => void;
  'game-state': (data: GameStateData) => void;
  'state-update': (data: StateUpdateData) => void;
  'structure-built': (data: StructureBuiltData) => void;
  'resources-collected': (data: ResourceResponse) => void;
  'resource-tick': (data: ResourceTickData) => void;
  'resource-update': (data: ResourceUpdateData) => void;
  'resource-waste': (data: ResourceWasteData) => void;
  'storage-warning': (data: StorageWarningData) => void;
  'resource-shortage': (data: ResourceShortageData) => void;
  'population-growth': (data: PopulationGrowthData) => void;
  'population-warning': (data: PopulationWarningData) => void;
  'settler-arrived': (data: SettlerArrivedData) => void;
  'population-state': (data: PopulationStateData) => void;
  'player-joined': (data: PlayerEventData) => void;
  'player-left': (data: PlayerEventData) => void;
  error: (data: ErrorData) => void;
}

// Inter-server Events (for future scaling)
export interface InterServerEvents {
  ping: () => void;
}

// Socket Data (attached to each socket)
export interface SocketData {
  playerId?: string;
  worldId?: string;
  authenticated: boolean;
  connectedAt: number;
}

// ============================================================================
// Event Data Types
// ============================================================================

// Authentication
export interface AuthenticateData {
  playerId: string;
  token?: string;
}

export interface AuthResponse {
  success: boolean;
  playerId?: string;
  error?: string;
}

// World Management
export interface JoinWorldData {
  worldId: string;
  playerId: string;
}

export interface LeaveWorldData {
  worldId: string;
  playerId: string;
}

export interface WorldJoinedData {
  worldId: string;
  timestamp: number;
}

// World Creation
export interface CreateWorldData {
  worldName: string;
  serverId?: string | null;
  seed?: number;
  width?: number;
  height?: number;
}

export interface CreateWorldResponse {
  success: boolean;
  worldId?: string;
  worldName?: string;
  stats?: {
    regionCount: number;
    tileCount: number;
    plotCount: number;
    duration: number;
  };
  error?: string;
  timestamp: number;
}

// Game State
export interface GameStateRequest {
  worldId: string;
}

export interface GameStateData {
  worldId: string;
  state: unknown; // Will be defined when implementing game state
  timestamp: number;
}

export interface StateUpdateData {
  worldId: string;
  update: unknown; // Partial state updates
  timestamp: number;
}

// Settlements & Structures
export interface BuildStructureData {
  settlementId: string;
  structureType: string;
  position?: { x: number; y: number };
}

export interface StructureBuiltData {
  success: boolean;
  settlementId: string;
  structureType: string;
  structure?: unknown;
  error?: string;
  timestamp: number;
}

export interface CollectResourcesData {
  settlementId: string;
}

export interface ResourceResponse {
  success: boolean;
  settlementId: string;
  resources: ResourceAmounts;
  error?: string;
  timestamp: number;
}

export interface ResourceTickData {
  settlementId: string;
  resources: ResourceAmounts;
  production: ResourceAmounts;
  consumption: ResourceAmounts;
  timestamp: number;
}

export interface ResourceAmounts {
  food: number;
  water: number;
  wood: number;
  stone: number;
  ore: number;
}

// Storage Capacity
export interface StorageCapacity {
  food: number;
  water: number;
  wood: number;
  stone: number;
  ore: number;
}

// Near Capacity Status
export interface NearCapacityStatus {
  food: boolean;
  water: boolean;
  wood: boolean;
  stone: boolean;
  ore: boolean;
}

// Resource Update (enhanced with consumption and population)
export interface ResourceUpdateData {
  type: 'auto-production' | 'manual-collect' | 'structure-built';
  settlementId: string;
  resources: ResourceAmounts;
  production: ResourceAmounts;
  consumption?: ResourceAmounts;
  netProduction?: ResourceAmounts;
  population?: number;
  timestamp: number;
}

// Resource Waste (overflow beyond capacity)
export interface ResourceWasteData {
  settlementId: string;
  waste: ResourceAmounts;
  capacity: StorageCapacity;
  timestamp: number;
}

// Storage Warning (near capacity)
export interface StorageWarningData {
  settlementId: string;
  nearCapacity: NearCapacityStatus;
  resources: ResourceAmounts;
  capacity: StorageCapacity;
  timestamp: number;
}

// Resource Shortage (insufficient for population)
export interface ResourceShortageData {
  settlementId: string;
  population: number;
  resources: ResourceAmounts;
  timestamp: number;
}

// Population Growth
export interface PopulationGrowthData {
  settlementId: string;
  oldPopulation: number;
  newPopulation: number;
  happiness: number;
  growthRate: number;
  timestamp: number;
}

export interface PopulationWarningData {
  settlementId: string;
  population: number;
  happiness: number;
  warning: 'low_happiness' | 'emigration_risk' | 'no_housing';
  message: string;
  timestamp: number;
}

export interface SettlerArrivedData {
  settlementId: string;
  population: number;
  immigrantCount: number;
  happiness: number;
  timestamp: number;
}

export interface PopulationStateData {
  settlementId: string;
  current: number;
  capacity: number;
  happiness: number;
  happinessDescription: string;
  growthRate: number;
  status: 'Growing' | 'Stable' | 'Declining';
  timestamp: number;
}

// Player Events
export interface PlayerEventData {
  playerId: string;
  timestamp: number;
}

// Connection
export interface ConnectedData {
  message: string;
  socketId: string;
  timestamp: number;
}

// Errors
export interface ErrorData {
  code: string;
  message: string;
  timestamp: number;
}

// Generic Action Response
export interface ActionResponse {
  success: boolean;
  error?: string;
  timestamp: number;
}

// World Data Loading
export interface RequestWorldDataData {
  worldId: string;
  includeRegions?: boolean;
}

export interface WorldDataResponse {
  success: boolean;
  world?: {
    id: string;
    name: string;
    serverId: string;
    elevationSettings: unknown;
    precipitationSettings: unknown;
    temperatureSettings: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
  regions?: Array<{
    id: string;
    worldId: string;
    name: string;
    xCoord: number;
    yCoord: number;
    elevationMap: unknown;
    precipitationMap: unknown;
    temperatureMap: unknown;
  }>;
  error?: string;
  timestamp: number;
}

export interface RequestRegionData {
  regionId: string;
  includeTiles?: boolean;
}

export interface RegionDataResponse {
  success: boolean;
  region?: {
    id: string;
    worldId: string;
    name: string;
    xCoord: number;
    yCoord: number;
    elevationMap: unknown;
    precipitationMap: unknown;
    temperatureMap: unknown;
    tiles?: Array<{
      id: string;
      biomeId: string;
      regionId: string;
      elevation: number;
      temperature: number;
      precipitation: number;
      type: 'OCEAN' | 'LAND';
      plots?: Array<{
        id: string;
        tileId: string;
        area: number;
        solar: number;
        wind: number;
        food: number;
        water: number;
        wood: number;
        stone: number;
        ore: number;
      }>;
    }>;
  };
  error?: string;
  timestamp: number;
}

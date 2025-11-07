/**
 * Socket Event Type Definitions
 */

// Client -> Server Events
export interface ClientToServerEvents {
	authenticate: (data: AuthenticateData, callback?: (response: AuthResponse) => void) => void;
	'join-world': (data: JoinWorldData) => void;
	'leave-world': (data: LeaveWorldData) => void;
	'request-game-state': (data: GameStateRequest) => void;
	'build-structure': (data: BuildStructureData, callback?: (response: ActionResponse) => void) => void;
	'collect-resources': (data: CollectResourcesData, callback?: (response: ResourceResponse) => void) => void;
	'create-world': (data: CreateWorldData, callback?: (response: CreateWorldResponse) => void) => void;
	'request-world-data': (data: RequestWorldDataData, callback?: (response: WorldDataResponse) => void) => void;
	'request-region': (data: RequestRegionData, callback?: (response: RegionDataResponse) => void) => void;
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

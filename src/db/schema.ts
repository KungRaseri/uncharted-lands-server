import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  json,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// ===========================
// TYPES
// ===========================

export interface WorldTemplateConfig {
  magicLevel?: 'NONE' | 'LOW' | 'HIGH';
  difficulty?: 'CASUAL' | 'NORMAL' | 'HARDCORE' | 'EXTREME';
  resourceAbundance?: 'SCARCE' | 'NORMAL' | 'ABUNDANT';
  depletionEnabled?: boolean;
  depletionRate?: number;
  disasterFrequency?: 'RARE' | 'NORMAL' | 'FREQUENT';
  disasterSeverity?: 'MILD' | 'NORMAL' | 'CATASTROPHIC';
  specialResourcesEnabled?: boolean;
  npcSettlementsEnabled?: boolean;
  productionMultiplier?: number;
  consumptionMultiplier?: number;
  populationGrowthRate?: number;
}

// ===========================
// ENUMS
// ===========================

export const accountRoleEnum = pgEnum('AccountRole', ['MEMBER', 'SUPPORT', 'ADMINISTRATOR']);
export const serverStatusEnum = pgEnum('ServerStatus', ['OFFLINE', 'MAINTENANCE', 'ONLINE']);
export const tileTypeEnum = pgEnum('TileType', ['OCEAN', 'LAND']);
export const specialResourceEnum = pgEnum('SpecialResource', [
  'GEMS',
  'EXOTIC_WOOD',
  'MAGICAL_HERBS',
  'ANCIENT_STONE',
]);
export const resourceTypeEnum = pgEnum('ResourceType', [
  'FOOD',
  'WOOD',
  'STONE',
  'ORE',
  'CLAY',
  'HERBS',
  'PELTS',
  'GEMS',
  'EXOTIC_WOOD',
]);
export const structureCategoryEnum = pgEnum('StructureCategory', ['EXTRACTOR', 'BUILDING']);
export const extractorTypeEnum = pgEnum('ExtractorType', [
  'FARM',
  'WELL',
  'LUMBER_MILL',
  'QUARRY',
  'MINE',
  'FISHING_DOCK',
  'HUNTERS_LODGE',
  'HERB_GARDEN',
]);
export const buildingTypeEnum = pgEnum('BuildingType', [
  'HOUSE',
  'STORAGE',
  'BARRACKS',
  'WORKSHOP',
  'MARKETPLACE',
  'TOWN_HALL',
  'WALL',
]);

// ===========================
// TABLES
// ===========================

// Master structure definitions table
export const structures = pgTable('Structure', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: structureCategoryEnum('category').notNull(),
  extractorType: extractorTypeEnum('extractorType'),
  buildingType: buildingTypeEnum('buildingType'),
  maxLevel: integer('maxLevel').notNull().default(10),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

// Master resource definitions table
export const resources = pgTable('Resource', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // 'BASE', 'SPECIAL'
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const accounts = pgTable('Account', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  userAuthToken: text('userAuthToken').notNull().unique(),
  role: accountRoleEnum('role').default('MEMBER').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const profiles = pgTable('Profile', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  picture: text('picture').notNull(),
  accountId: text('accountId')
    .notNull()
    .unique()
    .references(() => accounts.id, { onDelete: 'cascade' }),
});

export const servers = pgTable(
  'Server',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    hostname: text('hostname').notNull().default('localhost'),
    port: integer('port').notNull().default(5000),
    status: serverStatusEnum('status').default('OFFLINE').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    hostnamePortIdx: uniqueIndex('Server_hostname_port_key').on(table.hostname, table.port),
  })
);

export const profileServerData = pgTable(
  'ProfileServerData',
  {
    profileId: text('profileId')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    serverId: text('serverId')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    profileIdIdx: uniqueIndex('ProfileServerData_profileId_key').on(table.profileId),
    serverIdIdx: uniqueIndex('ProfileServerData_serverId_key').on(table.serverId),
    profileServerIdx: uniqueIndex('ProfileServerData_profileId_serverId_key').on(
      table.profileId,
      table.serverId
    ),
  })
);

export const worlds = pgTable(
  'World',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    elevationSettings: json('elevationSettings').notNull(),
    precipitationSettings: json('precipitationSettings').notNull(),
    temperatureSettings: json('temperatureSettings').notNull(),
    status: text('status').notNull().default('generating'), // 'generating', 'ready', 'failed'
    worldTemplateType: text('worldTemplateType').notNull().default('STANDARD'),
    worldTemplateConfig: json('worldTemplateConfig').$type<WorldTemplateConfig>(),
    serverId: text('serverId')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    nameServerIdx: uniqueIndex('World_name_serverId_key').on(table.name, table.serverId),
  })
);

export const regions = pgTable(
  'Region',
  {
    id: text('id').primaryKey(),
    xCoord: integer('xCoord').notNull().default(-1),
    yCoord: integer('yCoord').notNull().default(-1),
    name: text('name').notNull(),
    elevationMap: json('elevationMap').notNull(),
    precipitationMap: json('precipitationMap').notNull(),
    temperatureMap: json('temperatureMap').notNull(),
    worldId: text('worldId')
      .notNull()
      .references(() => worlds.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    nameWorldIdx: uniqueIndex('Region_name_worldId_key').on(table.name, table.worldId),
    worldCoordsIdx: index('Region_worldId_xCoord_yCoord_idx').on(
      table.worldId,
      table.xCoord,
      table.yCoord
    ),
    coordsIdx: index('Region_xCoord_yCoord_idx').on(table.xCoord, table.yCoord),
  })
);

export const biomes = pgTable('Biome', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  precipitationMin: doublePrecision('precipitationMin').notNull(),
  precipitationMax: doublePrecision('precipitationMax').notNull(),
  temperatureMin: doublePrecision('temperatureMin').notNull(),
  temperatureMax: doublePrecision('temperatureMax').notNull(),
  plotsMin: integer('plotsMin').notNull().default(1),
  plotsMax: integer('plotsMax').notNull().default(10),
  plotAreaMin: integer('plotAreaMin').notNull().default(30),
  plotAreaMax: integer('plotAreaMax').notNull().default(50),
  solarModifier: integer('solarModifier').notNull().default(1),
  windModifier: integer('windModifier').notNull().default(1),
  foodModifier: integer('foodModifier').notNull().default(1),
  waterModifier: integer('waterModifier').notNull().default(1),
  woodModifier: integer('woodModifier').notNull().default(1),
  stoneModifier: integer('stoneModifier').notNull().default(1),
  oreModifier: integer('oreModifier').notNull().default(1),
});

// @ts-expect-error - Circular reference with settlements is expected and works at runtime
export const tiles = pgTable(
  'Tile',
  {
    id: text('id').primaryKey(),
    biomeId: text('biomeId')
      .notNull()
      .references(() => biomes.id),
    regionId: text('regionId')
      .notNull()
      .references(() => regions.id, { onDelete: 'cascade' }),
    xCoord: integer('xCoord').notNull().default(0),
    yCoord: integer('yCoord').notNull().default(0),
    elevation: doublePrecision('elevation').notNull(),
    temperature: doublePrecision('temperature').notNull(),
    precipitation: doublePrecision('precipitation').notNull(),
    type: tileTypeEnum('type').notNull(),
    // Resource quality (0-100)
    foodQuality: doublePrecision('foodQuality').notNull().default(50),
    woodQuality: doublePrecision('woodQuality').notNull().default(50),
    stoneQuality: doublePrecision('stoneQuality').notNull().default(50),
    oreQuality: doublePrecision('oreQuality').notNull().default(50),
    specialResource: specialResourceEnum('specialResource'),
    // Settlement ownership
    // @ts-expect-error - Circular reference
    settlementId: text('settlementId').references(() => settlements.id, { onDelete: 'set null' }),
    plotSlots: integer('plotSlots').notNull().default(5),
  },
  (table) => ({
    regionIdx: index('Tile_regionId_idx').on(table.regionId),
    biomeIdx: index('Tile_biomeId_idx').on(table.biomeId),
    typeIdx: index('Tile_type_idx').on(table.type),
    coordIdx: index('Tile_coords_idx').on(table.xCoord, table.yCoord),
    settlementIdx: index('Tile_settlementId_idx').on(table.settlementId),
  })
);

// @ts-expect-error - Circular reference with tiles and settlementStructures is expected and works at runtime
export const plots = pgTable(
  'Plot',
  {
    id: text('id').primaryKey(),
    tileId: text('tileId')
      .notNull()
      // @ts-expect-error - Circular reference
      .references(() => tiles.id, { onDelete: 'cascade' }),
    // Plot position on tile (0-15 for 4x4 grid, but actual slots determined by plotSlots)
    position: integer('position').notNull().default(0),
    // Resource extraction
    resourceType: resourceTypeEnum('resourceType'),
    baseProductionRate: doublePrecision('baseProductionRate').notNull().default(0),
    qualityMultiplier: doublePrecision('qualityMultiplier').notNull().default(1),
    // Accumulation tracking
    lastHarvested: timestamp('lastHarvested', { mode: 'date' }),
    accumulatedResources: doublePrecision('accumulatedResources').notNull().default(0),
    // Legacy modifiers (keep for now, may deprecate later)
    area: integer('area').notNull().default(30),
    solar: integer('solar').notNull().default(1),
    wind: integer('wind').notNull().default(1),
    food: integer('food').notNull().default(1),
    water: integer('water').notNull().default(1),
    wood: integer('wood').notNull().default(1),
    stone: integer('stone').notNull().default(1),
    ore: integer('ore').notNull().default(1),
    // @ts-expect-error - Circular reference with settlementStructures is expected and works at runtime
    structureId: text('structureId').references(() => settlementStructures.id, {
      onDelete: 'set null',
    }),
    settlementId: text('settlementId').references(() => settlements.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    tileIdx: index('Plot_tileId_idx').on(table.tileId),
    settlementIdx: index('Plot_settlementId_idx').on(table.settlementId),
  })
);

export const settlementStorage = pgTable(
  'SettlementStorage',
  {
    id: text('id').primaryKey(),
    settlementId: text('settlementId').references(() => settlements.id, { onDelete: 'cascade' }),
    food: integer('food').notNull(),
    water: integer('water').notNull(),
    wood: integer('wood').notNull(),
    stone: integer('stone').notNull(),
    ore: integer('ore').notNull(),
  },
  (table) => ({
    settlementIdx: index('SettlementStorage_settlementId_idx').on(table.settlementId),
  })
);

export const settlementPopulation = pgTable('SettlementPopulation', {
  id: text('id').primaryKey(),
  settlementId: text('settlementId')
    .notNull()
    .unique()
    .references(() => settlements.id, { onDelete: 'cascade' }),
  currentPopulation: integer('currentPopulation').notNull().default(10),
  happiness: integer('happiness').notNull().default(50),
  lastGrowthTick: timestamp('lastGrowthTick', { mode: 'date' }).defaultNow().notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

// @ts-expect-error - Circular reference with plots is expected and works at runtime
export const settlements = pgTable(
  'Settlement',
  {
    id: text('id').primaryKey(),
    plotId: text('plotId')
      .notNull()
      .unique()
      // @ts-expect-error - Circular reference
      .references(() => plots.id, { onDelete: 'cascade' }),
    playerProfileId: text('playerProfileId')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    settlementStorageId: text('settlementStorageId')
      .notNull()
      .unique()
      .references(() => settlementStorage.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Home Settlement'),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    playerProfileIdx: index('Settlement_playerProfileId_idx').on(table.playerProfileId),
    plotIdx: index('Settlement_plotId_idx').on(table.plotId),
  })
);

// Normalized structure costs table
export const structureRequirements = pgTable(
  'StructureRequirement',
  {
    id: text('id').primaryKey(),
    structureId: text('structureId')
      .notNull()
      .references(() => structures.id, { onDelete: 'cascade' }),
    resourceId: text('resourceId')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
  },
  (table) => ({
    structureIdx: index('StructureRequirement_structureId_idx').on(table.structureId),
    resourceIdx: index('StructureRequirement_resourceId_idx').on(table.resourceId),
  })
);

// Structure prerequisites table - Option B1 (two nullable columns with FK constraints)
export const structurePrerequisites = pgTable(
  'StructurePrerequisite',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    structureId: text('structureId')
      .notNull()
      .references(() => structures.id, { onDelete: 'cascade' }),
    // ONE of these per row (not both) - enforced by CHECK constraint
    requiredStructureId: text('requiredStructureId').references(() => structures.id, {
      onDelete: 'cascade',
    }),
    requiredResearchId: text('requiredResearchId'), // FK to research table when it exists
    requiredLevel: integer('requiredLevel').notNull().default(1),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    structureIdx: index('StructurePrerequisite_structureId_idx').on(table.structureId),
    requiredStructureIdx: index('StructurePrerequisite_requiredStructureId_idx').on(
      table.requiredStructureId
    ),
  })
);

// @ts-expect-error - Circular reference with plots is expected and works at runtime
export const settlementStructures = pgTable('SettlementStructure', {
  id: text('id').primaryKey(),
  structureId: text('structureId')
    .notNull()
    .references(() => structures.id, { onDelete: 'restrict' }),
  settlementId: text('settlementId')
    .notNull()
    .references(() => settlements.id, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1),
  // Plot linkage for extractors
  plotId: text('plotId')
    // @ts-expect-error - Circular reference with plots
    .references(() => plots.id, { onDelete: 'cascade' }),
  // Population assignment for structure staffing
  populationAssigned: integer('populationAssigned').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const structureModifiers = pgTable('StructureModifier', {
  id: text('id').primaryKey(),
  settlementStructureId: text('settlementStructureId')
    .notNull()
    .references(() => settlementStructures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  value: integer('value').notNull(),
});

// ===========================
// RELATIONS
// ===========================

export const structuresRelations = relations(structures, ({ many }) => ({
  requirements: many(structureRequirements),
  prerequisites: many(structurePrerequisites, { relationName: 'structurePrerequisites' }),
  requiredBy: many(structurePrerequisites, { relationName: 'requiredStructure' }),
  instances: many(settlementStructures),
}));

export const resourcesRelations = relations(resources, ({ many }) => ({
  requirements: many(structureRequirements),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  profile: one(profiles, {
    fields: [accounts.id],
    references: [profiles.accountId],
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  account: one(accounts, {
    fields: [profiles.accountId],
    references: [accounts.id],
  }),
  servers: many(profileServerData),
  settlements: many(settlements),
}));

export const profileServerDataRelations = relations(profileServerData, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [profileServerData.profileId],
    references: [profiles.id],
  }),
  server: one(servers, {
    fields: [profileServerData.serverId],
    references: [servers.id],
  }),
  settlements: many(settlements),
}));

export const serversRelations = relations(servers, ({ many }) => ({
  players: many(profileServerData),
  worlds: many(worlds),
}));

export const worldsRelations = relations(worlds, ({ one, many }) => ({
  server: one(servers, {
    fields: [worlds.serverId],
    references: [servers.id],
  }),
  regions: many(regions),
}));

export const regionsRelations = relations(regions, ({ one, many }) => ({
  world: one(worlds, {
    fields: [regions.worldId],
    references: [worlds.id],
  }),
  tiles: many(tiles),
}));

export const biomesRelations = relations(biomes, ({ many }) => ({
  tiles: many(tiles),
}));

export const tilesRelations = relations(tiles, ({ one, many }) => ({
  biome: one(biomes, {
    fields: [tiles.biomeId],
    references: [biomes.id],
  }),
  region: one(regions, {
    fields: [tiles.regionId],
    references: [regions.id],
  }),
  settlement: one(settlements, {
    fields: [tiles.settlementId],
    references: [settlements.id],
  }),
  plots: many(plots),
}));

export const plotsRelations = relations(plots, ({ one }) => ({
  tile: one(tiles, {
    fields: [plots.tileId],
    references: [tiles.id],
  }),
  settlement: one(settlements, {
    fields: [plots.settlementId],
    references: [settlements.id],
  }),
  structure: one(settlementStructures, {
    fields: [plots.structureId],
    references: [settlementStructures.id],
  }),
}));

export const settlementStorageRelations = relations(settlementStorage, ({ one }) => ({
  settlement: one(settlements, {
    fields: [settlementStorage.id],
    references: [settlements.settlementStorageId],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one, many }) => ({
  storage: one(settlementStorage, {
    fields: [settlements.settlementStorageId],
    references: [settlementStorage.id],
  }),
  plot: one(plots, {
    fields: [settlements.plotId],
    references: [plots.id],
  }),
  playerProfile: one(profiles, {
    fields: [settlements.playerProfileId],
    references: [profiles.id],
  }),
  structures: many(settlementStructures),
  tiles: many(tiles),
  plots: many(plots),
}));

export const structureRequirementsRelations = relations(structureRequirements, ({ one }) => ({
  structure: one(structures, {
    fields: [structureRequirements.structureId],
    references: [structures.id],
  }),
  resource: one(resources, {
    fields: [structureRequirements.resourceId],
    references: [resources.id],
  }),
}));

export const structurePrerequisitesRelations = relations(structurePrerequisites, ({ one }) => ({
  structure: one(structures, {
    fields: [structurePrerequisites.structureId],
    references: [structures.id],
    relationName: 'structurePrerequisites',
  }),
  requiredStructure: one(structures, {
    fields: [structurePrerequisites.requiredStructureId],
    references: [structures.id],
    relationName: 'requiredStructure',
  }),
}));

export const settlementStructuresRelations = relations(settlementStructures, ({ one, many }) => ({
  structure: one(structures, {
    fields: [settlementStructures.structureId],
    references: [structures.id],
  }),
  settlement: one(settlements, {
    fields: [settlementStructures.settlementId],
    references: [settlements.id],
  }),
  plot: one(plots, {
    fields: [settlementStructures.plotId],
    references: [plots.id],
  }),
  modifiers: many(structureModifiers),
}));

export const structureModifiersRelations = relations(structureModifiers, ({ one }) => ({
  settlementStructure: one(settlementStructures, {
    fields: [structureModifiers.settlementStructureId],
    references: [settlementStructures.id],
  }),
}));

// ===========================
// TYPE EXPORTS
// ===========================

export type Structure = typeof structures.$inferSelect;
export type NewStructure = typeof structures.$inferInsert;

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

export type StructureRequirement = typeof structureRequirements.$inferSelect;
export type NewStructureRequirement = typeof structureRequirements.$inferInsert;

export type StructurePrerequisite = typeof structurePrerequisites.$inferSelect;
export type NewStructurePrerequisite = typeof structurePrerequisites.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;

export type ProfileServerData = typeof profileServerData.$inferSelect;
export type NewProfileServerData = typeof profileServerData.$inferInsert;

export type World = typeof worlds.$inferSelect;
export type NewWorld = typeof worlds.$inferInsert;

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;

export type Biome = typeof biomes.$inferSelect;
export type NewBiome = typeof biomes.$inferInsert;

export type Tile = typeof tiles.$inferSelect;
export type NewTile = typeof tiles.$inferInsert;

export type Plot = typeof plots.$inferSelect;
export type NewPlot = typeof plots.$inferInsert;

export type SettlementStorage = typeof settlementStorage.$inferSelect;
export type NewSettlementStorage = typeof settlementStorage.$inferInsert;

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;

export type SettlementStructure = typeof settlementStructures.$inferSelect;
export type NewSettlementStructure = typeof settlementStructures.$inferInsert;

export type StructureModifier = typeof structureModifiers.$inferSelect;
export type NewStructureModifier = typeof structureModifiers.$inferInsert;

-- Migration: Add resource quality and plot/structure system
-- Date: 2025-11-10

-- Add resource quality fields to Tile table
ALTER TABLE "Tile" 
ADD COLUMN "foodQuality" double precision DEFAULT 50 NOT NULL,
ADD COLUMN "woodQuality" double precision DEFAULT 50 NOT NULL,
ADD COLUMN "stoneQuality" double precision DEFAULT 50 NOT NULL,
ADD COLUMN "oreQuality" double precision DEFAULT 50 NOT NULL,
ADD COLUMN "specialResource" text;

-- Create enum for special resources
DO $$ BEGIN
  CREATE TYPE "SpecialResource" AS ENUM (
    'GEMS',
    'EXOTIC_WOOD',
    'MAGICAL_HERBS',
    'ANCIENT_STONE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update specialResource column to use enum
ALTER TABLE "Tile" ALTER COLUMN "specialResource" TYPE "SpecialResource" USING "specialResource"::"SpecialResource";

-- Add tile ownership for settlements
ALTER TABLE "Tile"
ADD COLUMN "settlementId" text,
ADD COLUMN "plotSlots" integer DEFAULT 5 NOT NULL;

-- Add foreign key for settlement ownership
ALTER TABLE "Tile" 
ADD CONSTRAINT "Tile_settlementId_fkey" 
FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL;

-- Update Plot table for new resource system
ALTER TABLE "Plot"
ADD COLUMN "position" integer NOT NULL DEFAULT 0,
ADD COLUMN "structureId" text,
ADD COLUMN "resourceType" text,
ADD COLUMN "baseProductionRate" double precision DEFAULT 0 NOT NULL,
ADD COLUMN "qualityMultiplier" double precision DEFAULT 1.0 NOT NULL,
ADD COLUMN "lastHarvested" timestamp with time zone,
ADD COLUMN "accumulatedResources" double precision DEFAULT 0 NOT NULL,
ADD COLUMN "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
ADD COLUMN "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
ADD COLUMN "settlementId" text;

-- Create enum for resource types
DO $$ BEGIN
  CREATE TYPE "ResourceType" AS ENUM (
    'FOOD',
    'WOOD',
    'STONE',
    'ORE',
    'CLAY',
    'HERBS',
    'PELTS',
    'GEMS',
    'EXOTIC_WOOD'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update resourceType column to use enum
ALTER TABLE "Plot" ALTER COLUMN "resourceType" TYPE "ResourceType" USING "resourceType"::"ResourceType";

-- Add foreign key for settlement on plots
ALTER TABLE "Plot"
ADD CONSTRAINT "Plot_settlementId_fkey"
FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE;

-- Create enum for structure categories
DO $$ BEGIN
  CREATE TYPE "StructureCategory" AS ENUM (
    'EXTRACTOR',
    'BUILDING'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for extractor types
DO $$ BEGIN
  CREATE TYPE "ExtractorType" AS ENUM (
    'FARM',
    'LUMBER_MILL',
    'QUARRY',
    'MINE',
    'FISHING_DOCK',
    'HUNTERS_LODGE',
    'HERB_GARDEN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for building types
DO $$ BEGIN
  CREATE TYPE "BuildingType" AS ENUM (
    'HOUSE',
    'STORAGE',
    'BARRACKS',
    'WORKSHOP',
    'MARKETPLACE',
    'TOWN_HALL',
    'WALL'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update SettlementStructure table with new structure system
ALTER TABLE "SettlementStructure"
ADD COLUMN "category" "StructureCategory" NOT NULL DEFAULT 'BUILDING',
ADD COLUMN "plotId" text,
ADD COLUMN "extractorType" "ExtractorType",
ADD COLUMN "buildingType" "BuildingType",
ADD COLUMN "level" integer DEFAULT 1 NOT NULL;

-- Add foreign key for plot
ALTER TABLE "SettlementStructure"
ADD CONSTRAINT "SettlementStructure_plotId_fkey"
FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE;

-- Add foreign key from Plot to SettlementStructure
ALTER TABLE "Plot"
ADD CONSTRAINT "Plot_structureId_fkey"
FOREIGN KEY ("structureId") REFERENCES "SettlementStructure"("id") ON DELETE SET NULL;

-- Create index for tile settlement lookup
CREATE INDEX IF NOT EXISTS "Tile_settlementId_idx" ON "Tile"("settlementId");

-- Create index for plot settlement lookup
CREATE INDEX IF NOT EXISTS "Plot_settlementId_idx" ON "Plot"("settlementId");

-- Create index for structure plot lookup
CREATE INDEX IF NOT EXISTS "SettlementStructure_plotId_idx" ON "SettlementStructure"("plotId");

-- Update existing biomes to have foodQuality, woodQuality, etc. based on their modifiers
-- This sets reasonable defaults based on the existing modifier system
UPDATE "Tile" t
SET 
  "foodQuality" = LEAST(100, GREATEST(0, (
    SELECT (b."foodModifier" * 10) 
    FROM "Biome" b 
    WHERE b.id = t."biomeId"
  ))),
  "woodQuality" = LEAST(100, GREATEST(0, (
    SELECT (b."woodModifier" * 10)
    FROM "Biome" b 
    WHERE b.id = t."biomeId"
  ))),
  "stoneQuality" = LEAST(100, GREATEST(0, (
    SELECT (b."stoneModifier" * 10)
    FROM "Biome" b 
    WHERE b.id = t."biomeId"
  ))),
  "oreQuality" = LEAST(100, GREATEST(0, (
    SELECT (b."oreModifier" * 10)
    FROM "Biome" b 
    WHERE b.id = t."biomeId"
  )));

-- Set plotSlots based on biome (using existing plotsMin/plotsMax)
UPDATE "Tile" t
SET "plotSlots" = (
  SELECT FLOOR((b."plotsMin" + b."plotsMax") / 2)
  FROM "Biome" b
  WHERE b.id = t."biomeId"
)
WHERE "type" = 'LAND';

CREATE TYPE "public"."BuildingType" AS ENUM('HOUSE', 'STORAGE', 'BARRACKS', 'WORKSHOP', 'MARKETPLACE', 'TOWN_HALL', 'WALL');--> statement-breakpoint
CREATE TYPE "public"."ExtractorType" AS ENUM('FARM', 'LUMBER_MILL', 'QUARRY', 'MINE', 'FISHING_DOCK', 'HUNTERS_LODGE', 'HERB_GARDEN');--> statement-breakpoint
CREATE TYPE "public"."ResourceType" AS ENUM('FOOD', 'WOOD', 'STONE', 'ORE', 'CLAY', 'HERBS', 'PELTS', 'GEMS', 'EXOTIC_WOOD');--> statement-breakpoint
CREATE TYPE "public"."SpecialResource" AS ENUM('GEMS', 'EXOTIC_WOOD', 'MAGICAL_HERBS', 'ANCIENT_STONE');--> statement-breakpoint
CREATE TYPE "public"."StructureCategory" AS ENUM('EXTRACTOR', 'BUILDING');--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "resourceType" "ResourceType";--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "baseProductionRate" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "qualityMultiplier" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "lastHarvested" timestamp;--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "accumulatedResources" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "structureId" text;--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "settlementId" text;--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "Plot" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "category" "StructureCategory" DEFAULT 'BUILDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "extractorType" "ExtractorType";--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "buildingType" "BuildingType";--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "plotId" text;--> statement-breakpoint
ALTER TABLE "Tile" ADD COLUMN "foodQuality" double precision DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "Tile" ADD COLUMN "woodQuality" double precision DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "Tile" ADD COLUMN "stoneQuality" double precision DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "Tile" ADD COLUMN "oreQuality" double precision DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "Tile" ADD COLUMN "specialResource" "SpecialResource";--> statement-breakpoint
ALTER TABLE "Tile" ADD COLUMN "settlementId" text;--> statement-breakpoint
ALTER TABLE "Tile" ADD COLUMN "plotSlots" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_structureId_SettlementStructure_id_fk" FOREIGN KEY ("structureId") REFERENCES "public"."SettlementStructure"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_settlementId_Settlement_id_fk" FOREIGN KEY ("settlementId") REFERENCES "public"."Settlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD CONSTRAINT "SettlementStructure_plotId_Plot_id_fk" FOREIGN KEY ("plotId") REFERENCES "public"."Plot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Tile" ADD CONSTRAINT "Tile_settlementId_Settlement_id_fk" FOREIGN KEY ("settlementId") REFERENCES "public"."Settlement"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Plot_settlementId_idx" ON "Plot" USING btree ("settlementId");--> statement-breakpoint
CREATE INDEX "Tile_settlementId_idx" ON "Tile" USING btree ("settlementId");
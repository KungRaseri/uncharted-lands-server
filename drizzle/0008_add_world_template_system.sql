-- Phase 1D: World Template System
-- Adds world template configuration for different difficulty modes and gameplay styles
-- Templates: STANDARD (1.0x/1.0x), SURVIVAL (0.7x/1.3x), RELAXED (1.5x/0.7x), 
--            FANTASY (1.2x/0.9x), APOCALYPSE (0.5x/1.5x)

ALTER TABLE "World" 
  ADD COLUMN "worldTemplateType" text DEFAULT 'STANDARD' NOT NULL,
  ADD COLUMN "worldTemplateConfig" jsonb;

-- Add comment for clarity
COMMENT ON COLUMN "World"."worldTemplateType" IS 'Template type: STANDARD, SURVIVAL, RELAXED, FANTASY, or APOCALYPSE';
COMMENT ON COLUMN "World"."worldTemplateConfig" IS 'Full template configuration with multipliers and settings';

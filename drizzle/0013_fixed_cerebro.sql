ALTER TABLE "SettlementStructure" ADD COLUMN "health" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "damagedAt" timestamp;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "lastRepairedAt" timestamp;
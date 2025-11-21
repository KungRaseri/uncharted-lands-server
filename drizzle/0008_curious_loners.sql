ALTER TABLE "StructureRequirement" DROP CONSTRAINT "StructureRequirement_structureId_resourceId_pk";--> statement-breakpoint
ALTER TABLE "SettlementStorage" ADD COLUMN "settlementId" text;--> statement-breakpoint
ALTER TABLE "StructureRequirement" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "World" ADD COLUMN "worldTemplateType" text DEFAULT 'STANDARD' NOT NULL;--> statement-breakpoint
ALTER TABLE "World" ADD COLUMN "worldTemplateConfig" json;--> statement-breakpoint
ALTER TABLE "SettlementStorage" ADD CONSTRAINT "SettlementStorage_settlementId_Settlement_id_fk" FOREIGN KEY ("settlementId") REFERENCES "public"."Settlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "SettlementStorage_settlementId_idx" ON "SettlementStorage" USING btree ("settlementId");
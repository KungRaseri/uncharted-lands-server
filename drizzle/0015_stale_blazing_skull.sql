CREATE TABLE "ConstructionQueue" (
	"id" text PRIMARY KEY NOT NULL,
	"settlementId" text NOT NULL,
	"structureType" text NOT NULL,
	"startedAt" timestamp,
	"completesAt" timestamp,
	"resourcesCost" json NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"position" integer NOT NULL,
	"isEmergency" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Settlement" RENAME COLUMN "plotId" TO "tileId";--> statement-breakpoint
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_plotId_Plot_id_fk";
--> statement-breakpoint
DROP INDEX "Settlement_plotId_idx";--> statement-breakpoint
ALTER TABLE "ConstructionQueue" ADD CONSTRAINT "ConstructionQueue_settlementId_Settlement_id_fk" FOREIGN KEY ("settlementId") REFERENCES "public"."Settlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "construction_queue_settlement_idx" ON "ConstructionQueue" USING btree ("settlementId");--> statement-breakpoint
CREATE INDEX "construction_queue_status_idx" ON "ConstructionQueue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "construction_queue_active_idx" ON "ConstructionQueue" USING btree ("settlementId","status");--> statement-breakpoint
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_tileId_Tile_id_fk" FOREIGN KEY ("tileId") REFERENCES "public"."Tile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Settlement_tileId_idx" ON "Settlement" USING btree ("tileId");
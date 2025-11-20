CREATE TYPE "public"."DisasterSeverity" AS ENUM('MILD', 'MODERATE', 'MAJOR', 'CATASTROPHIC');--> statement-breakpoint
CREATE TYPE "public"."DisasterStatus" AS ENUM('SCHEDULED', 'WARNING', 'IMPACT', 'AFTERMATH', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."DisasterType" AS ENUM('DROUGHT', 'FLOOD', 'BLIZZARD', 'HURRICANE', 'TORNADO', 'SANDSTORM', 'HEATWAVE', 'EARTHQUAKE', 'VOLCANO', 'LANDSLIDE', 'AVALANCHE', 'WILDFIRE', 'INSECT_PLAGUE', 'BLIGHT', 'LOCUST_SWARM');--> statement-breakpoint
CREATE TABLE "DisasterEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"worldId" text NOT NULL,
	"type" "DisasterType" NOT NULL,
	"severity" integer NOT NULL,
	"severityLevel" "DisasterSeverity" NOT NULL,
	"affectedRegionId" text,
	"affectedBiomes" json,
	"scheduledAt" timestamp NOT NULL,
	"warningTime" integer DEFAULT 7200 NOT NULL,
	"impactDuration" integer DEFAULT 3600 NOT NULL,
	"status" "DisasterStatus" DEFAULT 'SCHEDULED' NOT NULL,
	"warningIssuedAt" timestamp,
	"impactStartedAt" timestamp,
	"impactEndedAt" timestamp,
	"imminentWarningIssued" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DisasterHistory" (
	"id" text PRIMARY KEY NOT NULL,
	"settlementId" text NOT NULL,
	"disasterId" text NOT NULL,
	"casualties" integer DEFAULT 0 NOT NULL,
	"structuresDamaged" integer DEFAULT 0 NOT NULL,
	"structuresDestroyed" integer DEFAULT 0 NOT NULL,
	"resourcesLost" json,
	"resilienceGained" integer DEFAULT 5 NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DisasterEvent" ADD CONSTRAINT "DisasterEvent_worldId_World_id_fk" FOREIGN KEY ("worldId") REFERENCES "public"."World"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DisasterEvent" ADD CONSTRAINT "DisasterEvent_affectedRegionId_Region_id_fk" FOREIGN KEY ("affectedRegionId") REFERENCES "public"."Region"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DisasterHistory" ADD CONSTRAINT "DisasterHistory_settlementId_Settlement_id_fk" FOREIGN KEY ("settlementId") REFERENCES "public"."Settlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DisasterHistory" ADD CONSTRAINT "DisasterHistory_disasterId_DisasterEvent_id_fk" FOREIGN KEY ("disasterId") REFERENCES "public"."DisasterEvent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disaster_world_idx" ON "DisasterEvent" USING btree ("worldId");--> statement-breakpoint
CREATE INDEX "disaster_status_idx" ON "DisasterEvent" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disaster_scheduled_idx" ON "DisasterEvent" USING btree ("scheduledAt");--> statement-breakpoint
CREATE INDEX "disaster_active_idx" ON "DisasterEvent" USING btree ("worldId","status");--> statement-breakpoint
CREATE INDEX "disaster_history_settlement_idx" ON "DisasterHistory" USING btree ("settlementId");--> statement-breakpoint
CREATE INDEX "disaster_history_disaster_idx" ON "DisasterHistory" USING btree ("disasterId");
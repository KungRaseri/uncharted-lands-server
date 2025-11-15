CREATE TABLE "SettlementPopulation" (
	"id" text PRIMARY KEY NOT NULL,
	"settlementId" text NOT NULL,
	"currentPopulation" integer DEFAULT 10 NOT NULL,
	"happiness" integer DEFAULT 50 NOT NULL,
	"lastGrowthTick" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "SettlementPopulation_settlementId_unique" UNIQUE("settlementId")
);
--> statement-breakpoint
ALTER TABLE "SettlementPopulation" ADD CONSTRAINT "SettlementPopulation_settlementId_Settlement_id_fk" FOREIGN KEY ("settlementId") REFERENCES "public"."Settlement"("id") ON DELETE cascade ON UPDATE no action;
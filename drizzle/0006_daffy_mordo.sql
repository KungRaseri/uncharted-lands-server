ALTER TYPE "public"."ExtractorType" ADD VALUE 'WELL' BEFORE 'LUMBER_MILL';--> statement-breakpoint
CREATE TABLE "Resource" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StructurePrerequisite" (
	"id" text PRIMARY KEY NOT NULL,
	"structureId" text NOT NULL,
	"requiredStructureId" text,
	"requiredResearchId" text,
	"requiredLevel" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Structure" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" "StructureCategory" NOT NULL,
	"extractorType" "ExtractorType",
	"buildingType" "BuildingType",
	"maxLevel" integer DEFAULT 10 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "StructureRequirements" RENAME TO "StructureRequirement";--> statement-breakpoint
ALTER TABLE "SettlementStructure" DROP CONSTRAINT "SettlementStructure_structureRequirementsId_unique";--> statement-breakpoint
ALTER TABLE "SettlementStructure" DROP CONSTRAINT "SettlementStructure_structureRequirementsId_StructureRequirements_id_fk";
--> statement-breakpoint
ALTER TABLE "StructureRequirement" ADD CONSTRAINT "StructureRequirement_structureId_resourceId_pk" PRIMARY KEY("structureId","resourceId");--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "structureId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "StructureRequirement" ADD COLUMN "structureId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "StructureRequirement" ADD COLUMN "resourceId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "StructureRequirement" ADD COLUMN "quantity" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "StructurePrerequisite" ADD CONSTRAINT "StructurePrerequisite_structureId_Structure_id_fk" FOREIGN KEY ("structureId") REFERENCES "public"."Structure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StructurePrerequisite" ADD CONSTRAINT "StructurePrerequisite_requiredStructureId_Structure_id_fk" FOREIGN KEY ("requiredStructureId") REFERENCES "public"."Structure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "StructurePrerequisite_structureId_idx" ON "StructurePrerequisite" USING btree ("structureId");--> statement-breakpoint
CREATE INDEX "StructurePrerequisite_requiredStructureId_idx" ON "StructurePrerequisite" USING btree ("requiredStructureId");--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD CONSTRAINT "SettlementStructure_structureId_Structure_id_fk" FOREIGN KEY ("structureId") REFERENCES "public"."Structure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StructureRequirement" ADD CONSTRAINT "StructureRequirement_structureId_Structure_id_fk" FOREIGN KEY ("structureId") REFERENCES "public"."Structure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StructureRequirement" ADD CONSTRAINT "StructureRequirement_resourceId_Resource_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."Resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "StructureRequirement_structureId_idx" ON "StructureRequirement" USING btree ("structureId");--> statement-breakpoint
CREATE INDEX "StructureRequirement_resourceId_idx" ON "StructureRequirement" USING btree ("resourceId");--> statement-breakpoint
ALTER TABLE "SettlementStructure" DROP COLUMN "structureRequirementsId";--> statement-breakpoint
ALTER TABLE "SettlementStructure" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "SettlementStructure" DROP COLUMN "extractorType";--> statement-breakpoint
ALTER TABLE "SettlementStructure" DROP COLUMN "buildingType";--> statement-breakpoint
ALTER TABLE "SettlementStructure" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "SettlementStructure" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "area";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "solar";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "wind";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "food";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "water";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "wood";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "stone";--> statement-breakpoint
ALTER TABLE "StructureRequirement" DROP COLUMN "ore";
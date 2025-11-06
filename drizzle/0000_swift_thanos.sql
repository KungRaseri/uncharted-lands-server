CREATE TYPE "public"."AccountRole" AS ENUM('MEMBER', 'SUPPORT', 'ADMINISTRATOR');--> statement-breakpoint
CREATE TYPE "public"."ServerStatus" AS ENUM('OFFLINE', 'MAINTENANCE', 'ONLINE');--> statement-breakpoint
CREATE TYPE "public"."TileType" AS ENUM('OCEAN', 'LAND');--> statement-breakpoint
CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"userAuthToken" text NOT NULL,
	"role" "AccountRole" DEFAULT 'MEMBER' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Account_email_unique" UNIQUE("email"),
	CONSTRAINT "Account_userAuthToken_unique" UNIQUE("userAuthToken")
);
--> statement-breakpoint
CREATE TABLE "Biome" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"precipitationMin" real NOT NULL,
	"precipitationMax" real NOT NULL,
	"temperatureMin" real NOT NULL,
	"temperatureMax" real NOT NULL,
	"plotsMin" integer DEFAULT 1 NOT NULL,
	"plotsMax" integer DEFAULT 10 NOT NULL,
	"plotAreaMin" integer DEFAULT 30 NOT NULL,
	"plotAreaMax" integer DEFAULT 50 NOT NULL,
	"solarModifier" integer DEFAULT 1 NOT NULL,
	"windModifier" integer DEFAULT 1 NOT NULL,
	"foodModifier" integer DEFAULT 1 NOT NULL,
	"waterModifier" integer DEFAULT 1 NOT NULL,
	"woodModifier" integer DEFAULT 1 NOT NULL,
	"stoneModifier" integer DEFAULT 1 NOT NULL,
	"oreModifier" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "Biome_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "Plot" (
	"id" text PRIMARY KEY NOT NULL,
	"tileId" text NOT NULL,
	"area" integer DEFAULT 30 NOT NULL,
	"solar" integer DEFAULT 1 NOT NULL,
	"wind" integer DEFAULT 1 NOT NULL,
	"food" integer DEFAULT 1 NOT NULL,
	"water" integer DEFAULT 1 NOT NULL,
	"wood" integer DEFAULT 1 NOT NULL,
	"stone" integer DEFAULT 1 NOT NULL,
	"ore" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ProfileServerData" (
	"profileId" text NOT NULL,
	"serverId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Profile" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"picture" text NOT NULL,
	"accountId" text NOT NULL,
	CONSTRAINT "Profile_username_unique" UNIQUE("username"),
	CONSTRAINT "Profile_accountId_unique" UNIQUE("accountId")
);
--> statement-breakpoint
CREATE TABLE "Region" (
	"id" text PRIMARY KEY NOT NULL,
	"xCoord" integer DEFAULT -1 NOT NULL,
	"yCoord" integer DEFAULT -1 NOT NULL,
	"name" text NOT NULL,
	"elevationMap" json NOT NULL,
	"precipitationMap" json NOT NULL,
	"temperatureMap" json NOT NULL,
	"worldId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Server" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hostname" text DEFAULT 'localhost' NOT NULL,
	"port" integer DEFAULT 5000 NOT NULL,
	"status" "ServerStatus" DEFAULT 'OFFLINE' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Server_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "SettlementStorage" (
	"id" text PRIMARY KEY NOT NULL,
	"food" integer NOT NULL,
	"water" integer NOT NULL,
	"wood" integer NOT NULL,
	"stone" integer NOT NULL,
	"ore" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SettlementStructure" (
	"id" text PRIMARY KEY NOT NULL,
	"structureRequirementsId" text NOT NULL,
	"settlementId" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "SettlementStructure_structureRequirementsId_unique" UNIQUE("structureRequirementsId")
);
--> statement-breakpoint
CREATE TABLE "Settlement" (
	"id" text PRIMARY KEY NOT NULL,
	"plotId" text NOT NULL,
	"playerProfileId" text NOT NULL,
	"settlementStorageId" text NOT NULL,
	"name" text DEFAULT 'Home Settlement' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Settlement_plotId_unique" UNIQUE("plotId"),
	CONSTRAINT "Settlement_settlementStorageId_unique" UNIQUE("settlementStorageId")
);
--> statement-breakpoint
CREATE TABLE "StructureModifier" (
	"id" text PRIMARY KEY NOT NULL,
	"settlementStructureId" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StructureRequirements" (
	"id" text PRIMARY KEY NOT NULL,
	"area" integer DEFAULT 1 NOT NULL,
	"solar" integer DEFAULT 1 NOT NULL,
	"wind" integer DEFAULT 1 NOT NULL,
	"food" integer DEFAULT 1 NOT NULL,
	"water" integer DEFAULT 1 NOT NULL,
	"wood" integer DEFAULT 1 NOT NULL,
	"stone" integer DEFAULT 1 NOT NULL,
	"ore" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Tile" (
	"id" text PRIMARY KEY NOT NULL,
	"biomeId" text NOT NULL,
	"regionId" text NOT NULL,
	"elevation" real NOT NULL,
	"temperature" real NOT NULL,
	"precipitation" real NOT NULL,
	"type" "TileType" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "World" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"elevationSettings" json NOT NULL,
	"precipitationSettings" json NOT NULL,
	"temperatureSettings" json NOT NULL,
	"serverId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_tileId_Tile_id_fk" FOREIGN KEY ("tileId") REFERENCES "public"."Tile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProfileServerData" ADD CONSTRAINT "ProfileServerData_profileId_Profile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProfileServerData" ADD CONSTRAINT "ProfileServerData_serverId_Server_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."Server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_accountId_Account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Region" ADD CONSTRAINT "Region_worldId_World_id_fk" FOREIGN KEY ("worldId") REFERENCES "public"."World"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD CONSTRAINT "SettlementStructure_structureRequirementsId_StructureRequirements_id_fk" FOREIGN KEY ("structureRequirementsId") REFERENCES "public"."StructureRequirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SettlementStructure" ADD CONSTRAINT "SettlementStructure_settlementId_Settlement_id_fk" FOREIGN KEY ("settlementId") REFERENCES "public"."Settlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_plotId_Plot_id_fk" FOREIGN KEY ("plotId") REFERENCES "public"."Plot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_playerProfileId_Profile_id_fk" FOREIGN KEY ("playerProfileId") REFERENCES "public"."Profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_settlementStorageId_SettlementStorage_id_fk" FOREIGN KEY ("settlementStorageId") REFERENCES "public"."SettlementStorage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StructureModifier" ADD CONSTRAINT "StructureModifier_settlementStructureId_SettlementStructure_id_fk" FOREIGN KEY ("settlementStructureId") REFERENCES "public"."SettlementStructure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Tile" ADD CONSTRAINT "Tile_biomeId_Biome_id_fk" FOREIGN KEY ("biomeId") REFERENCES "public"."Biome"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Tile" ADD CONSTRAINT "Tile_regionId_Region_id_fk" FOREIGN KEY ("regionId") REFERENCES "public"."Region"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "World" ADD CONSTRAINT "World_serverId_Server_id_fk" FOREIGN KEY ("serverId") REFERENCES "public"."Server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Plot_tileId_idx" ON "Plot" USING btree ("tileId");--> statement-breakpoint
CREATE UNIQUE INDEX "ProfileServerData_profileId_key" ON "ProfileServerData" USING btree ("profileId");--> statement-breakpoint
CREATE UNIQUE INDEX "ProfileServerData_serverId_key" ON "ProfileServerData" USING btree ("serverId");--> statement-breakpoint
CREATE UNIQUE INDEX "ProfileServerData_profileId_serverId_key" ON "ProfileServerData" USING btree ("profileId","serverId");--> statement-breakpoint
CREATE UNIQUE INDEX "Region_name_worldId_key" ON "Region" USING btree ("name","worldId");--> statement-breakpoint
CREATE INDEX "Region_worldId_xCoord_yCoord_idx" ON "Region" USING btree ("worldId","xCoord","yCoord");--> statement-breakpoint
CREATE INDEX "Region_xCoord_yCoord_idx" ON "Region" USING btree ("xCoord","yCoord");--> statement-breakpoint
CREATE UNIQUE INDEX "Server_hostname_port_key" ON "Server" USING btree ("hostname","port");--> statement-breakpoint
CREATE INDEX "Settlement_playerProfileId_idx" ON "Settlement" USING btree ("playerProfileId");--> statement-breakpoint
CREATE INDEX "Settlement_plotId_idx" ON "Settlement" USING btree ("plotId");--> statement-breakpoint
CREATE INDEX "Tile_regionId_idx" ON "Tile" USING btree ("regionId");--> statement-breakpoint
CREATE INDEX "Tile_biomeId_idx" ON "Tile" USING btree ("biomeId");--> statement-breakpoint
CREATE INDEX "Tile_type_idx" ON "Tile" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "World_name_serverId_key" ON "World" USING btree ("name","serverId");
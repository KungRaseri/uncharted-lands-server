ALTER TABLE "Tile" ADD COLUMN "xCoord" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Tile" ADD COLUMN "yCoord" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "Tile_coords_idx" ON "Tile" USING btree ("xCoord","yCoord");
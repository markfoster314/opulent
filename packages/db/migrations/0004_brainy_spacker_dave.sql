CREATE TABLE "places" (
	"geoname_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ascii_name" text NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"admin1_code" text DEFAULT '' NOT NULL,
	"admin1_name" text DEFAULT '' NOT NULL,
	"label" text NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "place_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_place_id_places_geoname_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("geoname_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_place_id_idx" ON "users" USING btree ("place_id");
-- The old free-text city column stays until `pnpm places:sync` copies matching
-- names onto place_id and drops it. Dropping it in this migration would lose those names.
CREATE TABLE "want_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "want_items_user_oracle_key";--> statement-breakpoint
INSERT INTO "want_lists" ("user_id", "name")
SELECT DISTINCT "user_id", 'My wants' FROM "want_items";--> statement-breakpoint
ALTER TABLE "want_items" ADD COLUMN "want_list_id" uuid;--> statement-breakpoint
UPDATE "want_items" AS item
SET "want_list_id" = list.id
FROM "want_lists" AS list
WHERE list.user_id = item.user_id
  AND list.name = 'My wants';--> statement-breakpoint
ALTER TABLE "want_items" ALTER COLUMN "want_list_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "want_items" ADD COLUMN "wanted_languages" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "want_items" ADD COLUMN "unwanted_languages" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "want_items" ADD COLUMN "wanted_finishes" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "want_items" ADD COLUMN "unwanted_finishes" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "want_items" ADD COLUMN "wanted_sets" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "want_items" ADD COLUMN "unwanted_sets" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "want_lists" ADD CONSTRAINT "want_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "want_lists_user_id_idx" ON "want_lists" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "want_items" ADD CONSTRAINT "want_items_want_list_id_want_lists_id_fk" FOREIGN KEY ("want_list_id") REFERENCES "public"."want_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "want_items_list_oracle_key" ON "want_items" USING btree ("want_list_id","oracle_id");--> statement-breakpoint
CREATE INDEX "want_items_user_id_idx" ON "want_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "want_items_list_id_idx" ON "want_items" USING btree ("want_list_id");
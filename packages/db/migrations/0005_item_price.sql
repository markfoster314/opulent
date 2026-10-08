CREATE TYPE "public"."item_price_kind" AS ENUM('market', 'percent', 'custom');--> statement-breakpoint
DROP INDEX "binder_items_stack_key";--> statement-breakpoint
ALTER TABLE "binder_items" ADD COLUMN "price_kind" "item_price_kind" DEFAULT 'market' NOT NULL;--> statement-breakpoint
ALTER TABLE "binder_items" ADD COLUMN "price_percent" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "binder_items" ADD COLUMN "price_amount" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "binder_items_stack_key" ON "binder_items" USING btree ("binder_id","scryfall_id","finish","condition","language","price_kind","price_percent","price_amount");
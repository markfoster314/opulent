ALTER TABLE "binder_items" ADD COLUMN IF NOT EXISTS "artist_proof" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "binder_items_stack_key";--> statement-breakpoint
CREATE UNIQUE INDEX "binder_items_stack_key" ON "binder_items" USING btree ("binder_id","scryfall_id","finish","condition","language","signed","altered","misprint","miscut","artist_proof","price_kind","price_percent","price_amount");

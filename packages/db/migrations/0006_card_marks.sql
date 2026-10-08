DROP INDEX "binder_items_stack_key";--> statement-breakpoint
ALTER TABLE "binder_items" ADD COLUMN "signed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "binder_items" ADD COLUMN "altered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "binder_items" ADD COLUMN "misprint" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "binder_items" ADD COLUMN "miscut" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "binder_items_stack_key" ON "binder_items" USING btree ("binder_id","scryfall_id","finish","condition","language","signed","altered","misprint","miscut","price_kind","price_percent","price_amount");
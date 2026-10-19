ALTER TABLE "trades" ADD COLUMN "turn_user_id" uuid;--> statement-breakpoint
UPDATE "trades" SET "turn_user_id" = "proposer_id" WHERE "turn_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "turn_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "proposer_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "receiver_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_turn_user_id_users_id_fk" FOREIGN KEY ("turn_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trade_items_printing_key" ON "trade_items" USING btree ("trade_id","side","scryfall_id");--> statement-breakpoint
CREATE INDEX "trades_turn_user_id_idx" ON "trades" USING btree ("turn_user_id");
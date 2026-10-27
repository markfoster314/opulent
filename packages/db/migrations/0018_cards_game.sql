ALTER TABLE "cards" ADD COLUMN "game" text DEFAULT 'mtg' NOT NULL;--> statement-breakpoint
CREATE INDEX "cards_game_idx" ON "cards" USING btree ("game");
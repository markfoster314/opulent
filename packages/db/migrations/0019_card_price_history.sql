CREATE TABLE "card_price_history" (
	"scryfall_id" uuid NOT NULL,
	"recorded_on" date NOT NULL,
	"prices" jsonb NOT NULL,
	CONSTRAINT "card_price_history_scryfall_id_recorded_on_pk" PRIMARY KEY("scryfall_id","recorded_on")
);
--> statement-breakpoint
ALTER TABLE "card_price_history" ADD CONSTRAINT "card_price_history_scryfall_id_cards_scryfall_id_fk" FOREIGN KEY ("scryfall_id") REFERENCES "public"."cards"("scryfall_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_price_history_recorded_on_idx" ON "card_price_history" USING btree ("recorded_on");
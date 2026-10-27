-- Rebuild the price history as a monthly range partition.
--
-- One growing table would eventually be hundreds of millions of rows, which
-- makes vacuum, index rebuilds, and retention expensive. A partition per month
-- keeps each index small, lets old months be archived or dropped on their own
-- with DROP TABLE, and lets a date range read only the months it needs.
--
-- The primary key already contains the partition key, which PostgreSQL requires.

CREATE TABLE "card_price_history_old" AS SELECT * FROM "card_price_history";--> statement-breakpoint
DROP TABLE "card_price_history";--> statement-breakpoint

CREATE TABLE "card_price_history" (
	"scryfall_id" uuid NOT NULL,
	"recorded_on" date NOT NULL,
	"prices" jsonb NOT NULL,
	CONSTRAINT "card_price_history_scryfall_id_recorded_on_pk" PRIMARY KEY("scryfall_id","recorded_on")
) PARTITION BY RANGE ("recorded_on");--> statement-breakpoint

ALTER TABLE "card_price_history" ADD CONSTRAINT "card_price_history_scryfall_id_cards_scryfall_id_fk" FOREIGN KEY ("scryfall_id") REFERENCES "public"."cards"("scryfall_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- BRIN suits an append-only date: a few kilobytes per partition instead of a
-- full second copy of the column. Rows arrive in date order, so the physical
-- order already matches the dates it is asked about.
CREATE INDEX "card_price_history_recorded_on_idx" ON "card_price_history" USING brin ("recorded_on");--> statement-breakpoint

DO $$
DECLARE
	first_month date;
	last_month date;
	month_start date;
BEGIN
	SELECT date_trunc('month', min(recorded_on))::date,
	       date_trunc('month', max(recorded_on))::date
	  INTO first_month, last_month
	  FROM card_price_history_old;

	first_month := COALESCE(first_month, date_trunc('month', CURRENT_DATE)::date);
	last_month := GREATEST(
		COALESCE(last_month, date_trunc('month', CURRENT_DATE)::date),
		(date_trunc('month', CURRENT_DATE) + INTERVAL '12 months')::date
	);

	FOR month_start IN SELECT generate_series(first_month, last_month, INTERVAL '1 month')::date LOOP
		EXECUTE format(
			'CREATE TABLE IF NOT EXISTS %I PARTITION OF card_price_history FOR VALUES FROM (%L) TO (%L)',
			'card_price_history_' || to_char(month_start, 'YYYY_MM'),
			month_start,
			(month_start + INTERVAL '1 month')::date
		);
	END LOOP;
END $$;--> statement-breakpoint

INSERT INTO "card_price_history" ("scryfall_id", "recorded_on", "prices")
SELECT "scryfall_id", "recorded_on", "prices" FROM "card_price_history_old";--> statement-breakpoint

DROP TABLE "card_price_history_old";

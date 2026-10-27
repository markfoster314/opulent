UPDATE "card_price_history"
SET "usd" = NULLIF("prices"->>'usd', '')::numeric,
    "usd_foil" = NULLIF("prices"->>'usd_foil', '')::numeric,
    "usd_etched" = NULLIF("prices"->>'usd_etched', '')::numeric,
    "eur" = NULLIF("prices"->>'eur', '')::numeric,
    "eur_foil" = NULLIF("prices"->>'eur_foil', '')::numeric,
    "tix" = NULLIF("prices"->>'tix', '')::numeric;--> statement-breakpoint
ALTER TABLE "card_price_history" DROP COLUMN "prices";

ALTER TABLE "binder_items" DROP CONSTRAINT "binder_items_binder_id_binders_id_fk";
--> statement-breakpoint
DROP INDEX "binder_items_stack_key";--> statement-breakpoint
ALTER TABLE "binder_items" ALTER COLUMN "binder_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trade_binder_visibility" "binder_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trade_binder_share_token" text DEFAULT encode(gen_random_bytes(16), 'hex') NOT NULL;--> statement-breakpoint
-- A person with any public binder keeps a public trade binder, so nothing they shared goes dark.
UPDATE "users" u SET "trade_binder_visibility" = 'public'
WHERE EXISTS (SELECT 1 FROM "binders" b WHERE b."user_id" = u."id" AND b."visibility" = 'public');--> statement-breakpoint
ALTER TABLE "binder_items" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "binder_items" bi SET "user_id" = b."user_id" FROM "binders" b WHERE b."id" = bi."binder_id";--> statement-breakpoint
ALTER TABLE "binder_items" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
-- The stack key moves from the binder to the person. The same stack in two
-- binders becomes one stack: the oldest row keeps its folder and takes the quantities.
CREATE TEMP TABLE binder_item_dupes AS
SELECT id, keep_id, quantity FROM (
  SELECT id, quantity,
    first_value(id) OVER (
      PARTITION BY user_id, scryfall_id, finish, condition, language,
        signed, altered, misprint, miscut, artist_proof,
        price_kind, price_percent, price_amount
      ORDER BY created_at, id
    ) AS keep_id
  FROM "binder_items"
) ranked WHERE id <> keep_id;--> statement-breakpoint
UPDATE "binder_items" bi SET "quantity" = bi."quantity" + d.total, "updated_at" = now()
FROM (SELECT keep_id, sum(quantity) AS total FROM binder_item_dupes GROUP BY keep_id) d
WHERE bi."id" = d.keep_id;--> statement-breakpoint
DELETE FROM "binder_items" WHERE "id" IN (SELECT id FROM binder_item_dupes);--> statement-breakpoint
DROP TABLE binder_item_dupes;--> statement-breakpoint
ALTER TABLE "binder_items" ADD CONSTRAINT "binder_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binder_items" ADD CONSTRAINT "binder_items_binder_id_binders_id_fk" FOREIGN KEY ("binder_id") REFERENCES "public"."binders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_trade_binder_share_token_key" ON "users" USING btree ("trade_binder_share_token");--> statement-breakpoint
CREATE INDEX "binder_items_user_id_idx" ON "binder_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "binder_items_stack_key" ON "binder_items" USING btree ("user_id","scryfall_id","finish","condition","language","signed","altered","misprint","miscut","artist_proof","price_kind","price_percent","price_amount");

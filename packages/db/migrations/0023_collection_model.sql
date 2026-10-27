-- The collection model.
--
-- One collection per person: every `collection_items` row with their user id.
-- The trade binder is the rows marked for trade, so it needs no table of its own.
-- Groups are labels joined through `group_memberships`, so a card can sit in
-- several groups or none, and deleting a group never deletes a card.

CREATE TABLE "card_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "card_groups" ADD CONSTRAINT "card_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_groups_user_name_key" ON "card_groups" USING btree ("user_id", lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "card_groups_user_id_id_key" ON "card_groups" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "card_groups_user_id_idx" ON "card_groups" USING btree ("user_id");--> statement-breakpoint

CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scryfall_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"finish" "card_finish" DEFAULT 'nonfoil' NOT NULL,
	"condition" "card_condition" DEFAULT 'NM' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"signed" boolean DEFAULT false NOT NULL,
	"altered" boolean DEFAULT false NOT NULL,
	"misprint" boolean DEFAULT false NOT NULL,
	"miscut" boolean DEFAULT false NOT NULL,
	"artist_proof" boolean DEFAULT false NOT NULL,
	"notes" text,
	"photo_url" text,
	"for_trade" boolean DEFAULT false NOT NULL,
	"price_kind" "item_price_kind" DEFAULT 'market' NOT NULL,
	"price_percent" integer DEFAULT 100 NOT NULL,
	"price_amount" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_scryfall_id_cards_scryfall_id_fk" FOREIGN KEY ("scryfall_id") REFERENCES "public"."cards"("scryfall_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_stack_key" ON "collection_items" USING btree ("user_id","scryfall_id","finish","condition","language","signed","altered","misprint","miscut","artist_proof");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_user_id_id_key" ON "collection_items" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "collection_items_user_id_idx" ON "collection_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collection_items_scryfall_id_idx" ON "collection_items" USING btree ("scryfall_id");--> statement-breakpoint
CREATE INDEX "collection_items_trade_scryfall_idx" ON "collection_items" USING btree ("scryfall_id") WHERE "collection_items"."for_trade";--> statement-breakpoint

CREATE TABLE "group_memberships" (
	"item_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_memberships_item_id_group_id_pk" PRIMARY KEY("item_id","group_id")
);--> statement-breakpoint
CREATE INDEX "group_memberships_group_id_idx" ON "group_memberships" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_item_fk" FOREIGN KEY ("user_id","item_id") REFERENCES "public"."collection_items"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_fk" FOREIGN KEY ("user_id","group_id") REFERENCES "public"."card_groups"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Carry the existing data over. Each old folder becomes one group, and each
-- item keeps its folder as a membership.
INSERT INTO "card_groups" ("id", "user_id", "name", "description", "created_at", "updated_at")
SELECT "id", "user_id", "name", "description", "created_at", "updated_at" FROM "binders";--> statement-breakpoint

INSERT INTO "collection_items" (
	"id", "user_id", "scryfall_id", "quantity", "finish", "condition", "language",
	"signed", "altered", "misprint", "miscut", "artist_proof", "notes", "photo_url",
	"for_trade", "price_kind", "price_percent", "price_amount", "created_at", "updated_at"
)
SELECT
	"id", "user_id", "scryfall_id", "quantity", "finish", "condition", "language",
	"signed", "altered", "misprint", "miscut", "artist_proof", "notes", "photo_url",
	"for_trade", "price_kind", "price_percent", "price_amount", "created_at", "updated_at"
FROM "binder_items";--> statement-breakpoint

INSERT INTO "group_memberships" ("item_id", "group_id", "user_id", "added_at")
SELECT "id", "binder_id", "user_id", "created_at"
FROM "binder_items"
WHERE "binder_id" IS NOT NULL;--> statement-breakpoint

DROP TABLE "binder_items";--> statement-breakpoint
DROP TABLE "binders";

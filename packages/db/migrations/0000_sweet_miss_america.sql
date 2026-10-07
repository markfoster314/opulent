CREATE TYPE "public"."binder_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TYPE "public"."card_condition" AS ENUM('NM', 'LP', 'MP', 'HP', 'DMG');--> statement-breakpoint
CREATE TYPE "public"."card_finish" AS ENUM('nonfoil', 'foil', 'etched');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('offered', 'requested');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('draft', 'proposed', 'countered', 'accepted', 'declined', 'cancelled', 'completed');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth0_sub" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"scryfall_id" uuid PRIMARY KEY NOT NULL,
	"oracle_id" uuid NOT NULL,
	"name" text NOT NULL,
	"set_code" text NOT NULL,
	"set_name" text,
	"collector_number" text NOT NULL,
	"rarity" text,
	"lang" text DEFAULT 'en' NOT NULL,
	"layout" text,
	"type_line" text,
	"mana_cost" text,
	"finishes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_uris" jsonb,
	"prices" jsonb,
	"scryfall_uri" text,
	"released_at" text,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "binder_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"binder_id" uuid NOT NULL,
	"scryfall_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"finish" "card_finish" DEFAULT 'nonfoil' NOT NULL,
	"condition" "card_condition" DEFAULT 'NM' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"notes" text,
	"for_trade" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "binders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"visibility" "binder_visibility" DEFAULT 'private' NOT NULL,
	"share_token" text DEFAULT encode(gen_random_bytes(16), 'hex') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "want_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"oracle_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"side" "trade_side" NOT NULL,
	"scryfall_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposer_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"status" "trade_status" DEFAULT 'draft' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "binder_items" ADD CONSTRAINT "binder_items_binder_id_binders_id_fk" FOREIGN KEY ("binder_id") REFERENCES "public"."binders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binder_items" ADD CONSTRAINT "binder_items_scryfall_id_cards_scryfall_id_fk" FOREIGN KEY ("scryfall_id") REFERENCES "public"."cards"("scryfall_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binders" ADD CONSTRAINT "binders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "want_items" ADD CONSTRAINT "want_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_scryfall_id_cards_scryfall_id_fk" FOREIGN KEY ("scryfall_id") REFERENCES "public"."cards"("scryfall_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth0_sub_key" ON "users" USING btree ("auth0_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_key" ON "users" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "cards_oracle_id_idx" ON "cards" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "cards_set_code_idx" ON "cards" USING btree ("set_code");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_printing_key" ON "cards" USING btree ("set_code","collector_number","lang");--> statement-breakpoint
CREATE UNIQUE INDEX "binder_items_stack_key" ON "binder_items" USING btree ("binder_id","scryfall_id","finish","condition","language");--> statement-breakpoint
CREATE INDEX "binder_items_binder_id_idx" ON "binder_items" USING btree ("binder_id");--> statement-breakpoint
CREATE INDEX "binder_items_scryfall_id_idx" ON "binder_items" USING btree ("scryfall_id");--> statement-breakpoint
CREATE UNIQUE INDEX "binders_user_slug_key" ON "binders" USING btree ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "binders_share_token_key" ON "binders" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "binders_user_id_idx" ON "binders" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "want_items_user_oracle_key" ON "want_items" USING btree ("user_id","oracle_id");--> statement-breakpoint
CREATE INDEX "want_items_oracle_id_idx" ON "want_items" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "trade_items_trade_id_idx" ON "trade_items" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "trades_proposer_id_idx" ON "trades" USING btree ("proposer_id");--> statement-breakpoint
CREATE INDEX "trades_receiver_id_idx" ON "trades" USING btree ("receiver_id");
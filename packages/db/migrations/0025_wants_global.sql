CREATE TABLE "want_items_new" (
	"id" uuid NOT NULL DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"oracle_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"notes" text,
	"wanted_languages" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"wanted_finishes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"wanted_conditions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"wanted_sets" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"scope_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "want_items_new_pkey" PRIMARY KEY("id")
);
--> statement-breakpoint
ALTER TABLE "want_items_new" ADD CONSTRAINT "want_items_new_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TEMP TABLE "old_wants_normalized" AS
WITH base AS (
  SELECT
    id,
    want_list_id,
    user_id,
    oracle_id,
    quantity,
    priority,
    notes,
    created_at,
    ARRAY(SELECT DISTINCT l FROM unnest(wanted_languages) AS l ORDER BY 1) AS langs,
    ARRAY(SELECT DISTINCT f FROM unnest(wanted_finishes) AS f ORDER BY 1) AS finishes,
    ARRAY(SELECT DISTINCT c FROM unnest(wanted_conditions) AS c ORDER BY 1) AS conditions,
    ARRAY(SELECT DISTINCT lower(s) FROM unnest(wanted_sets) AS s ORDER BY 1) AS sets
  FROM "want_items"
)
SELECT
  base.*,
  concat_ws('|',
    'lang:' || array_to_string(langs, ','),
    'finish:' || array_to_string(finishes, ','),
    'cond:' || array_to_string(conditions, ','),
    'set:' || array_to_string(sets, ',')
  ) AS scope_key
FROM base;--> statement-breakpoint
INSERT INTO "want_items_new" (
  "id", "user_id", "oracle_id", "quantity", "priority", "notes",
  "wanted_languages", "wanted_finishes", "wanted_conditions", "wanted_sets",
  "scope_key", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  user_id,
  oracle_id,
  SUM(quantity)::int,
  MIN(priority),
  (array_agg(notes ORDER BY created_at) FILTER (WHERE notes IS NOT NULL))[1],
  langs,
  finishes,
  conditions,
  sets,
  scope_key,
  MIN(created_at),
  now()
FROM "old_wants_normalized"
GROUP BY user_id, oracle_id, langs, finishes, conditions, sets, scope_key;--> statement-breakpoint
CREATE TEMP TABLE "old_want_memberships" AS
SELECT id AS old_item_id, want_list_id, user_id, oracle_id, scope_key
FROM "old_wants_normalized";--> statement-breakpoint
DROP TABLE "want_items" CASCADE;--> statement-breakpoint
ALTER TABLE "want_items_new" RENAME TO "want_items";--> statement-breakpoint
ALTER TABLE "want_items" RENAME CONSTRAINT "want_items_new_pkey" TO "want_items_pkey";--> statement-breakpoint
ALTER TABLE "want_items" RENAME CONSTRAINT "want_items_new_user_id_users_id_fk" TO "want_items_user_id_users_id_fk";--> statement-breakpoint
CREATE UNIQUE INDEX "want_items_user_id_id_key" ON "want_items" USING btree ("user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "want_items_user_oracle_scope_key" ON "want_items" USING btree ("user_id","oracle_id","scope_key");--> statement-breakpoint
CREATE INDEX "want_items_oracle_id_idx" ON "want_items" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "want_items_user_id_idx" ON "want_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "want_lists_user_id_id_key" ON "want_lists" USING btree ("user_id","id");--> statement-breakpoint
CREATE TABLE "want_list_items" (
	"want_list_id" uuid NOT NULL,
	"want_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "want_list_items_want_list_id_want_item_id_pk" PRIMARY KEY("want_list_id","want_item_id")
);
--> statement-breakpoint
ALTER TABLE "want_list_items" ADD CONSTRAINT "want_list_items_list_fk" FOREIGN KEY ("user_id","want_list_id") REFERENCES "public"."want_lists"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "want_list_items" ADD CONSTRAINT "want_list_items_item_fk" FOREIGN KEY ("user_id","want_item_id") REFERENCES "public"."want_items"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "want_list_items_item_id_idx" ON "want_list_items" USING btree ("want_item_id");--> statement-breakpoint
CREATE INDEX "want_list_items_user_id_idx" ON "want_list_items" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "want_list_items" ("want_list_id","want_item_id","user_id")
SELECT m.want_list_id, w.id, m.user_id
FROM "old_want_memberships" m
JOIN "want_items" w
  ON w.user_id = m.user_id
 AND w.oracle_id = m.oracle_id
 AND w.scope_key = m.scope_key
ON CONFLICT DO NOTHING;--> statement-breakpoint
DROP TABLE "old_want_memberships";--> statement-breakpoint
DROP TABLE "old_wants_normalized";

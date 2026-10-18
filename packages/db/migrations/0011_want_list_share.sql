ALTER TABLE "want_lists" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "want_lists" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "want_lists" ADD COLUMN "visibility" "binder_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "want_lists" ADD COLUMN "share_token" text DEFAULT encode(gen_random_bytes(16), 'hex') NOT NULL;--> statement-breakpoint
UPDATE "want_lists"
SET "slug" = NULLIF(
  trim(both '-' from left(regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'), 60)),
  ''
);--> statement-breakpoint
UPDATE "want_lists"
SET "slug" = 'list'
WHERE "slug" IS NULL OR length("slug") < 3;--> statement-breakpoint
WITH ranked AS (
  SELECT
    id,
    slug,
    row_number() OVER (PARTITION BY user_id, slug ORDER BY created_at, id) AS n
  FROM want_lists
)
UPDATE want_lists AS w
SET slug = left(r.slug, 51) || '-' || substring(replace(w.id::text, '-', ''), 1, 8)
FROM ranked AS r
WHERE w.id = r.id AND r.n > 1;--> statement-breakpoint
ALTER TABLE "want_lists" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "want_lists_user_slug_key" ON "want_lists" USING btree ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "want_lists_share_token_key" ON "want_lists" USING btree ("share_token");

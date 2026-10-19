CREATE TABLE "generic_wants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"languages" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"finishes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"conditions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"sets" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"signed" boolean DEFAULT false NOT NULL,
	"altered" boolean DEFAULT false NOT NULL,
	"misprint" boolean DEFAULT false NOT NULL,
	"miscut" boolean DEFAULT false NOT NULL,
	"artist_proof" boolean DEFAULT false NOT NULL,
	"match_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generic_wants" ADD CONSTRAINT "generic_wants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generic_wants_user_id_idx" ON "generic_wants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generic_wants_user_match_key" ON "generic_wants" USING btree ("user_id","match_key");
CREATE TABLE "collection_value_snapshots" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	CONSTRAINT "collection_value_snapshots_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "collection_value_snapshots" ADD CONSTRAINT "collection_value_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_value_snapshots_user_day_idx" ON "collection_value_snapshots" USING btree ("user_id","day");
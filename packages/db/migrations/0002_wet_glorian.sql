ALTER TABLE "users" RENAME COLUMN "handle" TO "username";--> statement-breakpoint
DROP INDEX "users_handle_key";--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "display_name";
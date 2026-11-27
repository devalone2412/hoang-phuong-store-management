CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_key_uq` ON `categories` (`name_key`);--> statement-breakpoint
ALTER TABLE `products` ADD `sold_by_weight` integer DEFAULT false NOT NULL;
--> statement-breakpoint
-- Existing groups become the managed list. (lower() is ASCII-only; names that differ only by a
-- non-ASCII capital stay separate, exactly as they were on the products.)
INSERT OR IGNORE INTO `categories` (`id`, `name`, `name_key`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), `name`, lower(`name`), CAST(strftime('%s','now') AS integer) * 1000, CAST(strftime('%s','now') AS integer) * 1000
FROM (SELECT DISTINCT trim(`category`) AS `name` FROM `products` WHERE `category` IS NOT NULL AND trim(`category`) <> '' AND `deleted_at` IS NULL);

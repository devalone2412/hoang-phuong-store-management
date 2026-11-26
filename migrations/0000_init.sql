CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_search` text NOT NULL,
	`sku` text,
	`barcode` text,
	`unit` text NOT NULL,
	`category` text,
	`retail_price` integer NOT NULL,
	`wholesale_price` integer,
	`cost_price` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_uq` ON `products` (`sku`) WHERE "products"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_uq` ON `products` (`barcode`) WHERE "products"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `products_name_search_idx` ON `products` (`name_search`);--> statement-breakpoint
CREATE INDEX `products_updated_at_idx` ON `products` (`updated_at`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);
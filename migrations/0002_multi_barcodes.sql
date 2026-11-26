CREATE TABLE `product_barcodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` text NOT NULL,
	`barcode` text NOT NULL,
	`position` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_barcodes_barcode_uq` ON `product_barcodes` (`barcode`) WHERE "product_barcodes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `product_barcodes_product_idx` ON `product_barcodes` (`product_id`);--> statement-breakpoint
INSERT INTO `product_barcodes` (`product_id`, `barcode`, `position`, `deleted_at`)
SELECT `id`, `barcode`, 0, `deleted_at` FROM `products` WHERE `barcode` IS NOT NULL AND `barcode` <> '';--> statement-breakpoint
DROP INDEX `products_barcode_uq`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `barcode`;
ALTER TABLE `products` ADD `price_100g` integer;
--> statement-breakpoint
-- Carry over the lightest of the old weight rows as the 100 g price (its rate scaled to 100 g).
UPDATE `products` SET `price_100g` = (
	SELECT CAST(round(json_extract(`value`, '$.price') * 100.0 / json_extract(`value`, '$.grams')) AS integer)
	FROM json_each(`products`.`weight_prices`)
	ORDER BY json_extract(`value`, '$.grams')
	LIMIT 1
)
WHERE `weight_prices` IS NOT NULL AND json_array_length(`weight_prices`) > 0;

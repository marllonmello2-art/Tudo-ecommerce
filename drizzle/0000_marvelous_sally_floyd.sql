CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`bullets_json` text NOT NULL,
	`platform` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pricing_simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`platform` text NOT NULL,
	`cost` real NOT NULL,
	`margin` real NOT NULL,
	`fee` real NOT NULL,
	`fixed` real NOT NULL,
	`shipping` real NOT NULL,
	`recommended_price` real NOT NULL,
	`net` real NOT NULL,
	`profit` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`image_key` text,
	`image_mime` text,
	`identified_as` text NOT NULL,
	`analysis_json` text NOT NULL,
	`status` text DEFAULT 'analyzed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`photo_key` text,
	`photo_mime` text,
	`photo_data` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

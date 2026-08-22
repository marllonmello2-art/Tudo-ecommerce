CREATE TABLE `trend_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`marketplace` text NOT NULL,
	`category` text NOT NULL,
	`payload` text NOT NULL,
	`origin` text NOT NULL,
	`fetched_at` text NOT NULL
);

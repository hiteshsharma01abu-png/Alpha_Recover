CREATE TABLE `demo_videos` (
	`id` char(36) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`title` varchar(200) NOT NULL,
	`tag` varchar(40) NOT NULL,
	`category` enum('logical','electrical','mechanical','firmware') NOT NULL,
	`description` text NOT NULL,
	`tags` json NOT NULL,
	`level` enum('beginner','intermediate','advanced') NOT NULL,
	`duration_seconds` int unsigned NOT NULL,
	`video_provider` enum('bunny','youtube'),
	`video_id` varchar(128),
	`thumbnail_url` varchar(500),
	`view_count` int unsigned NOT NULL DEFAULT 0,
	`is_featured` boolean NOT NULL DEFAULT false,
	`featured_key` tinyint GENERATED ALWAYS AS (if(is_featured and deleted_at is null, 1, null)) STORED,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `demo_videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `demo_videos_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `demo_videos_featured_uq` UNIQUE(`featured_key`)
);
--> statement-breakpoint
CREATE INDEX `demo_videos_list_idx` ON `demo_videos` (`status`,`category`,`published_at`);
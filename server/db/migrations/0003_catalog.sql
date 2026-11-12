CREATE TABLE `course_modules` (
	`id` char(36) NOT NULL,
	`course_id` char(36) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`title` varchar(160) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `course_modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `course_modules_course_slug_uq` UNIQUE(`course_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` char(36) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`title` varchar(160) NOT NULL,
	`summary` text NOT NULL,
	`image_url` varchar(500),
	`sort_order` int NOT NULL DEFAULT 0,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `courses_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` char(36) NOT NULL,
	`module_id` char(36) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`video_provider` enum('bunny','youtube'),
	`video_id` varchar(128),
	`duration_seconds` int unsigned,
	`is_preview` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`),
	CONSTRAINT `lessons_module_slug_uq` UNIQUE(`module_id`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `course_modules` ADD CONSTRAINT `course_modules_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_module_id_course_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `course_modules_course_sort_idx` ON `course_modules` (`course_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `courses_status_sort_idx` ON `courses` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `lessons_module_sort_idx` ON `lessons` (`module_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `lessons_status_idx` ON `lessons` (`status`);
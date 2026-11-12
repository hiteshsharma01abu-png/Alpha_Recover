CREATE TABLE `plan_courses` (
	`plan_id` char(36) NOT NULL,
	`course_id` char(36) NOT NULL,
	CONSTRAINT `plan_courses_plan_id_course_id_pk` PRIMARY KEY(`plan_id`,`course_id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` char(36) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`price_paise` int unsigned NOT NULL,
	`compare_at_paise` int unsigned,
	`currency` char(3) NOT NULL DEFAULT 'INR',
	`features` json NOT NULL,
	`mobile_feature_order` json,
	`grants_all_courses` boolean NOT NULL DEFAULT true,
	`access_days` int unsigned,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` char(36) NOT NULL,
	`plan_id` char(36) NOT NULL,
	`label` varchar(120) NOT NULL,
	`sale_price_paise` int unsigned NOT NULL,
	`starts_at` datetime(3) NOT NULL,
	`ends_at` datetime(3) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `plan_courses` ADD CONSTRAINT `plan_courses_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plan_courses` ADD CONSTRAINT `plan_courses_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotions` ADD CONSTRAINT `promotions_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotions` ADD CONSTRAINT `promotions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `plans_status_sort_idx` ON `plans` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `promotions_plan_window_idx` ON `promotions` (`plan_id`,`is_active`,`starts_at`,`ends_at`);
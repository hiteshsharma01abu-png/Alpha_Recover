CREATE TABLE `lesson_progress` (
	`user_id` char(36) NOT NULL,
	`lesson_id` char(36) NOT NULL,
	`position_seconds` int unsigned NOT NULL DEFAULT 0,
	`watched_seconds` int unsigned NOT NULL DEFAULT 0,
	`completed_at` datetime(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lesson_progress_user_id_lesson_id_pk` PRIMARY KEY(`user_id`,`lesson_id`)
);
--> statement-breakpoint
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_lesson_id_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lesson_progress_user_updated_idx` ON `lesson_progress` (`user_id`,`updated_at`);
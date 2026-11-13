CREATE TABLE `certificate_sequences` (
	`year` int NOT NULL,
	`last_number` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `certificate_sequences_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` char(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`user_id` char(36) NOT NULL,
	`plan_id` char(36),
	`course_id` char(36),
	`recipient_name` varchar(160) NOT NULL,
	`program_title` varchar(200) NOT NULL,
	`issued_at` datetime(3) NOT NULL,
	`status` enum('valid','revoked') NOT NULL DEFAULT 'valid',
	`revoked_at` datetime(3),
	`revoked_reason` text,
	`pdf_storage_key` text,
	`issued_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_issued_by_users_id_fk` FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `certificates_user_idx` ON `certificates` (`user_id`);
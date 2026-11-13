CREATE TABLE `enrollments` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`plan_id` char(36) NOT NULL,
	`order_id` char(36),
	`source` enum('purchase','manual','complimentary') NOT NULL,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`starts_at` datetime(3) NOT NULL,
	`expires_at` datetime(3),
	`revoked_at` datetime(3),
	`revoked_reason` text,
	`granted_by` char(36),
	`active_flag` tinyint GENERATED ALWAYS AS (if(status = 'active', 1, null)) STORED,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrollments_order_uq` UNIQUE(`order_id`),
	CONSTRAINT `enrollments_active_uq` UNIQUE(`active_flag`,`user_id`,`plan_id`)
);
--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_granted_by_users_id_fk` FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `enrollments_user_status_idx` ON `enrollments` (`user_id`,`status`);
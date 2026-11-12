CREATE TABLE `accounts` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`provider_id` varchar(32) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`password` text,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scope` varchar(255),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_provider_uq` UNIQUE(`provider_id`,`account_id`)
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`actor_id` char(36),
	`actor_role` enum('student','support','content_manager','admin','super_admin'),
	`action` varchar(64) NOT NULL,
	`entity_type` varchar(32),
	`entity_id` varchar(64),
	`metadata` json,
	`ip_hash` char(64),
	`request_id` varchar(40),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_jobs` (
	`id` char(36) NOT NULL,
	`channel` enum('email','whatsapp') NOT NULL,
	`template` varchar(64) NOT NULL,
	`to_address` varchar(254) NOT NULL,
	`payload` json NOT NULL,
	`status` enum('pending','sending','sent','failed','dead') NOT NULL DEFAULT 'pending',
	`attempts` smallint NOT NULL DEFAULT 0,
	`next_attempt_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`provider_message_id` varchar(128),
	`last_error` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`sent_at` datetime(3),
	CONSTRAINT `notification_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`bucket_key` varchar(191) NOT NULL,
	`window_start` datetime(3) NOT NULL,
	`hits` int unsigned NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `rate_limit_buckets_bucket_key` PRIMARY KEY(`bucket_key`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_uq` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` varchar(64) NOT NULL,
	`value` json NOT NULL,
	`is_public` boolean NOT NULL DEFAULT false,
	`updated_by` char(36),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `site_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`first_name` varchar(80) NOT NULL,
	`last_name` varchar(80),
	`certificate_name` varchar(160),
	`image` varchar(500),
	`phone` varchar(20),
	`country` varchar(2) NOT NULL,
	`role` enum('student','support','content_manager','admin','super_admin') NOT NULL DEFAULT 'student',
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`terms_accepted_at` datetime(3) NOT NULL,
	`whatsapp_opt_in_at` datetime(3),
	`last_login_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` char(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` varchar(255) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_settings` ADD CONSTRAINT `site_settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_entity_idx` ON `activity_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_logs_actor_idx` ON `activity_logs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_logs_action_idx` ON `activity_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_jobs_due_idx` ON `notification_jobs` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `notification_jobs_template_idx` ON `notification_jobs` (`template`,`created_at`);--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_expires_idx` ON `rate_limit_buckets` (`expires_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_created_idx` ON `sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_created_idx` ON `users` (`created_at`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE INDEX `verifications_expires_idx` ON `verifications` (`expires_at`);
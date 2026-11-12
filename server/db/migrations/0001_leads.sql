CREATE TABLE `leads` (
	`id` char(36) NOT NULL,
	`source` enum('contact_form','callback','whatsapp','manual') NOT NULL,
	`name` varchar(120),
	`email` varchar(254),
	`phone` varchar(20),
	`reason` enum('technical_support','software_hardware_sale','data_recovery_service','training','other'),
	`message` text,
	`whatsapp_consent` boolean NOT NULL DEFAULT false,
	`status` enum('new','contacted','qualified','converted','closed','spam') NOT NULL DEFAULT 'new',
	`assigned_to` char(36),
	`user_id` char(36),
	`page_path` varchar(255),
	`utm` json,
	`ip_hash` char(64),
	`user_agent` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_to_users_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `leads_status_created_idx` ON `leads` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_assigned_status_idx` ON `leads` (`assigned_to`,`status`);--> statement-breakpoint
CREATE INDEX `leads_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX `leads_phone_idx` ON `leads` (`phone`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);
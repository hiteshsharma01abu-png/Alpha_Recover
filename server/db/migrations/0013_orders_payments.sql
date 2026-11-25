CREATE TABLE `order_sequences` (
	`year` int NOT NULL,
	`last_number` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `order_sequences_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` char(36) NOT NULL,
	`order_number` varchar(24) NOT NULL,
	`user_id` char(36) NOT NULL,
	`plan_id` char(36) NOT NULL,
	`promotion_id` char(36),
	`amount_paise` int unsigned NOT NULL,
	`currency` char(3) NOT NULL DEFAULT 'INR',
	`status` enum('created','paid','failed','cancelled','refunded','partially_refunded') NOT NULL DEFAULT 'created',
	`provider` enum('razorpay') NOT NULL DEFAULT 'razorpay',
	`provider_order_id` varchar(64),
	`billing_name` varchar(160) NOT NULL,
	`billing_email` varchar(254) NOT NULL,
	`billing_phone` varchar(20),
	`billing_country` varchar(2) NOT NULL DEFAULT 'IN',
	`gstin` varchar(15),
	`paid_at` datetime(3),
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_uq` UNIQUE(`order_number`),
	CONSTRAINT `orders_provider_order_uq` UNIQUE(`provider_order_id`)
);
--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` char(36) NOT NULL,
	`provider` enum('razorpay') NOT NULL DEFAULT 'razorpay',
	`event_id` varchar(128) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`signature_valid` boolean NOT NULL,
	`processed_at` datetime(3),
	`status` enum('received','processed','ignored','failed') NOT NULL DEFAULT 'received',
	`error` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `payment_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_webhook_events_event_uq` UNIQUE(`provider`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`provider_payment_id` varchar(64) NOT NULL,
	`amount_paise` int unsigned NOT NULL,
	`status` enum('authorized','captured','failed','refunded','partially_refunded') NOT NULL,
	`method` varchar(32),
	`refunded_paise` int unsigned NOT NULL DEFAULT 0,
	`refunded_at` datetime(3),
	`error_code` varchar(64),
	`error_description` text,
	`raw` json,
	`captured_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_provider_payment_uq` UNIQUE(`provider_payment_id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_promotion_id_promotions_id_fk` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `orders_user_created_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payment_webhook_events_status_idx` ON `payment_webhook_events` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;
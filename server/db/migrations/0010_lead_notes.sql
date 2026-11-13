CREATE TABLE `lead_notes` (
	`id` char(36) NOT NULL,
	`lead_id` char(36) NOT NULL,
	`author_id` char(36),
	`type` enum('note','call','email','whatsapp','status_change','assignment') NOT NULL,
	`body` text,
	`from_status` enum('new','contacted','qualified','converted','closed','spam'),
	`to_status` enum('new','contacted','qualified','converted','closed','spam'),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lead_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lead_notes_lead_created_idx` ON `lead_notes` (`lead_id`,`created_at`);
-- Staff roles (docs/admin/AUTH_AND_RBAC.md §2): add finance_manager, rename support → support_manager.
-- Expand, move rows, contract, so it is safe even if staff rows already exist.
ALTER TABLE `users` MODIFY COLUMN `role` enum('student','support','support_manager','content_manager','finance_manager','admin','super_admin') NOT NULL DEFAULT 'student';--> statement-breakpoint
ALTER TABLE `activity_logs` MODIFY COLUMN `actor_role` enum('student','support','support_manager','content_manager','finance_manager','admin','super_admin');--> statement-breakpoint
UPDATE `users` SET `role` = 'support_manager' WHERE `role` = 'support';--> statement-breakpoint
UPDATE `activity_logs` SET `actor_role` = 'support_manager' WHERE `actor_role` = 'support';--> statement-breakpoint
ALTER TABLE `activity_logs` MODIFY COLUMN `actor_role` enum('student','support_manager','content_manager','finance_manager','admin','super_admin');--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('student','support_manager','content_manager','finance_manager','admin','super_admin') NOT NULL DEFAULT 'student';

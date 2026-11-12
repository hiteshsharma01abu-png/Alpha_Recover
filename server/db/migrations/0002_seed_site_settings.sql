-- Default settings. INSERT IGNORE: never overwrites values an admin has changed.
INSERT IGNORE INTO `site_settings` (`key`, `value`, `is_public`) VALUES
  ('lead_notification_emails', JSON_ARRAY('info@alpharecover.com'), false);

CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`user_id` integer NOT NULL,
	`session_id` integer NOT NULL,
	`voucher_id` integer,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`credits_used` integer DEFAULT 1 NOT NULL,
	`checked_in_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`cancelled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `class_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_unique` ON `bookings` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_user_session_active_unique` ON `bookings` (`user_id`,`session_id`) WHERE status <> 'cancelled';--> statement-breakpoint
CREATE INDEX `bookings_session_idx` ON `bookings` (`session_id`);--> statement-breakpoint
CREATE TABLE `class_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer,
	`class_type_id` integer NOT NULL,
	`teacher_id` integer NOT NULL,
	`room_id` integer NOT NULL,
	`session_date` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`capacity` integer DEFAULT 12 NOT NULL,
	`is_extra` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `class_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`class_type_id`) REFERENCES `class_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_sessions_template_date_unique` ON `class_sessions` (`template_id`,`session_date`);--> statement-breakpoint
CREATE INDEX `class_sessions_date_idx` ON `class_sessions` (`session_date`);--> statement-breakpoint
CREATE TABLE `class_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`class_type_id` integer NOT NULL,
	`teacher_id` integer NOT NULL,
	`room_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`capacity` integer DEFAULT 12 NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`class_type_id`) REFERENCES `class_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'yoga' NOT NULL,
	`intensity` text DEFAULT 'All levels' NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`tagline` text NOT NULL,
	`description` text NOT NULL,
	`accent` text DEFAULT 'emerald' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_types_slug_unique` ON `class_types` (`slug`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`session_id` integer,
	`booking_id` integer,
	`action_href` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `class_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`is_read`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`voucher_id` integer,
	`reference` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text DEFAULT 'card' NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`view_name` text NOT NULL,
	`description` text NOT NULL,
	`image_url` text NOT NULL,
	`capacity` integer DEFAULT 14 NOT NULL,
	`floor` text DEFAULT 'Ground floor' NOT NULL,
	`amenities` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_slug_unique` ON `rooms` (`slug`);--> statement-breakpoint
CREATE TABLE `session_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`change_type` text NOT NULL,
	`label` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`note` text,
	`actor_name` text DEFAULT 'Studio admin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `class_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`bio` text NOT NULL,
	`photo_url` text NOT NULL,
	`specialties` text DEFAULT '' NOT NULL,
	`certifications` text DEFAULT '' NOT NULL,
	`years_experience` integer DEFAULT 1 NOT NULL,
	`instagram` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teachers_slug_unique` ON `teachers` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `voucher_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`class_count` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`validity_days` integer DEFAULT 180 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`perks` text DEFAULT '' NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`user_id` integer NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`credits_total` integer NOT NULL,
	`credits_remaining` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`purchased_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `voucher_products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vouchers_code_unique` ON `vouchers` (`code`);
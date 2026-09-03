CREATE TABLE `briefing_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`timeZone` varchar(64) NOT NULL DEFAULT 'Asia/Kolkata',
	`hour` int NOT NULL DEFAULT 8,
	`minute` int NOT NULL DEFAULT 30,
	`enabled` int NOT NULL DEFAULT 1,
	`schedule_cron_task_uid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `briefing_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `briefing_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `briefings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`briefing_date` varchar(10) NOT NULL,
	`content` text NOT NULL,
	`task_count` int NOT NULL DEFAULT 0,
	`event_count` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `briefings_id` PRIMARY KEY(`id`),
	CONSTRAINT `briefings_user_date_unique` UNIQUE(`userId`,`briefing_date`)
);
--> statement-breakpoint
CREATE INDEX `briefing_settings_task_uid_idx` ON `briefing_settings` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `briefings_userId_idx` ON `briefings` (`userId`);
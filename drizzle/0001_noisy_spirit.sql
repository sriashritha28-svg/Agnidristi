CREATE TABLE `firms_detections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`detectionId` varchar(191) NOT NULL,
	`source` varchar(100) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`observedAt` timestamp NOT NULL,
	`ingestedAt` timestamp NOT NULL DEFAULT (now()),
	`frp` double,
	`brightnessTemperature` double,
	`confidence` double,
	`dayNight` varchar(16),
	`payload` text NOT NULL,
	CONSTRAINT `firms_detections_id` PRIMARY KEY(`id`),
	CONSTRAINT `firms_detections_detectionId_unique` UNIQUE(`detectionId`)
);
--> statement-breakpoint
CREATE TABLE `incident_clusters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clusterKey` varchar(191) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`detectionCount` int NOT NULL DEFAULT 0,
	`totalFrp` double NOT NULL DEFAULT 0,
	`lastObservedAt` timestamp NOT NULL,
	`baselineType` varchar(32) NOT NULL,
	`robustZ` double,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incident_clusters_id` PRIMARY KEY(`id`),
	CONSTRAINT `incident_clusters_clusterKey_unique` UNIQUE(`clusterKey`)
);
--> statement-breakpoint
CREATE TABLE `operator_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hotspotId` varchar(191) NOT NULL,
	`outcome` enum('CONFIRMED','REJECTED','CORRECTED') NOT NULL,
	`comment` text,
	`userOpenId` varchar(64) NOT NULL DEFAULT 'anonymous',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operator_feedback_id` PRIMARY KEY(`id`)
);

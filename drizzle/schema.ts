import { double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const firmsDetections = mysqlTable("firms_detections", {
  id: int("id").autoincrement().primaryKey(),
  detectionId: varchar("detectionId", { length: 191 }).notNull().unique(),
  source: varchar("source", { length: 100 }).notNull(),
  latitude: double("latitude").notNull(),
  longitude: double("longitude").notNull(),
  observedAt: timestamp("observedAt").notNull(),
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
  frp: double("frp"),
  brightnessTemperature: double("brightnessTemperature"),
  confidence: double("confidence"),
  dayNight: varchar("dayNight", { length: 16 }),
  payload: text("payload").notNull(),
});

export const incidentClusters = mysqlTable("incident_clusters", {
  id: int("id").autoincrement().primaryKey(),
  clusterKey: varchar("clusterKey", { length: 191 }).notNull().unique(),
  latitude: double("latitude").notNull(),
  longitude: double("longitude").notNull(),
  detectionCount: int("detectionCount").notNull().default(0),
  totalFrp: double("totalFrp").notNull().default(0),
  lastObservedAt: timestamp("lastObservedAt").notNull(),
  baselineType: varchar("baselineType", { length: 32 }).notNull(),
  robustZ: double("robustZ"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const operatorFeedback = mysqlTable("operator_feedback", {
  id: int("id").autoincrement().primaryKey(),
  hotspotId: varchar("hotspotId", { length: 191 }).notNull(),
  outcome: mysqlEnum("outcome", ["CONFIRMED", "REJECTED", "CORRECTED"]).notNull(),
  comment: text("comment"),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull().default("anonymous"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type FirmsDetection = typeof firmsDetections.$inferSelect;
export type IncidentCluster = typeof incidentClusters.$inferSelect;
export type OperatorFeedback = typeof operatorFeedback.$inferSelect;

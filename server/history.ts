import { and, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { firmsDetections, incidentClusters, operatorFeedback } from "../drizzle/schema";
import type { Hotspot } from "./hotspots";

export type HistoryPoint = { label: string; frp: number; detections: number };
export type ClusterTimeline = { label: string; state: string; count: number; note: string };
export type IncidentHistory = { state: "AVAILABLE" | "UNAVAILABLE" | "DEMO"; detectionCount: number; baseline: { baselineType: string; median: number | null; mad: number | null; robustZ: number | null }; timeline: HistoryPoint[]; clusterTimeline: ClusterTimeline[]; message?: string };

const haversineKm = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = Math.PI / 180;
  const x = Math.sin((bLat - aLat) * r / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin((bLon - aLon) * r / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

export function clusterHotspots(hotspots: Hotspot[], radiusKm = 1.5) {
  const cellSize = radiusKm / 111;
  const buckets = new Map<string, Hotspot[]>();
  for (const hotspot of hotspots) {
    const key = `${Math.floor(hotspot.latitude / cellSize)}:${Math.floor(hotspot.longitude / cellSize)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(hotspot); else buckets.set(key, [hotspot]);
  }
  const clusters: Hotspot[][] = [];
  for (const bucket of Array.from(buckets.values())) {
    const localClusters: Hotspot[][] = [];
    for (const hotspot of bucket) {
      const existing = localClusters.find((cluster) => haversineKm(cluster[0].latitude, cluster[0].longitude, hotspot.latitude, hotspot.longitude) <= radiusKm);
      if (existing) existing.push(hotspot); else localClusters.push([hotspot]);
    }
    clusters.push(...localClusters);
  }
  return clusters.map((cluster, index) => {
    const signature = cluster.map((item) => item.id).sort().join("|") || String(index);
    const clusterKey = `cluster-${createHash("sha1").update(signature).digest("hex")}`;
    return { clusterKey, latitude: cluster.reduce((sum, item) => sum + item.latitude, 0) / cluster.length, longitude: cluster.reduce((sum, item) => sum + item.longitude, 0) / cluster.length, detectionCount: cluster.reduce((sum, item) => sum + item.detectionCount, 0), totalFrp: cluster.reduce((sum, item) => sum + (item.frp ?? 0), 0), lastObservedAt: cluster.map((item) => item.observationTime).sort().at(-1) ?? new Date().toISOString(), baselineType: "BASELINE_UNAVAILABLE" as const, robustZ: null };
  });
}

export function robustBaseline(values: number[]) {
  if (values.length < 3) return { baselineType: "BASELINE_UNAVAILABLE" as const, median: null, mad: null, robustZ: null };
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = sorted.map((value) => Math.abs(value - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)];
  const current = sorted.at(-1) ?? median;
  const robustZ = mad === 0 ? (current === median ? 0 : null) : (current - median) / (1.4826 * mad);
  return { baselineType: "SITE_BASELINE" as const, median, mad, robustZ };
}

export function getDemoHistory(hotspot: Hotspot): IncidentHistory {
  const base = hotspot.frp ?? 0;
  const count = Math.max(1, hotspot.detectionCount);
  const timeline = [5, 4, 3, 2, 1, 0].map((daysAgo, index) => ({ label: daysAgo ? `${daysAgo}d` : "now", frp: Number((base * (0.62 + index * 0.075)).toFixed(1)), detections: Math.max(1, Math.round(count * (0.45 + index * 0.11))) }));
  const clusterTimeline = [{ label: "Pass 1", state: "DETECTED", count: Math.max(1, Math.round(count * .35)), note: "Initial thermal footprint" }, { label: "Pass 2", state: "PERSISTENT", count: Math.max(1, Math.round(count * .7)), note: "Repeat observation in cluster" }, { label: "Current", state: hotspot.status.replaceAll("_", " "), count, note: "Seeded scenario status" }];
  return { state: "DEMO", detectionCount: count, baseline: { baselineType: "DEMO_SITE_BASELINE", median: Number((base * .78).toFixed(1)), mad: Number((base * .12).toFixed(1)), robustZ: hotspot.status === "SUSPECTED_UPSET" ? 4.2 : 1.1 }, timeline, clusterTimeline, message: "Illustrative seeded history for demo review; not a live satellite time series." };
}

export async function persistLiveHistory(hotspots: Hotspot[]) {
  const db = await getDb();
  if (!db || hotspots.length === 0) return { persistedDetections: 0, persistedClusters: 0 };
  const detectionRows = hotspots.map((hotspot) => ({ detectionId: hotspot.sourceDetectionId, source: hotspot.source, latitude: hotspot.latitude, longitude: hotspot.longitude, observedAt: new Date(hotspot.observationTime), frp: hotspot.frp, brightnessTemperature: hotspot.brightnessTemperature, confidence: hotspot.confidence, dayNight: hotspot.dayNight, payload: JSON.stringify(hotspot) }));
  for (let start = 0; start < detectionRows.length; start += 250) {
    await db.insert(firmsDetections).values(detectionRows.slice(start, start + 250)).onDuplicateKeyUpdate({ set: { ingestedAt: new Date() } });
  }
  const clusters = clusterHotspots(hotspots);
  for (let start = 0; start < clusters.length; start += 250) {
    const clusterRows = clusters.slice(start, start + 250).map((cluster) => ({ clusterKey: cluster.clusterKey, latitude: cluster.latitude, longitude: cluster.longitude, detectionCount: cluster.detectionCount, totalFrp: cluster.totalFrp, lastObservedAt: new Date(cluster.lastObservedAt), baselineType: cluster.baselineType, robustZ: cluster.robustZ }));
    await db.insert(incidentClusters).values(clusterRows).onDuplicateKeyUpdate({ set: { detectionCount: sql`values(${incidentClusters.detectionCount})`, totalFrp: sql`values(${incidentClusters.totalFrp})`, lastObservedAt: sql`values(${incidentClusters.lastObservedAt})`, updatedAt: new Date() } });
  }
  return { persistedDetections: hotspots.length, persistedClusters: clusters.length };
}

export async function getHistoryForLocation(latitude: number, longitude: number, demoHotspot?: Hotspot): Promise<IncidentHistory> {
  if (demoHotspot) return getDemoHistory(demoHotspot);
  const db = await getDb();
  if (!db) return { state: "UNAVAILABLE", detectionCount: 0, baseline: robustBaseline([]), timeline: [], clusterTimeline: [], message: "Database history is not configured." };
  const rows = await db.select().from(firmsDetections).where(and(eq(firmsDetections.latitude, latitude), eq(firmsDetections.longitude, longitude))).orderBy(desc(firmsDetections.observedAt)).limit(100);
  const values = rows.map((row) => row.frp ?? 0);
  return { state: "AVAILABLE", detectionCount: rows.length, baseline: robustBaseline(values), timeline: rows.slice(0, 12).reverse().map((row, index) => ({ label: `${index + 1}`, frp: row.frp ?? 0, detections: 1 })), clusterTimeline: [], message: rows.length ? undefined : "No persisted FIRMS history for this exact coordinate." };
}

export async function saveOperatorFeedback(input: { hotspotId: string; outcome: "CONFIRMED" | "REJECTED" | "CORRECTED"; comment?: string; userOpenId?: string }) {
  const db = await getDb();
  if (!db) return { state: "UNAVAILABLE" as const, message: "Feedback storage is not configured." };
  await db.insert(operatorFeedback).values({ hotspotId: input.hotspotId, outcome: input.outcome, comment: input.comment ?? null, userOpenId: input.userOpenId ?? "anonymous" });
  return { state: "SAVED" as const };
}

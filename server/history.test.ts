import { describe, expect, it } from "vitest";
import { clusterHotspots, robustBaseline } from "./history";
import type { Hotspot } from "./hotspots";

const sample = (id: string, latitude: number, longitude: number, frp: number): Hotspot => ({
  id,
  latitude,
  longitude,
  site: "test",
  region: "test",
  source: "NASA FIRMS",
  sourceDetectionId: id,
  observationTime: "2026-09-27T00:00:00.000Z",
  ingestedAt: "2026-09-27T00:00:00.000Z",
  frp,
  brightnessTemperature: null,
  confidence: 80,
  confidenceTier: "HIGH",
  satellite: "VIIRS",
  sensor: "VIIRS",
  dayNight: "DAY",
  status: "MONITOR",
  classLabel: "UNCLASSIFIED_INSUFFICIENT_CONTEXT",
  classificationMethod: "TEST",
  isDemo: false,
  detectionCount: 1,
  plume: null,
  evidence: [],
});

describe("FIRMS history helpers", () => {
  it("clusters nearby detections and keeps distant incidents separate", () => {
    const clusters = clusterHotspots([
      sample("a", 19, 73, 10),
      sample("b", 19.005, 73.005, 20),
      sample("c", 22, 75, 30),
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters.find((cluster) => cluster.detectionCount === 2)?.totalFrp).toBe(30);
  });

  it("uses robust median/MAD and does not invent a z-score when MAD is zero", () => {
    expect(robustBaseline([10, 10, 10])).toMatchObject({ baselineType: "SITE_BASELINE", median: 10, mad: 0, robustZ: 0 });
    expect(robustBaseline([10, 12])).toMatchObject({ baselineType: "BASELINE_UNAVAILABLE", robustZ: null });
    expect(robustBaseline([10, 12, 20]).baselineType).toBe("SITE_BASELINE");
  });

  it("keeps cluster keys bounded for large global FIRMS clusters", () => {
    const cluster = clusterHotspots(Array.from({ length: 500 }, (_, index) => sample(`global-${index}`, 19 + index / 100000, 73 + index / 100000, 10)))[0];
    expect(cluster?.clusterKey.length).toBeLessThanOrEqual(191);
  });
});

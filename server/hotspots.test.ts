import { describe, expect, it } from "vitest";
import { getDemoHotspots, normalizeFirmsCsv } from "./hotspots";

describe("hotspot data pipeline", () => {
  it("keeps demo records visibly marked and classified with rule evidence", () => {
    const demos = getDemoHotspots();
    expect(demos.length).toBeGreaterThan(3);
    expect(demos.every((hotspot) => hotspot.isDemo)).toBe(true);
    expect(demos.every((hotspot) => hotspot.classificationMethod === "DEMO_RULES_ONLY")).toBe(true);
    expect(demos.every((hotspot) => hotspot.evidence.length > 0)).toBe(true);
  });

  it("normalizes FIRMS CSV without inventing a cause or plume", () => {
    const csv = [
      "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,frp,daynight",
      "19.0196,73.1144,338.8,0.4,0.5,2026-09-27,1812,N,VIIRS,93,2.0NRT,72.4,N",
    ].join("\n");
    const [hotspot] = normalizeFirmsCsv(csv, "VIIRS_SNPP_NRT");
    expect(hotspot?.isDemo).toBe(false);
    expect(hotspot?.classLabel).toBe("UNCLASSIFIED THERMAL SIGNAL");
    expect(hotspot?.plume).toBeNull();
    expect(hotspot?.frp).toBe(72.4);
    expect(hotspot?.latitude).toBe(19.0196);
  });
});

describe("incident intelligence safeguards", () => {
  it("covers the six canonical demo classes without decorative plumes", () => {
    const labels = new Set(getDemoHotspots().map((hotspot) => hotspot.classLabel));
    expect(labels).toEqual(new Set([
      "UNCONTROLLED_INDUSTRIAL_FIRE",
      "CONTROLLED_FLARE",
      "NORMAL_PERSISTENT_INDUSTRIAL_HEAT",
      "MINING_COAL_SEAM_FIRE",
      "AGRICULTURAL_BURN",
      "WILDFIRE",
      "UNCLASSIFIED_INSUFFICIENT_CONTEXT",
    ]));
    expect(getDemoHotspots().every((hotspot) => hotspot.plume === null)).toBe(true);
  });
});

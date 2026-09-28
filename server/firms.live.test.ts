import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFirmsHotspots } from "./hotspots";

const bbox = { west: 76, south: 12, east: 79, north: 15 };
const csv = [
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,frp,daynight",
  "19.0196,73.1144,338.8,0.4,0.5,2026-09-27,1812,N,VIIRS,93,2.0NRT,72.4,N",
].join("\n");

const originalKey = process.env.FIRMS_MAP_KEY;

describe("NASA FIRMS live path", () => {
  beforeEach(() => {
    process.env.FIRMS_MAP_KEY = "server-only-test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.FIRMS_MAP_KEY;
    else process.env.FIRMS_MAP_KEY = originalKey;
  });

  it("returns NOT_CONFIGURED without making a request when the server key is missing", async () => {
    delete process.env.FIRMS_MAP_KEY;
    const result = await fetchFirmsHotspots({ source: "VIIRS_SNPP_NRT", days: 1, bbox });
    expect(result.state).toBe("NOT_CONFIGURED");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("server-only-test-key");
  });

  it("normalizes a valid CSV response and keeps the key out of the response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(csv, { status: 200 }));
    const result = await fetchFirmsHotspots({ source: "VIIRS_SNPP_NRT", days: 1, bbox });
    expect(result.state).toBe("CONNECTED");
    expect(result.sourceUsed).toBe("VIIRS_SNPP_NRT");
    expect(result.fetchedCount).toBe(1);
    expect(result.normalizedCount).toBe(1);
    expect(result.hotspots[0]?.isDemo).toBe(false);
    expect(result.hotspots[0]?.classLabel).toBe("UNCLASSIFIED THERMAL SIGNAL");
    expect(JSON.stringify(result)).not.toContain("server-only-test-key");
  });

  it("uses a user-entered key for the request without returning or persisting it", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(csv, { status: 200 }));
    const result = await fetchFirmsHotspots({ source: "VIIRS_SNPP_NRT", days: 1, bbox, apiKey: "user-entered-key" });
    expect(result.state).toBe("CONNECTED");
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("user-entered-key");
    expect(JSON.stringify(result)).not.toContain("user-entered-key");
    expect(JSON.stringify(result)).not.toContain("server-only-test-key");
  });

  it("returns NO_DETECTIONS for an empty or header-only CSV without demo fallback", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("latitude,longitude,frp\n", { status: 200 }));
    const result = await fetchFirmsHotspots({ source: "VIIRS_SNPP_NRT", days: 1, bbox });
    expect(result.state).toBe("NO_DETECTIONS");
    expect(result.hotspots).toEqual([]);
    expect(result.fetchedCount).toBe(0);
  });

  it("falls back to the next source when the requested source is unavailable", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("source unavailable", { status: 404 }))
      .mockResolvedValueOnce(new Response(csv, { status: 200 }));
    const result = await fetchFirmsHotspots({ source: "VIIRS_SNPP_NRT", days: 1, bbox });
    expect(result.state).toBe("CONNECTED");
    expect(result.sourceUsed).toBe("VIIRS_NOAA20_NRT");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("returns a safe ERROR for a rejected key response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("invalid MAP_KEY", { status: 403 }));
    const result = await fetchFirmsHotspots({ source: "VIIRS_SNPP_NRT", days: 1, bbox });
    expect(result.state).toBe("ERROR");
    expect(result.message).toContain("NASA FIRMS rejected the configured API key");
    expect(result.message).not.toContain("server-only-test-key");
  });

  it("rejects invalid bounds before making a NASA request", async () => {
    const result = await fetchFirmsHotspots({ source: "VIIRS_SNPP_NRT", days: 1, bbox: { west: 10, south: 20, east: 5, north: 25 } });
    expect(result.state).toBe("ERROR");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

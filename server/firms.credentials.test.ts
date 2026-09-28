import { describe, expect, it } from "vitest";

describe("NASA FIRMS server credential", () => {
  it("is accepted by a lightweight Area CSV request without exposing the key", async () => {
    const apiKey = process.env.FIRMS_MAP_KEY?.trim();
    if (!apiKey) return;

    const endpoint = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(apiKey)}/VIIRS_SNPP_NRT/0,0,0.1,0.1/1`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000), headers: { accept: "text/csv" } });
    const body = await response.text();

    expect([401, 403]).not.toContain(response.status);
    expect(body).not.toContain(apiKey);
    expect(response.status).toBe(200);
  }, 20_000);
});

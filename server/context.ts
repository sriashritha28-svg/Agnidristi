export type NearbyAsset = {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  withinPlanningBuffer: boolean;
};

const haversineKm = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const demoAssetTemplates: Record<string, Array<{ name: string; type: string; distanceKm: number }>> = {
  "DEMO-IND-001": [{ name: "Navi Mumbai process facility", type: "industrial facility", distanceKm: 0.8 }, { name: "Koparkhairane emergency clinic", type: "clinic", distanceKm: 2.4 }],
  "DEMO-IND-002": [{ name: "Ahmedabad refinery corridor", type: "industrial facility", distanceKm: 0.8 }, { name: "Industrial fire station", type: "fire station", distanceKm: 1.7 }],
  "DEMO-MIN-003": [{ name: "Jharia mine operations area", type: "mining facility", distanceKm: 0.6 }, { name: "Dhanbad district hospital", type: "hospital", distanceKm: 3.1 }],
  "DEMO-WLD-004": [{ name: "Central California wildland interface", type: "vegetation context", distanceKm: 1.2 }],
  "DEMO-AGR-005": [{ name: "Punjab cropland context", type: "agricultural land", distanceKm: 0.4 }, { name: "Village primary school", type: "school", distanceKm: 2.1 }],
  "DEMO-UNM-006": [],
  "DEMO-IND-007": [{ name: "Vadodara process heat site", type: "industrial facility", distanceKm: 0.5 }],
};

export function getDemoNearbyAssets(hotspotId: string, latitude: number, longitude: number, radiusMeters: number) {
  const assets = (demoAssetTemplates[hotspotId] ?? []).map((asset, index) => ({ id: `demo-asset-${hotspotId}-${index}`, name: asset.name, type: asset.type, latitude: latitude + (index + 1) * 0.002, longitude: longitude + (index + 1) * 0.002, distanceKm: asset.distanceKm, withinPlanningBuffer: asset.distanceKm * 1000 <= radiusMeters }));
  return { state: "AVAILABLE" as const, assets, message: assets.length ? "Seeded historical context for this demo scenario." : "No mapped facility is included in this seeded scenario." };
}

export async function fetchNearbyAssets(latitude: number, longitude: number, radiusMeters = 1000, hotspotId?: string, isDemo = false) {
  const radius = Math.min(Math.max(radiusMeters, 250), 5000);
  if (isDemo && hotspotId) return getDemoNearbyAssets(hotspotId, latitude, longitude, radius);
  const query = `[out:json][timeout:20];(nwr(around:${radius},${latitude},${longitude})[amenity~"hospital|school|clinic|fire_station"];nwr(around:${radius},${latitude},${longitude})[healthcare];nwr(around:${radius},${latitude},${longitude})[industrial];nwr(around:${radius},${latitude},${longitude})[power];);out center tags;`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22_000);
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query, signal: controller.signal, headers: { "content-type": "text/plain", accept: "application/json" } });
    if (!response.ok) return { state: "UNAVAILABLE" as const, assets: [], message: `Overpass returned HTTP ${response.status}.` };
    const payload = await response.json() as { elements?: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
    const assets: NearbyAsset[] = (payload.elements ?? []).flatMap((element) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat === undefined || lon === undefined) return [];
      const tags = element.tags ?? {};
      const type = tags.amenity || tags.healthcare || tags.power || tags.industrial || "mapped asset";
      const distanceKm = haversineKm(latitude, longitude, lat, lon);
      return [{ id: `osm-${element.id}`, name: tags.name || `${type} / unnamed`, type, latitude: lat, longitude: lon, distanceKm, withinPlanningBuffer: distanceKm * 1000 <= radius }];
    });
    const unique = Array.from(new Map(assets.map((asset) => [asset.id, asset])).values()).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 40);
    return { state: "AVAILABLE" as const, assets: unique, message: unique.length ? undefined : "No mapped assets returned in the selected radius." };
  } catch (error) {
    return { state: "UNAVAILABLE" as const, assets: [], message: error instanceof Error && error.name === "AbortError" ? "Overpass request timed out." : "OpenStreetMap context could not be reached from the server." };
  } finally {
    clearTimeout(timeout);
  }
}

export type SentinelAcquisition = { id: string; date: string; cloudCover: number | null; collection: string; productUrl: string | null };
export type SentinelStatus = { state: "DEMO_CONTEXT" | "NOT_CONFIGURED" | "UNAVAILABLE" | "AVAILABLE"; message: string; acquisitionDate: string | null; cloudCover: number | null; source: "Copernicus Data Space"; acquisitions: SentinelAcquisition[] };

let tokenCache: { token: string; expiresAt: number } | null = null;
async function getCopernicusToken() {
  const clientId = process.env.COPERNICUS_CLIENT_ID?.trim();
  const clientSecret = process.env.COPERNICUS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
  const response = await fetch("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return null;
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) return null;
  tokenCache = { token: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 300) * 1000 };
  return payload.access_token;
}

export async function fetchSentinelAcquisitions(latitude: number, longitude: number): Promise<SentinelStatus> {
  const token = await getCopernicusToken();
  if (!token) return { state: "NOT_CONFIGURED", message: "Live Copernicus lookup requires server-side COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET.", acquisitionDate: null, cloudCover: null, source: "Copernicus Data Space", acquisitions: [] };
  const end = new Date();
  const start = new Date(end.getTime() - 45 * 86_400_000);
  const body = { collections: ["sentinel-2-l2a"], datetime: `${start.toISOString()}/${end.toISOString()}`, intersects: { type: "Point", coordinates: [longitude, latitude] }, limit: 5, fields: { include: ["id", "properties.datetime", "properties.eo:cloud_cover", "links"] } };
  try {
    const response = await fetch("https://stac.dataspace.copernicus.eu/v1/search", { method: "POST", headers: { "content-type": "application/json", accept: "application/geo+json", authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return { state: "UNAVAILABLE", message: `Copernicus STAC returned HTTP ${response.status}.`, acquisitionDate: null, cloudCover: null, source: "Copernicus Data Space", acquisitions: [] };
    const payload = await response.json() as { features?: Array<{ id?: string; properties?: { datetime?: string; "eo:cloud_cover"?: number }; links?: Array<{ rel?: string; href?: string }> }> };
    const acquisitions = (payload.features ?? []).map((feature) => ({ id: feature.id ?? "unknown", date: feature.properties?.datetime ?? "unknown", cloudCover: typeof feature.properties?.["eo:cloud_cover"] === "number" ? feature.properties["eo:cloud_cover"] : null, collection: "sentinel-2-l2a", productUrl: feature.links?.find((link) => link.rel === "self")?.href ?? null }));
    return { state: "AVAILABLE", message: acquisitions.length ? `${acquisitions.length} Sentinel-2 L2A acquisition(s) found in the last 45 days.` : "No Sentinel-2 L2A acquisitions intersected this incident in the last 45 days.", acquisitionDate: acquisitions[0]?.date ?? null, cloudCover: acquisitions[0]?.cloudCover ?? null, source: "Copernicus Data Space", acquisitions };
  } catch (error) {
    return { state: "UNAVAILABLE", message: error instanceof Error && error.name === "TimeoutError" ? "Copernicus STAC lookup timed out." : "Copernicus STAC could not be reached from the server.", acquisitionDate: null, cloudCover: null, source: "Copernicus Data Space", acquisitions: [] };
  }
}

export async function getSentinelStatus(isDemo = false, latitude?: number, longitude?: number, hotspotId?: string): Promise<SentinelStatus> {
  if (isDemo) {
    const profiles: Record<string, { landCover: string; signal: string; cloud: number; offset: number }> = {
      "DEMO-IND-001": { landCover: "industrial / built-up", signal: "persistent high-temperature anomaly", cloud: 8, offset: 2 },
      "DEMO-IND-002": { landCover: "industrial / refinery corridor", signal: "stable process-heat signature", cloud: 14, offset: 4 },
      "DEMO-MIN-003": { landCover: "mining / exposed ground", signal: "persistent seam-fire context", cloud: 21, offset: 1 },
      "DEMO-WLD-004": { landCover: "vegetation / wildland interface", signal: "vegetation-adjacent thermal footprint", cloud: 6, offset: 3 },
      "DEMO-AGR-005": { landCover: "cropland", signal: "low-intensity agricultural-burn context", cloud: 12, offset: 5 },
      "DEMO-UNM-006": { landCover: "mixed / context pending", signal: "thermal signal requires independent verification", cloud: 18, offset: 6 },
      "DEMO-IND-007": { landCover: "industrial / process heat", signal: "repeatable persistent heat context", cloud: 9, offset: 7 },
    };
    const profile = profiles[hotspotId ?? ""] ?? { landCover: "seeded land-cover context", signal: "illustrative corroboration context", cloud: 15, offset: 2 };
    const acquisitions = [0, 1].map((index) => ({ id: `SIM-S2-${hotspotId ?? "DEMO"}-${index + 1}`, date: new Date(Date.now() - (profile.offset + index * 6) * 86_400_000).toISOString(), cloudCover: Math.min(78, profile.cloud + index * 7), collection: "sentinel-2-l2a / SIMULATED", productUrl: null }));
    return { state: "DEMO_CONTEXT", message: `SIMULATED Sentinel-2 context: ${profile.landCover}; ${profile.signal}. These records are illustrative and not live acquisitions.`, acquisitionDate: acquisitions[0].date, cloudCover: acquisitions[0].cloudCover, source: "Copernicus Data Space", acquisitions };
  }
  if (latitude !== undefined && longitude !== undefined && process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET) return fetchSentinelAcquisitions(latitude, longitude);
  return { state: "NOT_CONFIGURED", message: "Live Copernicus lookup requires server-side COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET.", acquisitionDate: null, cloudCover: null, source: "Copernicus Data Space", acquisitions: [] };
}

import { z } from "zod";

export const hotspotInputSchema = z.object({
  id: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  site: z.string(),
  region: z.string(),
  source: z.string(),
  sourceDetectionId: z.string(),
  observationTime: z.string(),
  ingestedAt: z.string(),
  frp: z.number().nullable(),
  brightnessTemperature: z.number().nullable(),
  confidence: z.number().nullable(),
  confidenceTier: z.string(),
  satellite: z.string(),
  sensor: z.string(),
  dayNight: z.string(),
  status: z.string(),
  classLabel: z.string(),
  classificationMethod: z.string(),
  isDemo: z.boolean(),
  detectionCount: z.number(),
  plume: z
    .object({ bearing: z.number(), lengthKm: z.number(), spreadKm: z.number() })
    .nullable(),
  evidence: z.array(z.object({ label: z.string(), value: z.string(), effect: z.string() })),
});

export type Hotspot = z.infer<typeof hotspotInputSchema>;

export const firmsSourceSchema = z.enum(["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]);
export type FirmsSource = z.infer<typeof firmsSourceSchema>;

const observed = (daysAgo: number, hour: number) => {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  date.setUTCHours(hour, 22, 0, 0);
  return date.toISOString();
};

const demoHotspots: Hotspot[] = [
  {
    id: "DEMO-IND-001",
    latitude: 19.0196,
    longitude: 73.1144,
    site: "Navi Mumbai industrial belt",
    region: "Maharashtra, India",
    source: "AGNIDRISHTI SEEDED SCENARIO",
    sourceDetectionId: "DEMO-IND-001-01",
    observationTime: observed(2, 18),
    ingestedAt: observed(2, 18),
    frp: 72.4,
    brightnessTemperature: 338.8,
    confidence: 93,
    confidenceTier: "HIGH",
    satellite: "VIIRS demo pass",
    sensor: "VIIRS",
    dayNight: "NIGHT",
    status: "SUSPECTED_UPSET",
    classLabel: "UNCONTROLLED_INDUSTRIAL_FIRE",
    classificationMethod: "DEMO_RULES_ONLY",
    isDemo: true,
    detectionCount: 12,
    plume: null,
    evidence: [
      { label: "Robust z-score", value: "4.2", effect: "supports anomaly" },
      { label: "FRP", value: "72.4 MW", effect: "supports elevated thermal output" },
      { label: "Detection recurrence", value: "12 pixels / 3 passes", effect: "supports persistence" },
      { label: "Land-cover context", value: "industrial", effect: "reduces wildfire likelihood" },
    ],
  },
  {
    id: "DEMO-IND-002",
    latitude: 23.0365,
    longitude: 72.6502,
    site: "Ahmedabad refinery corridor",
    region: "Gujarat, India",
    source: "AGNIDRISHTI SEEDED SCENARIO",
    sourceDetectionId: "DEMO-IND-002-01",
    observationTime: observed(4, 20),
    ingestedAt: observed(4, 20),
    frp: 18.7,
    brightnessTemperature: 316.2,
    confidence: 88,
    confidenceTier: "HIGH",
    satellite: "VIIRS demo pass",
    sensor: "VIIRS",
    dayNight: "NIGHT",
    status: "NORMAL",
    classLabel: "CONTROLLED_FLARE",
    classificationMethod: "DEMO_RULES_ONLY",
    isDemo: true,
    detectionCount: 31,
    plume: null,
    evidence: [
      { label: "Site baseline", value: "inside expected band", effect: "supports normal" },
      { label: "Persistence", value: "31 detections / 16 days", effect: "supports controlled flare" },
      { label: "Distance to refinery", value: "0.8 km", effect: "supports controlled flare" },
    ],
  },
  {
    id: "DEMO-MIN-003",
    latitude: 23.7946,
    longitude: 86.4304,
    site: "Jharia coal seam zone",
    region: "Jharkhand, India",
    source: "AGNIDRISHTI SEEDED SCENARIO",
    sourceDetectionId: "DEMO-MIN-003-01",
    observationTime: observed(1, 4),
    ingestedAt: observed(1, 4),
    frp: 41.9,
    brightnessTemperature: 326.5,
    confidence: 81,
    confidenceTier: "NOMINAL",
    satellite: "MODIS demo pass",
    sensor: "MODIS",
    dayNight: "DAY",
    status: "ELEVATED",
    classLabel: "MINING_COAL_SEAM_FIRE",
    classificationMethod: "DEMO_RULES_ONLY",
    isDemo: true,
    detectionCount: 8,
    plume: null,
    evidence: [
      { label: "Recurrence", value: "8 detections / 6 days", effect: "supports persistent source" },
      { label: "Footprint drift", value: "0.6 km", effect: "supports expansion" },
      { label: "Land-cover context", value: "mining", effect: "supports mining / coal-seam fire" },
    ],
  },
  {
    id: "DEMO-WLD-004",
    latitude: 36.7783,
    longitude: -119.4179,
    site: "Central California foothills",
    region: "California, United States",
    source: "AGNIDRISHTI SEEDED SCENARIO",
    sourceDetectionId: "DEMO-WLD-004-01",
    observationTime: observed(3, 2),
    ingestedAt: observed(3, 2),
    frp: 29.6,
    brightnessTemperature: 321.4,
    confidence: 77,
    confidenceTier: "NOMINAL",
    satellite: "VIIRS demo pass",
    sensor: "VIIRS",
    dayNight: "NIGHT",
    status: "NOT_APPLICABLE",
    classLabel: "WILDFIRE",
    classificationMethod: "DEMO_RULES_ONLY",
    isDemo: true,
    detectionCount: 5,
    plume: null,
    evidence: [
      { label: "Vegetation context", value: "high", effect: "supports wildfire likelihood" },
      { label: "Cluster footprint", value: "2.8 km", effect: "supports spread" },
      { label: "Industrial context", value: "not detected", effect: "reduces industrial source likelihood" },
    ],
  },
  {
    id: "DEMO-AGR-005",
    latitude: 30.7333,
    longitude: 76.7794,
    site: "Punjab agricultural burn belt",
    region: "Punjab, India",
    source: "AGNIDRISHTI SEEDED SCENARIO",
    sourceDetectionId: "DEMO-AGR-005-01",
    observationTime: observed(5, 12),
    ingestedAt: observed(5, 12),
    frp: 11.2,
    brightnessTemperature: 309.8,
    confidence: 69,
    confidenceTier: "NOMINAL",
    satellite: "VIIRS demo pass",
    sensor: "VIIRS",
    dayNight: "DAY",
    status: "NOT_APPLICABLE",
    classLabel: "AGRICULTURAL_BURN",
    classificationMethod: "DEMO_RULES_ONLY",
    isDemo: true,
    detectionCount: 4,
    plume: null,
    evidence: [
      { label: "Land-cover context", value: "cropland", effect: "supports agricultural burn" },
      { label: "FRP", value: "11.2 MW", effect: "supports low-intensity signal" },
    ],
  },
  {
    id: "DEMO-UNM-006",
    latitude: -1.2864,
    longitude: 36.8172,
    site: "Nairobi unmapped thermal source",
    region: "Nairobi, Kenya",
    source: "AGNIDRISHTI SEEDED SCENARIO",
    sourceDetectionId: "DEMO-UNM-006-01",
    observationTime: observed(6, 22),
    ingestedAt: observed(6, 22),
    frp: 53.8,
    brightnessTemperature: 332.2,
    confidence: 86,
    confidenceTier: "HIGH",
    satellite: "VIIRS demo pass",
    sensor: "VIIRS",
    dayNight: "NIGHT",
    status: "ELEVATED",
    classLabel: "UNCLASSIFIED_INSUFFICIENT_CONTEXT",
    classificationMethod: "DEMO_RULES_ONLY",
    isDemo: true,
    detectionCount: 7,
    plume: null,
    evidence: [
      { label: "FRP", value: "53.8 MW", effect: "supports high thermal output" },
      { label: "Facility context", value: "unavailable", effect: "classification pending" },
      { label: "Recurrence", value: "7 detections / 10 days", effect: "supports repeat source" },
    ],
  },
  {
    id: "DEMO-IND-007",
    latitude: 22.3072,
    longitude: 73.1812,
    site: "Vadodara process heat site",
    region: "Gujarat, India",
    source: "AGNIDRISHTI SEEDED SCENARIO",
    sourceDetectionId: "DEMO-IND-007-01",
    observationTime: observed(7, 19),
    ingestedAt: observed(7, 19),
    frp: 14.9,
    brightnessTemperature: 314.7,
    confidence: 84,
    confidenceTier: "HIGH",
    satellite: "VIIRS demo pass",
    sensor: "VIIRS",
    dayNight: "NIGHT",
    status: "NORMAL",
    classLabel: "NORMAL_PERSISTENT_INDUSTRIAL_HEAT",
    classificationMethod: "DEMO_RULES_ONLY",
    isDemo: true,
    detectionCount: 24,
    plume: null,
    evidence: [
      { label: "Site baseline", value: "inside expected band", effect: "supports normal" },
      { label: "Persistence", value: "24 detections / 12 days", effect: "supports persistent industrial heat" },
      { label: "Land-cover context", value: "industrial", effect: "supports industrial source" },
    ],
  },
];

export function getDemoHotspots() {
  return demoHotspots;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value.trim());
      value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      value += char;
    }
  }
  if (value.length || row.length) {
    row.push(value.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

const num = (value: string | undefined) => {
  if (!value || value === "null" || value === "NA") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const safeObservationTime = (date?: string, time?: string) => {
  if (!date) return new Date().toISOString();
  const hhmm = (time ?? "0000").padStart(4, "0");
  const parsed = new Date(`${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

export function normalizeFirmsCsv(csv: string, source: FirmsSource): Hotspot[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).toLowerCase().trim());
  const seen = new Set<string>();
  return rows.slice(1).flatMap((values) => {
    const raw = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]));
    const latitude = num(raw.latitude);
    const longitude = num(raw.longitude);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    const sourceDetectionId = [source, raw.acq_date || "unknown", raw.acq_time || "unknown", raw.satellite || "unknown", raw.instrument || "unknown", raw.version || "unknown", raw.scan || "unknown", raw.track || "unknown", latitude.toFixed(4), longitude.toFixed(4)].join("|");
    if (seen.has(sourceDetectionId)) return [];
    seen.add(sourceDetectionId);
    const observationTime = safeObservationTime(raw.acq_date, raw.acq_time);
    const confidence = num(raw.confidence);
    const frp = num(raw.frp);
    return [{
      id: sourceDetectionId,
      latitude,
      longitude,
      site: "Unresolved FIRMS detection",
      region: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
      source: `NASA FIRMS / ${source}`,
      sourceDetectionId,
      observationTime,
      ingestedAt: new Date().toISOString(),
      frp,
      brightnessTemperature: num(raw.bright_ti4) ?? num(raw.bright_ti5),
      confidence,
      confidenceTier: confidence === null ? "UNAVAILABLE" : confidence >= 80 ? "HIGH" : confidence >= 50 ? "NOMINAL" : "LOW",
      satellite: raw.satellite || "UNAVAILABLE",
      sensor: raw.instrument || "UNAVAILABLE",
      dayNight: raw.daynight || "UNAVAILABLE",
      status: "MONITOR",
      classLabel: "UNCLASSIFIED THERMAL SIGNAL",
      classificationMethod: "UNAVAILABLE",
      isDemo: false,
      detectionCount: 1,
      plume: null,
      evidence: [
        { label: "Source", value: "NASA FIRMS", effect: "near-real-time thermal detection" },
        { label: "Cause", value: "not determined", effect: "independent verification required" },
      ],
    } satisfies Hotspot];
  });
}

type FirmsBbox = { west: number; south: number; east: number; north: number };
type FirmsFetchInput = { source: FirmsSource; days: number; bbox: FirmsBbox; apiKey?: string };
type FirmsState = "CONNECTED" | "NOT_CONFIGURED" | "ERROR" | "NO_DETECTIONS";
export type FirmsFetchResult = {
  state: FirmsState;
  hotspots: Hotspot[];
  message?: string;
  sourceRequested: FirmsSource;
  sourceUsed: FirmsSource | null;
  bbox: FirmsBbox;
  days: number;
  httpStatus: number | null;
  fetchedCount: number;
  normalizedCount: number;
  clusteredCount: number;
  classifiedCount: number;
  renderedCount: number;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
};

const fallbackSources: FirmsSource[] = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"];
const validBbox = (bbox: FirmsBbox) => Number.isFinite(bbox.west) && Number.isFinite(bbox.south) && Number.isFinite(bbox.east) && Number.isFinite(bbox.north) && bbox.west >= -180 && bbox.east <= 180 && bbox.south >= -90 && bbox.north <= 90 && bbox.west < bbox.east && bbox.south < bbox.north;
const safeBbox = (bbox: FirmsBbox) => `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;

function baseFirmsResult(input: FirmsFetchInput, state: FirmsState, message?: string): FirmsFetchResult {
  return { state, hotspots: [], message, sourceRequested: input.source, sourceUsed: null, bbox: input.bbox, days: input.days, httpStatus: null, fetchedCount: 0, normalizedCount: 0, clusteredCount: 0, classifiedCount: 0, renderedCount: 0, lastAttemptAt: new Date().toISOString(), lastSuccessAt: null };
}

function safeBodyCategory(body: string) {
  const trimmed = body.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) return "EMPTY" as const;
  if (lower.includes("<html") || lower.startsWith("<!doctype")) return "HTML_ERROR" as const;
  if (lower.includes("invalid map_key") || lower.includes("invalid map key") || lower.includes("unauthorized") || lower.includes("forbidden")) return "KEY_REJECTED" as const;
  return "CSV" as const;
}

async function requestFirmsCsv(apiKey: string, source: FirmsSource, bbox: FirmsBbox, days: number) {
  // FIRMS uses commas as delimiters inside this already validated numeric path segment.
  const endpoint = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(apiKey)}/${encodeURIComponent(source)}/${safeBbox(bbox)}/${days}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: "text/csv" } });
      const body = await response.text();
      const category = safeBodyCategory(body);
      if (response.status === 401 || response.status === 403 || category === "KEY_REJECTED") return { kind: "KEY_REJECTED" as const, status: response.status, body: "" };
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt === 0 && (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500)) continue;
        return { kind: "SOURCE_ERROR" as const, status: response.status, body: "" };
      }
      if (category === "HTML_ERROR") return { kind: "SOURCE_ERROR" as const, status: response.status, body: "" };
      return { kind: "CSV" as const, status: response.status, body };
    } catch (error) {
      lastError = error;
      if (attempt === 0) continue;
    } finally {
      clearTimeout(timeout);
    }
  }
  return { kind: "NETWORK_ERROR" as const, status: null, body: "", error: lastError };
}

export async function fetchFirmsHotspots(input: FirmsFetchInput): Promise<FirmsFetchResult> {
  const normalizedInput = { ...input, days: Math.round(input.days) };
  if (!validBbox(input.bbox) || normalizedInput.days < 1 || normalizedInput.days > 10) return baseFirmsResult(normalizedInput, "ERROR", "NASA FIRMS request failed. Check source, area, date range, network availability, and server logs.");
  const apiKey = input.apiKey?.trim() || process.env.FIRMS_MAP_KEY?.trim();
  if (!apiKey) return baseFirmsResult(normalizedInput, "NOT_CONFIGURED", "NASA FIRMS MAP_KEY is not configured on the server.");

  const candidates = [input.source, ...fallbackSources.filter((source) => source !== input.source)];
  let lastStatus: number | null = null;
  for (const source of candidates) {
    const response = await requestFirmsCsv(apiKey, source, input.bbox, normalizedInput.days);
    lastStatus = response.status;
    if (response.kind === "KEY_REJECTED") return { ...baseFirmsResult(normalizedInput, "ERROR", "NASA FIRMS rejected the configured API key. Verify the key in server environment settings."), httpStatus: response.status };
    if (response.kind !== "CSV") continue;
    const rows = parseCsv(response.body);
    const fetchedCount = Math.max(0, rows.length - 1);
    const hotspots = normalizeFirmsCsv(response.body, source);
    const now = new Date().toISOString();
    if (!hotspots.length) return { ...baseFirmsResult(normalizedInput, "NO_DETECTIONS", "No FIRMS detections returned for the selected area and time range."), sourceUsed: source, httpStatus: response.status, fetchedCount, normalizedCount: 0, lastAttemptAt: now, lastSuccessAt: now };
    const renderedHotspots = hotspots.length > 2000 ? [...hotspots].sort((a, b) => (b.frp ?? 0) - (a.frp ?? 0)).slice(0, 2000) : hotspots;
    return { ...baseFirmsResult(normalizedInput, "CONNECTED"), hotspots: renderedHotspots, sourceUsed: source, httpStatus: response.status, fetchedCount, normalizedCount: hotspots.length, renderedCount: renderedHotspots.length, lastAttemptAt: now, lastSuccessAt: now };
  }
  return { ...baseFirmsResult(normalizedInput, "ERROR", "NASA FIRMS request failed. Check source, area, date range, network availability, and server logs."), httpStatus: lastStatus };
}

export type WindObservation = {
  state: "AVAILABLE" | "UNAVAILABLE";
  speedKmh: number | null;
  directionDeg: number | null;
  observedAt: string | null;
  source: "Open-Meteo";
  freshness: "current" | "unavailable";
  message?: string;
};

export function getDemoWindObservation(hotspotId: string): WindObservation {
  const presets: Record<string, { speedKmh: number; directionDeg: number }> = { "DEMO-IND-001": { speedKmh: 12, directionDeg: 245 }, "DEMO-IND-002": { speedKmh: 8, directionDeg: 310 }, "DEMO-MIN-003": { speedKmh: 10, directionDeg: 95 }, "DEMO-WLD-004": { speedKmh: 18, directionDeg: 275 }, "DEMO-AGR-005": { speedKmh: 14, directionDeg: 40 }, "DEMO-UNM-006": { speedKmh: 6, directionDeg: 180 }, "DEMO-IND-007": { speedKmh: 7, directionDeg: 220 } };
  const preset = presets[hotspotId] ?? { speedKmh: 9, directionDeg: 180 };
  return { state: "AVAILABLE", speedKmh: preset.speedKmh, directionDeg: preset.directionDeg, observedAt: new Date().toISOString(), source: "Open-Meteo", freshness: "current", message: "Illustrative seeded wind for demo plume rendering." };
}

export async function fetchWindObservation(latitude: number, longitude: number, hotspotId?: string, isDemo = false): Promise<WindObservation> {
  if (isDemo && hotspotId) return getDemoWindObservation(hotspotId);
  const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current=wind_speed_10m,wind_direction_10m&timezone=UTC`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) return { state: "UNAVAILABLE", speedKmh: null, directionDeg: null, observedAt: null, source: "Open-Meteo", freshness: "unavailable", message: "Open-Meteo did not return a successful response." };
    const payload = await response.json() as { current?: { time?: string; wind_speed_10m?: number; wind_direction_10m?: number } };
    const speed = payload.current?.wind_speed_10m;
    const direction = payload.current?.wind_direction_10m;
    if (typeof speed !== "number" || typeof direction !== "number") return { state: "UNAVAILABLE", speedKmh: null, directionDeg: null, observedAt: null, source: "Open-Meteo", freshness: "unavailable", message: "Wind fields were unavailable for this location." };
    return { state: "AVAILABLE", speedKmh: speed, directionDeg: direction, observedAt: payload.current?.time ?? new Date().toISOString(), source: "Open-Meteo", freshness: "current" };
  } catch (error) {
    return { state: "UNAVAILABLE", speedKmh: null, directionDeg: null, observedAt: null, source: "Open-Meteo", freshness: "unavailable", message: error instanceof Error && error.name === "AbortError" ? "Wind request timed out." : "Wind data could not be reached from the server." };
  } finally {
    clearTimeout(timeout);
  }
}

# FIRMS live integration diagnosis

- **Key missing from server runtime:** `FIRMS_MAP_KEY` is not configured in the current sandbox environment; the app therefore reports not configured. The browser currently asks for a key and sends it as `apiKey` in the tRPC mutation, which violates the server-owned secret requirement.
- **Runtime:** the FIRMS request runs server-side in `server/hotspots.ts`, but it currently uses the browser-supplied `apiKey`; `process.env.FIRMS_MAP_KEY` is only used by `hotspots.liveStatus` for the readiness badge.
- **Endpoint:** current shape is `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{encoded key}/{source}/{west,south,east,north}/{days}`. It uses a global bbox `-180,-60,180,75`, the user-selected source, and 2 default days. The endpoint shape is valid, but there is no fallback source strategy, bounds validation beyond the tRPC field ranges, retry, or structured response diagnostics.
- **Parsing:** CSV is read as text and normalized by `normalizeFirmsCsv`; header-only/empty/HTML/error bodies are not distinguished. Detection identity includes row index, so deduplication is not stable across repeated fetches.
- **Downstream:** live records are normalized but remain `UNCLASSIFIED THERMAL SIGNAL`; the existing persistence call runs, while the client renders them from `liveHotspots`. The live filter is available, but current fetch failures/empty results do not expose enough status detail to distinguish hidden records from no detections.
- **UI issue:** the key input is mandatory in the browser, so a configured server key would still not be used by `fetchLive`. The current source selector omits `VIIRS_NOAA21_NRT` and there is no optional fit-live action.
- **Scope:** only `server/hotspots.ts`, `server/routers.ts`, targeted FIRMS tests, `.env.example`, and the existing live configuration/status section in `Home.tsx` should change. Demo data, map styling/layers, incident panel, EAP, plume controls, schema, and unrelated integrations remain untouched.


## Secret documentation

The required server-side placeholder is:

```text
FIRMS_MAP_KEY=your_nasa_firms_map_key_here
```

The WebDev environment prevents direct edits to `.env.example`; the actual `FIRMS_MAP_KEY` is configured through the project secret store instead.

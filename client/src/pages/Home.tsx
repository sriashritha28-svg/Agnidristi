import { useEffect, useMemo, useRef, useState } from "react";
import type { Hotspot, WindObservation } from "../../../server/hotspots";
import IncidentPanel from "@/components/IncidentPanel";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Crosshair,
  Database,
  Eye,
  Flame,
  Layers3,
  LocateFixed,
  Map as MapIcon,
  Menu,
  Moon,
  Navigation,
  RadioTower,
  RefreshCw,
  Satellite,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wind,
  X,
} from "lucide-react";

const statusColor: Record<string, string> = {
  SUSPECTED_UPSET: "#ff4d3d",
  ELEVATED: "#ff9f43",
  NORMAL: "#32d583",
  MONITOR: "#f6c453",
};

const classAccent: Record<string, string> = {
  UNCONTROLLED_INDUSTRIAL_FIRE: "#DC2626",
  CONTROLLED_FLARE: "#F97316",
  NORMAL_PERSISTENT_INDUSTRIAL_HEAT: "#EAB308",
  MINING_COAL_SEAM_FIRE: "#7C3AED",
  AGRICULTURAL_BURN: "#A16207",
  WILDFIRE: "#16A34A",
  UNCLASSIFIED_INSUFFICIENT_CONTEXT: "#64748B",
  "UNCLASSIFIED THERMAL SIGNAL": "#64748B",
};

const formatDate = (value: string) => new Date(value).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const formatNumber = (value: number | null) => value === null ? "—" : value.toFixed(1);

function MapCanvas({ hotspots, selectedId, mapStyle, showPlume, selectedWind, driftHours, bufferRadius, nearbyAssets, onSelect, onReset, onFitAll, fitToken }: {
  hotspots: Hotspot[];
  selectedId?: string;
  mapStyle: "street" | "dark" | "satellite";
  showPlume: boolean;
  selectedWind?: WindObservation;
  driftHours: number;
  bufferRadius: number;
  nearbyAssets: Array<{ id: string; name: string; type: string; latitude: number; longitude: number; distanceKm: number; withinPlanningBuffer: boolean }>;
  onSelect: (hotspot: Hotspot) => void;
  onReset: () => void;
  onFitAll: () => void;
  fitToken: number;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!nodeRef.current) return;
    const map = L.map(nodeRef.current, { zoomControl: false, minZoom: 2, maxZoom: 16, worldCopyJump: true }).setView([18, 25], 2);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const tiles: Record<string, L.TileLayer> = {
      street: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }),
      dark: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", className: "dark-map-tiles" }),
      satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Tiles © Esri" }),
    };
    tiles[mapStyle].addTo(map);
    overlayRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setReady(true);
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => { window.clearTimeout(timer); map.remove(); mapRef.current = null; overlayRef.current = null; setReady(false); };
  }, [mapStyle]);

  useEffect(() => {
    if (!ready || !overlayRef.current || !mapRef.current) return;
    overlayRef.current.clearLayers();
    const map = mapRef.current;
    hotspots.forEach((hotspot) => {
      const accent = classAccent[hotspot.classLabel] ?? "#63d5ff";
      const selected = hotspot.id === selectedId;
      const icon = L.divIcon({
        className: "hotspot-icon-shell",
        html: `<button class="hotspot-marker ${selected ? "is-selected" : ""}" style="--marker-color:${accent};--status-color:${statusColor[hotspot.status] ?? "#64748B"}" aria-label="Open ${hotspot.site}"><span class="hotspot-pulse"></span><span class="hotspot-core"></span></button>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker([hotspot.latitude, hotspot.longitude], { icon, keyboard: true });
      marker.on("click", () => {
        map.flyTo([hotspot.latitude, hotspot.longitude], 14, { duration: 0.85, easeLinearity: 0.18 });
        onSelect(hotspot);
      });
      marker.bindTooltip(`<strong>${hotspot.site}</strong><br/>${hotspot.classLabel}`, { direction: "top", offset: [0, -14], className: "hotspot-tooltip" });
      marker.addTo(overlayRef.current!);
      if (selected) {
        L.circle([hotspot.latitude, hotspot.longitude], { radius: bufferRadius, color: accent, weight: 2, opacity: 0.9, fillColor: accent, fillOpacity: 0.13, dashArray: "5 6" }).addTo(overlayRef.current!);
      }
      if (selected && nearbyAssets.length) {
        nearbyAssets.forEach((asset) => {
          const assetMarker = L.circleMarker([asset.latitude, asset.longitude], { radius: 5, color: "#d9f3ff", weight: 1, fillColor: asset.withinPlanningBuffer ? "#ffbf5f" : "#63d5ff", fillOpacity: 0.9 });
          assetMarker.bindTooltip(`<strong>${asset.name}</strong><br/>${asset.type} · ${asset.distanceKm.toFixed(2)} km`, { direction: "top", className: "asset-tooltip" });
          assetMarker.addTo(overlayRef.current!);
        });
      }
      if (selected && showPlume && selectedWind?.state === "AVAILABLE" && selectedWind.directionDeg !== null && selectedWind.speedKmh !== null) {
        const downwind = ((selectedWind.directionDeg + 180) % 360) * Math.PI / 180;
        const reach = Math.max(0.7, selectedWind.speedKmh * driftHours / 111);
        const side = Math.max(0.12, reach * 0.28);
        const tip: L.LatLngExpression = [hotspot.latitude + Math.cos(downwind) * reach, hotspot.longitude + Math.sin(downwind) * reach];
        const left: L.LatLngExpression = [hotspot.latitude + Math.cos(downwind - Math.PI / 2) * side, hotspot.longitude + Math.sin(downwind - Math.PI / 2) * side];
        const right: L.LatLngExpression = [hotspot.latitude + Math.cos(downwind + Math.PI / 2) * side, hotspot.longitude + Math.sin(downwind + Math.PI / 2) * side];
        L.polygon([left, tip, right], { color: "#63d5ff", weight: 1, opacity: 0.85, fillColor: "#63d5ff", fillOpacity: 0.14, dashArray: "4 5" }).addTo(overlayRef.current!);
        L.polyline([[hotspot.latitude, hotspot.longitude], tip], { color: "#8ae7ff", weight: 2, opacity: 0.75, dashArray: "5 7" }).addTo(overlayRef.current!);
      }
    });
  }, [hotspots, selectedId, showPlume, selectedWind, driftHours, bufferRadius, nearbyAssets, ready, onSelect]);

  useEffect(() => {
    if (!fitToken || !mapRef.current || !selectedId) return;
    const hotspot = hotspots.find((item) => item.id === selectedId);
    if (hotspot) mapRef.current.flyTo([hotspot.latitude, hotspot.longitude], 14, { duration: 0.85, easeLinearity: 0.18 });
  }, [fitToken, hotspots, selectedId]);

  return <div className="map-stage"><div ref={nodeRef} className="map-canvas" /><div className="map-tools"><button className="map-reset" onClick={() => { onReset(); mapRef.current?.setView([18, 25], 2); }} title="Reset global view"><Crosshair size={15} /> Reset view</button><button className="map-reset" onClick={onFitAll} title="Fit all incidents"><LocateFixed size={15} /> Fit all</button></div><div className="map-grid-label">FIRMS / GLOBAL VIEW</div></div>;
}

function StatCard({ label, value, detail, tone = "cyan" }: { label: string; value: string; detail: string; tone?: "cyan" | "orange" | "red" | "green" }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}

export default function Home() {
  const { data: demoHotspots = [], isLoading: demoLoading } = trpc.hotspots.demo.useQuery();
  const { data: liveStatus } = trpc.hotspots.liveStatus.useQuery();
  const liveFetch = trpc.hotspots.fetchLive.useMutation();
  const [mode, setMode] = useState<"demo" | "live" | "all">("demo");
  const [liveHotspots, setLiveHotspots] = useState<Hotspot[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [mapStyle, setMapStyle] = useState<"street" | "dark" | "satellite">("dark");
  const [showPlume, setShowPlume] = useState(true);
  const [bufferRadius, setBufferRadius] = useState(250);
  const [driftHours, setDriftHours] = useState(1);
  const [source, setSource] = useState("VIIRS_SNPP_NRT");
  const [days, setDays] = useState("1");
  const [firmsApiKey, setFirmsApiKey] = useState("");
  const [search, setSearch] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [fitToken, setFitToken] = useState(0);

  const allVisible = useMemo(() => {
    const sourceSet = mode === "demo" ? demoHotspots : mode === "live" ? liveHotspots : [...demoHotspots, ...liveHotspots];
    const needle = search.trim().toLowerCase();
    return sourceSet.filter((hotspot) => !needle || `${hotspot.site} ${hotspot.region} ${hotspot.classLabel}`.toLowerCase().includes(needle));
  }, [demoHotspots, liveHotspots, mode, search]);

  const renderedHotspots = useMemo(() => {
    if (allVisible.length <= 2000) return allVisible;
    const ranked = [...allVisible].sort((a, b) => (b.frp ?? 0) - (a.frp ?? 0));
    const selectedForMap = ranked.find((hotspot) => hotspot.id === selectedId);
    const topSignals = ranked.slice(0, 2000);
    if (selectedForMap && !topSignals.some((hotspot) => hotspot.id === selectedForMap.id)) topSignals[topSignals.length - 1] = selectedForMap;
    return topSignals;
  }, [allVisible, selectedId]);

  const selected = allVisible.find((hotspot) => hotspot.id === selectedId);
  const windInput = useMemo(() => selected ? { latitude: selected.latitude, longitude: selected.longitude, hotspotId: selected.id, isDemo: selected.isDemo } : { latitude: 0, longitude: 0, isDemo: false }, [selected]);
  const { data: selectedWind } = trpc.hotspots.wind.useQuery(windInput, { enabled: Boolean(selected), staleTime: 300_000 });
  const contextInput = useMemo(() => selected ? { latitude: selected.latitude, longitude: selected.longitude, radiusMeters: 1000, hotspotId: selected.id, isDemo: selected.isDemo } : { latitude: 0, longitude: 0, radiusMeters: 1000, isDemo: false }, [selected]);
  const { data: nearbyContext } = trpc.context.nearbyAssets.useQuery(contextInput, { enabled: Boolean(selected), staleTime: 300_000 });
  const historyInput = useMemo(() => selected ? { latitude: selected.latitude, longitude: selected.longitude, hotspotId: selected.id, isDemo: selected.isDemo } : { latitude: 0, longitude: 0, isDemo: false }, [selected]);
  const { data: historyContext } = trpc.history.forLocation.useQuery(historyInput, { enabled: Boolean(selected), staleTime: 600_000 });
  const sentinelInput = useMemo(() => selected ? ({ isDemo: selected.isDemo, latitude: selected.latitude, longitude: selected.longitude, hotspotId: selected.id }) : ({ isDemo: false }), [selected]);
  const { data: sentinelStatus } = trpc.sentinel.status.useQuery(sentinelInput, { enabled: Boolean(selected), staleTime: 600_000 });

  useEffect(() => {
    if (!selected && selectedId) setSelectedId(undefined);
  }, [selected, selectedId]);

  const highCount = allVisible.filter((hotspot) => hotspot.status === "SUSPECTED_UPSET").length;
  const elevatedCount = allVisible.filter((hotspot) => hotspot.status === "ELEVATED").length;
  const totalMw = allVisible.reduce((sum, hotspot) => sum + (hotspot.frp ?? 0), 0);

  const handleLiveFetch = () => {
    const apiKey = firmsApiKey.trim();
    liveFetch.mutate({ source: source as "VIIRS_SNPP_NRT" | "VIIRS_NOAA20_NRT" | "VIIRS_NOAA21_NRT" | "MODIS_NRT", days: Number(days), bbox: { west: -180, south: -60, east: 180, north: 75 }, ...(apiKey ? { apiKey } : {}) }, {
      onSuccess: (result) => {
        setLiveHotspots(result.hotspots);
        setMode("live");
        if (result.state === "CONNECTED" || result.state === "NO_DETECTIONS") toast.success(result.hotspots.length ? `${result.hotspots.length} FIRMS detections loaded` : "FIRMS returned no detections");
        else toast.error(result.message ?? "FIRMS fetch did not complete");
      },
      onError: () => toast.error("The secure FIRMS request could not be completed"),
    });
  };

  const resetView = () => { setSelectedId(undefined); setDetailOpen(false); };
  const fitAll = () => { setSelectedId(undefined); setDetailOpen(false); };
  const activeModeLabel = mode === "demo" ? "DEMO / SEEDED HISTORICAL DATA" : mode === "live" ? "LIVE / NASA FIRMS" : "ALL SOURCES / FILTERED";

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><Flame size={18} fill="currentColor" /></div><div><div className="brand-name">AGNIDRISHTI</div><div className="brand-tagline">THERMAL INTELLIGENCE / EARLY WARNING</div></div></div>
      <div className="topbar-center"><span className="live-dot" /> <span>OPERATIONS CONSOLE</span><span className="topbar-divider" /> <span className="topbar-muted">GLOBAL / 24 HR VIEW</span></div>
      <div className="top-actions"><div className="server-status"><span className={`status-orb ${liveStatus?.configured ? "is-ready" : ""}`} /> {liveStatus?.configured ? "FIRMS READY" : "FIRMS NOT CONFIGURED"}</div><button className="icon-button" title="Open navigation"><Menu size={18} /></button></div>
    </header>

    <main className="workspace">
      <aside className={`control-rail ${leftOpen ? "is-open" : "is-collapsed"}`}>
        <button className="rail-collapse" onClick={() => setLeftOpen(!leftOpen)} title={leftOpen ? "Collapse controls" : "Open controls"}>{leftOpen ? <ChevronDown size={16} className="rotate-90" /> : <SlidersHorizontal size={16} />}</button>
        {leftOpen && <div className="rail-content">
          <div className="rail-heading"><div><span className="eyebrow">MISSION CONTROL</span><h1>Thermal overview</h1></div><div className="system-pip"><span />NOMINAL</div></div>
          <div className="source-badge"><Database size={14} /><span>{activeModeLabel}</span></div>

          <div className="rail-section"><div className="section-label">DATA SOURCE</div><div className="segmented-control"><button className={mode === "demo" ? "active" : ""} onClick={() => setMode("demo")}>Demo <span>{demoHotspots.length}</span></button><button className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>Live <span>{liveHotspots.length}</span></button><button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>All</button></div><p className="rail-note">Demo records are historical and persistently labelled. Live records never fall back to demo markers.</p></div>

          <div className="rail-section"><div className="section-label">SEARCH EVENTS</div><div className="field-with-icon"><Search size={15} /><input placeholder="Site, region, class..." value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button onClick={() => setSearch("")}><X size={13} /></button>}</div></div>

          <div className="rail-section"><div className="section-label">BASEMAP</div><div className="layer-grid"><button className={mapStyle === "street" ? "layer-option active" : "layer-option"} onClick={() => setMapStyle("street")}><MapIcon size={16} /><span>Street</span></button><button className={mapStyle === "dark" ? "layer-option active" : "layer-option"} onClick={() => setMapStyle("dark")}><Moon size={16} /><span>Dark</span></button><button className={mapStyle === "satellite" ? "layer-option active" : "layer-option"} onClick={() => setMapStyle("satellite")}><Satellite size={16} /><span>Satellite</span></button></div></div>

          <div className="rail-section"><div className="section-label">DISPLAY LAYERS</div><label className="toggle-row"><span><Wind size={15} /> Smoke drift (wind-backed)</span><button className={`toggle ${showPlume ? "on" : ""}`} onClick={() => setShowPlume(!showPlume)} aria-label="Toggle smoke drift"><span /></button></label><label className="toggle-row"><span><Building2 size={15} /> Facilities context</span><span className="context-tag">ON SELECT</span></label><label className="toggle-row"><span><Navigation size={15} /> Wind field</span><span className="unavailable-tag">NOT CONFIGURED</span></label></div>

          <div className="rail-section live-config"><div className="section-label"><span>LIVE FIRMS CONFIGURATION</span><ShieldCheck size={13} /></div><div className={`server-secret-state ${liveStatus?.configured ? "is-ready" : ""}`}><span className="status-orb" /> {liveStatus?.configured ? "Server MAP_KEY configured" : "Server MAP_KEY not configured"}</div><label className="api-key-label" htmlFor="firms-api-key">NASA FIRMS MAP_KEY <span>optional override</span></label><input id="firms-api-key" className="api-input" type="password" autoComplete="off" spellCheck={false} placeholder="Paste MAP_KEY for this session" value={firmsApiKey} onChange={(event) => setFirmsApiKey(event.target.value)} /><p className="api-key-hint">Used only for this fetch; never saved or shown in status.</p><div className="input-row"><select value={source} onChange={(event) => setSource(event.target.value)}><option value="VIIRS_SNPP_NRT">VIIRS SNPP NRT</option><option value="VIIRS_NOAA20_NRT">VIIRS NOAA-20 NRT</option><option value="VIIRS_NOAA21_NRT">VIIRS NOAA-21 NRT</option><option value="MODIS_NRT">MODIS NRT</option></select><select value={days} onChange={(event) => setDays(event.target.value)}><option value="1">1 day</option><option value="2">2 days</option><option value="5">5 days</option><option value="10">10 days</option></select></div><button className="primary-action" onClick={handleLiveFetch} disabled={liveFetch.isPending || (!liveStatus?.configured && !firmsApiKey.trim())}><RadioTower size={15} />{liveFetch.isPending ? "Fetching secure feed..." : "Refresh live FIRMS data"}<ArrowUpRight size={15} /></button><p className="secure-note"><ShieldCheck size={12} /> Your key is sent over HTTPS to NASA through the server and is not stored. The server key remains the fallback.</p></div>

          <details className="live-status-card" open><summary className="section-label"><span>LIVE FIRMS STATUS</span><Activity size={13} /></summary><div className="live-status-grid"><span>State</span><strong>{liveFetch.data?.state ?? (liveStatus?.configured ? "CONNECTED" : "NOT_CONFIGURED")}</strong><span>Last attempt</span><strong>{liveFetch.data?.lastAttemptAt ? formatDate(liveFetch.data.lastAttemptAt) : "—"}</strong><span>Last success</span><strong>{liveFetch.data?.lastSuccessAt ? formatDate(liveFetch.data.lastSuccessAt) : "—"}</strong><span>Source requested</span><strong>{liveFetch.data?.sourceRequested ?? source}</strong><span>Source used</span><strong>{liveFetch.data?.sourceUsed ?? "—"}</strong><span>HTTP</span><strong>{liveFetch.data?.httpStatus ?? "—"}</strong><span>Fetched</span><strong>{liveFetch.data?.fetchedCount ?? 0}</strong><span>Normalized</span><strong>{liveFetch.data?.normalizedCount ?? 0}</strong><span>Clustered</span><strong>{liveFetch.data?.clusteredCount ?? 0}</strong><span>Classified</span><strong>{liveFetch.data?.classifiedCount ?? 0}</strong><span>Rendered</span><strong>{renderedHotspots.length}</strong><span>Map filter</span><strong>{mode === "demo" ? "Demo" : mode === "live" ? "Live" : "All"}</strong></div>{liveFetch.data?.message && <p className="live-message">{liveFetch.data.message}</p>}<p className="rail-note">Area: global · bbox -180,-60,180,75 · {days} day(s) · current map filter: {mode}. Map renders up to 2,000 strongest signals for responsiveness. NASA FIRMS is near-real-time, not real-time.</p></details>
          <div className="rail-footer"><div><span className="footer-label">LAST SERVER CHECK</span><strong>{liveStatus ? formatDate(liveStatus.serverTime) : "checking..."}</strong></div><button className="small-icon-button" onClick={() => window.location.reload()} title="Refresh console"><RefreshCw size={14} /></button></div>
        </div>}
      </aside>

          <section className="map-workspace">
        <div className="map-header"><div className="map-title"><span className="eyebrow">SPATIAL SITUATION AWARENESS</span><h2>Global thermal activity <span>/</span> <em>24 hours</em></h2></div><div className="map-header-actions"><button className="header-filter"><Layers3 size={15} /> {renderedHotspots.length} map / {allVisible.length} total <ChevronDown size={14} /></button><div className="sync-chip"><span className="sync-indicator" /> Updated {demoLoading ? "loading" : "now"}</div></div></div>
        <div className="stats-row"><StatCard label="VISIBLE SIGNALS" value={String(allVisible.length).padStart(2, "0")} detail={mode === "live" ? "NASA FIRMS feed" : "seeded scenario"} tone="cyan" /><StatCard label="HIGH PRIORITY" value={String(highCount).padStart(2, "0")} detail="suspected upset" tone="red" /><StatCard label="ELEVATED" value={String(elevatedCount).padStart(2, "0")} detail="monitor / verify" tone="orange" /><StatCard label="TOTAL FRP" value={`${totalMw.toFixed(0)} MW`} detail="visible sources" tone="green" /></div>
        <div className="map-card"><MapCanvas hotspots={renderedHotspots} selectedId={selected?.id} mapStyle={mapStyle} showPlume={showPlume} selectedWind={selectedWind} driftHours={driftHours} bufferRadius={bufferRadius} nearbyAssets={nearbyContext?.assets ?? []} onSelect={(hotspot) => { setSelectedId(hotspot.id); setDetailOpen(true); }} onReset={resetView} onFitAll={fitAll} fitToken={fitToken} /><div className="map-legend"><div className="legend-title">SIGNAL STATUS</div><div className="legend-item"><span className="legend-dot red" /> Suspected upset</div><div className="legend-item"><span className="legend-dot orange" /> Elevated</div><div className="legend-item"><span className="legend-dot green" /> Normal</div><div className="legend-item"><span className="legend-dot yellow" /> Monitor</div></div><div className="map-attribution">© NASA FIRMS / © OpenStreetMap / Esri <span>•</span> not a fire confirmation</div></div>
      </section>

      <IncidentPanel selected={selected} open={detailOpen} onClose={() => setDetailOpen(false)} onFit={() => { if (selected) setFitToken((value) => value + 1); }} onReset={resetView} bufferRadius={bufferRadius} onBufferRadiusChange={setBufferRadius} wind={selectedWind} driftHours={driftHours} onDriftHoursChange={setDriftHours} classColor={selected ? classAccent[selected.classLabel] : undefined} nearbyAssets={nearbyContext?.assets ?? []} nearbyState={nearbyContext?.state} history={historyContext} sentinelStatus={sentinelStatus} />
    </main>
    <footer className="bottom-bar"><div><span className="footer-accent" /> Data state: <strong>{activeModeLabel}</strong></div><div className="bottom-center"><span>NASA FIRMS is near-real-time, not real-time</span><span>•</span><span>OSM context may be incomplete</span></div><div>RULES ENGINE <span className="rules-version">v0.1 / DEMO</span></div></footer>
  </div>;
}

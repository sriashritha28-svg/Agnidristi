import { useState } from "react";
import type { ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Hotspot, WindObservation } from "../../../server/hotspots";
import { ArrowUpRight, BarChart3, Check, ChevronDown, Clock3, Download, Flame, Info, Printer, ShieldCheck, Wind, X } from "lucide-react";

const formatDate = (value: string) => new Date(value).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const formatNumber = (value: number | null) => value === null ? "—" : value.toFixed(1);
const friendlyClass = (value: string) => value.replaceAll("_", " ");

export type IncidentPanelProps = {
  selected?: Hotspot;
  open: boolean;
  onClose: () => void;
  onFit: () => void;
  onReset: () => void;
  bufferRadius: number;
  onBufferRadiusChange: (radius: number) => void;
  wind?: WindObservation;
  driftHours: number;
  onDriftHoursChange: (hours: number) => void;
  classColor?: string;
  nearbyAssets: Array<{ id: string; name: string; type: string; distanceKm: number; withinPlanningBuffer: boolean }>;
  nearbyState?: "AVAILABLE" | "UNAVAILABLE";
  history?: { state: "AVAILABLE" | "UNAVAILABLE" | "DEMO"; detectionCount: number; baseline: { baselineType: string; median: number | null; mad: number | null; robustZ: number | null }; timeline: Array<{ label: string; frp: number; detections: number }>; clusterTimeline: Array<{ label: string; state: string; count: number; note: string }>; message?: string };
  sentinelStatus?: { state: string; message: string; acquisitionDate: string | null; cloudCover: number | null; source: string; acquisitions: Array<{ id: string; date: string; cloudCover: number | null; collection: string; productUrl: string | null }> };
};

function Accordion({ title, icon, children, defaultOpen = false }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="intel-accordion" open={defaultOpen}><summary><span>{icon}{title}</span><ChevronDown size={14} /></summary><div className="accordion-body">{children}</div></details>;
}

export default function IncidentPanel({ selected, open, onClose, onFit, onReset, bufferRadius, onBufferRadiusChange, wind, driftHours, onDriftHoursChange, classColor = "#64748B", nearbyAssets, nearbyState, history, sentinelStatus }: IncidentPanelProps) {
  const feedbackMutation = trpc.feedback.submit.useMutation();
  const [feedbackComment, setFeedbackComment] = useState("");
  const submitFeedback = (outcome: "CONFIRMED" | "REJECTED" | "CORRECTED") => {
    if (!selected) return;
    feedbackMutation.mutate({ hotspotId: selected.id, outcome, comment: feedbackComment || undefined }, { onSuccess: (result) => { toast.success(result.state === "SAVED" ? "Operator feedback saved" : "Feedback storage unavailable"); setFeedbackComment(""); }, onError: () => toast.error("Could not save operator feedback") });
  };
  const eapText = selected ? [
    `Incident summary: ${selected.classLabel} at ${selected.site}. Observation ${formatDate(selected.observationTime)}; FRP ${formatNumber(selected.frp)} MW; source mode ${selected.isDemo ? "DEMO" : "LIVE"}.`,
    "Immediate verification: Verify thermal activity through authorised site or field channels.",
    "Evidence review: Review available FIRMS observations and incident evidence.",
    "Context review: Review mapped facility, land-cover and nearby-asset context.",
    "Operational action: Confirm classification through authorised operational channels.",
    "Routing: For unmapped hazards, route for district/state disaster-management review.",
    "Feedback: Record confirmation, rejection or correction using operator feedback.",
  ].join("\n") : "";

  return <aside className={`detail-drawer ${open ? "is-open" : "is-closed"}`}>
    <button className="detail-toggle" onClick={open ? onClose : onReset}>{open ? <ChevronDown size={15} className="rotate-90" /> : <Info size={15} />}</button>
    {open && selected && <div className="detail-content">
      <div className="detail-topline"><span className="eyebrow">INCIDENT INTELLIGENCE</span><button className="icon-button subtle" onClick={onClose}><X size={16} /></button></div>
      <div className="detail-actions"><button onClick={onFit}><CrosshairIcon /> Fit incident</button><button onClick={onReset}><GlobeIcon /> Fit all</button><button onClick={() => window.print()}><Printer size={13} /> Print / PDF</button></div>
      <div className="detail-identity"><div className="detail-marker" style={{ background: classColor }}><Flame size={18} /></div><div><h3>{selected.site}</h3><p>{selected.region}</p></div></div>
      <div className="status-banner"><span className="status-banner-dot" /> {selected.status === "NOT_APPLICABLE" ? "CLASS STATUS / NOT APPLICABLE" : selected.status.replaceAll("_", " ")} <span className="status-verify">{selected.isDemo ? "DEMO / RULES ONLY" : "LIVE / FIRMS"}</span></div>
      <div className="classification-card"><span className="eyebrow">CURRENT CLASSIFICATION</span><strong className="class-label" style={{ color: classColor }}>{friendlyClass(selected.classLabel)}</strong><p>{selected.isDemo ? "Transparent rules-only classification from seeded historical evidence." : "FIRMS detects thermal activity; cause is not determined. Verify independently."}</p></div>
      <div className="metric-grid"><div><span>FRP</span><strong>{formatNumber(selected.frp)} <small>MW</small></strong></div><div><span>BRIGHTNESS</span><strong>{formatNumber(selected.brightnessTemperature)} <small>K</small></strong></div><div><span>FIRMS CONFIDENCE</span><strong>{formatNumber(selected.confidence)}<small>%</small></strong></div><div><span>DETECTIONS</span><strong>{selected.detectionCount}<small> merged</small></strong></div></div>
      <Accordion title="Observation & provenance" icon={<Clock3 size={14} />} defaultOpen><div className="detail-row"><span>Observed</span><strong>{formatDate(selected.observationTime)}</strong></div><div className="detail-row"><span>Satellite / sensor</span><strong>{selected.satellite} / {selected.sensor}</strong></div><div className="detail-row"><span>Day / night</span><strong>{selected.dayNight}</strong></div><div className="detail-row"><span>Coordinates</span><strong>{selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</strong></div><div className="detail-row"><span>Source state</span><strong>{selected.isDemo ? "DEMO / SEEDED HISTORICAL DATA" : "LIVE / NASA FIRMS"}</strong></div></Accordion>
      <Accordion title={selected.isDemo ? "Classification evidence" : "Source context"} icon={<BarChart3 size={14} />} defaultOpen><div className="evidence-list">{selected.evidence.map((item) => <div className="evidence-item" key={`${item.label}-${item.value}`}><div className="evidence-check"><Check size={11} /></div><div><strong>{item.label}: {item.value}</strong><span>{item.effect}</span></div></div>)}</div></Accordion>
      <Accordion title="Smoke & planning buffer" icon={<Wind size={14} />} defaultOpen><div className="buffer-label"><span>Indicative planning buffer</span><strong>{bufferRadius >= 1000 ? `${bufferRadius / 1000} km` : `${bufferRadius} m`}</strong></div><div className="buffer-options">{[250, 500, 1000].map((radius) => <button key={radius} className={bufferRadius === radius ? "active" : ""} onClick={() => onBufferRadiusChange(radius)}>{radius >= 1000 ? "1 km" : `${radius} m`}</button>)}</div><p className="disclaimer-text">Indicative planning buffer — not a precise fire boundary or evacuation zone.</p><div className="wind-status">{wind?.state === "AVAILABLE" ? <><Wind size={15} /><div><strong>Wind-backed smoke drift available</strong><span>{wind.speedKmh?.toFixed(1)} km/h / {wind.directionDeg}° from {wind.source} / {wind.observedAt ? formatDate(wind.observedAt) : "current"}</span></div></> : <><Wind size={15} /><div><strong>Wind data unavailable</strong><span>Directional smoke drift cannot be estimated.</span></div></>}</div>{wind?.state === "AVAILABLE" && <><div className="buffer-label drift-label"><span>Smoke drift horizon</span><strong>{driftHours} hour{driftHours > 1 ? "s" : ""}</strong></div><div className="buffer-options">{[1, 3, 6].map((hours) => <button key={hours} className={driftHours === hours ? "active" : ""} onClick={() => onDriftHoursChange(hours)}>{hours}h</button>)}</div><p className="disclaimer-text">Indicative smoke drift from wind forecast — not toxic-gas or chemical dispersion modelling.</p></>}</Accordion>
      <Accordion title="Emergency Action Plan" icon={<ShieldCheck size={14} />}><div className="eap-disclaimer">Decision-support template — requires review and validation by the responsible plant safety officer or disaster-management authority. Not an official emergency order.</div><pre className="eap-preview">{eapText}</pre><div className="eap-actions"><button onClick={() => window.print()}><Printer size={13} /> Print / Save as PDF</button><button onClick={() => navigator.clipboard?.writeText(eapText).then(() => undefined)}><Download size={13} /> Copy plan</button></div></Accordion>
      <Accordion title="Thermal history & baseline" icon={<Clock3 size={14} />}><div className="detail-row"><span>History state</span><strong>{history?.state ?? "LOADING"}</strong></div><div className="detail-row"><span>Detections / baseline</span><strong>{history?.detectionCount ?? 0} / {history?.baseline.baselineType ?? "—"}</strong></div><div className="detail-row"><span>Median / MAD / robust z</span><strong>{history?.baseline.median ?? "—"} / {history?.baseline.mad ?? "—"} / {history?.baseline.robustZ ?? "—"}</strong></div>{history?.timeline?.length ? <div className="trend-chart" aria-label="Thermal FRP trend">{history.timeline.map((point) => <div className="trend-column" key={point.label}><div className="trend-bar" style={{ height: `${Math.max(10, Math.min(100, (point.frp / Math.max(...history.timeline.map((item) => item.frp), 1)) * 100))}%` }} title={`${point.frp} MW / ${point.detections} detections`} /><span>{point.label}</span></div>)}</div> : null}<p className="disclaimer-text">{history?.message ?? "Historical footprint and robust baseline are shown only when persisted FIRMS observations are available."}</p></Accordion>
      <Accordion title="Cluster timeline" icon={<BarChart3 size={14} />}><div className="cluster-timeline">{history?.clusterTimeline?.length ? history.clusterTimeline.map((item) => <div className="cluster-step" key={item.label}><span className="cluster-node" /><div><strong>{item.label} · {item.state}</strong><span>{item.count} detections — {item.note}</span></div></div>) : <p className="disclaimer-text">Cluster timeline appears after live FIRMS detections are persisted.</p>}</div></Accordion>
      <Accordion title="Nearby assets & facility context" icon={<Info size={14} />}><p className="disclaimer-text">Indicative planning context, not confirmed human exposure.</p>{nearbyState === "AVAILABLE" && nearbyAssets.length ? <div className="asset-list">{nearbyAssets.slice(0, 8).map((asset) => <div className="asset-row" key={asset.id}><div><strong>{asset.name}</strong><span>{asset.type} / {asset.distanceKm.toFixed(2)} km</span></div><em className={asset.withinPlanningBuffer ? "inside" : ""}>{asset.withinPlanningBuffer ? "IN BUFFER" : "NEARBY"}</em></div>)}</div> : <div className="asset-placeholder"><strong>OSM / Overpass context</strong><span>{nearbyState === "UNAVAILABLE" ? "Asset lookup unavailable from the server." : "No mapped facility is included in this seeded scenario."}</span><em>{nearbyState === "UNAVAILABLE" ? "UNAVAILABLE" : "SEEDED"}</em></div>}</Accordion>
      <Accordion title="Sentinel-2 corroboration" icon={<Info size={14} />}><div className="asset-placeholder"><strong>{sentinelStatus?.state === "DEMO_CONTEXT" ? "SIMULATED / Sentinel-2 context" : sentinelStatus?.source ?? "Copernicus Data Space"}</strong><span>{sentinelStatus?.message ?? "Checking corroboration availability…"}</span><em>{sentinelStatus?.state === "DEMO_CONTEXT" ? "DEMO" : sentinelStatus?.state ?? "LOADING"}</em></div>{sentinelStatus?.acquisitions?.length ? <div className="sentinel-list">{sentinelStatus.acquisitions.map((item) => <div className="sentinel-row" key={item.id}><strong>{new Date(item.date).toLocaleDateString()}</strong><span>{item.collection} · cloud {item.cloudCover === null ? "—" : `${item.cloudCover.toFixed(1)}%`}</span></div>)}</div> : null}<p className="disclaimer-text">Simulated records are for demo visualization only. Sentinel-2 is corroborating evidence and never blocks FIRMS-based escalation.</p></Accordion>
      <Accordion title="Operator feedback" icon={<Check size={14} />}><p className="disclaimer-text">Record confirmation, rejection or correction for this selected incident.</p><textarea className="feedback-input" value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} placeholder="Optional review note…" /><div className="feedback-actions"><button onClick={() => submitFeedback("CONFIRMED")} disabled={feedbackMutation.isPending}>Confirm</button><button onClick={() => submitFeedback("REJECTED")} disabled={feedbackMutation.isPending}>Reject</button><button onClick={() => submitFeedback("CORRECTED")} disabled={feedbackMutation.isPending}>Correct</button></div></Accordion>
      <Accordion title="Limitations" icon={<Info size={14} />}><div className="limitation-list"><span>• FIRMS is near-real-time satellite detection, not an on-site alarm system.</span><span>• Thermal data cannot confirm explosion, gas leak, toxic release or root cause.</span><span>• Satellite locations are indicative and have uncertainty.</span><span>• Planning buffer is not an evacuation zone.</span><span>• Sentinel-2 evidence is corroborating only.</span></div></Accordion>
      <button className="secondary-action"><ShieldCheck size={15} /> Open incident workspace <ArrowUpRight size={14} /></button>
    </div>}
    {!open && <div className="empty-detail"><Info size={26} /><strong>Incident panel closed</strong><span>Click a rendered hotspot to open intelligence and zoom to the incident.</span></div>}
    {open && !selected && <div className="empty-detail"><Info size={26} /><strong>Select a hotspot</strong><span>Click a rendered hotspot to inspect incident intelligence.</span></div>}
  </aside>;
}

function CrosshairIcon() { return <span className="mini-glyph">+</span>; }
function GlobeIcon() { return <span className="mini-glyph">◎</span>; }

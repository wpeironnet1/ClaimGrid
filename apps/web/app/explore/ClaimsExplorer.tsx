"use client";

import { useEffect, useMemo, useState } from "react";
import { createResearchSnapshot, parseResearchSnapshots, RESEARCH_STORAGE_VERSION, type SavedResearchArea, upsertResearchSnapshot } from "@claimgrid/core";

type Feature = { id?: string | number; geometry?: { type: string; coordinates: unknown } };
type Result = { features: Feature[]; metadata: { retrievedAt: string; exceededLimit: boolean; warning: string } };
const STORAGE_KEY = `claimgrid:research:v${RESEARCH_STORAGE_VERSION}`;
const areas = [
  { id: "mother-lode", label: "Mother Lode, CA", west: -121.15, south: 37.55, east: -119.9, north: 39.25 },
  { id: "walker-lane", label: "Walker Lane, NV", west: -119.5, south: 37.2, east: -117.3, north: 39.4 },
  { id: "bradshaw", label: "Bradshaw Mountains, AZ", west: -112.75, south: 33.75, east: -111.65, north: 34.75 }
];

function rings(feature: Feature): number[][][] {
  if (feature.geometry?.type === "Polygon") return feature.geometry.coordinates as number[][][];
  if (feature.geometry?.type === "MultiPolygon") return (feature.geometry.coordinates as number[][][][]).flat();
  return [];
}

export default function ClaimsExplorer() {
  const [areaId, setAreaId] = useState(areas[0].id);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState<SavedResearchArea[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const area = useMemo(() => areas.find(item => item.id === areaId) ?? areas[0], [areaId]);

  useEffect(() => setSaved(parseResearchSnapshots(localStorage.getItem(STORAGE_KEY))), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    const query = new URLSearchParams({ west: String(area.west), south: String(area.south), east: String(area.east), north: String(area.north) });
    fetch(`/api/blm/active-claims?${query}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error((await response.json()).error); return response.json(); })
      .then(setResult).catch(reason => { if (reason.name !== "AbortError") setError(reason.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [area]);

  const paths = useMemo(() => result?.features.flatMap((feature, featureIndex) => rings(feature).map((ring, ringIndex) => {
    const d = ring.map(([lng, lat], index) => { const x = ((lng - area.west) / (area.east - area.west)) * 1000; const y = 620 - ((lat - area.south) / (area.north - area.south)) * 620; return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ") + " Z";
    return <path key={`${feature.id ?? featureIndex}-${ringIndex}`} d={d} />;
  })) ?? [], [area, result]);

  function saveCurrentArea() {
    if (!result) return;
    const snapshot = createResearchSnapshot({ label: area.label, bounds: { west: area.west, south: area.south, east: area.east, north: area.north }, activeClaimCount: result.features.length, sourceCheckedAt: result.metadata.retrievedAt });
    const next = upsertResearchSnapshot(saved, snapshot); setSaved(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  function removeSaved(id: string) { const next = saved.filter(item => item.id !== id); setSaved(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }

  return <><div className="explorerLayout"><section className="liveMap" aria-label={`BLM active mining claim screening layer for ${area.label}`}><div className="mapTop"><div><small>OFFICIAL-SOURCE SCREENING VIEW</small><strong>{area.label}</strong></div><label>Research area<select value={areaId} onChange={event => setAreaId(event.target.value)}>{areas.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div><div className="liveCanvas"><svg viewBox="0 0 1000 620" preserveAspectRatio="none"><defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" className="gridLine" /></pattern></defs><rect width="1000" height="620" fill="url(#grid)"/><g className="claimShapes">{paths}</g></svg>{loading && <div className="mapStatus">Loading the current BLM layer…</div>}{error && <div className="mapStatus error">{error}</div>}<div className="legend"><span><i/>Active claim geometry</span><span>BLM MLRS • not an availability map</span></div></div></section><aside className="resultPanel"><span className="stepLabel">LIVE RESULTS</span><h1>{loading ? "—" : result?.features.length ?? 0}</h1><h2>mapped active-claim records intersect this view</h2><p>This count reflects geometries returned by the current BLM service, not a count of legally available parcels.</p>{result && <><dl><div><dt>Source checked</dt><dd>{new Date(result.metadata.retrievedAt).toLocaleString()}</dd></div><div><dt>Result cap</dt><dd>{result.metadata.exceededLimit ? "Reached — zoom in" : "Not reached"}</dd></div></dl><div className="screeningWarning"><b>Required verification</b><span>{result.metadata.warning}</span></div><button className="saveAreaButton" onClick={saveCurrentArea}>Save evidence snapshot</button></>}<a className="darkButton explorerButton" href="https://mlrs.blm.gov/s/" target="_blank" rel="noreferrer">Verify in BLM MLRS ↗</a></aside></div><section className="savedResearch"><div><span className="stepLabel">SAVED RESEARCH</span><h2>Evidence snapshots</h2><p>Each save preserves the area, BLM record count, and the exact time the official source was checked.</p></div><div className="savedList">{saved.length === 0 ? <div className="emptySaved">No areas saved yet.</div> : saved.map(item => <article key={item.id}><div><b>{item.label}</b><span>{item.activeClaimCount} mapped records • checked {new Date(item.sourceCheckedAt).toLocaleString()}</span></div><button onClick={() => removeSaved(item.id)} aria-label={`Remove ${item.label}`}>Remove</button></article>)}</div></section></>;
}

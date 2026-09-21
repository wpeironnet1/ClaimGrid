"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClaimDraft, parseClaimDraft, supportedStates, type ClaimDraft, type ClaimStage, type ClaimType } from "@claimgrid/core";

const STORAGE_KEY = "claimgrid.claim-draft.v1";

export default function ClaimIntake() {
  const [name, setName] = useState("");
  const [state, setState] = useState("NV");
  const [county, setCounty] = useState("");
  const [claimType, setClaimType] = useState<ClaimType>("placer");
  const [stage, setStage] = useState<ClaimStage>("research");
  const [locationDate, setLocationDate] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saved, setSaved] = useState<ClaimDraft | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const draft = parseClaimDraft(localStorage.getItem(STORAGE_KEY));
    if (!draft) return;
    setName(draft.name); setState(draft.state); setCounty(draft.county); setClaimType(draft.claimType);
    setStage(draft.stage); setLocationDate(draft.locationDate ?? ""); setSaved(draft);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      const draft = createClaimDraft({ name, state, county, claimType, stage, locationDate });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setSaved(draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this project.");
    }
  }

  return <main className="claimPage">
    <nav className="claimNav"><a className="claimBrand" href="/"><span>CG</span>ClaimGrid</a><a href="/explore">Open research map</a></nav>
    <div className="claimShell">
      <header><span className="claimEyebrow">PRIVATE PROJECT INTAKE</span><h1>Turn promising ground into a careful process.</h1><p>This workspace organizes research and deadlines. Creating it does not locate a mining claim or establish rights.</p></header>
      <div className="claimGrid">
        <form onSubmit={submit}>
          <label>Project name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. North Wash research" required /></label>
          <div className="twoCols">
            <label>State<select value={state} onChange={e => setState(e.target.value)}>{supportedStates.map(code => <option key={code}>{code}</option>)}</select></label>
            <label>County (if known)<input value={county} onChange={e => setCounty(e.target.value)} placeholder="Verify recording office" /></label>
          </div>
          <label>Claim type<select value={claimType} onChange={e => setClaimType(e.target.value as ClaimType)}><option value="placer">Placer</option><option value="lode">Lode</option><option value="mill">Mill site</option><option value="tunnel">Tunnel site</option></select></label>
          <fieldset><legend>Where are you in the process?</legend>
            <label className="choice"><input type="radio" checked={stage === "research"} onChange={() => setStage("research")} /><span><b>Researching only</b><small>No deadline is calculated because no physical location is being claimed.</small></span></label>
            <label className="choice"><input type="radio" checked={stage === "located"} onChange={() => setStage("located")} /><span><b>I physically marked/located a claim</b><small>Use the actual field location date—not the day you found it online.</small></span></label>
          </fieldset>
          {stage === "located" && <label>Physical location date<input type="date" value={locationDate} max={new Date().toISOString().slice(0,10)} onChange={e => setLocationDate(e.target.value)} required /></label>}
          <label className="ack"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} required /><span>I understand map data is screening evidence only. I must verify current BLM records, land status and withdrawals, monuments, discovery, and state/county rules.</span></label>
          {error && <p className="formError" role="alert">{error}</p>}
          <button className="saveButton" disabled={!acknowledged}>Save private draft</button>
          <p className="privacyNote">Stored only in this browser on this device.</p>
        </form>
        <aside>
          <h2>{saved ? "Draft saved" : "What happens next"}</h2>
          {saved ? <>
            <div className="statusBadge">{saved.stage === "research" ? "RESEARCH — NO RIGHTS CREATED" : "LOCATION DATE RECORDED"}</div>
            <dl><div><dt>Project</dt><dd>{saved.name}</dd></div><div><dt>Jurisdiction</dt><dd>{saved.county ? `${saved.county} County, ` : ""}{saved.state}</dd></div>{saved.federalRecordingDeadline && <div className="deadline"><dt>Federal 90-day deadline</dt><dd>{saved.federalRecordingDeadline}</dd></div>}</dl>
            {saved.federalRecordingDeadline && <p className="deadlineWarning"><b>Do not treat this as your first deadline.</b> State or county recording can be required sooner. Confirm the applicable rules immediately.</p>}
            {saved.state === "NV" && <a className="workflowLink" href="/claim/nevada">Open Nevada verification checklist →</a>}
            {saved.state === "AZ" && <a className="workflowLink" href="/claim/arizona">Open Arizona verification checklist →</a>}
            {saved.state === "CA" && <a className="workflowLink" href="/claim/california">Open California verification checklist →</a>}
            {saved.state === "OR" && <a className="workflowLink" href="/claim/oregon">Open Oregon verification checklist →</a>}
            {saved.state === "UT" && <a className="workflowLink" href="/claim/utah">Open Utah verification checklist →</a>}
            {saved.stage === "located" && <a className="workflowLink" href="/documents/blm">Prepare BLM recording worksheet →</a>}
            {saved.federalRecordingDeadline && <a className="workflowLink" href="/deadlines">Open deadline tracker →</a>}
          </> : <ol><li>Save the jurisdiction and present stage.</li><li>Research official land and mineral records.</li><li>Verify conditions and monuments in the field.</li><li>Follow state, county, and BLM requirements.</li></ol>}
          <div className="officialBox"><b>Authoritative verification required</b><p>ClaimGrid cannot determine legal availability or validate a discovery. Confirm the current record directly with the responsible agencies.</p><a href="https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-minerals/mining-claims" target="_blank" rel="noreferrer">Review BLM mining-claim guidance ↗</a></div>
        </aside>
      </div>
    </div>
  </main>;
}

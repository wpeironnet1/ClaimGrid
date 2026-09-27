"use client";
import { useEffect, useState } from "react";
import { parseWorkflowProgress, washingtonWorkflow } from "@claimgrid/core";

const STORAGE_KEY = "claimgrid.workflow.wa.v1";
const ids = washingtonWorkflow.steps.map(step => step.id);
const phaseLabels = { research: "RESEARCH", field: "FIELD", county: "COUNTY", federal: "FEDERAL" } as const;

export default function WashingtonChecklist() {
  const [completed,setCompleted]=useState<string[]>([]); const [loaded,setLoaded]=useState(false);
  useEffect(()=>{setCompleted(parseWorkflowProgress(localStorage.getItem(STORAGE_KEY),ids));setLoaded(true)},[]);
  function toggle(id:string){setCompleted(current=>{const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next})}
  return <main className="nvPage"><nav><a href="/">← ClaimGrid</a><a href="/claim/new">Project intake</a></nav>
    <header><span>STATE WORKFLOW · SOURCE REVIEWED {washingtonWorkflow.reviewedAt}</span><h1>{washingtonWorkflow.title}</h1><p>{washingtonWorkflow.notice}</p></header>
    <section className="progress" aria-live="polite"><div><b>{loaded?completed.length:0} of {washingtonWorkflow.steps.length}</b><span>verification gates marked</span></div><div className="progressTrack"><i style={{width:`${completed.length/washingtonWorkflow.steps.length*100}%`}}/></div></section>
    <div className="nvLayout"><section className="checklist">{washingtonWorkflow.steps.map((step,index)=><article key={step.id} className={completed.includes(step.id)?"done":""}><button onClick={()=>toggle(step.id)} aria-pressed={completed.includes(step.id)} aria-label={`${completed.includes(step.id)?"Unmark":"Mark"} ${step.title}`}><span>{completed.includes(step.id)?"✓":index+1}</span></button><div><small>{phaseLabels[step.phase]}</small><h2>{step.title}</h2><p>{step.description}</p><strong>Verification gate</strong><p className="gate">{step.verification}</p></div></article>)}</section>
    <aside><div className="critical"><b>Map appearance is not land status</b><p>Verify mineral ownership, public-domain status, withdrawals, closures, current claims, prior rights, and special federal or state restrictions in authoritative records.</p></div><div className="critical"><b>A claim is not permission to prospect or mine</b><p>Landowner permission, Washington aquatic and surface-mining rules, state mineral leases, water requirements, and federal surface-use authorization remain separate.</p></div><h2>Official sources</h2>{washingtonWorkflow.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><b>{source.label}</b><span>{source.authority}<br/>Checked {source.checkedAt} ↗</span></a>)}</aside></div>
  </main>
}

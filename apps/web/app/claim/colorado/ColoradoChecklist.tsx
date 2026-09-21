"use client";

import { useEffect, useState } from "react";
import { coloradoWorkflow, parseWorkflowProgress } from "@claimgrid/core";

const STORAGE_KEY = "claimgrid.workflow.co.v1";
const ids = coloradoWorkflow.steps.map(step => step.id);
const phaseLabels = { research: "Desk research", field: "Physical field work", county: "County recording", federal: "Federal recording" };

export default function ColoradoChecklist() {
  const [completed,setCompleted]=useState<string[]>([]);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{setCompleted(parseWorkflowProgress(localStorage.getItem(STORAGE_KEY),ids));setLoaded(true)},[]);
  function toggle(id:string){const next=completed.includes(id)?completed.filter(value=>value!==id):[...completed,id];setCompleted(next);localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}
  return <main className="nvPage"><nav className="nvNav"><a className="nvBrand" href="/"><span>CG</span>ClaimGrid</a><div><a href="/explore">Map</a><a href="/claim/new">Project intake</a></div></nav><div className="nvShell">
    <header><span>STATE WORKFLOW · SOURCE REVIEWED {coloradoWorkflow.reviewedAt}</span><h1>{coloradoWorkflow.title}</h1><p>{coloradoWorkflow.notice}</p></header>
    <section className="progress" aria-live="polite"><div><b>{loaded?completed.length:0} of {coloradoWorkflow.steps.length}</b><span>verification gates marked</span></div><div className="progressTrack"><i style={{width:`${completed.length/coloradoWorkflow.steps.length*100}%`}}/></div></section>
    <div className="nvLayout"><section className="checklist">{coloradoWorkflow.steps.map((step,index)=><article key={step.id} className={completed.includes(step.id)?"done":""}><button onClick={()=>toggle(step.id)} aria-pressed={completed.includes(step.id)} aria-label={`${completed.includes(step.id)?"Unmark":"Mark"} ${step.title}`}><span>{completed.includes(step.id)?"✓":index+1}</span></button><div><small>{phaseLabels[step.phase]}</small><h2>{step.title}</h2><p>{step.description}</p><strong>Verification gate</strong><p className="gate">{step.verification}</p></div></article>)}</section>
    <aside><div className="critical"><b>Map appearance is not land status</b><p>Verify the mineral estate, current claims, withdrawals, closures, prior rights, and special designations in authoritative records before acting.</p></div><div className="critical"><b>Location is not operating approval</b><p>Claim location does not itself authorize access, excavation, vehicle use, or surface disturbance. Confirm every separate authorization first.</p></div><h2>Official sources</h2>{coloradoWorkflow.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><b>{source.label}</b><span>{source.authority}<br/>Checked {source.checkedAt} ↗</span></a>)}</aside></div>
  </div></main>
}

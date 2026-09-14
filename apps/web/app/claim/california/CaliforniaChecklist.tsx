"use client";

import { useEffect, useState } from "react";
import { californiaWorkflow, parseWorkflowProgress } from "@claimgrid/core";

const STORAGE_KEY = "claimgrid.workflow.ca.v1";
const ids = californiaWorkflow.steps.map(step => step.id);
const phaseLabels = { research: "Desk research", field: "Physical field work", county: "County recording", federal: "Federal recording" };

export default function CaliforniaChecklist() {
  const [completed,setCompleted]=useState<string[]>([]);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{setCompleted(parseWorkflowProgress(localStorage.getItem(STORAGE_KEY),ids));setLoaded(true)},[]);
  function toggle(id:string){const next=completed.includes(id)?completed.filter(value=>value!==id):[...completed,id];setCompleted(next);localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}
  return <main className="nvPage"><nav className="nvNav"><a className="nvBrand" href="/"><span>CG</span>ClaimGrid</a><div><a href="/explore">Map</a><a href="/claim/new">Project intake</a></div></nav><div className="nvShell">
    <header><span>STATE WORKFLOW · SOURCE REVIEWED {californiaWorkflow.reviewedAt}</span><h1>{californiaWorkflow.title}</h1><p>{californiaWorkflow.notice}</p></header>
    <section className="progress" aria-live="polite"><div><b>{loaded?completed.length:0} of {californiaWorkflow.steps.length}</b><span>verification gates marked</span></div><div className="progressTrack"><i style={{width:`${completed.length/californiaWorkflow.steps.length*100}%`}}/></div></section>
    <div className="nvLayout"><section className="checklist">{californiaWorkflow.steps.map((step,index)=><article key={step.id} className={completed.includes(step.id)?"done":""}><button onClick={()=>toggle(step.id)} aria-pressed={completed.includes(step.id)} aria-label={`${completed.includes(step.id)?"Unmark":"Mark"} ${step.title}`}><span>{completed.includes(step.id)?"✓":index+1}</span></button><div><small>{phaseLabels[step.phase]}</small><h2>{step.title}</h2><p>{step.description}</p><strong>Verification gate</strong><p className="gate">{step.verification}</p></div></article>)}</section>
    <aside><div className="critical"><b>Federal land is not automatically claimable</b><p>Verify the mineral estate, withdrawals, closures, existing rights, and applicable special-area rules in authoritative records before entering or acting.</p></div><div className="critical"><b>Surface work is separate</b><p>A claim location does not itself authorize access across private property or mining disturbance. Confirm access and operational authorization with the land manager.</p></div><h2>Official sources</h2>{californiaWorkflow.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><b>{source.label}</b><span>{source.authority}<br/>Checked {source.checkedAt} ↗</span></a>)}</aside></div>
  </div></main>
}
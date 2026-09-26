"use client";
import { useEffect, useState } from "react";
import { newMexicoWorkflow, parseWorkflowProgress } from "@claimgrid/core";

const STORAGE_KEY = "claimgrid.workflow.nm.v1";
const ids = newMexicoWorkflow.steps.map(step => step.id);
const phaseLabels = { research: "RESEARCH", field: "FIELD", county: "COUNTY", federal: "FEDERAL" } as const;

export default function NewMexicoChecklist() {
  const [completed,setCompleted]=useState<string[]>([]); const [loaded,setLoaded]=useState(false);
  useEffect(()=>{setCompleted(parseWorkflowProgress(localStorage.getItem(STORAGE_KEY),ids));setLoaded(true)},[]);
  function toggle(id:string){setCompleted(current=>{const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next})}
  return <main className="nvPage"><nav><a href="/">â ClaimGrid</a><a href="/claim/new">Project intake</a></nav>
    <header><span>STATE WORKFLOW Â· SOURCE REVIEWED {newMexicoWorkflow.reviewedAt}</span><h1>{newMexicoWorkflow.title}</h1><p>{newMexicoWorkflow.notice}</p></header>
    <section className="progress" aria-live="polite"><div><b>{loaded?completed.length:0} of {newMexicoWorkflow.steps.length}</b><span>verification gates marked</span></div><div className="progressTrack"><i style={{width:`${completed.length/newMexicoWorkflow.steps.length*100}%`}}/></div></section>
    <div className="nvLayout"><section className="checklist">{newMexicoWorkflow.steps.map((step,index)=><article key={step.id} className={completed.includes(step.id)?"done":""}><button onClick={()=>toggle(step.id)} aria-pressed={completed.includes(step.id)} aria-label={`${completed.includes(step.id)?"Unmark":"Mark"} ${step.title}`}><span>{completed.includes(step.id)?"â":index+1}</span></button><div><small>{phaseLabels[step.phase]}</small><h2>{step.title}</h2><p>{step.description}</p><strong>Verification gate</strong><p className="gate">{step.verification}</p></div></article>)}</section>
    <aside><div className="critical"><b>Map appearance is not land status</b><p>Verify the mineral estate, current claims, withdrawals, closures, prior rights, and special designations in authoritative records before acting.</p></div><div className="critical"><b>A claim is not an exploration or mining permit</b><p>New Mexico and federal access, reclamation, water, financial-assurance, and surface-use requirements remain separate. Obtain agency determinations before disturbance.</p></div><h2>Official sources</h2>{newMexicoWorkflow.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><b>{source.label}</b><span>{source.authority}<br/>Checked {source.checkedAt} â</span></a>)}</aside></div>
  </main>
}

"use client";
import { useEffect, useState } from "react";
import { alaskaWorkflow, parseWorkflowProgress } from "@claimgrid/core";

const STORAGE_KEY = "claimgrid.workflow.ak.v1";
const ids = alaskaWorkflow.steps.map(step => step.id);
const phaseLabels = { research: "RESEARCH", field: "FIELD", county: "STATE RECORDING", federal: "FEDERAL / MAINTENANCE" } as const;

export default function AlaskaChecklist() {
  const [completed,setCompleted]=useState<string[]>([]); const [loaded,setLoaded]=useState(false);
  useEffect(()=>{setCompleted(parseWorkflowProgress(localStorage.getItem(STORAGE_KEY),ids));setLoaded(true)},[]);
  function toggle(id:string){setCompleted(current=>{const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next})}
  return <main className="nvPage"><nav><a href="/">â ClaimGrid</a><a href="/claim/new">Project intake</a></nav>
    <header><span>STATE / FEDERAL WORKFLOW Â· SOURCE REVIEWED {alaskaWorkflow.reviewedAt}</span><h1>{alaskaWorkflow.title}</h1><p>{alaskaWorkflow.notice}</p></header>
    <section className="progress" aria-live="polite"><div><b>{loaded?completed.length:0} of {alaskaWorkflow.steps.length}</b><span>verification gates marked</span></div><div className="progressTrack"><i style={{width:`${completed.length/alaskaWorkflow.steps.length*100}%`}}/></div></section>
    <div className="nvLayout"><section className="checklist">{alaskaWorkflow.steps.map((step,index)=><article key={step.id} className={completed.includes(step.id)?"done":""}><button onClick={()=>toggle(step.id)} aria-pressed={completed.includes(step.id)} aria-label={`${completed.includes(step.id)?"Unmark":"Mark"} ${step.title}`}><span>{completed.includes(step.id)?"â":index+1}</span></button><div><small>{phaseLabels[step.phase]}</small><h2>{step.title}</h2><p>{step.description}</p><strong>Verification gate</strong><p className="gate">{step.verification}</p></div></article>)}</section>
    <aside><div className="critical"><b>Choose the jurisdiction first</b><p>Alaska state claims and federal claims use different location, recording, payment, and maintenance systems. State selection alone does not settle title.</p></div><div className="critical"><b>A location is not activity authorization</b><p>Access, exploration, mining, water use, reclamation, and surface disturbance may require separate approvals before work begins.</p></div><h2>Official sources</h2>{alaskaWorkflow.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><b>{source.label}</b><span>{source.authority}<br/>Checked {source.checkedAt} â</span></a>)}</aside></div>
  </main>
}

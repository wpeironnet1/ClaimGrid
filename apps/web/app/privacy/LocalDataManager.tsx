"use client";

import { useEffect, useState } from "react";
import { claimGridLocalRecords, collectLocalRecords, createLocalDataExport, type LocalRecord } from "@claimgrid/core";

export default function LocalDataManager() {
  const [records,setRecords]=useState<LocalRecord[]>([]);
  const [armed,setArmed]=useState(false);
  const [message,setMessage]=useState("");
  function refresh(){setRecords(collectLocalRecords(key=>localStorage.getItem(key)))}
  useEffect(refresh,[]);
  function download(){
    const packet=createLocalDataExport(records);
    const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:"application/json"}));
    const link=document.createElement("a"); link.href=url; link.download=`claimgrid-data-${packet.exportedAt.slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
    setMessage("Private backup downloaded. Keep it in a secure location.");
  }
  function clear(){
    if(!armed){setArmed(true);setMessage("Review the warning, then press the delete button again.");return}
    claimGridLocalRecords.forEach(record=>localStorage.removeItem(record.key)); setRecords([]);setArmed(false);setMessage("All ClaimGrid records stored by this browser were deleted.");
  }
  return <section className="dataPanel">
    <div className="dataSummary"><span>{records.length}</span><div><h2>Local record types found</h2><p>These records are stored only in this browser. ClaimGrid has not uploaded them to an account.</p></div></div>
    <div className="recordList">{claimGridLocalRecords.map(definition=>{const present=records.some(record=>record.key===definition.key);return <article key={definition.key}><i className={present?"present":"empty"}>{present?"Stored":"Empty"}</i><div><b>{definition.label}</b><p>{definition.description}</p></div></article>})}</div>
    <div className="dataActions"><button onClick={download} disabled={!records.length}>Download JSON backup</button><button className={armed?"danger armed":"danger"} onClick={clear} disabled={!records.length}>{armed?"Permanently delete all local data":"Delete local data"}</button></div>
    {armed&&<p className="deleteWarning" role="alert"><b>This cannot be undone.</b> Download a backup first if these records matter. Deletion affects this browser only and does not cancel future accounts or subscriptions.</p>}
    {message&&<p className="dataMessage" role="status">{message}</p>}
  </section>
}

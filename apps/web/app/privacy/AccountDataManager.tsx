"use client";

import { useState, type FormEvent } from "react";
import { ACCOUNT_DELETION_CONFIRMATION } from "@claimgrid/core";

export default function AccountDataManager() {
  const [confirmation,setConfirmation]=useState(""); const [message,setMessage]=useState(""); const [working,setWorking]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setWorking(true);setMessage("");try{const response=await fetch("/api/account/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmation})});const result=await response.json() as {message?:string;error?:string};setMessage(result.message??result.error??"Account deletion could not be confirmed.");if(response.ok)setConfirmation("");}catch{setMessage("Account deletion could not be reached. No success was recorded.");}finally{setWorking(false)}}
  return <section className="accountDataPanel"><h2>Delete a cloud account</h2><p>Cloud accounts are not active in this version. When account service is connected, this control will require a verified signed-in session and exact acknowledgement from the deletion service before reporting success.</p><p>Deletion is intended to remove the account and associated personal data and cancel linked subscriptions. It does not erase official agency or county records, filings, or copies you exported or shared elsewhere.</p><form onSubmit={submit}><label>Type <b>{ACCOUNT_DELETION_CONFIRMATION}</b><input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label><button className="danger" disabled={working||confirmation!==ACCOUNT_DELETION_CONFIRMATION}>{working?"Requesting verified deletion…":"Delete account and personal data"}</button></form>{message&&<p className="dataMessage" role="status">{message}</p>}</section>;
}

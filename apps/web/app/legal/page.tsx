import type { Metadata } from "next";
import { LEGAL_NOTICE_REVIEWED_AT, legalNoticeSections } from "@claimgrid/core";
import "./legal.css";

export const metadata: Metadata = {
  title: "Legal & verification notice — ClaimGrid",
  description: "Understand ClaimGrid's research limitations and required authoritative verification."
};

export default function LegalPage() {
  return <main className="legalPage"><nav><a className="legalBrand" href="/"><span>CG</span>ClaimGrid</a><a href="/">Back home</a></nav><div className="legalShell"><header><span>LEGAL & VERIFICATION NOTICE</span><h1>Research support is not a land-status decision.</h1><p>Read these limits before relying on any ClaimGrid map, workflow, reminder, worksheet, or field record.</p><small>Last product review: {LEGAL_NOTICE_REVIEWED_AT}</small></header><div className="legalWarning"><b>Never use map data alone to decide that land is available.</b><p>Only current authoritative records, applicable law, agency confirmation, and field verification can support a real-world decision.</p></div><div className="legalGrid">{legalNoticeSections.map((section,index)=><section key={section.id}><span>{String(index+1).padStart(2,"0")}</span><h2>{section.title}</h2><p>{section.body}</p></section>)}</div><footer><p>This product notice is part of ClaimGrid’s safety design. It is not a substitute for terms of service or a privacy policy reviewed by qualified counsel before commercial launch.</p><a href="/privacy">Privacy & local data</a></footer></div></main>;
}

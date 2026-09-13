import Link from "next/link";
import ClaimsExplorer from "./ClaimsExplorer";
import "./explore.css";
export const metadata = { title: "Research map — ClaimGrid" };
export default function ExplorePage() { return <main><nav className="nav shell"><Link className="brand" href="/"><span className="brandMark">CG</span>ClaimGrid</Link><div className="navLinks"><Link href="/">Home</Link><a href="https://www.blm.gov/services/land-records/mlrs" target="_blank" rel="noreferrer">About MLRS ↗</a></div><span className="sourceBadge">BLM source connected</span></nav><div className="exploreHero shell"><div className="eyebrow">Research before you travel</div><h1>Active claims,<br/><em>with context.</em></h1><p>Explore mapped BLM claim records without confusing an incomplete map with a legal land-status determination.</p></div><div className="shell"><ClaimsExplorer /></div></main>; }

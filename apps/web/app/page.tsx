import { federalWorkflow } from "@claimgrid/core";

const sampleAreas = [
  { name: "Walker Lane", state: "Nevada", note: "Research workspace", tone: "gold" },
  { name: "Mother Lode", state: "California", note: "High claim density", tone: "rust" },
  { name: "Bradshaw Mtns.", state: "Arizona", note: "Land status review", tone: "sage" }
];

export default function Home() {
  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#top"><span className="brandMark">CG</span>ClaimGrid</a>
        <div className="navLinks"><a href="#map">Explore</a><a href="#process">How it works</a><a href="#pricing">Pricing</a></div>
        <button className="quietButton">Sign in</button>
      </nav>

      <section id="top" className="hero shell">
        <div className="eyebrow">The modern field guide to mineral claims</div>
        <h1>Find your ground.<br/><em>Know the process.</em></h1>
        <p>Research federal mineral lands, prepare for the field, and keep every deadline and document organized in one place.</p>
        <div className="actions"><button className="primary">Open the map <span>↗</span></button><a href="#process">See how it works</a></div>
        <div className="trust"><span>Official-source overlays</span><span>State-aware checklists</span><span>Field-ready workflow</span></div>
      </section>

      <section id="map" className="mapSection shell">
        <div className="mapPanel">
          <div className="mapHeader"><div><small>RESEARCH MAP</small><strong>Western United States</strong></div><span className="liveDot">Live source</span></div>
          <div className="mapCanvas" role="img" aria-label="Stylized preview of the ClaimGrid research map">
            <div className="terrain terrainOne"/><div className="terrain terrainTwo"/><div className="terrain terrainThree"/>
            <div className="claim claimOne">Active claims</div><div className="claim claimTwo">Research area</div>
            <div className="mapWarning"><b>Screening layer</b><span>Verify land status, records, and monuments before acting.</span></div>
            <div className="mapControls"><button>+</button><button>−</button></div>
          </div>
        </div>
        <aside className="researchCard">
          <span className="stepLabel">AREA WORKSPACE</span><h2>Build an evidence trail before you drive.</h2>
          <p>Save coordinates, inspect official claim records, track when each source was checked, and export a field packet.</p>
          <ul><li>BLM active-claim overlay</li><li>Withdrawal and ownership checks</li><li>County + state requirements</li><li>Offline field notes</li></ul>
          <button className="darkButton">Start research</button>
        </aside>
      </section>

      <section className="areas shell">
        <div className="sectionHeading"><span>Saved research</span><h2>Your ground, organized.</h2></div>
        <div className="areaGrid">{sampleAreas.map(area => <article key={area.name} className={`areaCard ${area.tone}`}><span>{area.state}</span><h3>{area.name}</h3><p>{area.note}</p><button aria-label={`Open ${area.name}`}>→</button></article>)}</div>
      </section>

      <section id="process" className="process">
        <div className="shell"><div className="sectionHeading light"><span>From research to record</span><h2>A process you can actually follow.</h2></div>
          <div className="steps">{federalWorkflow.slice(0,6).map((step,index) => <article key={step.id}><b>{String(index+1).padStart(2,"0")}</b><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
        </div>
      </section>

      <section id="pricing" className="pricing shell">
        <div><span className="stepLabel">BUILT FOR SERIOUS RESEARCH</span><h2>Explore free. Go Pro when you find promising ground.</h2><p>The core map and education stay accessible. Pro unlocks saved projects, document packets, offline field mode, deadline tracking, and monitored areas.</p></div>
        <div className="priceCard"><small>CLAIMGRID PRO</small><div><strong>$19</strong><span>/ month</span></div><p>Planned launch pricing</p><button className="primary">Join early access</button></div>
      </section>

      <footer className="shell"><a className="brand" href="#top"><span className="brandMark">CG</span>ClaimGrid</a><p>Research tools, not legal advice. Always verify with BLM, the county, the state, and conditions on the ground.</p></footer>
    </main>
  );
}


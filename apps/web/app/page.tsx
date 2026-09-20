import {
  arizonaWorkflow,
  californiaWorkflow,
  federalWorkflow,
  nevadaWorkflow,
} from "@claimgrid/core";

const stateGuides = [
  {
    workflow: nevadaWorkflow,
    name: "Nevada",
    href: "/claim/nevada",
    note: "State, county, field, and BLM gates",
    tone: "gold",
  },
  {
    workflow: californiaWorkflow,
    name: "California",
    href: "/claim/california",
    note: "Mineral estate, withdrawal, and surface-use checks",
    tone: "rust",
  },
  {
    workflow: arizonaWorkflow,
    name: "Arizona",
    href: "/claim/arizona",
    note: "Federal versus State Trust Land verification",
    tone: "sage",
  },
];

export default function Home() {
  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#top">
          <span className="brandMark">CG</span>ClaimGrid
        </a>
        <div className="navLinks">
          <a href="#map">Explore</a>
          <a href="#process">How it works</a>
          <a href="/pricing">Pricing</a>
        </div>
        <a className="quietButton" href="/privacy">
          Local data controls
        </a>
      </nav>

      <section id="top" className="hero shell">
        <div className="eyebrow">The modern field guide to mineral claims</div>
        <h1>
          Find your ground.
          <br />
          <em>Know the process.</em>
        </h1>
        <p>
          Research federal mineral lands, prepare for the field, and keep every
          deadline and document organized in one place.
        </p>
        <div className="actions">
          <a className="primary" href="/explore">
            Open the live map <span>↗</span>
          </a>
          <a href="#process">See how it works</a>
        </div>
        <div className="trust">
          <span>Official-source overlays</span>
          <span>State-aware checklists</span>
          <span>Field-ready workflow</span>
        </div>
      </section>

      <section id="map" className="mapSection shell">
        <div className="mapPanel">
          <div className="mapHeader">
            <div>
              <small>RESEARCH MAP</small>
              <strong>Western United States</strong>
            </div>
            <span className="liveDot">Live source</span>
          </div>
          <div
            className="mapCanvas"
            role="img"
            aria-label="Stylized preview of the ClaimGrid research map"
          >
            <div className="terrain terrainOne" />
            <div className="terrain terrainTwo" />
            <div className="terrain terrainThree" />
            <div className="claim claimOne">Active claims</div>
            <div className="claim claimTwo">Research area</div>
            <div className="mapWarning">
              <b>Screening layer</b>
              <span>
                Verify land status, records, and monuments before acting.
              </span>
            </div>
            <div className="mapControls">
              <button>+</button>
              <button>−</button>
            </div>
          </div>
        </div>
        <aside className="researchCard">
          <span className="stepLabel">AREA WORKSPACE</span>
          <h2>Build an evidence trail before you drive.</h2>
          <p>
            Save coordinates, inspect official claim records, track when each
            source was checked, and export a field packet.
          </p>
          <ul>
            <li>BLM active-claim overlay</li>
            <li>Withdrawal and ownership checks</li>
            <li>County + state requirements</li>
            <li>Offline field notes</li>
          </ul>
          <a className="darkButton" href="/claim/new">
            Start a claim project
          </a>
        </aside>
      </section>

      <section className="areas shell" aria-labelledby="state-guides-heading">
        <div className="sectionHeading">
          <span>Source-reviewed guidance</span>
          <h2 id="state-guides-heading">Start with your state workflow.</h2>
          <p>
            ClaimGrid currently provides guided workflows for these states. Your
            progress stays in this browser; cloud accounts and synchronization
            are not active yet.
          </p>
        </div>
        <div className="areaGrid">
          {stateGuides.map(({ workflow, name, href, note, tone }) => (
            <article key={workflow.state} className={`areaCard ${tone}`}>
              <span>
                {workflow.state} · {workflow.steps.length} verification gates
              </span>
              <h3>{name}</h3>
              <p>{note}</p>
              <a href={href} aria-label={`Open the ${name} claim workflow`}>
                →
              </a>
            </article>
          ))}
        </div>
      </section>

      <section id="process" className="process">
        <div className="shell">
          <div className="sectionHeading light">
            <span>From research to record</span>
            <h2>A process you can actually follow.</h2>
          </div>
          <div className="steps">
            {federalWorkflow.slice(0, 6).map((step, index) => (
              <article key={step.id}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="pricing shell">
        <div>
          <span className="stepLabel">BUILT FOR SERIOUS RESEARCH</span>
          <h2>Explore free. Go Pro when you find promising ground.</h2>
          <p>
            The core map and education stay accessible. Pro unlocks saved
            projects, document packets, offline field mode, deadline tracking,
            and monitored areas.
          </p>
        </div>
        <div className="priceCard">
          <small>CLAIMGRID PRO</small>
          <div>
            <strong>$19</strong>
            <span>/ month</span>
          </div>
          <p>Planned launch pricing</p>
          <a className="primary" href="/pricing">
            View plans
          </a>
        </div>
      </section>

      <footer className="shell">
        <a className="brand" href="#top">
          <span className="brandMark">CG</span>ClaimGrid
        </a>
        <p>
          Research tools, not legal advice. Always verify with BLM, the county,
          the state, and conditions on the ground.
        </p>
        <div><a href="/legal">Legal & verification</a><a href="/privacy">Privacy & local data</a></div>
      </footer>
    </main>
  );
}

# ClaimGrid

ClaimGrid is a web and mobile workspace for researching U.S. federal land, organizing field work, and completing the administrative steps involved in locating a mining claim.

## Product principles

- **Research, not a guarantee.** A map result is a screening aid. It is not a legal determination that land is open to mineral entry.
- **Official sources first.** Claim overlays should come from BLM MLRS/ArcGIS services and link users back to authoritative records.
- **Field verification is mandatory.** Existing monuments, discoveries, land status, withdrawals, and state rules must be verified outside the app.
- **State-aware workflows.** Monument and county recording requirements vary by jurisdiction.
- **No one-click claim promises.** ClaimGrid prepares, tracks, and explains; the claimant remains responsible for physical and legal steps.

## Architecture

- `apps/web`: Next.js web experience and deployable Vercel app
- `apps/mobile`: Expo/React Native field companion
- `packages/core`: shared claim types, workflow rules, and BLM source configuration
- `docs`: product, data, compliance, and monetization decisions

## Local development

```bash
npm install
npm run dev:web
```

For mobile:

```bash
npm run dev:mobile
```

## Initial roadmap

1. Live BLM active-claim overlay and federal surface-management layers
2. Parcel/area research workspace with saved coordinates and source timestamps
3. State-specific eligibility and staking checklist
4. Field mode for GPS corners, photos, notes, and offline drafts
5. Guided county + BLM filing packet and 90-day deadline tracker
6. Claim dashboard, annual maintenance reminders, and community observations
7. Pro subscription for saved projects, document generation, offline maps, and monitoring

## Official starting points

- BLM mining claims: https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-minerals/mining-claims
- BLM MLRS: https://www.blm.gov/services/land-records/mlrs
- BLM active mining claims ArcGIS layer: https://gis.blm.gov/nlsdb/rest/services/Mining_Claims/MiningClaims/MapServer/1

ClaimGrid is not a law firm, title company, land surveyor, government agency, or substitute for professional advice.


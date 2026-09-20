export const LEGAL_NOTICE_REVIEWED_AT = "2026-09-20";

export const legalNoticeSections = [
  {
    id: "research-only",
    title: "Research and organization only",
    body: "ClaimGrid is an educational research and record-organization tool. It does not provide legal, surveying, geological, financial, or filing advice and does not create, locate, perfect, maintain, transfer, or validate a mining claim."
  },
  {
    id: "no-availability",
    title: "No land-availability determination",
    body: "A gap, boundary, status, attribute, or apparent absence on a map never establishes that land is open or legally available for mineral entry. Map and service data can be delayed, incomplete, generalized, misaligned, or subject to later correction."
  },
  {
    id: "authoritative-records",
    title: "Authoritative verification is required",
    body: "Before acting, independently verify current BLM and MLRS case files, land and mineral ownership, withdrawals and segregations, existing rights, legal descriptions, county and state records, monuments, access, surface-use restrictions, and conditions on the ground."
  },
  {
    id: "deadlines-filings",
    title: "Deadlines and filings remain your responsibility",
    body: "ClaimGrid reminders, worksheets, exports, checklists, and document preparation screens do not file, record, sign, notarize, pay, submit, or preserve rights. Confirm every deadline, form, fee, office, and acceptance requirement directly with the responsible authority."
  },
  {
    id: "field-data",
    title: "Device readings are not surveys",
    body: "Phone GPS, photos, notes, and offline observations are field aids only. They are not legal surveys, certified corner positions, proof of discovery, proof of access, proof of compliance, or evidence that a claim is valid."
  },
  {
    id: "professional-review",
    title: "Use qualified professional review",
    body: "Mining and land-status rules vary by location and change over time. Consult the relevant agencies and qualified legal, surveying, geological, environmental, and tax professionals when the decision or filing matters."
  }
] as const;

export function legalNoticeHasRequiredSafeguards() {
  const text = legalNoticeSections.map(section => section.body).join(" ").toLowerCase();
  return ["does not provide legal", "never establishes", "independently verify", "do not file", "not legal surveys"].every(phrase => text.includes(phrase));
}

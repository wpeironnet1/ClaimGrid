export interface NevadaPacketDraft {
  claimName: string; claimType: string; locatorNames: string; mailingAddress: string; county: string; locationDate: string; landDescription: string;
  mapHasNorthArrow: boolean; mapHasScale: boolean; mapHasClaimBoundaries: boolean; mapMatchesDescription: boolean;
}
export interface PacketReview { status: "incomplete" | "agency-review-required"; completed: number; total: number; missing: string[]; warnings: string[]; }
export function reviewNevadaPacket(draft: NevadaPacketDraft): PacketReview {
  const checks: [boolean,string][]= [
    [Boolean(draft.claimName.trim()),"Claim name or number"],[Boolean(draft.claimType.trim()),"Claim or site type"],[Boolean(draft.locatorNames.trim()),"Every locator name"],
    [Boolean(draft.mailingAddress.trim()),"Current mailing address for every locator"],[Boolean(draft.county.trim()),"Nevada county"],[/^\d{4}-\d{2}-\d{2}$/.test(draft.locationDate),"Physical location date"],
    [Boolean(draft.landDescription.trim()),"PLSS or applicable metes-and-bounds land description"],[draft.mapHasNorthArrow,"Map north arrow"],[draft.mapHasScale,"Map scale"],
    [draft.mapHasClaimBoundaries,"Mapped claim boundaries and position"],[draft.mapMatchesDescription,"Map and certificate cross-check"]
  ];
  const missing=checks.filter(([complete])=>!complete).map(([,label])=>label);
  return {status:missing.length?"incomplete":"agency-review-required",completed:checks.length-missing.length,total:checks.length,missing,warnings:[
    "This worksheet does not generate, sign, notarize, record, or file a legal document.",
    "Confirm the current form, fees, deadlines, land description, signatures, map format, and filing method with the county recorder and BLM immediately before filing."
  ]};
}
export function parseNevadaPacket(raw:string|null):NevadaPacketDraft|null{if(!raw)return null;try{const value=JSON.parse(raw);if(!value||typeof value!=="object")return null;const texts=["claimName","claimType","locatorNames","mailingAddress","county","locationDate","landDescription"],bools=["mapHasNorthArrow","mapHasScale","mapHasClaimBoundaries","mapMatchesDescription"];if(!texts.every(k=>typeof value[k]==="string")||!bools.every(k=>typeof value[k]==="boolean"))return null;return value as NevadaPacketDraft}catch{return null}}

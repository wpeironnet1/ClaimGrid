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

export interface FederalPacketDraft {
  claimName: string; claimType: string; locatorNames: string; mailingAddress: string; state: string; county: string; locationDate: string; acreage: string; landDescription: string; countyDocumentNumber: string;
  countyCopyReady: boolean; mapAttached: boolean; mapMatchesLocation: boolean; currentFeesChecked: boolean;
}
const FEDERAL_TEXT_FIELDS = ["claimName","claimType","locatorNames","mailingAddress","state","county","locationDate","acreage","landDescription","countyDocumentNumber"] as const;
const FEDERAL_BOOLEAN_FIELDS = ["countyCopyReady","mapAttached","mapMatchesLocation","currentFeesChecked"] as const;
export function reviewFederalPacket(draft: FederalPacketDraft): PacketReview {
  const acreage=Number(draft.acreage);
  const checks:[boolean,string][]= [
    [Boolean(draft.claimName.trim()),"Claim or site name"],[Boolean(draft.claimType.trim()),"Claim or site type"],[Boolean(draft.locatorNames.trim()),"Every claimant name"],[Boolean(draft.mailingAddress.trim()),"Current mailing address for every claimant"],
    [/^[A-Z]{2}$/.test(draft.state),"Two-letter state code"],[Boolean(draft.county.trim()),"County or borough"],[/^\d{4}-\d{2}-\d{2}$/.test(draft.locationDate),"Physical location date"],[Number.isFinite(acreage)&&acreage>0&&acreage<=10000,"Claimed acreage"],
    [Boolean(draft.landDescription.trim()),"PLSS or other accepted legal land description"],[Boolean(draft.countyDocumentNumber.trim()),"County recording reference"],[draft.countyCopyReady,"Recorded county notice copy"],[draft.mapAttached,"Claim-boundary map"],[draft.mapMatchesLocation,"Map, notice, and physical location cross-check"],[draft.currentFeesChecked,"Current BLM fees checked"]
  ];
  const missing=checks.filter(([complete])=>!complete).map(([,label])=>label);
  return {status:missing.length?"incomplete":"agency-review-required",completed:checks.length-missing.length,total:checks.length,missing,warnings:["This worksheet is not a BLM or county form and does not create, record, file, validate, or maintain a mining claim.","Confirm land and mineral status, discovery, the recorded county document, legal description, map, current fees, signatures, deadlines, and filing method with BLM and the county immediately before filing."]};
}
export function parseFederalPacket(raw:string|null):FederalPacketDraft|null {
  if(!raw||raw.length>20_000)return null;
  try {const value=JSON.parse(raw) as Record<string,unknown>;if(!value||typeof value!=="object"||!FEDERAL_TEXT_FIELDS.every(key=>typeof value[key]==="string"&&(value[key] as string).length<=4000)||!FEDERAL_BOOLEAN_FIELDS.every(key=>typeof value[key]==="boolean"))return null;if(!/^[A-Z]{2}$/.test(value.state as string)||!/^[a-z]{3,10}$/.test(value.claimType as string))return null;return value as unknown as FederalPacketDraft}catch{return null}
}

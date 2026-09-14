export interface LocalRecordDefinition { key: string; label: string; description: string }
export interface LocalRecord extends LocalRecordDefinition { value: string }
export interface LocalDataExport { schema: "claimgrid-local-data-v1"; exportedAt: string; storage: "browser-local"; records: LocalRecord[] }

export const claimGridLocalRecords: readonly LocalRecordDefinition[] = [
  { key: "claimgrid.research-areas.v1", label: "Saved research areas", description: "Map bounds, source timestamps, and mapped-record counts." },
  { key: "claimgrid.claim-draft.v1", label: "Claim project draft", description: "Project intake, location date, and federal deadline target." },
  { key: "claimgrid.workflow.nv.v1", label: "Nevada workflow progress", description: "Completed Nevada verification gates." },
  { key: "claimgrid.deadlines.v1", label: "Tracked deadlines", description: "Federal and source-confirmed county filing dates." },
  { key: "claimgrid.nevada-packet.v1", label: "Nevada document worksheet", description: "Locators, land description, and map cross-checks." }
] as const;

export function collectLocalRecords(read: (key: string) => string | null): LocalRecord[] {
  return claimGridLocalRecords.flatMap(definition => {
    const value = read(definition.key);
    return value === null ? [] : [{ ...definition, value }];
  });
}

export function createLocalDataExport(records: LocalRecord[], now = new Date()): LocalDataExport {
  return { schema: "claimgrid-local-data-v1", exportedAt: now.toISOString(), storage: "browser-local", records: records.map(record => ({ ...record })) };
}

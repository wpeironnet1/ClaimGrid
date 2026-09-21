export interface LocalRecordDefinition { key: string; label: string; description: string }
export interface LocalRecord extends LocalRecordDefinition { value: string }
export interface LocalDataExport { schema: "claimgrid-local-data-v1"; exportedAt: string; storage: "browser-local"; records: LocalRecord[] }

export const claimGridLocalRecords: readonly LocalRecordDefinition[] = [
  { key: "claimgrid:research:v1", label: "Saved research areas", description: "Map bounds, source timestamps, and mapped-record counts." },
  { key: "claimgrid:claim-bookmarks:v1", label: "Saved BLM claim records", description: "Sanitized BLM record attributes, source timestamps, and research viewports." },
  { key: "claimgrid.claim-draft.v1", label: "Claim project draft", description: "Project intake, location date, and federal deadline target." },
  { key: "claimgrid.workflow.nv.v1", label: "Nevada workflow progress", description: "Completed Nevada verification gates." },
  { key: "claimgrid.workflow.az.v1", label: "Arizona workflow progress", description: "Completed Arizona verification gates." },
  { key: "claimgrid.workflow.ca.v1", label: "California workflow progress", description: "Completed California verification gates." },
  { key: "claimgrid.workflow.or.v1", label: "Oregon workflow progress", description: "Completed Oregon verification gates." },
  { key: "claimgrid.workflow.ut.v1", label: "Utah workflow progress", description: "Completed Utah verification gates." },
  { key: "claimgrid.workflow.co.v1", label: "Colorado workflow progress", description: "Completed Colorado verification gates." },
  { key: "claimgrid.workflow.id.v1", label: "Idaho workflow progress", description: "Completed Idaho verification gates." },
  { key: "claimgrid.deadlines.v1", label: "Tracked deadlines", description: "Federal and source-confirmed county filing dates." },
  { key: "claimgrid.packet.nv.v1", label: "Nevada document worksheet", description: "Locators, land description, and map cross-checks." },
  { key: "claimgrid.packet.blm.v1", label: "BLM recording worksheet", description: "Claimant, county-recording, map, acreage, and fee cross-checks." }
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


export type LocalDataImportResult = { ok: true; records: LocalRecord[] } | { ok: false; error: string };
const MAX_BACKUP_BYTES = 5_000_000;
const MAX_RECORD_BYTES = 1_000_000;

export function parseLocalDataExport(raw: string): LocalDataImportResult {
  if (raw.length > MAX_BACKUP_BYTES) return { ok: false, error: "Backup exceeds the 5 MB safety limit." };
  try {
    const candidate = JSON.parse(raw) as Partial<LocalDataExport>;
    if (candidate.schema !== "claimgrid-local-data-v1" || candidate.storage !== "browser-local" || !Array.isArray(candidate.records)) return { ok: false, error: "This is not a supported ClaimGrid browser backup." };
    if (candidate.records.length > claimGridLocalRecords.length) return { ok: false, error: "Backup contains too many record types." };
    const definitions = new Map(claimGridLocalRecords.map(record => [record.key, record]));
    const seen = new Set<string>();
    const records: LocalRecord[] = [];
    for (const item of candidate.records) {
      if (!item || typeof item !== "object" || typeof item.key !== "string" || typeof item.value !== "string") return { ok: false, error: "Backup contains a malformed record." };
      const definition = definitions.get(item.key);
      if (!definition) return { ok: false, error: "Backup contains an unknown storage key." };
      if (seen.has(item.key)) return { ok: false, error: "Backup contains a duplicate storage key." };
      if (item.value.length > MAX_RECORD_BYTES) return { ok: false, error: "A backup record exceeds the 1 MB safety limit." };
      try { JSON.parse(item.value); } catch { return { ok: false, error: "A backup record does not contain valid JSON." }; }
      seen.add(item.key); records.push({ ...definition, value: item.value });
    }
    return { ok: true, records };
  } catch {
    return { ok: false, error: "Backup is not valid JSON." };
  }
}

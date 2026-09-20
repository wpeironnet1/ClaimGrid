export type DeadlineKind = "county" | "federal" | "maintenance";
export type DeadlineStatus = "overdue" | "urgent" | "upcoming" | "later";

export interface TrackedDeadline {
  id: string;
  kind: DeadlineKind;
  label: string;
  dueDate: string;
  authority: string;
  sourceUrl: string;
  verifiedAt: string;
  manuallyVerified: boolean;
}

export function createTrackedDeadline(
  input: Omit<TrackedDeadline, "id">,
): TrackedDeadline {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ||
    Number.isNaN(Date.parse(`${input.dueDate}T12:00:00Z`))
  )
    throw new Error("Enter a valid deadline date.");
  if (!input.authority.trim())
    throw new Error("Name the authority that supplied this deadline.");
  if (!input.sourceUrl.startsWith("https://"))
    throw new Error("Add an HTTPS source for this deadline.");
  if (input.kind === "county" && !input.manuallyVerified)
    throw new Error(
      "County deadlines must be confirmed with the recorder before tracking.",
    );
  return {
    ...input,
    id: `${input.kind}-${input.dueDate}`,
    label: input.label.trim(),
    authority: input.authority.trim(),
  };
}

export function daysUntilDeadline(dueDate: string, today = new Date()): number {
  const due = Date.parse(`${dueDate}T12:00:00Z`);
  const start = Date.parse(`${today.toISOString().slice(0, 10)}T12:00:00Z`);
  return Math.round((due - start) / 86_400_000);
}

export function deadlineStatus(
  dueDate: string,
  today = new Date(),
): DeadlineStatus {
  const days = daysUntilDeadline(dueDate, today);
  if (days < 0) return "overdue";
  if (days <= 14) return "urgent";
  if (days <= 45) return "upcoming";
  return "later";
}

export function parseTrackedDeadlines(raw: string | null): TrackedDeadline[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is TrackedDeadline =>
          typeof item?.id === "string" &&
          typeof item?.dueDate === "string" &&
          typeof item?.sourceUrl === "string" &&
          item.sourceUrl.startsWith("https://") &&
          (item.kind !== "county" || item.manuallyVerified === true),
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

const CALENDAR_WARNING =
  "Reminder only. This event does not file, record, mail, or preserve a mining claim. Confirm current requirements and timely receipt with each authority.";

function escapeCalendarText(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function calendarDateAfter(date: string): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10).replaceAll("-", "");
}

export function createDeadlineCalendar(
  deadlines: readonly TrackedDeadline[],
  projectName = "Claim project",
  now = new Date(),
): string {
  const safe = deadlines.map((item) => {
    const { id: _id, ...input } = item;
    return createTrackedDeadline(input);
  });
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClaimGrid//Filing Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ClaimGrid filing deadlines",
  ];
  for (const item of safe) {
    const description = `${item.kind.toUpperCase()} deadline. Authority: ${item.authority}. Source verified: ${item.verifiedAt}. ${CALENDAR_WARNING}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeCalendarText(item.id)}@claimgrid.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${item.dueDate.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${calendarDateAfter(item.dueDate)}`,
      `SUMMARY:${escapeCalendarText(`${projectName} — ${item.label}`)}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
      `URL:${item.sourceUrl}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  createDeadlineCalendar,
  createTrackedDeadline,
  deadlineStatus,
  daysUntilDeadline,
  parseClaimDraft,
  parseTrackedDeadlines,
  type ClaimDraft,
  type TrackedDeadline,
} from "@claimgrid/core";

const DEADLINES_KEY = "claimgrid.deadlines.v1",
  DRAFT_KEY = "claimgrid.claim-draft.v1";
export default function DeadlineTracker() {
  const [draft, setDraft] = useState<ClaimDraft | null>(null),
    [deadlines, setDeadlines] = useState<TrackedDeadline[]>([]);
  const [dueDate, setDueDate] = useState(""),
    [authority, setAuthority] = useState(""),
    [sourceUrl, setSourceUrl] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const savedDraft = parseClaimDraft(localStorage.getItem(DRAFT_KEY));
    const saved = parseTrackedDeadlines(localStorage.getItem(DEADLINES_KEY));
    if (
      savedDraft?.federalRecordingDeadline &&
      !saved.some((item) => item.kind === "federal")
    ) {
      saved.unshift(
        createTrackedDeadline({
          kind: "federal",
          label: "BLM recording — 90-day maximum",
          dueDate: savedDraft.federalRecordingDeadline,
          authority: "U.S. Bureau of Land Management",
          sourceUrl:
            "https://www.blm.gov/programs/energy-and-minerals/mining-and-minerals/locatable-minerals/mining-claims",
          verifiedAt: new Date().toISOString().slice(0, 10),
          manuallyVerified: true,
        }),
      );
      localStorage.setItem(DEADLINES_KEY, JSON.stringify(saved));
    }
    setDraft(savedDraft);
    setDeadlines(saved);
  }, []);
  function addCounty(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const item = createTrackedDeadline({
        kind: "county",
        label: "County recording deadline",
        dueDate,
        authority,
        sourceUrl,
        verifiedAt: new Date().toISOString().slice(0, 10),
        manuallyVerified: confirmed,
      });
      const next = [
        item,
        ...deadlines.filter((existing) => existing.id !== item.id),
      ];
      setDeadlines(next);
      localStorage.setItem(DEADLINES_KEY, JSON.stringify(next));
      setDueDate("");
      setAuthority("");
      setSourceUrl("");
      setConfirmed(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save deadline.",
      );
    }
  }
  function remove(id: string) {
    const next = deadlines.filter((item) => item.id !== id);
    setDeadlines(next);
    localStorage.setItem(DEADLINES_KEY, JSON.stringify(next));
  }
  function exportCalendar() {
    const calendar = createDeadlineCalendar(
      deadlines,
      draft?.name ?? "Claim project",
    );
    const url = URL.createObjectURL(
      new Blob([calendar], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `claimgrid-deadlines-${new Date().toISOString().slice(0, 10)}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="deadlinePage">
      <nav>
        <a href="/" className="deadlineBrand">
          <span>CG</span>ClaimGrid
        </a>
        <div>
          <a href="/claim/new">Project</a>
          <a href="/explore">Map</a>
        </div>
      </nav>
      <div className="deadlineShell">
        <header>
          <span>FILING CONTROL CENTER</span>
          <h1>Know which clock runs first.</h1>
          <p>
            Federal and county deadlines are separate. ClaimGrid only calculates
            the federal 90-day maximum; enter a county deadline only after
            verifying it with the responsible recorder.
          </p>
        </header>
        <section className="deadlineGrid">
          <div>
            <div className="deadlineHeading">
              <h2>Tracked dates</h2>
              {deadlines.length > 0 && (
                <button onClick={exportCalendar}>Export calendar (.ics)</button>
              )}
            </div>
            {deadlines.length === 0 ? (
              <div className="emptyDeadline">
                <b>No filing clock yet</b>
                <p>
                  Create a project with a physical location date or add a
                  recorder-confirmed county deadline.
                </p>
              </div>
            ) : (
              [...deadlines]
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .map((item) => {
                  const status = deadlineStatus(item.dueDate),
                    days = daysUntilDeadline(item.dueDate);
                  return (
                    <article className={`deadlineCard ${status}`} key={item.id}>
                      <div>
                        <small>
                          {item.kind} · {status}
                        </small>
                        <h3>{item.label}</h3>
                        <p>{draft?.name ?? "Claim project"}</p>
                      </div>
                      <div className="dateBlock">
                        <b>{item.dueDate}</b>
                        <span>
                          {days < 0
                            ? `${Math.abs(days)} days overdue`
                            : days === 0
                              ? "Due today"
                              : `${days} days left`}
                        </span>
                      </div>
                      <footer>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.authority} ↗
                        </a>
                        <span>Verified {item.verifiedAt}</span>
                        <button onClick={() => remove(item.id)}>Remove</button>
                      </footer>
                    </article>
                  );
                })
            )}
            <p className="calendarNote">
              Calendar events are reminders only. They include the official
              source and verification date, but do not file documents or
              guarantee a deadline is current.
            </p>
          </div>
          <aside>
            <h2>Add county deadline</h2>
            <form onSubmit={addCounty}>
              <label>
                Due date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Recorder / authority
                <input
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  placeholder="e.g. Nye County Recorder"
                  required
                />
              </label>
              <label>
                Official source URL
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://…"
                  required
                />
              </label>
              <label className="confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  required
                />
                <span>
                  I confirmed this date with the recorder or its current
                  official instructions. I understand county rules may be
                  earlier than BLM’s deadline.
                </span>
              </label>
              {error && (
                <p role="alert" className="deadlineError">
                  {error}
                </p>
              )}
              <button className="addDeadline">Track verified date</button>
            </form>
            <div className="deadlineWarning">
              <b>Not a filing service</b>
              <p>
                A reminder does not submit, record, mail, or preserve a claim.
                Keep proof of timely receipt from each authority.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

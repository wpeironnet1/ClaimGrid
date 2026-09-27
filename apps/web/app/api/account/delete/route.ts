import { NextRequest, NextResponse } from "next/server";
import { accountDeletionConfiguration, createSafeServerErrorEvent, isAccountDeletionConfirmed, parseAccountDeletionAcknowledgement, parseAccountSessionToken, parseVerifiedAccountSession } from "@claimgrid/core";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid deletion origin." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return NextResponse.json({ error: "Deletion request is too large." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    input = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "Enter the required deletion confirmation exactly." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  if (!isAccountDeletionConfirmed(input)) return NextResponse.json({ error: "Enter the required deletion confirmation exactly." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (!accountDeletionConfiguration(process.env).ready) return NextResponse.json({ error: "Account deletion is not connected yet. No account data was changed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const sessionToken = parseAccountSessionToken(request.cookies.get("claimgrid_session")?.value);
  if (!sessionToken) return NextResponse.json({ error: "Sign in to the account you want to delete." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const sessionResponse = await fetch(process.env.CLAIMGRID_ACCOUNT_SESSION_URL!, { method: "POST", headers: { Authorization: `Bearer ${process.env.CLAIMGRID_ACCOUNT_SESSION_TOKEN}`, "Content-Type": "application/json", "X-ClaimGrid-Session": sessionToken }, body: "{}", cache: "no-store", signal: AbortSignal.timeout(5000) });
    const rawSession = await sessionResponse.text();
    if (!sessionResponse.ok || rawSession.length > 8192) throw new Error("Session verification failed");
    const account = parseVerifiedAccountSession(JSON.parse(rawSession));
    if (!account) throw new Error("Session verification failed");
    const requestedAt = new Date().toISOString();
    const deletionResponse = await fetch(process.env.CLAIMGRID_ACCOUNT_DELETE_URL!, { method: "POST", headers: { Authorization: `Bearer ${process.env.CLAIMGRID_ACCOUNT_DELETE_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ schemaVersion: 1, accountId: account.accountId, requestedAt, scope: "account-and-personal-data", cancelSubscriptions: true }), cache: "no-store", signal: AbortSignal.timeout(8000) });
    const rawAcknowledgement = await deletionResponse.text();
    if (!deletionResponse.ok || rawAcknowledgement.length > 8192) throw new Error("Deletion acknowledgement failed");
    const acknowledgement = parseAccountDeletionAcknowledgement(JSON.parse(rawAcknowledgement), account.accountId);
    if (!acknowledgement) throw new Error("Deletion acknowledgement failed");
    const response = NextResponse.json({ deleted: true, deletedAt: acknowledgement.deletedAt, message: "The account service confirmed deletion of the account and associated personal data." }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("claimgrid_session", "", { expires: new Date(0), httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    return response;
  } catch (error) {
    console.error(JSON.stringify(createSafeServerErrorEvent({ error, method: "POST", route: "/api/account/delete", routeType: "route", release: process.env.VERCEL_GIT_COMMIT_SHA })));
    return NextResponse.json({ error: "Account deletion could not be confirmed. No success was recorded; contact support before assuming data was deleted." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

// app/api/convert/url/route.ts
//
// Server-side proxy: takes a URL from the browser and forwards it to the
// backend's /v1/convert/url endpoint. The BACKEND_API_KEY never leaves the server.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, incrementUsage } from '@/lib/rate-limit';
import { getPostHogClient } from '@/lib/posthog-server';

export const runtime     = 'nodejs';
export const maxDuration = 60; // seconds — remote fetch + conversion

const BACKEND_URL     = process.env.BACKEND_URL;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

export async function POST(req: NextRequest) {
  // ── 1. Validate server config ──────────────────────────────
  if (!BACKEND_URL || !BACKEND_API_KEY) {
    console.error('[/api/convert/url] Missing BACKEND_URL or BACKEND_API_KEY env vars');
    return NextResponse.json(
      { error: 'SERVER_MISCONFIGURED', message: 'Backend connection is not configured.' },
      { status: 500 }
    );
  }

  // ── 2. Rate limit check ────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const identifier = user ? user.id : getClientIp(req);
  const identifierType: 'user' | 'ip' = user ? 'user' : 'ip';

  const rateCheck = await checkRateLimit(identifier, identifierType);

  if (!rateCheck.allowed) {
    const message = user
      ? `Daily limit of ${rateCheck.limit} conversions reached. Resets at midnight UTC.`
      : `Daily conversion limit reached. Sign in for more conversions.`;

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: identifier,
      event: 'conversion_rate_limited',
      properties: { identifier_type: identifierType, limit: rateCheck.limit, source: 'url' },
    });
    await posthog.shutdown();

    return NextResponse.json(
      { error: 'RATE_LIMITED', message, limit: rateCheck.limit, remaining: 0, resetsAt: rateCheck.resetsAt },
      { status: 429, headers: { 'X-RateLimit-Limit': String(rateCheck.limit), 'X-RateLimit-Remaining': '0' } }
    );
  }

  // ── 3. Parse + validate the URL ────────────────────────────
  let body: { url?: string; filename?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Request body must be JSON.' },
      { status: 400 }
    );
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: 'MISSING_URL', message: 'A url is required.' }, { status: 400 });
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('not http(s)');
  } catch {
    return NextResponse.json(
      { error: 'INVALID_URL', message: 'Enter a valid http(s) URL.' },
      { status: 400 }
    );
  }

  // ── 4. Call the backend ────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/v1/convert/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BACKEND_API_KEY}` },
      body: JSON.stringify({ file_url: url, ...(body.filename ? { filename: body.filename } : {}) }),
    });
  } catch (err) {
    console.error('[/api/convert/url] Backend unreachable:', err);
    return NextResponse.json(
      { error: 'BACKEND_UNREACHABLE', message: 'Could not reach the conversion service. Try again.' },
      { status: 502 }
    );
  }

  // ── 5. Forward response ─────────────────────────────────────
  const text = await backendRes.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('[/api/convert/url] Non-JSON backend response:', backendRes.status, text.slice(0, 500));
    return NextResponse.json(
      { error: 'BACKEND_ERROR', message: text || 'Backend returned an unexpected response.' },
      { status: backendRes.status >= 400 ? backendRes.status : 502 }
    );
  }

  // ── 6. Increment usage on success ───────────────────────────
  if (backendRes.ok) {
    incrementUsage(identifier, identifierType).catch((err) =>
      console.error('[/api/convert/url] Usage increment failed:', err)
    );
  }
  const remaining = backendRes.ok ? Math.max(0, rateCheck.remaining - 1) : rateCheck.remaining;

  return NextResponse.json(data, {
    status: backendRes.status,
    headers: {
      'X-RateLimit-Limit':     String(rateCheck.limit),
      'X-RateLimit-Remaining': String(remaining),
    },
  });
}

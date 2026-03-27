// app/api/convert/route.ts
//
// Server-side proxy that receives a file from the browser, converts it to
// base64, and forwards it to the Vercel backend for Markdown conversion.
// The BACKEND_API_KEY never leaves the server.
//
// Supported formats: PDF, DOCX, DOC, PPTX, GSLIDES, RTF, TXT, PAGES
//
// Requires env vars in .env.local (and in Vercel project settings):
//   BACKEND_URL=https://mdc-api-murex.vercel.app
//   BACKEND_API_KEY=<your 64-char key>
//   SUPABASE_SERVICE_ROLE_KEY=<service role key>

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, incrementUsage } from '@/lib/rate-limit';

export const runtime    = 'nodejs'; // Buffer is required — cannot run on Edge
export const maxDuration = 30;      // seconds — large PDFs can be slow

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
    console.error('[/api/convert] Missing BACKEND_URL or BACKEND_API_KEY env vars');
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

    return NextResponse.json(
      {
        error: 'RATE_LIMITED',
        message,
        limit: rateCheck.limit,
        remaining: 0,
        resetsAt: rateCheck.resetsAt,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // ── 3. Parse incoming FormData ──────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Request must be multipart/form-data.' },
      { status: 400 }
    );
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json(
      { error: 'MISSING_FILE', message: 'No file was uploaded.' },
      { status: 400 }
    );
  }

  // ── 4. Validate file type ───────────────────────────────────
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const SUPPORTED_EXTS = ['pdf', 'docx', 'doc', 'pptx', 'gslides', 'rtf', 'txt', 'pages'];
  if (!SUPPORTED_EXTS.includes(ext)) {
    return NextResponse.json(
      {
        error:   'UNSUPPORTED_FILE_TYPE',
        message: `".${ext}" files are not supported. Please upload a PDF, DOCX, DOC, PPTX, GSLIDES, RTF, TXT, or PAGES file.`,
      },
      { status: 415 }
    );
  }

  // ── 5. Convert File → base64 ────────────────────────────────
  let base64Data: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    base64Data = Buffer.from(arrayBuffer).toString('base64');
  } catch {
    return NextResponse.json(
      { error: 'FILE_READ_ERROR', message: 'Failed to read the uploaded file.' },
      { status: 400 }
    );
  }

  const MIME_TYPES: Record<string, string> = {
    pdf:     'application/pdf',
    docx:    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:     'application/msword',
    pptx:    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    gslides: 'application/vnd.google-apps.presentation',
    rtf:     'application/rtf',
    txt:     'text/plain',
    pages:   'application/x-iwork-pages-sffpages',
  };
  const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

  // ── 6. Call the Vercel backend ──────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/v1/convert/attachment`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${BACKEND_API_KEY}`,
      },
      body: JSON.stringify({
        file_data: base64Data,
        filename:  file.name,
        mime_type: mimeType,
      }),
    });
  } catch (err) {
    console.error('[/api/convert] Backend unreachable:', err);
    return NextResponse.json(
      { error: 'BACKEND_UNREACHABLE', message: 'Could not reach the conversion service. Try again.' },
      { status: 502 }
    );
  }

  // ── 7. Forward response ──────────────────────────────────────
  const text = await backendRes.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('[/api/convert] Non-JSON backend response:', backendRes.status, text.slice(0, 500));
    return NextResponse.json(
      { error: 'BACKEND_ERROR', message: text || 'Backend returned an unexpected response.' },
      { status: backendRes.status >= 400 ? backendRes.status : 502 }
    );
  }

  // ── 8. Increment usage on success ───────────────────────────
  if (backendRes.ok) {
    // Fire-and-forget — don't block the response
    incrementUsage(identifier, identifierType).catch((err) =>
      console.error('[/api/convert] Usage increment failed:', err)
    );
  }

  const remaining = backendRes.ok ? rateCheck.remaining - 1 : rateCheck.remaining;

  return NextResponse.json(data, {
    status: backendRes.status,
    headers: {
      'X-RateLimit-Limit': String(rateCheck.limit),
      'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    },
  });
}

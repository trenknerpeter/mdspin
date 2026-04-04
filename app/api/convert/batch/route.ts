// app/api/convert/batch/route.ts
//
// Server-side proxy that receives multiple files from the browser, converts
// each to base64, and forwards them to the Vercel backend for batch Markdown
// conversion. The BACKEND_API_KEY never leaves the server.
//
// Supported formats: PDF, DOCX, DOC, PPTX, GSLIDES, RTF, TXT, PAGES
// Limits: 1–20 files per request, each file must be < 20 MB
//
// Requires env vars in .env.local (and in Vercel project settings):
//   BACKEND_URL=https://mdc-api-murex.vercel.app
//   BACKEND_API_KEY=<your 64-char key>
//   SUPABASE_SERVICE_ROLE_KEY=<service role key>

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, incrementUsage } from '@/lib/rate-limit';

export const runtime     = 'nodejs'; // Buffer is required — cannot run on Edge
export const maxDuration = 120;      // seconds — batch conversions can be slow

const BACKEND_URL     = process.env.BACKEND_URL;
const BACKEND_API_KEY = process.env.BACKEND_API_KEY;

const SUPPORTED_EXTS  = ['pdf', 'docx', 'doc', 'pptx', 'gslides', 'rtf', 'txt', 'pages'] as const;
const MAX_FILE_SIZE   = 20 * 1024 * 1024; // 20 MB
const MAX_FILES       = 20;
const MIN_FILES       = 1;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

interface BatchResult {
  success: boolean;
  markdown_text?: string;
  error?: string;
  filename?: string;
  index?: number;
}

interface BatchResponse {
  results: BatchResult[];
  total: number;
  succeeded: number;
  failed: number;
}

export async function POST(req: NextRequest) {
  // ── 1. Validate server config ──────────────────────────────
  if (!BACKEND_URL || !BACKEND_API_KEY) {
    console.error('[/api/convert/batch] Missing BACKEND_URL or BACKEND_API_KEY env vars');
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
          'X-RateLimit-Limit':     String(rateCheck.limit),
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

  const rawFiles = formData.getAll('files');
  const files = rawFiles.filter((f): f is File => f instanceof File);

  // ── 4. Validate file count ──────────────────────────────────
  if (files.length < MIN_FILES) {
    return NextResponse.json(
      { error: 'MISSING_FILES', message: 'No files were uploaded.' },
      { status: 400 }
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      {
        error:   'TOO_MANY_FILES',
        message: `Too many files. Maximum is ${MAX_FILES} files per request.`,
      },
      { status: 400 }
    );
  }

  // ── 5. Validate file types ──────────────────────────────────
  const unsupportedFiles = files
    .filter((f) => !SUPPORTED_EXTS.includes((f.name.split('.').pop()?.toLowerCase() ?? '') as typeof SUPPORTED_EXTS[number]))
    .map((f) => f.name);

  if (unsupportedFiles.length > 0) {
    return NextResponse.json(
      {
        error:           'UNSUPPORTED_FILE_TYPE',
        message:         `Some files are not supported. Please upload PDF, DOCX, DOC, PPTX, GSLIDES, RTF, TXT, or PAGES files.`,
        unsupportedFiles,
      },
      { status: 415 }
    );
  }

  // ── 6. Validate file sizes ──────────────────────────────────
  const oversizedFiles = files
    .filter((f) => f.size > MAX_FILE_SIZE)
    .map((f) => f.name);

  if (oversizedFiles.length > 0) {
    return NextResponse.json(
      {
        error:         'FILE_TOO_LARGE',
        message:       `Some files exceed the 20 MB limit.`,
        oversizedFiles,
      },
      { status: 400 }
    );
  }

  // ── 7. Rate limit: check remaining capacity ─────────────────
  if (files.length > rateCheck.remaining) {
    const message = user
      ? `You can only convert ${rateCheck.remaining} more file(s) today. Resets at midnight UTC.`
      : `Daily conversion limit reached. Sign in for more conversions.`;

    // Intentional: the 429 body includes extra fields (message, limit, remaining,
    // resetsAt) beyond what the spec minimum requires. This matches the pattern in
    // app/api/convert/route.ts and gives the frontend everything it needs to render
    // a meaningful error (e.g. countdown until reset, remaining quota).
    return NextResponse.json(
      {
        error:     'RATE_LIMITED',
        allowed:   rateCheck.remaining,
        message,
        limit:     rateCheck.limit,
        remaining: rateCheck.remaining,
        resetsAt:  rateCheck.resetsAt,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit':     String(rateCheck.limit),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        },
      }
    );
  }

  // ── 8. Convert each File → base64 ──────────────────────────
  let filePayloads: { file_data: string; filename: string }[];
  try {
    filePayloads = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const file_data   = Buffer.from(arrayBuffer).toString('base64');
        // mime_type is intentionally omitted — the batch endpoint infers it from filename.
        return { file_data, filename: file.name };
      })
    );
  } catch {
    return NextResponse.json(
      { error: 'FILE_READ_ERROR', message: 'Failed to read one or more uploaded files.' },
      { status: 400 }
    );
  }

  // ── 9. Call the Vercel backend ──────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/v1/convert/attachments/batch`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${BACKEND_API_KEY}`,
      },
      body: JSON.stringify({ files: filePayloads }),
    });
  } catch (err) {
    console.error('[/api/convert/batch] Backend unreachable:', err);
    return NextResponse.json(
      { error: 'BACKEND_UNREACHABLE', message: 'Could not reach the conversion service. Try again.' },
      { status: 502 }
    );
  }

  // ── 10. Forward response ─────────────────────────────────────
  const text = await backendRes.text();
  let data: BatchResponse;
  try {
    data = JSON.parse(text) as BatchResponse;
  } catch {
    console.error('[/api/convert/batch] Non-JSON backend response:', backendRes.status, text.slice(0, 500));
    return NextResponse.json(
      { error: 'BACKEND_ERROR', message: text || 'Backend returned an unexpected response.' },
      { status: backendRes.status >= 400 ? backendRes.status : 502 }
    );
  }

  // ── 11. Increment usage for each successfully converted file ─
  let successCount = 0;
  // Intentional: usage is only incremented when backendRes.ok is true (HTTP 2xx).
  // If the backend returns a non-2xx status we must not bill the user — the
  // conversion did not succeed from the service's perspective regardless of what
  // the response body may contain.
  if (backendRes.ok && Array.isArray(data.results)) {
    successCount = data.results.filter((r) => r.success === true).length;

    // Fire-and-forget — don't block the response.
    // Each call atomically increments by 1 via a Supabase RPC — N calls = N usages billed.
    for (let i = 0; i < successCount; i++) {
      incrementUsage(identifier, identifierType).catch((err) =>
        console.error('[/api/convert/batch] Usage increment failed:', err)
      );
    }
  }

  const remaining = Math.max(0, rateCheck.remaining - successCount);

  return NextResponse.json(data, {
    status: backendRes.status,
    headers: {
      'X-RateLimit-Limit':     String(rateCheck.limit),
      'X-RateLimit-Remaining': String(remaining),
    },
  });
}

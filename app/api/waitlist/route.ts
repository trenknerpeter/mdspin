//
// Pro waitlist sign-ups from /pricing. Signed-in users join with their account
// email; guests type one. The table has RLS on and no policies (nothing public
// may read or write it), so the insert uses the service role.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeEmail } from '@/lib/waitlist'
import { trackServer } from '@/lib/posthog-server'
import { EVENTS } from '@/lib/analytics/events'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let body: { email?: unknown } = {}
  try { body = await req.json() } catch { /* empty body is fine for signed-in users */ }

  const email = normalizeEmail(user?.email ?? body.email)
  if (!email) return NextResponse.json({ message: 'Enter a valid email address.' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ message: 'Internal server error' }, { status: 500 })

  const { error } = await admin
    .from('waitlist')
    .insert({ email, user_id: user?.id ?? null, interest: 'pro' })

  // 23505 = unique violation (already on the list) — treat as success.
  if (error && error.code !== '23505') {
    console.error('[/api/waitlist] insert failed:', error.message)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }

  trackServer(EVENTS.proWaitlistJoined, {
    distinctId: user?.id,
    properties: { authenticated: !!user, duplicate: error?.code === '23505' },
  })
  return NextResponse.json({ success: true }, { status: 200 })
}

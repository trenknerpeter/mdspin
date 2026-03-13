import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ message: 'Invalid email' }, { status: 400 })
    }

    // TODO: wire to email service (Mailchimp, Supabase, Resend, etc.)
    console.log(`[waitlist] New signup: ${email}`)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

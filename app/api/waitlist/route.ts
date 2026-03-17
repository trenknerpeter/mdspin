import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ message: 'Invalid email' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from('waitlist').insert({ email })

    if (error && error.code !== '23505') {
      // 23505 = unique violation (email already signed up) — treat as success
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

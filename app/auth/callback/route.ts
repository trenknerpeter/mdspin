import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Capture Google OAuth tokens if the user signed in with Google SSO
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.provider_token) {
          const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
          )

          await supabaseAdmin.from("user_google_tokens").upsert({
            user_id: session.user.id,
            google_access_token: session.provider_token,
            google_refresh_token: session.provider_refresh_token ?? null,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      } catch (tokenErr) {
        // Non-blocking — log but don't fail the login
        console.error("Failed to store Google tokens:", tokenErr)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If no code or exchange failed, redirect to sign-in with error
  return NextResponse.redirect(`${origin}/auth/sign-in`)
}

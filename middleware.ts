import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets (images, icons)
     * - api/* — every route handler that needs a session calls supabase.auth.getUser()
     *   itself (app/api/{brief,convert*,vault/summaries/run,waitlist}/route.ts), and a
     *   Route Handler, unlike a Server Component, can persist the refreshed cookies
     *   directly. Routing API requests through this middleware first was a second,
     *   redundant Supabase round-trip on every call — including a future MCP endpoint,
     *   which authenticates via Bearer token and has no cookie session to refresh at all.
     * - ingest/* — the PostHog reverse proxy (see rewrites in next.config.mjs). These
     *   are analytics beacons, not navigations: there is no session to refresh, and
     *   routing them through here added a Supabase round-trip to every single event.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|ingest/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

export function GetStartedButton({
  className = "inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#e04200] hover:shadow-lg hover:shadow-[#FF4800]/20",
  label = "Get started free",
}: {
  className?: string
  label?: string
}) {
  const { user, isLoading } = useAuth()
  // While auth is still resolving, bias toward the app: signed-in users land there
  // (the /app layout confirms their session server-side), and signed-out users get
  // redirected to sign-in by that same guard. Once known, signed-out users go to sign-up.
  const href = isLoading || user ? "/app/dashboard" : "/auth/sign-up?next=/app"
  return (
    <Link href={href} className={className}>
      {label} <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

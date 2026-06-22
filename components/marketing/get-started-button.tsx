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
  const { user } = useAuth()
  return (
    <Link href={user ? "/app/dashboard" : "/auth/sign-up?next=/app"} className={className}>
      {label} <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

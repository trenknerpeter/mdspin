import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Thank you! | MDSpin",
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 text-6xl">☕</div>
        <h1 className="font-display text-3xl font-bold text-white mb-3">
          Thank you!
        </h1>
        <p className="text-[#888480] mb-8">
          Your support means a lot and keeps MDSpin running. Cheers!
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4800] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
        >
          Back to MDSpin
        </Link>
      </div>
    </div>
  )
}

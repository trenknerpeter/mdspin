"use client"

import { useAuth } from "@/components/auth-provider"

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F0EDE8] font-[family-name:var(--font-syne)]">Settings</h1>
        <p className="text-sm text-[#888480] font-[family-name:var(--font-dm-sans)]">
          Manage your account
        </p>
      </div>

      <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
        <h2 className="text-sm font-semibold mb-3 font-[family-name:var(--font-syne)] text-[#F0EDE8]">Account</h2>
        <div className="flex items-center justify-between text-sm font-[family-name:var(--font-dm-sans)]">
          <span className="text-[#888480]">Email</span>
          <span className="text-[#F0EDE8]">{user?.email ?? "—"}</span>
        </div>
      </div>
    </div>
  )
}

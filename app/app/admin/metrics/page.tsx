import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/admin"
import { getMetricsSnapshot, pct, type FeatureReach, type FunnelWeek } from "@/lib/metrics"

export const metadata: Metadata = { title: "Metrics", robots: { index: false, follow: false } }

// Always fresh — this is a handful of aggregate queries read a few times a week.
export const dynamic = "force-dynamic"

export default async function MetricsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // 404 rather than 403: a non-admin should not learn this page exists.
  if (!isAdminUser(user?.id)) notFound()

  const m = await getMetricsSnapshot()
  if (!m) {
    return (
      <Shell>
        <p className="text-sm text-red-400">
          Could not read metrics. Check <code>SUPABASE_SERVICE_ROLE_KEY</code> is set.
        </p>
      </Shell>
    )
  }

  const { totals, active, quota } = m
  const activationRate = pct(totals.activated, totals.signed_up)
  const vaultRate = pct(totals.used_vault, totals.activated)

  return (
    <Shell generatedAt={m.generated_at}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="MAU" value={active.mau} hint={`${active.wau} WAU · ${active.dau} DAU`} />
        <Stat label="Activated" value={fmtPct(activationRate)} hint={`${totals.activated} of ${totals.signed_up} signups`} />
        <Stat label="Vault reach" value={fmtPct(vaultRate)} hint={`${totals.used_vault} of ${totals.activated} activated`} />
        <Stat label="Hit a limit" value={quota.distinct_actors} hint={`${quota.signed_in_hits} signed-in · ${quota.anonymous_hits} anon`} />
      </div>

      <p className="mt-3 text-xs text-[#4A4A46]">
        Everything below excludes the maker account and comes from database state, not
        analytics events — so it covers all history, not just since tracking shipped.
      </p>

      <Section title="Feature reach" subtitle="Share of activated users who have ever used each feature">
        <Table head={["Feature", "Users", "% of activated"]}>
          {m.feature_reach?.map((f: FeatureReach) => (
            <tr key={f.feature} className="border-t border-[#1E1E1E]">
              <Td>{f.feature.replace(/_/g, " ")}</Td>
              <Td numeric>{f.users_reached}</Td>
              <Td numeric dim={f.users_reached === 0}>{fmtPct(f.pct_of_activated)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Activation by signup week" subtitle="Does a new signup ever become a user?">
        <Table head={["Week", "Signed up", "Converted", "3+", "Vault", "Project", "Active 30d"]}>
          {m.funnel?.map((w: FunnelWeek) => (
            <tr key={w.signup_week} className="border-t border-[#1E1E1E]">
              <Td>{w.signup_week}</Td>
              <Td numeric>{w.signed_up}</Td>
              <Td numeric>{w.converted_once}</Td>
              <Td numeric>{w.converted_3plus}</Td>
              <Td numeric>{w.used_vault}</Td>
              <Td numeric>{w.created_project}</Td>
              <Td numeric>{w.active_last_30d}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Conversions, last 60 days" subtitle="Metered conversion requests — excludes GitHub sync, MCP and manual notes">
        <Table head={["Date", "Audience", "Actors", "Conversions"]}>
          {m.activity?.map((d) => (
            <tr key={`${d.date}-${d.audience}`} className="border-t border-[#1E1E1E]">
              <Td>{d.date}</Td>
              <Td>{d.audience === "signed_in" ? "signed in" : "anonymous"}</Td>
              <Td numeric>{d.actors}</Td>
              <Td numeric>{d.conversions}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </Shell>
  )
}

function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v}%`
}

function Shell({ children, generatedAt }: { children: React.ReactNode; generatedAt?: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold text-[#F0EDE8]">Metrics</h1>
      {generatedAt && (
        <p className="mt-1 text-xs text-[#4A4A46]">
          Generated {new Date(generatedAt).toLocaleString()}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-[#1E1E1E] p-3">
      <p className="text-xs text-[#888480]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#F0EDE8]">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[#4A4A46]">{hint}</p>}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-[#F0EDE8]">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-[#4A4A46]">{subtitle}</p>}
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} className={`pb-2 font-medium text-[#888480] ${i === 0 ? "text-left" : "text-right"}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Td({ children, numeric, dim }: { children: React.ReactNode; numeric?: boolean; dim?: boolean }) {
  return (
    <td className={`py-1.5 ${numeric ? "text-right tabular-nums" : "text-left"} ${dim ? "text-[#4A4A46]" : "text-[#F0EDE8]"}`}>
      {children}
    </td>
  )
}

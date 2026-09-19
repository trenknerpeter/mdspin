"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { GitBranch, Pause, Play, Unlink, RefreshCw, Sparkles, Github } from "lucide-react"

interface SourceConnectionJson {
  id: string
  provider: string
  display_name: string
  config: { owner?: string; repo?: string; branch?: string; path_prefix?: string | null; backfill_cursor?: { paths: unknown[]; nextIndex: number } | null }
  status: "active" | "paused" | "error" | "revoked"
  last_synced_at: string | null
  last_error: string | null
  created_at: string
}

// Mirrors the error codes app/api/integrations/github/callback/route.ts redirects with.
const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "GitHub didn't send back what we expected. Try connecting again.",
  sign_in_required: "Sign in to MDSpin first, then connect GitHub.",
  github_exchange_failed: "Couldn't verify your GitHub identity. Try again.",
  github_verify_failed: "Couldn't verify your GitHub identity. Try again.",
  not_your_installation: "That GitHub installation doesn't belong to your account.",
  github_list_repos_failed: "Couldn't read which repos GitHub granted access to.",
  no_repos_selected: "No repositories were selected during install.",
  already_connected: "This repository is already connected.",
  create_connection_failed: "Couldn't create the connection. Try again.",
  not_configured: "GitHub sync isn't configured on this server yet.",
  installation_pending_approval: "Installation needs approval from an organization owner first.",
}

interface BannerAction {
  label: string
  href: string
}

interface Banner {
  kind: "error" | "success"
  text: string
  action?: BannerAction
}

/** select_one_repo gets its own builder rather than a static ERROR_MESSAGES string: the
 *  useful fix here isn't more explanation, it's a link to the exact GitHub screen most
 *  people have never seen — Configure Repository Access for THIS installation — which a
 *  generic message can't provide. installation_id is non-secret (GitHub-controlled,
 *  visible to anyone who can see the installation) — see
 *  lib/integrations/github/auth.ts's header comment. */
function selectOneRepoBanner(searchParams: URLSearchParams): Banner {
  const count = searchParams.get("repo_count")
  const installationId = searchParams.get("installation_id")
  const text = count
    ? `GitHub gave MDSpin access to ${count} repositories; it needs exactly 1. Pick just one on GitHub, then come back and connect again.`
    : "MDSpin needs access to exactly one repository. Pick just one on GitHub, then come back and connect again."
  return {
    kind: "error",
    text,
    action: installationId
      ? { label: "Choose which repo on GitHub", href: `https://github.com/settings/installations/${installationId}` }
      : undefined,
  }
}

function githubAppInstallUrl(): string | null {
  const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG
  return slug ? `https://github.com/apps/${slug}/installations/new` : null
}

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<SourceConnectionJson[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  const reload = useCallback(async () => {
    const res = await fetch("/api/integrations/connections")
    if (res.ok) {
      const body = (await res.json()) as { data: SourceConnectionJson[] }
      setConnections(body.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // One-time consumption of the callback redirect's query params, then clean the URL —
  // reloading the page shouldn't re-show a stale "connected!" banner.
  useEffect(() => {
    const error = searchParams.get("error")
    const connected = searchParams.get("connected")
    if (error === "select_one_repo") {
      setBanner(selectOneRepoBanner(searchParams))
      router.replace("/app/integrations")
    } else if (error) {
      setBanner({ kind: "error", text: ERROR_MESSAGES[error] ?? `Something went wrong (${error}).` })
      router.replace("/app/integrations")
    } else if (connected) {
      setBanner({ kind: "success", text: "Connected. Backfill has started." })
      router.replace("/app/integrations")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const installUrl = useMemo(githubAppInstallUrl, [])

  const runAction = async (id: string, path: string, method: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/integrations/connections/${id}${path}`, { method })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setBanner({ kind: "error", text: body?.message ?? "That action failed." })
      }
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F0EDE8] font-display">Integrations</h1>
        <p className="text-sm text-[#888480] font-sans">
          Connect a live source so the Knowledge Vault stays current on its own.
        </p>
      </div>

      {banner && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm font-sans ${
            banner.kind === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-400"
              : "border-[#FF4800]/20 bg-[#FF4800]/10 text-[#FF4800]"
          }`}
        >
          <p>{banner.text}</p>
          {banner.action && (
            <a
              href={banner.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline decoration-dotted hover:no-underline"
            >
              {banner.action.label} →
            </a>
          )}
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[#F0EDE8] font-display">Your connections</h2>

        {loading ? (
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888480] font-sans">Loading…</p>
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-8 text-center">
            <p className="text-sm text-[#888480] font-sans">
              No connections yet. Connect a GitHub repo below.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {connections.map((c) => {
              const hasMoreBackfill = !!c.config.backfill_cursor
              const busy = busyId === c.id
              return (
                <li key={c.id} className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 shrink-0 text-[#888480]" />
                        <span className="truncate text-sm font-medium text-[#F0EDE8] font-sans">
                          {c.display_name}
                        </span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="mt-1 text-xs text-[#888480] font-sans">
                        {c.last_synced_at
                          ? `Last synced ${new Date(c.last_synced_at).toLocaleString()}`
                          : "Not synced yet"}
                        {c.config.path_prefix && <> · path: {c.config.path_prefix}</>}
                      </p>
                      {c.last_error && (
                        <p className="mt-1 text-xs text-red-400 font-sans">{c.last_error}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {hasMoreBackfill && (
                      <button
                        onClick={() => runAction(c.id, "/backfill", "POST")}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] px-2.5 py-1 text-xs text-[#888480] hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Continue backfill
                      </button>
                    )}
                    <button
                      onClick={() => runAction(c.id, "/summarize", "POST")}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] px-2.5 py-1 text-xs text-[#888480] hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-50 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      Summarize backfilled docs
                    </button>
                    {(c.status === "active" || c.status === "paused") && (
                      <button
                        onClick={async () => {
                          setBusyId(c.id)
                          try {
                            await fetch(`/api/integrations/connections/${c.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: c.status === "active" ? "paused" : "active" }),
                            })
                            await reload()
                          } finally {
                            setBusyId(null)
                          }
                        }}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] px-2.5 py-1 text-xs text-[#888480] hover:border-[#4A4A46] hover:text-[#F0EDE8] disabled:opacity-50 transition-colors"
                      >
                        {c.status === "active" ? (
                          <>
                            <Pause className="h-3 w-3" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" />
                            Resume
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm(`Disconnect ${c.display_name}? Documents stay in your vault but stop syncing.`)) return
                        await runAction(c.id, "", "DELETE")
                      }}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] px-2.5 py-1 text-xs text-[#888480] hover:border-red-500/40 hover:text-red-400 disabled:opacity-50 transition-colors"
                    >
                      <Unlink className="h-3 w-3" />
                      Disconnect
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
        <div className="mb-2 flex items-center gap-2">
          <Github className="h-5 w-5 shrink-0 text-[#F0EDE8]" />
          <h2 className="text-sm font-semibold text-[#F0EDE8] font-display">Connect GitHub</h2>
        </div>
        <p className="mb-4 text-xs text-[#888480] font-sans">
          Markdown files in a repo sync into the vault automatically on every push. One repo per
          connection — select exactly one repository when installing.
        </p>
        {installUrl ? (
          <a
            href={installUrl}
            className="inline-flex items-center gap-2 rounded-full bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e04200] transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            Connect a repo
          </a>
        ) : (
          <p className="text-xs text-red-400 font-sans">
            GitHub sync isn&apos;t configured on this server yet.
          </p>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: SourceConnectionJson["status"] }) {
  const styles: Record<SourceConnectionJson["status"], string> = {
    active: "bg-[#FF4800]/10 text-[#FF4800] border-[#FF4800]/20",
    paused: "bg-[#2A2A2A] text-[#888480] border-[#2A2A2A]",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    revoked: "bg-red-500/10 text-red-400 border-red-500/20",
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  )
}

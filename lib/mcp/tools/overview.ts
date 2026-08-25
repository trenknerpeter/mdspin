import { repoForContext, type McpAuthContext } from "@/lib/mcp/context"
import { compactStats, compactProject, compactDocMeta } from "@/lib/mcp/format"
import { toolError } from "@/lib/mcp/errors"
import type { VaultRepo } from "@/lib/vault/repo"

// No per-project document counts here on purpose: computing them would cost one extra
// query per project (N+1) for a tool whose entire reason to exist is being the cheap
// discovery call. A caller that wants one project's count already gets it for free from
// that project's own list_documents call.
export async function buildOverview(repo: VaultRepo) {
  const [stats, projects, recent] = await Promise.all([
    repo.getStats(),
    repo.listProjects(),
    repo.listDocuments({ limit: 10 }),
  ])
  return {
    ...compactStats(stats),
    projects: projects.map(compactProject),
    recent: recent.data.map(compactDocMeta),
  }
}

export const vaultOverviewTool = {
  name: "vault_overview",
  config: {
    title: "Vault overview",
    description:
      "Totals, projects, top tags, and the 10 most recently updated documents in your vault. Call this first — it replaces 3-4 separate discovery calls.",
  },
  handler: async (ctx: McpAuthContext) => {
    try {
      const overview = await buildOverview(repoForContext(ctx))
      return { content: [{ type: "text" as const, text: JSON.stringify(overview) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

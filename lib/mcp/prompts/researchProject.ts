import { z } from "zod"
import { repoForContext, type McpAuthContext } from "@/lib/mcp/context"
import { VaultError } from "@/lib/vault/errors"
import type { VaultRepo } from "@/lib/vault/repo"

export async function buildResearchProjectPrompt(repo: VaultRepo, projectId: string) {
  const project = await repo.getProject(projectId)
  if (!project) throw new VaultError("NOT_FOUND", "Project not found.")

  const instructions = project.instructions ? `\n\nProject instructions:\n${project.instructions}` : ""

  const text = [
    `You are researching the MDSpin vault project "${project.name}" (id: ${projectId}).${instructions}`,
    "",
    "1. Call list_documents with project_id set to this project to see its full document roster.",
    "2. For each question you need to answer, call search_vault scoped to project_id, then get_document for the most relevant hits.",
    "3. Cite every claim with the document id it came from.",
    "4. Never invent a fact that isn't in a document you actually fetched — if you don't know, say so.",
  ].join("\n")

  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] }
}

export const researchProjectPrompt = {
  name: "research_project",
  config: {
    title: "Research a project",
    description: "Grounds an agent in a vault project before answering questions about it — reads the project's own instructions first.",
    argsSchema: z.object({ project_id: z.uuid() }),
  },
  handler: async (args: { project_id: string }, ctx: McpAuthContext) => {
    return buildResearchProjectPrompt(repoForContext(ctx), args.project_id)
  },
}

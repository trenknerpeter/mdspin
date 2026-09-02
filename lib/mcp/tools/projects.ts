import { z } from "zod"
import { repoForContext, type McpAuthContext } from "@/lib/mcp/context"
import { compactProject, compactProjectDetail, compactRelated } from "@/lib/mcp/format"
import { toolError } from "@/lib/mcp/errors"
import { VaultError } from "@/lib/vault/errors"
import type { VaultRepo } from "@/lib/vault/repo"
import type { ProjectPatch } from "@/lib/vault/types"

export async function runListProjects(repo: VaultRepo) {
  const projects = await repo.listProjects()
  return { projects: projects.map(compactProject) }
}

export async function runGetProject(repo: VaultRepo, projectId: string) {
  const project = await repo.getProject(projectId)
  if (!project) throw new VaultError("NOT_FOUND", "Project not found.")
  return compactProjectDetail(project)
}

export async function runGetRelatedDocuments(repo: VaultRepo, documentId: string, limit?: number) {
  const related = await repo.getRelatedDocuments(documentId, limit)
  return { related: related.map(compactRelated) }
}

export const listProjectsTool = {
  name: "list_projects",
  config: {
    title: "List projects",
    description: "Every project in your vault (name and color only — call get_project for a project's instructions).",
  },
  handler: async (ctx: McpAuthContext) => {
    try {
      const result = await runListProjects(repoForContext(ctx))
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

export const getProjectTool = {
  name: "get_project",
  config: {
    title: "Get project",
    description:
      "A single project's details, including its instructions — the project's own operating notes for an agent.",
    inputSchema: z.object({ project_id: z.uuid() }),
  },
  handler: async (args: { project_id: string }, ctx: McpAuthContext) => {
    try {
      const result = await runGetProject(repoForContext(ctx), args.project_id)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

export async function runCreateProject(
  repo: VaultRepo,
  args: { name: string; color?: string; instructions?: string }
) {
  const project = await repo.createProject({ name: args.name, color: args.color, instructions: args.instructions })
  return compactProjectDetail(project)
}

export const createProjectTool = {
  name: "create_project",
  config: {
    title: "Create project",
    description:
      "Create a new project to organize documents under. instructions, if given, become the project's agent-facing operating notes (read by get_project and the research_project prompt).",
    inputSchema: z.object({
      name: z.string().min(1).max(200),
      color: z.string().max(50).optional(),
      instructions: z.string().optional(),
    }),
  },
  handler: async (args: { name: string; color?: string; instructions?: string }, ctx: McpAuthContext) => {
    try {
      const result = await runCreateProject(repoForContext(ctx), args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

interface UpdateProjectArgs {
  project_id: string
  name?: string
  color?: string | null
  instructions?: string | null
}

export async function runUpdateProject(repo: VaultRepo, args: UpdateProjectArgs) {
  const patch: ProjectPatch = {}
  if ("name" in args) patch.name = args.name
  if ("color" in args) patch.color = args.color ?? null
  if ("instructions" in args) patch.instructions = args.instructions ?? null
  const project = await repo.updateProject(args.project_id, patch)
  return compactProjectDetail(project)
}

export const updateProjectTool = {
  name: "update_project",
  config: {
    title: "Update project",
    description:
      "Rename a project, change its color, or update its instructions (the project's agent-facing operating notes). Provide at least one field to change. To move a document into or out of a project, use update_document instead.",
    inputSchema: z.object({
      project_id: z.uuid(),
      name: z.string().min(1).max(200).optional(),
      color: z.string().max(50).nullable().optional(),
      instructions: z.string().nullable().optional(),
    }),
  },
  handler: async (args: UpdateProjectArgs, ctx: McpAuthContext) => {
    try {
      const result = await runUpdateProject(repoForContext(ctx), args)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

export const getRelatedDocumentsTool = {
  name: "get_related_documents",
  config: {
    title: "Get related documents",
    description:
      "Documents related to a given document, within the same project. An empty result is normal — most documents have no related documents.",
    inputSchema: z.object({ document_id: z.uuid(), limit: z.number().int().positive().optional() }),
  },
  handler: async (args: { document_id: string; limit?: number }, ctx: McpAuthContext) => {
    try {
      const result = await runGetRelatedDocuments(repoForContext(ctx), args.document_id, args.limit)
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] }
    } catch (err) {
      return toolError(err)
    }
  },
}

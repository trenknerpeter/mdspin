// lib/graph.ts
//
// Builds the {nodes, links} payload for the Knowledge Graph (Vault → Map).
// Nodes = the user's in-vault spins; links = relatedness edges from the
// build_knowledge_graph RPC (the all-pairs form of find_related_conversions).
// The pure `buildGraph` shaping is split out so it can be unit-tested.

import { createClient } from "@/lib/supabase/client"
import {
  fetchProjectIdsByDocument,
  listProjects,
  rootProjectId,
  type Project,
} from "@/lib/library"

const UNFILED_COLOR = "#888480"

// Deterministic fallback palette for projects that have no stored color.
const FALLBACK_COLORS = [
  "#FF4800", "#4F9DDE", "#5CB85C", "#E0B341", "#B36AE2",
  "#E2698A", "#3FC1C9", "#E07A3F", "#9BCF5C", "#C45C5C",
]

export interface GraphNodeRow {
  id: string
  filename: string
  title: string | null
  file_type: string
  word_count: number | null
  project_ids: string[]
  tags: string[]
}

/** r.project_ids is always earliest-linked-first (see lib/library.ts's
 *  fetchProjectIdsByDocument), so index 0 is the primary project — same convention as
 *  the Stage 5 Phase A SQL and Phase B/C TypeScript layers. */
export function pickPrimaryProject(projectIds: string[]): string | null {
  return projectIds[0] ?? null
}

export interface GraphEdgeRow {
  source_id: string
  target_id: string
  weight: number
}

export interface GraphNode {
  id: string
  label: string
  fileType: string
  wordCount: number | null
  projectId: string | null
  community: string // project name, or "Unfiled"
  color: string
}

export interface GraphLink {
  source: string
  target: string
  weight: number
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  links: GraphLink[]
}

// Pure: shape raw node/edge rows + projects into a graph.
// Edges are deduped by unordered pair (keeping the highest weight) and dropped
// if either endpoint isn't a known node.
export function buildGraph(
  nodeRows: GraphNodeRow[],
  edgeRows: GraphEdgeRow[],
  projects: Project[]
): KnowledgeGraph {
  // Colour and community are keyed by ROOT project, not by the document's own folder:
  // a project split into six subprojects should stay one visual community on the map,
  // not fragment into six colours.
  const byId = new Map(projects.map((p) => [p.id, p]))
  const roots = projects.filter((p) => !p.parent_id)

  // Fallback colours are assigned over ROOTS only. Indexing over all projects would mean
  // creating a single subproject shifts every later project's palette index, silently
  // re-colouring unrelated nodes for a reason the user never asked for.
  const colorByRoot = new Map<string, string>()
  roots.forEach((p, i) => {
    colorByRoot.set(p.id, p.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length])
  })
  const nameByProject = new Map(projects.map((p) => [p.id, p.name]))

  const nodes: GraphNode[] = nodeRows.map((r) => {
    // pickPrimaryProject stays "which folder is this document in" — a subproject is the
    // right answer there, so the root is resolved here at the display site instead.
    const projectId = pickPrimaryProject(r.project_ids)
    const rootId = rootProjectId(projectId, byId)
    return {
      id: r.id,
      label: r.title || r.filename,
      fileType: r.file_type,
      wordCount: r.word_count,
      projectId,
      community: rootId ? nameByProject.get(rootId) ?? "Unfiled" : "Unfiled",
      color: rootId ? colorByRoot.get(rootId) ?? UNFILED_COLOR : UNFILED_COLOR,
    }
  })

  const nodeIds = new Set(nodes.map((n) => n.id))
  const best = new Map<string, GraphLink>()
  for (const e of edgeRows) {
    if (!nodeIds.has(e.source_id) || !nodeIds.has(e.target_id)) continue
    if (e.source_id === e.target_id) continue
    const [a, b] = e.source_id < e.target_id ? [e.source_id, e.target_id] : [e.target_id, e.source_id]
    const key = `${a}|${b}`
    const prev = best.get(key)
    if (!prev || e.weight > prev.weight) best.set(key, { source: a, target: b, weight: e.weight })
  }

  return { nodes, links: Array.from(best.values()) }
}

export async function getKnowledgeGraph(maxPerNode = 5): Promise<KnowledgeGraph> {
  const supabase = createClient()
  const [nodesRes, edgesRes, projects] = await Promise.all([
    supabase
      .from("conversions")
      .select("id, filename, title, file_type, word_count, tags")
      .eq("in_vault", true),
    supabase.rpc("build_knowledge_graph", { max_per_node: maxPerNode }),
    listProjects(),
  ])
  if (nodesRes.error) throw nodesRes.error
  if (edgesRes.error) throw edgesRes.error
  const nodeRows = (nodesRes.data ?? []) as Omit<GraphNodeRow, "project_ids">[]
  const projectIdsByDoc = await fetchProjectIdsByDocument(nodeRows.map((r) => r.id))
  return buildGraph(
    nodeRows.map((r) => ({ ...r, project_ids: projectIdsByDoc.get(r.id) ?? [] })),
    (edgesRes.data ?? []) as GraphEdgeRow[],
    projects
  )
}

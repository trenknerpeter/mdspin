// lib/graph.ts
//
// Builds the {nodes, links} payload for the Knowledge Graph (Vault → Map).
// Nodes = the user's in-vault spins; links = relatedness edges from the
// build_knowledge_graph RPC (the all-pairs form of find_related_conversions).
// The pure `buildGraph` shaping is split out so it can be unit-tested.

import { createClient } from "@/lib/supabase/client"
import { listProjects, type Project } from "@/lib/library"

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
  project_id: string | null
  tags: string[]
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
  const colorByProject = new Map<string, string>()
  projects.forEach((p, i) => {
    colorByProject.set(p.id, p.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length])
  })
  const nameByProject = new Map(projects.map((p) => [p.id, p.name]))

  const nodes: GraphNode[] = nodeRows.map((r) => ({
    id: r.id,
    label: r.title || r.filename,
    fileType: r.file_type,
    wordCount: r.word_count,
    projectId: r.project_id,
    community: r.project_id ? nameByProject.get(r.project_id) ?? "Unfiled" : "Unfiled",
    color: r.project_id ? colorByProject.get(r.project_id) ?? UNFILED_COLOR : UNFILED_COLOR,
  }))

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
      .select("id, filename, title, file_type, word_count, project_id, tags")
      .eq("in_vault", true),
    supabase.rpc("build_knowledge_graph", { max_per_node: maxPerNode }),
    listProjects(),
  ])
  if (nodesRes.error) throw nodesRes.error
  if (edgesRes.error) throw edgesRes.error
  return buildGraph(
    (nodesRes.data ?? []) as GraphNodeRow[],
    (edgesRes.data ?? []) as GraphEdgeRow[],
    projects
  )
}

// Saved planet positions for the Vault Map. Kept out of lib/library.ts because this is view
// state for exactly one screen, not part of the Vault's domain model.
//
// `nodeId` is a project id, or the UNFILED sentinel — see the table's own comments in
// supabase/migrations/20260913_vault_map_positions.sql for why it isn't a foreign key.

import { createClient } from "@/lib/supabase/client"

export interface MapPosition {
  x: number
  y: number
}

/** Every saved position for the signed-in user, keyed by node id. RLS scopes the rows. */
export async function listMapPositions(): Promise<Record<string, MapPosition>> {
  const supabase = createClient()
  const { data, error } = await supabase.from("vault_map_positions").select("node_id, x, y")
  if (error) throw error
  const out: Record<string, MapPosition> = {}
  for (const row of (data ?? []) as { node_id: string; x: number; y: number }[]) {
    out[row.node_id] = { x: row.x, y: row.y }
  }
  return out
}

/**
 * Pin a node where the user dropped it. Upsert on (user_id, node_id) — the primary key — so
 * repeated drags of the same planet overwrite rather than accumulate.
 *
 * `user_id` has to be passed explicitly: RLS checks it, but there is no column default, so an
 * insert that omits it fails the not-null constraint before the policy is ever consulted.
 */
export async function saveMapPosition(nodeId: string, pos: MapPosition): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not signed in.")
  const { error } = await supabase.from("vault_map_positions").upsert(
    {
      user_id: user.id,
      node_id: nodeId,
      x: pos.x,
      y: pos.y,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,node_id" }
  )
  if (error) throw error
}

/** Forget a pinned position, returning the node to its deterministic hashed spot. */
export async function clearMapPosition(nodeId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("vault_map_positions").delete().eq("node_id", nodeId)
  if (error) throw error
}

import { describe, it, expect } from "vitest"
import { invalidationReducer, initialInvalidationState } from "@/lib/library-invalidation"

describe("invalidationReducer", () => {
  it("starts with tags not stale", () => {
    expect(initialInvalidationState).toEqual({ tagsStale: false })
  })

  it("refreshRequested marks tags stale", () => {
    const next = invalidationReducer(initialInvalidationState, { type: "refreshRequested" })
    expect(next).toEqual({ tagsStale: true })
  })

  it("projectDeleted marks tags stale when the deleted project wasn't selected", () => {
    const next = invalidationReducer(initialInvalidationState, {
      type: "projectDeleted",
      wasSelected: false,
    })
    expect(next).toEqual({ tagsStale: true })
  })

  it("projectDeleted leaves tagsStale untouched when the deleted project WAS selected", () => {
    // The upcoming selectedProject -> null change fires its own request with fresh state;
    // requesting one here too would race it.
    const next = invalidationReducer(initialInvalidationState, {
      type: "projectDeleted",
      wasSelected: true,
    })
    expect(next).toEqual({ tagsStale: false })
  })

  it("projectDeleted(wasSelected: true) doesn't clear an already-pending refetch", () => {
    const pending = { tagsStale: true }
    const next = invalidationReducer(pending, { type: "projectDeleted", wasSelected: true })
    expect(next.tagsStale).toBe(true)
  })

  it("flushed clears the flag", () => {
    expect(invalidationReducer({ tagsStale: true }, { type: "flushed" })).toEqual({
      tagsStale: false,
    })
  })

  it("regression (65914ed): deleting the selected project then reacting to its filter change never double-races tags", () => {
    // Sequence as it actually happens in useLibrary: removeProject() dispatches
    // projectDeleted first (still inside the same callback), then setSelectedProject(null)
    // triggers the project-filter effect on the next render, which dispatches its own
    // request off the fresh (post-delete) selectedProject.
    let state = initialInvalidationState
    state = invalidationReducer(state, { type: "projectDeleted", wasSelected: true })
    expect(state.tagsStale).toBe(false) // not requested yet — correctly deferred

    state = invalidationReducer(state, { type: "refreshRequested" })
    expect(state.tagsStale).toBe(true) // now requested exactly once, off fresh state
  })
})

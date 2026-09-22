import { describe, it, expect } from "vitest"
import {
  invalidationReducer,
  initialInvalidationState,
  type InvalidationState,
} from "@/lib/library-invalidation"

describe("invalidationReducer", () => {
  it("starts with nothing stale", () => {
    expect(initialInvalidationState).toEqual({
      tagsStale: false,
      sidebarsStale: false,
      spinsStale: false,
    })
  })

  it("filtersChanged marks tags and spins stale, but not sidebars", () => {
    const next = invalidationReducer(initialInvalidationState, { type: "filtersChanged" })
    expect(next).toEqual({ tagsStale: true, sidebarsStale: false, spinsStale: true })
  })

  it("projectDeleted marks everything stale when the deleted project wasn't selected", () => {
    const next = invalidationReducer(initialInvalidationState, {
      type: "projectDeleted",
      wasSelected: false,
    })
    expect(next).toEqual({ tagsStale: true, sidebarsStale: true, spinsStale: true })
  })

  it("projectDeleted leaves tagsStale untouched when the deleted project WAS selected", () => {
    // The upcoming selectedProject -> null change fires its own filtersChanged event with
    // fresh state; requesting a tags refetch here too would race it.
    const next = invalidationReducer(initialInvalidationState, {
      type: "projectDeleted",
      wasSelected: true,
    })
    expect(next).toEqual({ tagsStale: false, sidebarsStale: true, spinsStale: true })
  })

  it("projectDeleted(wasSelected: true) doesn't clear an already-pending tags refetch", () => {
    const pending: InvalidationState = { ...initialInvalidationState, tagsStale: true }
    const next = invalidationReducer(pending, { type: "projectDeleted", wasSelected: true })
    expect(next.tagsStale).toBe(true)
  })

  it("mutated only marks the slices it names", () => {
    const next = invalidationReducer(initialInvalidationState, { type: "mutated", tags: true })
    expect(next).toEqual({ tagsStale: true, sidebarsStale: false, spinsStale: false })
  })

  it("mutated can mark all three at once (bulk move)", () => {
    const next = invalidationReducer(initialInvalidationState, {
      type: "mutated",
      tags: true,
      sidebars: true,
      spins: true,
    })
    expect(next).toEqual({ tagsStale: true, sidebarsStale: true, spinsStale: true })
  })

  it("mutated never clears a flag it doesn't name", () => {
    const pending: InvalidationState = {
      tagsStale: true,
      sidebarsStale: true,
      spinsStale: false,
    }
    const next = invalidationReducer(pending, { type: "mutated", spins: true })
    expect(next).toEqual({ tagsStale: true, sidebarsStale: true, spinsStale: true })
  })

  it("flushed clears exactly the named flag", () => {
    const allStale: InvalidationState = {
      tagsStale: true,
      sidebarsStale: true,
      spinsStale: true,
    }
    expect(invalidationReducer(allStale, { type: "flushed", flag: "tags" })).toEqual({
      tagsStale: false,
      sidebarsStale: true,
      spinsStale: true,
    })
    expect(invalidationReducer(allStale, { type: "flushed", flag: "sidebars" })).toEqual({
      tagsStale: true,
      sidebarsStale: false,
      spinsStale: true,
    })
    expect(invalidationReducer(allStale, { type: "flushed", flag: "spins" })).toEqual({
      tagsStale: true,
      sidebarsStale: true,
      spinsStale: false,
    })
  })

  it("regression (65914ed): deleting the selected project then reacting to its filter change never double-races tags", () => {
    // Sequence as it actually happens in useLibrary: removeProject() dispatches
    // projectDeleted first (still inside the same callback), then setSelectedProject(null)
    // triggers the filtersChanged effect on the next render.
    let state = initialInvalidationState
    state = invalidationReducer(state, { type: "projectDeleted", wasSelected: true })
    expect(state.tagsStale).toBe(false) // not requested yet — correctly deferred

    state = invalidationReducer(state, { type: "filtersChanged" })
    expect(state.tagsStale).toBe(true) // now requested exactly once, off fresh state
  })
})

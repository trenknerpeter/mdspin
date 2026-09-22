/**
 * Decides which slices of useLibrary's fetched data (tags / sidebars / spins) are stale,
 * given an event. Kept separate from the state it describes: this is pure decision logic,
 * testable with plain objects, no React involved.
 *
 * Exists to fix a class of bug (see 65914ed): a mutation that also changes a filter (e.g.
 * deleting the currently-selected project) must NOT also request its own tags refetch,
 * because the resulting filter-change will request one anyway, with fresh state — racing
 * the two produces a refetch from a stale closure that can clobber the correct one.
 */

export type InvalidationEvent =
  | { type: "filtersChanged" }
  | { type: "projectDeleted"; wasSelected: boolean }
  | { type: "mutated"; tags?: boolean; sidebars?: boolean; spins?: boolean }
  | { type: "flushed"; flag: "tags" | "sidebars" | "spins" }

export interface InvalidationState {
  tagsStale: boolean
  sidebarsStale: boolean
  spinsStale: boolean
}

export const initialInvalidationState: InvalidationState = {
  tagsStale: false,
  sidebarsStale: false,
  spinsStale: false,
}

export function invalidationReducer(
  state: InvalidationState,
  event: InvalidationEvent
): InvalidationState {
  switch (event.type) {
    case "filtersChanged":
      // Tags are scoped to the active project filter; spins are the filtered list itself.
      // Sidebars (projects/stats/folders) don't depend on the filter, so they're untouched.
      return { ...state, tagsStale: true, spinsStale: true }

    case "projectDeleted":
      return {
        ...state,
        // If the deleted project was selected, selectedProject is about to become null,
        // which fires its own "filtersChanged" event off the fresh, post-delete state.
        // Requesting a tags refetch here too would race it from this event's stale
        // closure — so leave tagsStale exactly as it was.
        tagsStale: event.wasSelected ? state.tagsStale : true,
        sidebarsStale: true,
        spinsStale: true,
      }

    case "mutated":
      return {
        ...state,
        tagsStale: state.tagsStale || !!event.tags,
        sidebarsStale: state.sidebarsStale || !!event.sidebars,
        spinsStale: state.spinsStale || !!event.spins,
      }

    case "flushed":
      if (event.flag === "tags") return { ...state, tagsStale: false }
      if (event.flag === "sidebars") return { ...state, sidebarsStale: false }
      return { ...state, spinsStale: false }

    default:
      return state
  }
}

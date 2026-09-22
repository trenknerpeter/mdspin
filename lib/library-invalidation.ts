/**
 * Decides whether useLibrary's tag sidebar is stale, given an event. Kept separate from the
 * state it describes: this is pure decision logic, testable with plain objects, no React
 * involved.
 *
 * Exists to fix a class of bug (see 65914ed): a mutation that also changes the selected
 * project (deleting the currently-selected one) must NOT also request its own tags refetch,
 * because the resulting project-filter change will request one anyway, with fresh state —
 * racing the two produces a refetch from a stale closure that can clobber the correct one.
 */

export type InvalidationEvent =
  | { type: "projectDeleted"; wasSelected: boolean }
  | { type: "refreshRequested" }
  | { type: "flushed" }

export interface InvalidationState {
  tagsStale: boolean
}

export const initialInvalidationState: InvalidationState = {
  tagsStale: false,
}

export function invalidationReducer(
  state: InvalidationState,
  event: InvalidationEvent
): InvalidationState {
  switch (event.type) {
    case "projectDeleted":
      // If the deleted project was selected, selectedProject is about to become null, which
      // fires its own "refreshRequested" off the fresh, post-delete state (see the
      // project-filter effect in useLibrary). Requesting a refetch here too would race it
      // from this event's stale closure — so leave tagsStale exactly as it was.
      return event.wasSelected ? state : { tagsStale: true }

    case "refreshRequested":
      return { tagsStale: true }

    case "flushed":
      return { tagsStale: false }

    default:
      return state
  }
}

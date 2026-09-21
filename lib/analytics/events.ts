/**
 * Every analytics event name in one place.
 *
 * Event names used to be inline string literals scattered across ~20 call
 * sites, with drifting quote style and property names. Import from here so a
 * typo is a type error.
 *
 * Client and server events overlap on purpose for conversions:
 * `file_conversion_completed` (browser) records what the user perceived,
 * `conversion_succeeded` (API route) records what actually happened. Comparing
 * the two is how we measure what share of users our browser analytics can see
 * at all — ad blockers now being the only thing between them.
 */

export const EVENTS = {
  // ── Auth ──────────────────────────────────────────────────
  signInSubmitted: "sign_in_submitted",
  signUpSubmitted: "sign_up_submitted",

  // ── Conversion, as the browser sees it ────────────────────
  fileConversionStarted: "file_conversion_started",
  fileConversionCompleted: "file_conversion_completed",
  fileConversionFailed: "file_conversion_failed",
  markdownCopied: "markdown_copied",
  markdownDownloaded: "markdown_downloaded",

  // ── Conversion, as the server sees it ─────────────────────
  conversionSucceeded: "conversion_succeeded",
  conversionFailed: "conversion_failed",
  /** The free-tier ceiling being hit. The pricing signal. */
  conversionRateLimited: "conversion_rate_limited",

  // ── Vault: navigation only ────────────────────────────────
  // Vault *state* (docs, projects, tags, subprojects) is queried from Postgres
  // via the metrics.* views — it leaves a row, so it needs no event. Only
  // non-mutating actions are captured here, because nothing records them.
  vaultDocumentIngested: "vault_document_ingested",
  vaultMapOpened: "vault_map_opened",
  vaultSearchPerformed: "vault_search_performed",
  vaultTagFilterApplied: "vault_tag_filter_applied",
  relatedDocumentOpened: "related_document_opened",

  // ── Machine-facing surfaces (no browser involved) ─────────
  vaultApiRead: "vault_api_read",
  vaultApiWrite: "vault_api_write",
  mcpToolCalled: "mcp_tool_called",

  // ── Integrations ──────────────────────────────────────────
  githubSyncRan: "github_sync_ran",
  githubSyncFailed: "github_sync_failed",

  // ── LLM features (these cost money — watch them) ──────────
  summaryGenerated: "summary_generated",
  briefGenerated: "brief_generated",

  // ── Commerce ──────────────────────────────────────────────
  apiKeyGenerated: "api_key_generated",
  apiKeyRevoked: "api_key_revoked",
  buyCoffeeClicked: "buy_coffee_clicked",
  checkoutInitiated: "checkout_initiated",
  paymentCompleted: "payment_completed",
} as const

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS]

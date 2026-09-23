"use client"

import { useState } from "react"
import Link from "next/link"
import { endpoints, BASE_URL, type Endpoint } from "./api-docs-data"

function MethodBadge({ method }: { method: string }) {
  const color = method === "GET" ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
  return (
    <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${color}`}>
      {method}
    </span>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="rounded-lg bg-[#1E1E1E] p-4">
      <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-[#F0EDE8] whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  )
}

function ParamTable({ params }: { params: Endpoint["parameters"] }) {
  if (params.length === 0) {
    return <p className="text-xs text-[#888480]">No request body — authentication is via the header.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#2A2A2A] text-[#888480]">
            <th className="pb-2 pr-4 font-medium">Parameter</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Required</th>
            <th className="pb-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-[#2A2A2A]/50">
              <td className="py-2.5 pr-4 font-mono text-[#FF4800]">{p.name}</td>
              <td className="py-2.5 pr-4 font-mono text-[#888480]">{p.type}</td>
              <td className="py-2.5 pr-4">
                {p.required ? (
                  <span className="text-[#F0EDE8]">Yes</span>
                ) : (
                  <span className="text-[#888480]">No</span>
                )}
              </td>
              <td className="py-2.5 text-[#888480]">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResponseTable({ fields }: { fields: Endpoint["responseFields"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[#2A2A2A] text-[#888480]">
            <th className="pb-2 pr-4 font-medium">Field</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-b border-[#2A2A2A]/50">
              <td className="py-2.5 pr-4 font-mono text-emerald-400">{f.name}</td>
              <td className="py-2.5 pr-4 font-mono text-[#888480]">{f.type}</td>
              <td className="py-2.5 text-[#888480]">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EndpointSection({ endpoint }: { endpoint: Endpoint }) {
  const [tab, setTab] = useState<"request" | "response">("request")

  return (
    <section id={endpoint.id} className="scroll-mt-32">
      <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <MethodBadge method={endpoint.method} />
          <code className="font-mono text-sm text-[#F0EDE8]">{endpoint.path}</code>
        </div>
        <h3 className="mb-2 font-display text-lg font-bold text-white">
          {endpoint.title}
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-[#888480]">
          {endpoint.description}
        </p>

        {/* Parameters */}
        <div className="mb-6">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#888480]">
            Parameters
          </h4>
          <ParamTable params={endpoint.parameters} />
        </div>

        {/* Tabs: Request / Response */}
        <div role="tablist" aria-label="Example request and response" className="mb-3 flex gap-1 rounded-lg bg-[#0C0C0C] p-1">
          <button
            role="tab"
            aria-selected={tab === "request"}
            aria-controls={`${endpoint.id}-request`}
            onClick={() => setTab("request")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "request"
                ? "bg-[#2A2A2A] text-[#F0EDE8]"
                : "text-[#888480] hover:text-[#F0EDE8]"
            }`}
          >
            Example Request
          </button>
          <button
            role="tab"
            aria-selected={tab === "response"}
            aria-controls={`${endpoint.id}-response`}
            onClick={() => setTab("response")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "response"
                ? "bg-[#2A2A2A] text-[#F0EDE8]"
                : "text-[#888480] hover:text-[#F0EDE8]"
            }`}
          >
            Example Response
          </button>
        </div>

        {tab === "request" ? (
          <div role="tabpanel" id={`${endpoint.id}-request`}>
            <CodeBlock>{endpoint.exampleRequest}</CodeBlock>
          </div>
        ) : (
          <div role="tabpanel" id={`${endpoint.id}-response`}>
            <CodeBlock>{endpoint.exampleResponse}</CodeBlock>
            <div className="mt-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#888480]">
                Response Fields
              </h4>
              <ResponseTable fields={endpoint.responseFields} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function ApiDocsContent() {
  return (
    <div className="space-y-6">
      {/* Authentication */}
      <section id="authentication" className="mb-10 scroll-mt-32">
        <h2 className="mb-4 font-display text-2xl font-bold text-white">
          Authentication
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-[#888480]">
          All API requests require an API key sent via the{" "}
          <code className="rounded bg-[#1E1E1E] px-1.5 py-0.5 font-mono text-xs text-[#FF4800]">
            Authorization
          </code>{" "}
          header. Keys start with{" "}
          <code className="rounded bg-[#1E1E1E] px-1.5 py-0.5 font-mono text-xs text-[#F0EDE8]">
            mdspin_
          </code>{" "}
          and can be generated from your{" "}
          <Link href="/api-keys" className="text-[#FF4800] underline underline-offset-2 hover:text-[#e04200]">
            API Keys dashboard
          </Link>.
        </p>
        <CodeBlock>{`Authorization: Bearer mdspin_your_api_key`}</CodeBlock>

        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-sm">🔒</span>
              <div>
                <p className="text-sm font-medium text-[#F0EDE8]">Base URL — Conversion API</p>
                <code className="font-mono text-sm text-[#888480]">{BASE_URL}</code>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-sm">🗄️</span>
              <div>
                <p className="text-sm font-medium text-[#F0EDE8]">Base URL — Knowledge Vault &amp; MCP</p>
                <code className="font-mono text-sm text-[#888480]">https://mdspin.app</code>
                <p className="mt-1 text-xs text-[#888480]">
                  A different domain from the Conversion API above — the Vault REST endpoints and the MCP server are
                  both served directly from the main MDSpin app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scopes & Permissions */}
      <section id="scopes" className="mb-10 scroll-mt-32">
        <h2 className="mb-4 font-display text-2xl font-bold text-white">
          Scopes &amp; Permissions
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-[#888480]">
          Each API key carries a set of scopes that determine which endpoints it
          can access. All API keys include all scopes by default.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-[#888480]">
                <th className="pb-2 pr-4 font-medium">Scope</th>
                <th className="pb-2 pr-4 font-medium">Description</th>
                <th className="pb-2 font-medium">Endpoints</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  scope: "convert",
                  description: "Convert documents to Markdown",
                  endpoints: "/v1/convert/*",
                },
                {
                  scope: "drive",
                  description: "Save files to Google Drive",
                  endpoints: "/v1/save/drive",
                },
                {
                  scope: "read:account",
                  description: "Verify API key and read account info",
                  endpoints: "/oauth/me",
                },
                {
                  scope: "vault",
                  description: "Read and update your Knowledge Vault — documents, projects, search",
                  endpoints: "/api/v1/vault/*",
                },
              ].map((s) => (
                <tr key={s.scope} className="border-b border-[#2A2A2A]/50">
                  <td className="py-2.5 pr-4 font-mono text-[#FF4800]">{s.scope}</td>
                  <td className="py-2.5 pr-4 text-[#F0EDE8]">{s.description}</td>
                  <td className="py-2.5 font-mono text-[#888480]">{s.endpoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick Nav */}
      <section className="mb-10">
        <h2 className="mb-4 font-display text-2xl font-bold text-white">
          Endpoints
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {endpoints.map((ep) => (
            <a
              key={ep.id}
              href={`#${ep.id}`}
              className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#161616] px-4 py-3 transition-colors hover:border-[#3A3A3A]"
            >
              <MethodBadge method={ep.method} />
              <span className="font-mono text-xs text-[#888480]">{ep.path}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Endpoint Reference */}
      {endpoints.map((ep) => (
        <EndpointSection key={ep.id} endpoint={ep} />
      ))}

      {/* Vault MCP Server */}
      <section id="mcp-server" className="scroll-mt-32">
        <h2 className="mb-4 font-display text-2xl font-bold text-white">
          Vault MCP Server
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-[#888480]">
          For AI agents rather than raw HTTP calls, your Knowledge Vault is also reachable as a{" "}
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF4800] underline underline-offset-2 hover:text-[#e04200]"
          >
            Model Context Protocol
          </a>{" "}
          server — 14 tools covering everything the REST API above exposes, plus document and project writes. Same
          authentication as everything else on this page.
        </p>
        <div className="mb-6 rounded-xl border border-[#2A2A2A] bg-[#161616] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-sm">🔌</span>
            <div>
              <p className="text-sm font-medium text-[#F0EDE8]">MCP endpoint</p>
              <code className="font-mono text-sm text-[#888480]">https://mdspin.app/api/mcp</code>
            </div>
          </div>
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#888480]">
          Connecting a client
        </h3>
        <p className="mb-3 text-sm leading-relaxed text-[#888480]">
          Using Claude Code:
        </p>
        <CodeBlock>{`claude mcp add --transport http mdspin-vault https://mdspin.app/api/mcp \\
  --header "Authorization: Bearer mdspin_your_api_key"`}</CodeBlock>
        <p className="mb-3 mt-4 text-sm leading-relaxed text-[#888480]">
          Or add it directly to any client that supports a Streamable HTTP MCP server:
        </p>
        <CodeBlock>{`{
  "mcpServers": {
    "mdspin-vault": {
      "type": "http",
      "url": "https://mdspin.app/api/mcp",
      "headers": { "Authorization": "Bearer mdspin_your_api_key" }
    }
  }
}`}</CodeBlock>

        <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-[#888480]">
          Read tools
        </h3>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-[#888480]">
                <th className="pb-2 pr-4 font-medium">Tool</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "vault_overview", description: "Totals, projects, top tags, and your 10 most recently updated documents. The cheapest first call for an agent exploring your Vault." },
                { name: "search_vault", description: "Keyword-and-meaning search across your Vault. Returns short snippets and a relevance score, never full document bodies." },
                { name: "list_documents", description: "Filterable, keyset-paginated document listing. Prefer search_vault when looking for something specific rather than enumerating." },
                { name: "get_document", description: "Fetch 1–5 documents by id, with a content mode: none, summary (default), outline, or full (paginated)." },
                { name: "list_projects", description: "Every project in your Vault, flat, with parent_id marking which are subprojects." },
                { name: "get_project", description: "A single project's details and instructions, with its subprojects listed inline." },
                { name: "get_related_documents", description: "Documents related to a given one, scoped to its top-level project." },
              ].map((t) => (
                <tr key={t.name} className="border-b border-[#2A2A2A]/50">
                  <td className="py-2.5 pr-4 font-mono text-emerald-400">{t.name}</td>
                  <td className="py-2.5 text-[#888480]">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#888480]">
          Write tools
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-[#888480]">
                <th className="pb-2 pr-4 font-medium">Tool</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "create_document", description: "Create a new document from a Markdown body. Title is derived from the first heading when omitted." },
                { name: "append_to_document", description: "Add content to the end of an existing document without touching what's already there." },
                { name: "update_document", description: "Full replace of title/markdown/tags/project, gated by expected_version and a required reason. Only allowed on notes and MCP-created documents — imported/converted/API-created documents return IMMUTABLE_SOURCE." },
                { name: "organize_document", description: "Add and/or remove tags on a document. Additive/subtractive only — there's no 'set tags'." },
                { name: "remove_from_vault", description: "Reversibly remove a document from listings and search. There is no delete tool." },
                { name: "create_project", description: "Create a project, optionally nested one level under an existing top-level project." },
                { name: "update_project", description: "Rename a project, change its color or instructions, or move it in or out of nesting." },
              ].map((t) => (
                <tr key={t.name} className="border-b border-[#2A2A2A]/50">
                  <td className="py-2.5 pr-4 font-mono text-blue-400">{t.name}</td>
                  <td className="py-2.5 text-[#888480]">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Error Codes */}
      <section id="errors" className="scroll-mt-32">
        <h2 className="mb-4 font-display text-2xl font-bold text-white">
          Error Codes
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-[#888480]">
          The REST API returns standard HTTP status codes with a JSON body of the
          shape <code className="rounded bg-[#1E1E1E] px-1.5 py-0.5 font-mono text-xs text-[#F0EDE8]">{`{ "error": "...", "message": "..." }`}</code>.
          The <span className="text-[#F0EDE8]">Make error type</span> column shows
          which class our Make.com custom app raises for that status — useful if
          you are branching on error type inside a Make scenario.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-[#888480]">
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Meaning</th>
                <th className="pb-2 pr-4 font-medium">Make error type</th>
                <th className="pb-2 font-medium">What to do</th>
              </tr>
            </thead>
            <tbody>
              {[
                { status: "400", meaning: "Bad Request",           makeType: "DataError",               action: "Check your request body — a required parameter is missing or malformed." },
                { status: "401", meaning: "Unauthorized",          makeType: "InvalidConnectionError",  action: "Your API key is missing, invalid, or expired. In Make, the scenario prompts a reconnect." },
                { status: "403", meaning: "Forbidden",             makeType: "InvalidAccessTokenError", action: "Your API key does not have access to this resource, or the Drive folder is not shared with the connected account." },
                { status: "404", meaning: "Not Found",             makeType: "DataError",               action: "The document, folder, or endpoint does not exist. Check the URL or ID." },
                { status: "413", meaning: "Payload Too Large",     makeType: "DataError",               action: "The file exceeds the size limit. Reduce file size or use the batch endpoint for multiple smaller files." },
                { status: "429", meaning: "Too Many Requests",     makeType: "RateLimitError",          action: "Rate limit exceeded. Wait and retry with exponential backoff. Make retries automatically." },
                { status: "500", meaning: "Internal Server Error", makeType: "RuntimeError",            action: "Unexpected server error. Retry the request. If it persists, contact support." },
                { status: "502", meaning: "Bad Gateway",           makeType: "RuntimeError",            action: "Upstream error. Retry." },
                { status: "503", meaning: "Service Unavailable",   makeType: "RuntimeError",            action: "Temporary outage or maintenance. Retry after a short delay." },
              ].map((e) => (
                <tr key={e.status} className="border-b border-[#2A2A2A]/50">
                  <td className="py-2.5 pr-4 font-mono text-[#FF4800]">{e.status}</td>
                  <td className="py-2.5 pr-4 font-medium text-[#F0EDE8]">{e.meaning}</td>
                  <td className="py-2.5 pr-4 font-mono text-[#888480]">{e.makeType}</td>
                  <td className="py-2.5 text-[#888480]">{e.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Batch partial failures */}
        <div className="mt-6 rounded-xl border border-[#2A2A2A] bg-[#161616] p-5">
          <h3 className="mb-2 font-display text-sm font-bold text-white">
            Partial failures in batch conversion
          </h3>
          <p className="mb-3 text-xs leading-relaxed text-[#888480]">
            <code className="rounded bg-[#1E1E1E] px-1.5 py-0.5 font-mono text-[11px] text-[#FF4800]">POST /v1/convert/attachments/batch</code>{" "}
            always returns <code className="text-[#F0EDE8]">200</code>, even when some files
            fail. Inspect the response body to handle them:
          </p>
          <ul className="mb-3 space-y-1 text-xs text-[#888480]">
            <li>• <code className="text-[#F0EDE8]">total</code>, <code className="text-[#F0EDE8]">succeeded</code>, <code className="text-[#F0EDE8]">failed</code> — summary counts</li>
            <li>• <code className="text-[#F0EDE8]">results[].success</code> — per-file boolean</li>
            <li>• <code className="text-[#F0EDE8]">results[].error</code>, <code className="text-[#F0EDE8]">results[].message</code> — populated when <code>success</code> is false</li>
          </ul>
          <p className="text-xs leading-relaxed text-[#888480]">
            Inside the Make app, this module raises a <code className="font-mono text-[#F0EDE8]">DataError</code> when
            <code className="mx-1 font-mono text-[#F0EDE8]">failed &gt; 0</code>, surfacing the
            first failure&apos;s message so the scenario halts rather than silently
            passing partial data downstream.
          </p>
        </div>

        {/* Error body example */}
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#888480]">
            Example error response
          </h3>
          <CodeBlock>{`HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "invalid_api_key",
  "message": "API key invalid or expired. Reconnect your MDSpin account."
}`}</CodeBlock>
        </div>
      </section>

      {/* Supported Formats */}
      <section id="formats" className="scroll-mt-32">
        <h2 className="mb-4 font-display text-2xl font-bold text-white">
          Supported Formats
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { format: "PDF", mime: "application/pdf" },
            { format: "DOCX", mime: "application/vnd.openxmlformats-..." },
            { format: "DOC", mime: "application/msword" },
            { format: "PPTX", mime: "application/vnd.openxmlformats-..." },
            { format: "Google Docs", mime: "via URL or ID" },
            { format: "Google Slides", mime: "via URL or ID" },
            { format: "TXT", mime: "text/plain" },
            { format: "RTF", mime: "application/rtf" },
            { format: "PNG", mime: "image/png" },
            { format: "JPG", mime: "image/jpeg" },
          ].map((f) => (
            <div key={f.format} className="rounded-lg border border-[#2A2A2A] bg-[#161616] p-3 text-center">
              <p className="font-mono text-sm font-medium text-[#F0EDE8]">{f.format}</p>
              <p className="mt-1 text-[10px] text-[#888480]">{f.mime}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

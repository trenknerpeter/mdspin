export interface EndpointParam {
  name: string
  type: string
  required: boolean
  description: string
}

export interface EndpointResponseField {
  name: string
  type: string
  description: string
}

export interface Endpoint {
  id: string
  method: "GET" | "POST" | "PATCH"
  path: string
  title: string
  description: string
  parameters: EndpointParam[]
  responseFields: EndpointResponseField[]
  exampleRequest: string
  exampleResponse: string
}

export const BASE_URL = "https://api.mdspin.app"

export const endpoints: Endpoint[] = [
  {
    id: "verify-api-key",
    method: "GET",
    path: "/oauth/me",
    title: "Verify API Key",
    description:
      "Validates an API key and returns the associated account email. Use this to confirm a key is active before making conversion requests.",
    parameters: [],
    responseFields: [
      { name: "email", type: "string", description: "The email address associated with the API key." },
    ],
    exampleRequest: `curl -X GET https://api.mdspin.app/oauth/me \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "email": "user@example.com"
}`,
  },

  {
    id: "convert-google-doc",
    method: "POST",
    path: "/v1/convert/google-doc",
    title: "Convert Google Doc (Deprecated)",
    description:
      "Deprecated. This endpoint relied on Google Drive/Docs scopes that are no longer requested at sign-in. New users will not have a usable Google token on file. Workaround: export the Doc yourself (e.g. via Google's API or Make.com's Google Docs/Drive modules) and convert the resulting file with /v1/convert/attachment or /v1/convert/url.",
    parameters: [
      { name: "doc_id_or_url", type: "string", required: true, description: "Full Google Docs URL (e.g. https://docs.google.com/document/d/...) or the document ID." },
      { name: "include_metadata", type: "boolean", required: false, description: "When true, response includes character count and heading count. Defaults to false." },
    ],
    responseFields: [
      { name: "markdown_text", type: "string", description: "The converted Markdown content." },
      { name: "title", type: "string", description: "The document title." },
      { name: "doc_id", type: "string", description: "The Google Doc ID." },
      { name: "word_count", type: "number", description: "Total word count of the converted text." },
      { name: "converted_at", type: "string", description: "ISO 8601 timestamp of the conversion." },
    ],
    exampleRequest: `curl -X POST https://api.mdspin.app/v1/convert/google-doc \\
  -H "Authorization: Bearer mdspin_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "doc_id_or_url": "https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
    "include_metadata": false
  }'`,
    exampleResponse: `{
  "markdown_text": "# Meeting Notes\\n\\nAttendees: Alice, Bob...",
  "title": "Q1 Meeting Notes",
  "doc_id": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
  "word_count": 342,
  "converted_at": "2026-04-16T10:30:00.000Z"
}`,
  },

  {
    id: "convert-google-slides",
    method: "POST",
    path: "/v1/convert/google-slides",
    title: "Convert Google Slides (Deprecated)",
    description:
      "Deprecated. This endpoint relied on Google Drive/Docs scopes that are no longer requested at sign-in. New users will not have a usable Google token on file. Workaround: export the deck as PDF or PPTX yourself (e.g. via Google's API or Make.com's Google Drive module) and convert the resulting file with /v1/convert/attachment or /v1/convert/url.",
    parameters: [
      { name: "presentation_id_or_url", type: "string", required: true, description: "Full Google Slides URL or just the presentation ID." },
      { name: "include_notes", type: "boolean", required: false, description: "When true, speaker notes are included under each slide. Defaults to false." },
      { name: "include_metadata", type: "boolean", required: false, description: "When true, response includes character count and heading count. Defaults to false." },
    ],
    responseFields: [
      { name: "markdown_text", type: "string", description: "The converted Markdown content." },
      { name: "title", type: "string", description: "The presentation title." },
      { name: "presentation_id", type: "string", description: "The Google Slides presentation ID." },
      { name: "slide_count", type: "number", description: "Number of slides in the presentation." },
      { name: "word_count", type: "number", description: "Total word count of the converted text." },
      { name: "converted_at", type: "string", description: "ISO 8601 timestamp of the conversion." },
    ],
    exampleRequest: `curl -X POST https://api.mdspin.app/v1/convert/google-slides \\
  -H "Authorization: Bearer mdspin_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "presentation_id_or_url": "https://docs.google.com/presentation/d/1xYzAbCdEfGhIjKlMnOpQrStUvWxYz",
    "include_notes": true,
    "include_metadata": false
  }'`,
    exampleResponse: `{
  "markdown_text": "# Product Launch\\n\\n## Slide 1: Overview\\n\\nWe are launching...",
  "title": "Product Launch 2026",
  "presentation_id": "1xYzAbCdEfGhIjKlMnOpQrStUvWxYz",
  "slide_count": 12,
  "word_count": 890,
  "converted_at": "2026-04-16T10:30:00.000Z"
}`,
  },

  {
    id: "convert-attachment",
    method: "POST",
    path: "/v1/convert/attachment",
    title: "Convert Attachment",
    description:
      "Converts a Base64-encoded PDF or DOCX file to Markdown. Ideal for processing email attachments or files already in memory.",
    parameters: [
      { name: "file_data", type: "string", required: true, description: "The file content encoded as a Base64 string." },
      { name: "filename", type: "string", required: true, description: "Full filename including extension, e.g. 'report.pdf' or 'notes.docx'." },
      { name: "mime_type", type: "string", required: false, description: "MIME type, e.g. 'application/pdf'. Auto-detected from filename if omitted." },
    ],
    responseFields: [
      { name: "markdown_text", type: "string", description: "The converted Markdown content." },
      { name: "filename", type: "string", description: "The original filename." },
      { name: "file_type", type: "string", description: "Detected file type (e.g. 'pdf', 'docx')." },
      { name: "word_count", type: "number", description: "Total word count of the converted text." },
      { name: "converted_at", type: "string", description: "ISO 8601 timestamp of the conversion." },
      { name: "warning", type: "string", description: "Optional warning message if the conversion had issues." },
    ],
    exampleRequest: `curl -X POST https://api.mdspin.app/v1/convert/attachment \\
  -H "Authorization: Bearer mdspin_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "file_data": "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZS...",
    "filename": "report.pdf",
    "mime_type": "application/pdf"
  }'`,
    exampleResponse: `{
  "markdown_text": "# Annual Report\\n\\n## Executive Summary...",
  "filename": "report.pdf",
  "file_type": "pdf",
  "word_count": 2150,
  "converted_at": "2026-04-16T10:30:00.000Z",
  "warning": null
}`,
  },

  {
    id: "convert-url",
    method: "POST",
    path: "/v1/convert/url",
    title: "Convert File from URL",
    description:
      "Fetches a file from a public URL and converts it to Markdown. Works with S3 pre-signed URLs, Dropbox links, and any direct download link.",
    parameters: [
      { name: "file_url", type: "string", required: true, description: "Public URL pointing to a PDF, DOCX, or other supported file." },
      { name: "filename", type: "string", required: false, description: "Override the auto-detected filename. Include extension, e.g. 'report.pdf'." },
    ],
    responseFields: [
      { name: "markdown_text", type: "string", description: "The converted Markdown content." },
      { name: "filename", type: "string", description: "The filename (detected or overridden)." },
      { name: "file_type", type: "string", description: "Detected file type." },
      { name: "word_count", type: "number", description: "Total word count of the converted text." },
      { name: "converted_at", type: "string", description: "ISO 8601 timestamp of the conversion." },
      { name: "warning", type: "string", description: "Optional warning message if the conversion had issues." },
    ],
    exampleRequest: `curl -X POST https://api.mdspin.app/v1/convert/url \\
  -H "Authorization: Bearer mdspin_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "file_url": "https://example.com/files/report.pdf",
    "filename": "report.pdf"
  }'`,
    exampleResponse: `{
  "markdown_text": "# Downloaded Report\\n\\nContents...",
  "filename": "report.pdf",
  "file_type": "pdf",
  "word_count": 1580,
  "converted_at": "2026-04-16T10:30:00.000Z",
  "warning": null
}`,
  },

  {
    id: "convert-batch",
    method: "POST",
    path: "/v1/convert/attachments/batch",
    title: "Batch Convert Attachments",
    description:
      "Converts up to 20 Base64-encoded files to Markdown in a single request. Each file is processed independently — one failure does not affect the others.",
    parameters: [
      {
        name: "files",
        type: "array",
        required: true,
        description: "Array of file objects (max 20). Each object must include file_data and filename, with an optional mime_type.",
      },
    ],
    responseFields: [
      { name: "results", type: "array", description: "Array of result objects — one per input file. Each contains: success (boolean), index (number), markdown_text, filename, file_type, word_count, converted_at, warning, error, message." },
      { name: "total", type: "number", description: "Total number of files submitted." },
      { name: "succeeded", type: "number", description: "Number of files successfully converted." },
      { name: "failed", type: "number", description: "Number of files that failed conversion." },
    ],
    exampleRequest: `curl -X POST https://api.mdspin.app/v1/convert/attachments/batch \\
  -H "Authorization: Bearer mdspin_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "files": [
      {
        "file_data": "JVBERi0xLjQK...",
        "filename": "report.pdf"
      },
      {
        "file_data": "UEsDBBQAAAAI...",
        "filename": "notes.docx",
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    ]
  }'`,
    exampleResponse: `{
  "results": [
    {
      "success": true,
      "index": 0,
      "markdown_text": "# Report\\n\\nContent...",
      "filename": "report.pdf",
      "file_type": "pdf",
      "word_count": 2150,
      "converted_at": "2026-04-16T10:30:00.000Z",
      "warning": null
    },
    {
      "success": true,
      "index": 1,
      "markdown_text": "# Notes\\n\\nMeeting notes...",
      "filename": "notes.docx",
      "file_type": "docx",
      "word_count": 580,
      "converted_at": "2026-04-16T10:30:01.000Z",
      "warning": null
    }
  ],
  "total": 2,
  "succeeded": 2,
  "failed": 0
}`,
  },

  {
    id: "save-to-drive",
    method: "POST",
    path: "/v1/save/drive",
    title: "Save Markdown to Google Drive (Deprecated)",
    description:
      "Deprecated. This endpoint relied on Google Drive scopes that are no longer requested at sign-in. New users will not have a usable Google token on file. Workaround: take the markdown_text returned by any conversion endpoint and upload it to Drive yourself (e.g. via Google's API or Make.com's Google Drive 'Upload a File' module).",
    parameters: [
      { name: "markdown_text", type: "string", required: true, description: "The Markdown content to save." },
      { name: "folder_id", type: "string", required: true, description: "Google Drive folder ID (the last segment of the folder's URL)." },
      { name: "filename", type: "string", required: false, description: "Filename without extension. Defaults to 'converted-document'. The .md extension is added automatically." },
      { name: "overwrite", type: "boolean", required: false, description: "When false (default), a timestamp is appended to avoid overwriting existing files." },
    ],
    responseFields: [
      { name: "file_id", type: "string", description: "The Google Drive file ID of the saved file." },
      { name: "file_url", type: "string", description: "Direct URL to the file in Google Drive." },
      { name: "filename", type: "string", description: "The final filename (with .md extension)." },
      { name: "folder_id", type: "string", description: "The folder ID where the file was saved." },
      { name: "saved_at", type: "string", description: "ISO 8601 timestamp of when the file was saved." },
    ],
    exampleRequest: `curl -X POST https://api.mdspin.app/v1/save/drive \\
  -H "Authorization: Bearer mdspin_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "markdown_text": "# Meeting Notes\\n\\nAttendees: Alice, Bob...",
    "folder_id": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
    "filename": "meeting-notes-q1",
    "overwrite": false
  }'`,
    exampleResponse: `{
  "file_id": "1xYzAbCdEfGhIjKlMnOpQr",
  "file_url": "https://drive.google.com/file/d/1xYzAbCdEfGhIjKlMnOpQr/view",
  "filename": "meeting-notes-q1.md",
  "folder_id": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
  "saved_at": "2026-04-16T10:35:00.000Z"
}`,
  },

  {
    id: "vault-me",
    method: "GET",
    path: "/api/v1/vault/me",
    title: "Vault: Get Account Info",
    description:
      "Verifies the API key (or session) and returns the authenticated user's id and how they authenticated. A lightweight check before making other Vault requests. Note: every Vault endpoint below is served from https://mdspin.app — a different domain than the conversion endpoints above (https://api.mdspin.app).",
    parameters: [],
    responseFields: [
      { name: "user_id", type: "string", description: "The authenticated user's id." },
      { name: "auth_method", type: "string", description: "\"api_key\" when authenticated via an API key, otherwise \"session\"." },
    ],
    exampleRequest: `curl -X GET https://mdspin.app/api/v1/vault/me \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "auth_method": "api_key"
}`,
  },

  {
    id: "vault-list-documents",
    method: "GET",
    path: "/api/v1/vault/documents",
    title: "Vault: List Documents",
    description:
      "Lists documents in your Knowledge Vault, optionally filtered by project, tags, or a search term. Paginated. Never includes the document's markdown body — fetch a single document with ?include=markdown for that.",
    parameters: [
      { name: "project_id", type: "string", required: false, description: "Filter to documents in this project or its subprojects. Must be a valid UUID." },
      { name: "tags", type: "string", required: false, description: "Comma-separated list of tags to filter by." },
      { name: "search", type: "string", required: false, description: "Filter to documents whose title or filename matches this text." },
      { name: "limit", type: "number", required: false, description: "Max results per page." },
      { name: "offset", type: "number", required: false, description: "Number of results to skip, for pagination." },
    ],
    responseFields: [
      { name: "data", type: "array", description: "Document objects: id, filename, title, file_type, word_count, project_ids, tags, source_type, converted_at, updated_at, version. markdown_text is always null here." },
      { name: "page", type: "object", description: "Pagination info: limit, offset, total, has_more, next_offset." },
    ],
    exampleRequest: `curl -X GET "https://mdspin.app/api/v1/vault/documents?project_id=3fa85f64-5717-4562-b3fc-2c963f66afa6&limit=20" \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "data": [
    {
      "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
      "filename": "q1-report.pdf",
      "title": "Q1 Report",
      "file_type": "pdf",
      "word_count": 2150,
      "project_ids": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
      "tags": ["finance", "q1"],
      "source_type": "upload",
      "converted_at": "2026-04-16T10:30:00.000Z",
      "updated_at": "2026-04-16T10:30:00.000Z",
      "version": 1,
      "markdown_text": null
    }
  ],
  "page": { "limit": 20, "offset": 0, "total": 1, "has_more": false, "next_offset": null }
}`,
  },

  {
    id: "vault-sync-document",
    method: "POST",
    path: "/api/v1/vault/documents",
    title: "Vault: Sync a Document",
    description:
      "Upserts a document by its external identity from a connected source (e.g. a GitHub repo) — the same endpoint MDSpin's own Live Source Sync uses, exposed here for external callers. Not a general 'create any document' endpoint: it requires an existing source_connection_id from a connection you've already set up.",
    parameters: [
      { name: "source_connection_id", type: "string", required: true, description: "UUID of an existing source connection (created when you connect a GitHub repo to your Vault)." },
      { name: "external_id", type: "string", required: true, description: "Stable identifier for this document at the source, e.g. a file path." },
      { name: "markdown", type: "string", required: true, description: "The document's Markdown content." },
      { name: "external_url", type: "string", required: false, description: "A URL back to the source, e.g. the file's GitHub URL." },
      { name: "title", type: "string", required: false, description: "Document title. Derived from the content when omitted." },
      { name: "project_id", type: "string", required: false, description: "Vault project to file the document under. Must be a project you own." },
      { name: "tags", type: "array", required: false, description: "Tags to apply to the document." },
      { name: "summary_status", type: "string", required: false, description: "'pending' to queue an AI summary, or 'manual'." },
    ],
    responseFields: [
      { name: "action", type: "string", description: "'inserted', 'adopted', or 'updated' — what happened to the document." },
      { name: "document", type: "object", description: "The resulting document, including external_id, external_url, and source_link_state." },
    ],
    exampleRequest: `curl -X POST https://mdspin.app/api/v1/vault/documents \\
  -H "Authorization: Bearer mdspin_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source_connection_id": "b6d1b5b0-3f2e-4c1a-9b8f-7f9a2f6d9e3c",
    "external_id": "docs/architecture.md",
    "external_url": "https://github.com/acme/wiki/blob/main/docs/architecture.md",
    "markdown": "# Architecture\\n\\n..."
  }'`,
    exampleResponse: `{
  "action": "inserted",
  "document": {
    "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
    "filename": "architecture.md",
    "title": "Architecture",
    "file_type": "markdown",
    "word_count": 640,
    "project_ids": [],
    "tags": [],
    "source_type": "github",
    "converted_at": "2026-09-16T12:00:00.000Z",
    "updated_at": "2026-09-16T12:00:00.000Z",
    "version": 1,
    "markdown_text": "# Architecture\\n\\n...",
    "external_id": "docs/architecture.md",
    "external_url": "https://github.com/acme/wiki/blob/main/docs/architecture.md",
    "source_link_state": "linked"
  }
}`,
  },

  {
    id: "vault-get-document",
    method: "GET",
    path: "/api/v1/vault/documents/:id",
    title: "Vault: Get a Document",
    description:
      "Fetches a single document by id. Pass ?include=markdown to include its full Markdown body — omitted by default to keep the default response light.",
    parameters: [
      { name: "include", type: "string", required: false, description: "Set to 'markdown' to include the document's markdown_text in the response." },
    ],
    responseFields: [
      { name: "id, filename, title, file_type, word_count, project_ids, tags, source_type, converted_at, updated_at, version", type: "—", description: "Same document fields as List Documents." },
      { name: "markdown_text", type: "string", description: "The document's Markdown body — populated only when ?include=markdown is passed." },
    ],
    exampleRequest: `curl -X GET "https://mdspin.app/api/v1/vault/documents/9c858901-8a57-4791-81fe-4c455b099bc9?include=markdown" \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "filename": "q1-report.pdf",
  "title": "Q1 Report",
  "file_type": "pdf",
  "word_count": 2150,
  "project_ids": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
  "tags": ["finance", "q1"],
  "source_type": "upload",
  "converted_at": "2026-04-16T10:30:00.000Z",
  "updated_at": "2026-04-16T10:30:00.000Z",
  "version": 1,
  "markdown_text": "# Q1 Report\\n\\n## Executive Summary..."
}`,
  },

  {
    id: "vault-update-document",
    method: "PATCH",
    path: "/api/v1/vault/documents/:id",
    title: "Vault: Update a Document",
    description:
      "Updates a document's title, markdown body, tags, or project. Requires expected_version — the document's current version from a prior GET — so a stale, concurrent edit gets rejected (409) instead of silently overwritten. Every field you omit is left unchanged.",
    parameters: [
      { name: "expected_version", type: "number", required: true, description: "The document's current version. A stale value returns a 409 VERSION_CONFLICT." },
      { name: "title", type: "string", required: false, description: "New title, or null to clear it." },
      { name: "markdown_text", type: "string", required: false, description: "New Markdown body, or null to clear it." },
      { name: "tags", type: "array", required: false, description: "Replaces the document's tags entirely." },
      { name: "project_id", type: "string", required: false, description: "Moves the document to this project, or null to unfile it. Must be a project you own." },
      { name: "reason", type: "string", required: false, description: "Optional free-text note recorded on the revision." },
    ],
    responseFields: [
      { name: "id, filename, title, file_type, word_count, project_ids, tags, source_type, converted_at, updated_at", type: "—", description: "The updated document, same shape as Get a Document." },
      { name: "version", type: "number", description: "The document's new version number after this update." },
    ],
    exampleRequest: `curl -X PATCH https://mdspin.app/api/v1/vault/documents/9c858901-8a57-4791-81fe-4c455b099bc9 \\
  -H "Authorization: Bearer mdspin_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expected_version": 1,
    "tags": ["finance", "q1", "reviewed"],
    "reason": "Marked as reviewed"
  }'`,
    exampleResponse: `{
  "id": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "filename": "q1-report.pdf",
  "title": "Q1 Report",
  "file_type": "pdf",
  "word_count": 2150,
  "project_ids": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
  "tags": ["finance", "q1", "reviewed"],
  "source_type": "upload",
  "converted_at": "2026-04-16T10:30:00.000Z",
  "updated_at": "2026-09-23T09:12:00.000Z",
  "version": 2,
  "markdown_text": null
}`,
  },

  {
    id: "vault-related-documents",
    method: "GET",
    path: "/api/v1/vault/documents/:id/related",
    title: "Vault: Get Related Documents",
    description:
      "Returns documents related to the given one, ranked within its top-level project (subproject boundaries are ignored, so splitting a project doesn't shrink this list). An empty array — not an error — is normal for an unfiled document or one with no related matches.",
    parameters: [
      { name: "limit", type: "number", required: false, description: "Max number of related documents to return." },
    ],
    responseFields: [
      { name: "data", type: "array", description: "Related document objects: id, filename, title, file_type, word_count, tags, project_id, converted_at, rank, and strength ('strong' | 'medium' | 'weak')." },
    ],
    exampleRequest: `curl -X GET "https://mdspin.app/api/v1/vault/documents/9c858901-8a57-4791-81fe-4c455b099bc9/related?limit=5" \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "data": [
    {
      "id": "1b1f6d1a-9c9d-4a02-9b1e-2b7a5b6d9f10",
      "filename": "q1-forecast.docx",
      "title": "Q1 Forecast",
      "file_type": "docx",
      "word_count": 980,
      "tags": ["finance", "q1"],
      "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "converted_at": "2026-04-10T09:00:00.000Z",
      "rank": 0.82,
      "strength": "strong"
    }
  ]
}`,
  },

  {
    id: "vault-list-projects",
    method: "GET",
    path: "/api/v1/vault/projects",
    title: "Vault: List Projects",
    description:
      "Lists every project in your Vault, flat. parent_id marks a project as a subproject of another (nesting is exactly one level), so you can build a tree client-side if you need one.",
    parameters: [],
    responseFields: [
      { name: "data", type: "array", description: "Project objects: id, name, color, created_at, parent_id (null for a root/top-level project)." },
    ],
    exampleRequest: `curl -X GET https://mdspin.app/api/v1/vault/projects \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "data": [
    { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "name": "Plato PM", "color": "#FF4800", "created_at": "2026-03-01T00:00:00.000Z", "parent_id": null },
    { "id": "7a2e1c3b-5f6d-4a8e-9c1b-2d3e4f5a6b7c", "name": "Faiaz", "color": null, "created_at": "2026-09-08T00:00:00.000Z", "parent_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6" }
  ]
}`,
  },

  {
    id: "vault-get-project",
    method: "GET",
    path: "/api/v1/vault/projects/:id",
    title: "Vault: Get a Project",
    description: "Fetches a single project by id.",
    parameters: [],
    responseFields: [
      { name: "id, name, color, created_at, parent_id", type: "—", description: "Same project fields as List Projects." },
    ],
    exampleRequest: `curl -X GET https://mdspin.app/api/v1/vault/projects/3fa85f64-5717-4562-b3fc-2c963f66afa6 \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Plato PM",
  "color": "#FF4800",
  "created_at": "2026-03-01T00:00:00.000Z",
  "parent_id": null
}`,
  },

  {
    id: "vault-search",
    method: "GET",
    path: "/api/v1/vault/search",
    title: "Vault: Search",
    description:
      "Full-text search across every document in your Vault. project_id and tags filter the results; project_id includes a project's subprojects automatically.",
    parameters: [
      { name: "q", type: "string", required: true, description: "The search query." },
      { name: "project_id", type: "string", required: false, description: "Restrict results to this project and its subprojects." },
      { name: "tags", type: "string", required: false, description: "Comma-separated tags to filter by." },
      { name: "limit", type: "number", required: false, description: "Max results per page." },
      { name: "offset", type: "number", required: false, description: "Results to skip, for pagination." },
      { name: "mode", type: "string", required: false, description: "Reserved for future search modes. 'keyword' (the default) is the only accepted value today." },
    ],
    responseFields: [
      { name: "data", type: "array", description: "Document objects (see List Documents) plus rank (number) and snippet (matched excerpt)." },
      { name: "page", type: "object", description: "Pagination info: limit, offset, total, has_more, next_offset." },
    ],
    exampleRequest: `curl -X GET "https://mdspin.app/api/v1/vault/search?q=quarterly+forecast&limit=10" \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "data": [
    {
      "id": "1b1f6d1a-9c9d-4a02-9b1e-2b7a5b6d9f10",
      "filename": "q1-forecast.docx",
      "title": "Q1 Forecast",
      "file_type": "docx",
      "word_count": 980,
      "project_ids": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
      "tags": ["finance", "q1"],
      "source_type": "upload",
      "converted_at": "2026-04-10T09:00:00.000Z",
      "updated_at": "2026-04-10T09:00:00.000Z",
      "version": 1,
      "markdown_text": null,
      "rank": 0.71,
      "snippet": "...quarterly forecast shows a 12% increase..."
    }
  ],
  "page": { "limit": 10, "offset": 0, "total": 1, "has_more": false, "next_offset": null }
}`,
  },

  {
    id: "vault-stats",
    method: "GET",
    path: "/api/v1/vault/stats",
    title: "Vault: Get Stats",
    description:
      "Summary counts for your Vault — how many documents and top-level projects you have, and your most-used tags.",
    parameters: [],
    responseFields: [
      { name: "document_count", type: "number", description: "Total number of documents in your Vault." },
      { name: "project_count", type: "number", description: "Counts top-level projects only — splitting one into subprojects doesn't change this number." },
      { name: "top_tags", type: "array", description: "Most frequently used tags, most-used first." },
    ],
    exampleRequest: `curl -X GET https://mdspin.app/api/v1/vault/stats \\
  -H "Authorization: Bearer mdspin_your_api_key"`,
    exampleResponse: `{
  "document_count": 42,
  "project_count": 6,
  "top_tags": ["finance", "q1", "product"]
}`,
  },
]

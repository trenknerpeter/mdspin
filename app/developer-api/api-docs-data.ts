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
  method: "GET" | "POST"
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
    title: "Convert Google Doc",
    description:
      "Converts a Google Doc to clean Markdown. Accepts a full Google Docs URL or just the document ID. The document must be publicly accessible or shared with MDSpin's service account.",
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
    title: "Convert Google Slides",
    description:
      "Converts a Google Slides presentation to Markdown. Each slide becomes a section. Optionally includes speaker notes.",
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
    title: "Save Markdown to Google Drive",
    description:
      "Saves Markdown text as a .md file in a specified Google Drive folder. Useful for archiving conversion results.",
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
]

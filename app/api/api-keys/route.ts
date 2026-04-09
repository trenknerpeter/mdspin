import { NextRequest, NextResponse } from "next/server"
import { BACKEND_URL } from "@/lib/backend"

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return { error: "Upstream returned a non-JSON response" }
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const res = await fetch(`${BACKEND_URL}/api-keys`, {
    headers: { Authorization: auth },
  })
  const data = await safeJson(res)
  return NextResponse.json(data, { status: res.status })
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const name = body.name
  if (name !== null && name !== undefined && (typeof name !== "string" || name.length > 100)) {
    return NextResponse.json({ error: "name must be a string under 100 characters" }, { status: 400 })
  }

  const res = await fetch(`${BACKEND_URL}/api-keys`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: typeof name === "string" ? name.trim() || null : null }),
  })
  const data = await safeJson(res)
  return NextResponse.json(data, { status: res.status })
}

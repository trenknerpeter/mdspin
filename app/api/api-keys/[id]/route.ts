import { NextRequest, NextResponse } from "next/server"
import { BACKEND_URL } from "@/lib/backend"

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return { error: "Upstream returned a non-JSON response" }
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get("authorization")
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const res = await fetch(`${BACKEND_URL}/api-keys/${id}`, {
    method: "DELETE",
    headers: { Authorization: auth },
  })
  const data = await safeJson(res)
  return NextResponse.json(data, { status: res.status })
}

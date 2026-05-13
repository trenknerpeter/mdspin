import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getPostHogClient } from "@/lib/posthog-server"

export async function POST(req: NextRequest) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://mdspin.app"}/payment/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://mdspin.app"}/payment/cancel`,
  })

  const distinctId = req.headers.get("X-POSTHOG-DISTINCT-ID") ?? "anonymous"
  const posthog = getPostHogClient()
  posthog.capture({
    distinctId,
    event: "checkout_initiated",
    properties: { stripe_session_id: session.id, amount: 299 },
  })
  await posthog.shutdown()

  return NextResponse.json({ url: session.url })
}

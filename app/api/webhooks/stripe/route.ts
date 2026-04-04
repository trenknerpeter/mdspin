import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[stripe webhook] signature verification failed:", message)
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    console.log("[stripe webhook] payment completed:", session.id, "amount:", session.amount_total)
  }

  return NextResponse.json({ received: true })
}

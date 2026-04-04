import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"

export async function POST() {
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

  return NextResponse.json({ url: session.url })
}

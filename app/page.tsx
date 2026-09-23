import type { Metadata } from "next"
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/seo"
import { HomeFaqJsonLd } from "./json-ld"
import { HomePageClient } from "@/components/marketing/home-page-client"

export const metadata: Metadata = {
  // Absolute: the root layout's title.template does not apply to the "/"
  // segment itself, so a plain string here would skip the "| MDSpin" suffix.
  title: { absolute: "PDF to Markdown Converter — Free AI Document Conversion | MDSpin" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "PDF to Markdown Converter — Free AI Document Conversion | MDSpin",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
}

export default function MDSpinPage() {
  return (
    <>
      <HomeFaqJsonLd />
      <HomePageClient />
    </>
  )
}

import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import type { Metadata } from "next"
import { SITE_URL, SITE_NAME } from "@/lib/seo"
import { SiteNav } from "@/components/site-nav"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for MDSpin and the MDSpin Chrome Extension. Learn how we handle your data.",
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0C0C0C] font-sans text-[#F0EDE8]">
      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      <SiteNav />

      <main className="pb-24 pt-32">
        <article className="mx-auto max-w-2xl px-6">
          {/* Back link */}
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-1.5 text-sm text-[#4A4A46] transition-colors hover:text-[#888480]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>

          {/* Header */}
          <header className="mb-12">
            <span className="rounded-full bg-[#FF4800]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FF4800]">
              Legal
            </span>

            <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              Privacy Policy
            </h1>

            <p className="mt-4 text-sm text-[#888480]">
              Last updated: March 23, 2026
            </p>
          </header>

          {/* Content */}
          <div className="space-y-10 text-[15px] leading-relaxed text-[#B0ADA8]">
            {/* Introduction */}
            <section>
              <p>
                This Privacy Policy describes how MDSpin (&ldquo;we&rdquo;,
                &ldquo;our&rdquo;, or &ldquo;us&rdquo;) handles information
                when you use the MDSpin website and the MDSpin Chrome Extension
                (collectively, &ldquo;the Service&rdquo;). We are committed to
                protecting your privacy and being transparent about our data
                practices.
              </p>
            </section>

            {/* What MDSpin Does */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                What MDSpin Does
              </h2>
              <p>
                MDSpin converts document files (PDF, DOCX, PPTX, TXT, HTML,
                RTF, CSV) into clean Markdown format. The Chrome Extension
                integrates directly into ChatGPT, Claude, and Gemini, allowing
                you to convert files to Markdown before sending them to the AI
                &mdash; improving context quality and reducing token costs.
              </p>
            </section>

            {/* Data We Process */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                Data We Process
              </h2>
              <div className="space-y-6">
                <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#FF4800]">
                    File Contents
                  </h3>
                  <p>
                    When you click the MDSpin convert button, the file you
                    uploaded is read from your browser, encoded, and sent to our
                    conversion API for processing. The file is converted to
                    Markdown and the result is returned to your browser.{" "}
                    <strong className="text-white">
                      We do not permanently store the contents of your files on
                      our servers.
                    </strong>{" "}
                    Files are processed in-memory for the sole purpose of
                    conversion and are not retained after the response is sent.
                  </p>
                </div>

                <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#FF4800]">
                    Authentication Data
                  </h3>
                  <p>
                    If you sign in to MDSpin, we use Supabase as our
                    authentication provider. This may include your email address
                    and a session token. This data is used solely to manage your
                    account and is governed by{" "}
                    <a
                      href="https://supabase.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF4800] underline decoration-[#FF4800]/30 underline-offset-2 transition-colors hover:text-[#e04200]"
                    >
                      Supabase&apos;s Privacy Policy
                    </a>
                    .
                  </p>
                </div>

                <div className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#FF4800]">
                    Local Preferences
                  </h3>
                  <p>
                    The Chrome Extension stores a small amount of data locally in
                    your browser (using Chrome&apos;s storage API) to remember
                    your settings, such as whether inline buttons are enabled.
                    This data never leaves your device.
                  </p>
                </div>
              </div>
            </section>

            {/* Data We Do NOT Collect */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                Data We Do NOT Collect
              </h2>
              <ul className="space-y-2.5">
                {[
                  "We do not track your browsing history",
                  "We do not collect analytics or telemetry from the Chrome Extension",
                  "We do not read or access the content of your conversations on ChatGPT, Claude, or Gemini",
                  "We do not sell, rent, or share any personal data with third parties for advertising purposes",
                  "We do not use cookies or tracking pixels in the Chrome Extension",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Third-Party Services */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                Third-Party Services
              </h2>
              <p className="mb-4">
                The Service communicates with the following third-party services:
              </p>
              <div className="overflow-hidden rounded-xl border border-[#2A2A2A]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2A2A2A] bg-[#161616]">
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        Service
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        Purpose
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        Data Sent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#111111]">
                    <tr className="border-b border-[#2A2A2A]">
                      <td className="px-4 py-3 font-mono text-xs text-[#888480]">
                        MDSpin Conversion API
                      </td>
                      <td className="px-4 py-3">File-to-Markdown conversion</td>
                      <td className="px-4 py-3">
                        File contents (temporarily), filename, file type
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-mono text-xs text-[#888480]">
                        Supabase
                      </td>
                      <td className="px-4 py-3">User authentication</td>
                      <td className="px-4 py-3">
                        Email address, session tokens
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-[#888480]">
                We do not share your data with any other third parties.
              </p>
            </section>

            {/* Browser Permissions */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                Browser Permissions (Chrome Extension)
              </h2>
              <p className="mb-4">
                The Chrome Extension requests the following permissions, each for
                a specific purpose:
              </p>
              <div className="space-y-3">
                {[
                  {
                    perm: "activeTab",
                    reason:
                      "To detect when you are on a supported site (ChatGPT, Claude, or Gemini) and interact with the current tab",
                  },
                  {
                    perm: "storage",
                    reason:
                      "To save your preferences (e.g., inline button toggle) locally on your device",
                  },
                  {
                    perm: "clipboardWrite",
                    reason:
                      "To copy converted Markdown to your clipboard as a fallback when direct file injection is not possible",
                  },
                  {
                    perm: "scripting",
                    reason:
                      "To inject the MDSpin conversion button into supported chat interfaces",
                  },
                  {
                    perm: "identity",
                    reason: "To authenticate your MDSpin account",
                  },
                  {
                    perm: "Host access",
                    reason:
                      "Access to ChatGPT, Claude, and Gemini domains is required to display the conversion button and inject converted files within these specific sites",
                  },
                ].map(({ perm, reason }) => (
                  <div
                    key={perm}
                    className="rounded-lg border border-[#2A2A2A] bg-[#161616] px-4 py-3"
                  >
                    <span className="font-mono text-xs font-medium text-[#FF4800]">
                      {perm}
                    </span>
                    <p className="mt-1 text-sm text-[#B0ADA8]">{reason}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                Data Security
              </h2>
              <p>
                All communication between the Extension and our servers is
                encrypted using HTTPS/TLS. File data is transmitted securely and
                processed in-memory without permanent storage. Authentication is
                handled through Supabase&apos;s secure infrastructure.
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                Data Retention
              </h2>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                  <span>
                    <strong className="text-white">File contents:</strong> Not
                    retained. Files are processed in real-time and discarded
                    immediately after conversion.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                  <span>
                    <strong className="text-white">Account data:</strong>{" "}
                    Retained as long as your account is active. You may request
                    account deletion at any time.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                  <span>
                    <strong className="text-white">Local preferences:</strong>{" "}
                    Stored on your device only. Cleared when you uninstall the
                    Extension.
                  </span>
                </li>
              </ul>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                Your Rights
              </h2>
              <p className="mb-4">You may:</p>
              <ul className="space-y-2.5">
                {[
                  "Uninstall the Extension at any time to stop all data processing",
                  "Request deletion of your account and associated data",
                  "Contact us with any privacy questions or concerns",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Changes */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will
                notify users of significant changes by updating the &ldquo;Last
                updated&rdquo; date at the top of this page.
              </p>
            </section>

            {/* Contact */}
            <section className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6">
              <h2 className="mb-3 font-display text-xl font-bold text-white">
                Contact
              </h2>
              <p>
                If you have questions about this Privacy Policy, please contact
                us at:{" "}
                <a
                  href="mailto:trenkner.peter@gmail.com"
                  className="text-[#FF4800] underline decoration-[#FF4800]/30 underline-offset-2 transition-colors hover:text-[#e04200]"
                >
                  trenkner.peter@gmail.com
                </a>
              </p>
            </section>
          </div>

          {/* Back link */}
          <div className="mt-16 border-t border-[#1E1E1E] pt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-[#4A4A46] transition-colors hover:text-[#888480]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </Link>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E1E1E] py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="MDSpin"
              className="h-6 w-6 rounded-md opacity-50"
            />
            <span className="text-xs text-[#4A4A46]">MDSpin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Blog
            </Link>
            <Link href="/privacy" className="text-xs text-[#4A4A46] transition-colors hover:text-[#888480]">
              Privacy
            </Link>
            <p className="text-xs text-[#4A4A46]">
              Drop, spin, done. &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

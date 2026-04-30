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
              Last updated: April 30, 2026
            </p>
          </header>

          {/* Content */}
          <div className="space-y-10 text-[15px] leading-relaxed text-[#B0ADA8]">
            {/* Introduction */}
            <section>
              <p>
                MDSpin (&ldquo;we&rdquo;, &ldquo;our&rdquo;) is a Chrome
                Extension and web service that converts document files into
                Markdown. This policy describes, in full, what data we collect,
                how we use it, who we share it with, and how long we keep it.
              </p>
            </section>

            {/* 1. Data we collect */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                1. Data we collect
              </h2>
              <div className="overflow-hidden rounded-xl border border-[#2A2A2A]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2A2A2A] bg-[#161616]">
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        What
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        Where it comes from
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#111111]">
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">
                        Personally identifiable information
                      </td>
                      <td className="px-4 py-3">
                        Email address, Google account ID
                      </td>
                      <td className="px-4 py-3">
                        Sign-up form (email + password) or Google OAuth sign-in
                      </td>
                    </tr>
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">Authentication credentials</td>
                      <td className="px-4 py-3">
                        Password (only when you sign up with email + password).
                        Submitted from the sign-up form directly to Supabase
                        Auth over TLS, where it is stored only in hashed form.
                        MDSpin&apos;s backend never receives the password, and
                        neither MDSpin nor anyone else can read the stored
                        hash.
                      </td>
                      <td className="px-4 py-3">
                        You, when you create an account with email and password
                      </td>
                    </tr>
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">Authentication information</td>
                      <td className="px-4 py-3">Supabase session tokens</td>
                      <td className="px-4 py-3">Created when you sign in</td>
                    </tr>
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">
                        Third-party authentication tokens
                      </td>
                      <td className="px-4 py-3">
                        Google OAuth access token and refresh token (only if
                        you sign in with Google and grant Drive/Docs scopes)
                      </td>
                      <td className="px-4 py-3">
                        Returned by Google after OAuth consent; stored
                        server-side so the extension can import files from
                        your Drive on your behalf
                      </td>
                    </tr>
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">
                        Network identifier (anonymous use only)
                      </td>
                      <td className="px-4 py-3">
                        Your IP address, used solely to enforce the
                        3-conversions-per-day limit for non-signed-in users.
                        Not stored against signed-in accounts.
                      </td>
                      <td className="px-4 py-3">
                        Sent automatically by your browser when you make a
                        conversion request without being signed in
                      </td>
                    </tr>
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">
                        Website content (user-uploaded files)
                      </td>
                      <td className="px-4 py-3">
                        The contents, filename, and file type of documents you
                        choose to convert (PDF, DOCX, PPTX, TXT, HTML, RTF, CSV)
                      </td>
                      <td className="px-4 py-3">
                        You, when you trigger a conversion
                      </td>
                    </tr>
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">User activity</td>
                      <td className="px-4 py-3">
                        Count of conversions performed per day, tied to your
                        account
                      </td>
                      <td className="px-4 py-3">
                        Generated by the extension when you convert a file
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="px-4 py-3">Local preferences</td>
                      <td className="px-4 py-3">
                        UI settings such as inline-mode toggle
                      </td>
                      <td className="px-4 py-3">
                        Stored locally in your browser via chrome.storage
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4">
                <strong className="text-white">We do not collect:</strong>{" "}
                browsing history, page content from ChatGPT/Claude/Gemini
                conversations, mouse/keystroke telemetry, location, financial
                data, health data, or extension usage analytics.
              </p>
            </section>

            {/* 2. How we use data */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                2. How we use data
              </h2>
              <ul className="space-y-2.5">
                {[
                  <>
                    <strong className="text-white">File contents</strong> &mdash;
                    transmitted to our conversion API solely to produce Markdown
                    output, then returned to you. Used for no other purpose.
                  </>,
                  <>
                    <strong className="text-white">Email + account ID</strong>{" "}
                    &mdash; to identify your account and enforce daily conversion
                    quotas.
                  </>,
                  <>
                    <strong className="text-white">Password</strong> &mdash;
                    verified by Supabase Auth at sign-in. Used only to
                    authenticate you. Not used for any other purpose. We have
                    no ability to read it.
                  </>,
                  <>
                    <strong className="text-white">Google OAuth tokens</strong>{" "}
                    &mdash; used server-side to fetch documents from your
                    Google Drive when you choose to import a file. Tokens are
                    never shared with third parties.
                  </>,
                  <>
                    <strong className="text-white">
                      IP address (anonymous users only)
                    </strong>{" "}
                    &mdash; counted against the per-IP daily quota and
                    discarded after 24 hours. Not linked to an account.
                  </>,
                  <>
                    <strong className="text-white">Session tokens</strong>{" "}
                    &mdash; to keep you signed in.
                  </>,
                  <>
                    <strong className="text-white">Conversion counts</strong>{" "}
                    &mdash; to enforce per-user daily limits across devices.
                  </>,
                  <>
                    <strong className="text-white">Local preferences</strong>{" "}
                    &mdash; to remember your UI settings. Never transmitted.
                  </>,
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 3. Who we share data with */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                3. Who we share data with
              </h2>
              <p className="mb-4">
                We share data only with the following infrastructure providers,
                strictly for the purposes listed:
              </p>
              <div className="overflow-hidden rounded-xl border border-[#2A2A2A]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2A2A2A] bg-[#161616]">
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        Recipient
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        What is sent
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        Purpose
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-white">
                        Retention
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#111111]">
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">
                        MDSpin Conversion API (hosted on Vercel,{" "}
                        <span className="font-mono text-xs text-[#888480]">
                          mdc-api-murex.vercel.app
                        </span>
                        )
                      </td>
                      <td className="px-4 py-3">
                        File contents, filename, file type
                      </td>
                      <td className="px-4 py-3">Convert the file to Markdown</td>
                      <td className="px-4 py-3">
                        Processed in memory; not stored. Discarded immediately
                        after the response is returned.
                      </td>
                    </tr>
                    <tr className="border-b border-[#2A2A2A] align-top">
                      <td className="px-4 py-3">
                        Supabase (
                        <span className="font-mono text-xs text-[#888480]">
                          ixdsddfxkrkytiitfici.supabase.co
                        </span>
                        )
                      </td>
                      <td className="px-4 py-3">
                        Email, account ID, hashed password (email signup only),
                        Google OAuth tokens (Google signup only), session
                        tokens, daily conversion counter, IP address (anonymous
                        quota only)
                      </td>
                      <td className="px-4 py-3">
                        Authentication, password verification, OAuth token
                        storage for Drive/Docs imports, quota enforcement
                      </td>
                      <td className="px-4 py-3">
                        Retained until you delete your account. Quota counters
                        reset every 24 hours.
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="px-4 py-3">
                        Google (OAuth identity provider)
                      </td>
                      <td className="px-4 py-3">Standard OAuth flow</td>
                      <td className="px-4 py-3">
                        Verify your identity when you sign in
                      </td>
                      <td className="px-4 py-3">
                        Governed by Google&apos;s privacy policy
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4">
                We do not sell, rent, or transfer user data to any other party.
                We do not use user data for advertising, profiling, or any
                purpose unrelated to MDSpin&apos;s single purpose
                (file-to-Markdown conversion). We do not use or transfer user
                data to determine creditworthiness or for lending purposes.
              </p>
            </section>

            {/* 4. Google Limited Use */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                4. Google API Services &mdash; Limited Use disclosure
              </h2>
              <p>
                MDSpin&apos;s use and transfer of information received from
                Google APIs to any other app will adhere to the{" "}
                <a
                  href="https://developer.chrome.com/docs/webstore/user_data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF4800] underline decoration-[#FF4800]/30 underline-offset-2 transition-colors hover:text-[#e04200]"
                >
                  Chrome Web Store User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </section>

            {/* 5. Data retention */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                5. Data retention
              </h2>
              <ul className="space-y-2.5">
                {[
                  <>
                    <strong className="text-white">File contents:</strong> 0
                    seconds (in-memory only; discarded after response).
                  </>,
                  <>
                    <strong className="text-white">
                      Account data (email, ID):
                    </strong>{" "}
                    until you delete your account.
                  </>,
                  <>
                    <strong className="text-white">Password (hashed):</strong>{" "}
                    stored by Supabase Auth until you delete your account or
                    change your password.
                  </>,
                  <>
                    <strong className="text-white">
                      Google OAuth tokens:
                    </strong>{" "}
                    until you revoke access in your Google account settings or
                    delete your MDSpin account. Refresh tokens are rotated
                    automatically by Google.
                  </>,
                  <>
                    <strong className="text-white">
                      IP addresses (anonymous quota):
                    </strong>{" "}
                    24-hour rolling window; deleted when the daily quota row is
                    reset.
                  </>,
                  <>
                    <strong className="text-white">Session tokens:</strong> until
                    you sign out or they expire.
                  </>,
                  <>
                    <strong className="text-white">Quota counters:</strong>{" "}
                    24-hour rolling window.
                  </>,
                  <>
                    <strong className="text-white">Local preferences:</strong>{" "}
                    until you uninstall the extension or clear browser storage.
                  </>,
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 6. Security */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                6. Security
              </h2>
              <p>
                All communication between the extension, the conversion API,
                and Supabase uses HTTPS/TLS encryption. Passwords are never
                stored in plaintext: when you sign up with email + password,
                the password is sent directly from your browser to Supabase
                Auth over TLS and hashed there using bcrypt before storage.
                MDSpin&apos;s backend never receives the plaintext password,
                and neither MDSpin nor anyone else can read the stored hash.
                Authentication is performed entirely by Supabase Auth.
              </p>
            </section>

            {/* 7. Your rights and controls */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                7. Your rights and controls
              </h2>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                  <span>
                    <strong className="text-white">
                      Access or delete your account data:
                    </strong>{" "}
                    email{" "}
                    <a
                      href="mailto:trenkner.peter@gmail.com"
                      className="text-[#FF4800] underline decoration-[#FF4800]/30 underline-offset-2 transition-colors hover:text-[#e04200]"
                    >
                      trenkner.peter@gmail.com
                    </a>{" "}
                    and we will delete your account and all associated data
                    within 30 days.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                  <span>
                    <strong className="text-white">Sign out:</strong> available
                    from the extension popup. Ends the session immediately.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF4800]" />
                  <span>
                    <strong className="text-white">Stop local storage:</strong>{" "}
                    uninstalling the extension clears all locally stored
                    preferences.
                  </span>
                </li>
              </ul>
            </section>

            {/* 8. Children */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                8. Children
              </h2>
              <p>
                MDSpin is not directed at children under 13 and we do not
                knowingly collect data from them.
              </p>
            </section>

            {/* 9. Changes */}
            <section>
              <h2 className="mb-4 font-display text-xl font-bold text-white">
                9. Changes to this policy
              </h2>
              <p>
                We will update the &ldquo;Last updated&rdquo; date above when
                the policy changes. Material changes will be announced in the
                extension&apos;s release notes.
              </p>
            </section>

            {/* 10. Contact */}
            <section className="rounded-xl border border-[#2A2A2A] bg-[#161616] p-6">
              <h2 className="mb-3 font-display text-xl font-bold text-white">
                10. Contact
              </h2>
              <p>
                Questions about this policy:{" "}
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

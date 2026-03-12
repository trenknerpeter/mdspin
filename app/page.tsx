"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, Copy, Download, Check, Sparkles, FileText, Zap } from "lucide-react"

type AppState = "idle" | "loaded" | "converting" | "done"

const SUPPORTED_FORMATS = ["PDF", "DOC", "DOCX", "PAGES", "TXT", "RTF"]


function FloatingIcon({ 
  icon: Icon, 
  className, 
  delay = 0 
}: { 
  icon: typeof FileText
  className?: string
  delay?: number 
}) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  
  return (
    <div 
      className={`absolute transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}
    >
      <div className="rounded-lg border border-neutral-200 bg-white/80 p-2.5 shadow-sm backdrop-blur-sm">
        <Icon className="h-4 w-4 text-neutral-400" strokeWidth={1.5} />
      </div>
    </div>
  )
}

function AnimatedGradientOrb({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full blur-3xl ${className}`} />
  )
}

export default function MDSpinPage() {
  const [state, setState] = useState<AppState>("idle")
  const [fileName, setFileName] = useState<string>("")
  const [markdown, setMarkdown] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleFile = useCallback((droppedFile: File) => {
    setFileName(droppedFile.name)
    setFile(droppedFile)
    setState("loaded")
    setMarkdown("")
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleBrowse = () => {
    fileInputRef.current?.click()
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleSpin = async () => {
    if (state !== "loaded" || !file) return
    setState("converting")
    setError(null)

    try {
      const fd = new FormData()
      fd.append("file", file)
      const res  = await fetch("/api/convert", { method: "POST", body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? "Conversion failed. Please try again.")
        setState("loaded")
        return
      }

      setMarkdown(data.markdown_text)
      setState("done")
    } catch {
      setError("Network error. Check your connection and try again.")
      setState("loaded")
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName.replace(/\.[^/.]+$/, "") + ".md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetApp = () => {
    setState("idle")
    setFileName("")
    setMarkdown("")
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-50">
      {/* Background elements */}
      <div className="pointer-events-none absolute inset-0">
        <AnimatedGradientOrb className="left-1/4 top-1/4 h-96 w-96 bg-orange-100/40 animate-pulse" />
        <AnimatedGradientOrb className="right-1/4 bottom-1/3 h-80 w-80 bg-neutral-200/30 animate-pulse [animation-delay:1s]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgb(250,250,250)_70%)]" />
      </div>

      {/* Floating decorative icons */}
      <FloatingIcon icon={FileText} className="left-[10%] top-[20%] hidden lg:block" delay={200} />
      <FloatingIcon icon={Sparkles} className="right-[12%] top-[25%] hidden lg:block" delay={400} />
      <FloatingIcon icon={Zap} className="left-[15%] bottom-[30%] hidden lg:block" delay={600} />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-12">
        {/* Header */}
        <header 
          className={`mb-16 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        >
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="MDSpin logo" 
              className="h-10 w-10 rounded-lg"
            />
            <h1 className="text-xl font-semibold tracking-tight text-black">MDSpin</h1>
          </div>
        </header>

        {/* Hero text */}
        <div 
          className={`mb-12 text-center transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-black sm:text-4xl">
            Transform documents into
            <span className="relative ml-2">
              clean markdown
              <svg className="absolute -bottom-1 left-0 h-2 w-full" viewBox="0 0 200 8" fill="none">
                <path 
                  d="M2 6C50 2 150 2 198 6" 
                  stroke="#FF4800" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                  className="animate-draw"
                  style={{
                    strokeDasharray: 200,
                    strokeDashoffset: mounted ? 0 : 200,
                    transition: 'stroke-dashoffset 1s ease-out 0.5s'
                  }}
                />
              </svg>
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-neutral-500">
            Markdown gives your AI up to <span className="font-semibold text-[#FF4800]">64% better retrieval accuracy</span>, <span className="font-semibold text-neutral-700">2.4x faster processing</span>, and <span className="font-semibold text-neutral-700">40% lower token costs</span> compared to PDF or DOCX.
          </p>
        </div>

        {/* Metrics Grid */}
        <div 
          className={`mb-14 grid grid-cols-2 gap-3 sm:grid-cols-4 transition-all duration-700 delay-150 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <div className="text-lg font-semibold text-[#FF4800]">+64%</div>
            <div className="mt-1 text-xs text-neutral-500">Retrieval Accuracy</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <div className="text-lg font-semibold text-neutral-900">2.4x</div>
            <div className="mt-1 text-xs text-neutral-500">Faster Processing</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <div className="text-lg font-semibold text-neutral-900">-40%</div>
            <div className="mt-1 text-xs text-neutral-500">Token Costs</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <div className="text-lg font-semibold text-neutral-900">+16%</div>
            <div className="mt-1 text-xs text-neutral-500">Reasoning Accuracy</div>
          </div>
        </div>

        {/* Upload Zone */}
        <div 
          className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={state === "idle" ? handleBrowse : undefined}
            className={`
              group relative flex min-h-[220px] flex-col items-center justify-center 
              rounded-2xl border-2 border-dashed bg-white transition-all duration-300
              ${isDragOver ? "scale-[1.02] border-[#FF4800] bg-orange-50/50 shadow-lg shadow-orange-100" : "border-neutral-200 hover:border-neutral-300 hover:shadow-md"}
              ${state === "converting" ? "opacity-60" : ""}
              ${state === "idle" ? "cursor-pointer" : "cursor-default"}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.pages,.txt,.rtf"
              onChange={handleFileInput}
              className="hidden"
            />

            {state === "idle" && (
              <div className="flex flex-col items-center">
                <div className="mb-4 rounded-xl bg-neutral-100 p-4 transition-transform duration-300 group-hover:scale-110">
                  <Upload className="h-6 w-6 text-neutral-400" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-neutral-700">Drop your file here</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBrowse()
                  }}
                  className="mt-1.5 text-sm text-neutral-400 underline underline-offset-4 transition-colors hover:text-[#FF4800]"
                >
                  or browse
                </button>
              </div>
            )}

            {(state === "loaded" || state === "converting" || state === "done") && (
              <div className="flex flex-col items-center">
                <div className="mb-3 rounded-xl bg-neutral-900 p-3">
                  <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-black">{fileName}</p>
                {state !== "done" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      resetApp()
                    }}
                    className="mt-2 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Supported Formats */}
        <div 
          className={`mt-5 flex flex-wrap items-center justify-center gap-2 transition-all duration-700 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        >
          {SUPPORTED_FORMATS.map((format, i) => (
            <span 
              key={format} 
              className="flex items-center rounded-full bg-white px-2.5 py-1 text-xs text-neutral-400 shadow-sm"
            >
              {format}
            </span>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-4 text-center text-sm text-red-500">{error}</p>
        )}

        {/* Spin Button */}
        <div
          className={`mt-10 flex justify-center transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <button
            type="button"
            onClick={handleSpin}
            disabled={state !== "loaded"}
            className={`
              group relative flex h-12 min-w-[140px] items-center justify-center gap-2 rounded-full px-8 text-sm font-medium 
              transition-all duration-300
              ${
                state === "loaded"
                  ? "bg-[#FF4800] text-white shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-200 hover:scale-105 active:scale-[0.98]"
                  : "cursor-not-allowed bg-neutral-200 text-neutral-400"
              }
            `}
          >
            {state === "converting" ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Converting
              </span>
            ) : (
              <>
                <Sparkles className={`h-4 w-4 transition-transform ${state === "loaded" ? "group-hover:rotate-12" : ""}`} />
                Spin
              </>
            )}
          </button>
        </div>

        {/* Output Area */}
        {state === "done" && markdown && (
          <div className="mt-14 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="text-xs font-medium text-neutral-500">Output ready</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Save .md
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <pre className="overflow-x-auto bg-neutral-900 p-5 text-sm leading-relaxed text-neutral-100">
                <code>{markdown}</code>
              </pre>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={resetApp}
                className="flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-neutral-600"
              >
                <Zap className="h-3.5 w-3.5" />
                Convert another file
              </button>
            </div>
          </div>
        )}

        {/* Coming Soon Section */}
        <section 
          className={`mt-20 transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF4800]" />
              Coming Soon
            </span>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Make.com Integration */}
            <div className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#6D28D9]/10">
                <svg className="h-6 w-6 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-neutral-900">Make.com App</h3>
              <p className="text-sm leading-relaxed text-neutral-500">
                Use MDSpin inside your automated workflows. Connect to any trigger and automatically convert documents to Markdown before sending to your AI tools.
              </p>
            </div>

            {/* Chrome Extension */}
            <div className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4285F4]/10">
                <svg className="h-6 w-6 text-[#4285F4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-neutral-900">Chrome Extension</h3>
              <p className="text-sm leading-relaxed text-neutral-500">
                Convert files directly in your favorite LLM chat window. When you attach a document, MDSpin automatically offers to convert it to Markdown for better AI comprehension.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer 
          className={`mt-20 text-center transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        >
          <p className="text-xs text-neutral-400">
            Built for simplicity. Drop, spin, done.
          </p>
        </footer>
      </div>
    </main>
  )
}

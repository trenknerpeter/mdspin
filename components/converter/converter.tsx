"use client"

import { useState } from "react"
import { Upload, Copy, Download, Check, Sparkles, FileText, Zap, TrendingDown, Plus, X } from "lucide-react"
import Link from "next/link"
import { BuyCoffee } from "@/components/buy-coffee"
import { SUPPORTED_FORMATS, ACCEPT_ATTR } from "@/lib/formats"
import { useConverter } from "./use-converter"
import { AddToVaultPanel } from "./add-to-vault-panel"
import type { ConverterContext, ConversionOptions } from "./types"
import { estimateOriginalTokens, estimateMarkdownTokens, computeSavings } from "@/lib/roi"

export function Converter({ context, options, onAuthRequired }: {
  context: ConverterContext
  options?: ConversionOptions
  onAuthRequired?: () => void
}) {
  const c = useConverter({ context, options, onAuthRequired })
  const [monthlyCalls, setMonthlyCalls] = useState(20) // ROI input

  // Gate the power features (URL + multi-file batch) behind sign-in in the teaser context.
  const gatePower = () => {
    if (context === "teaser" && !c.user) { onAuthRequired?.(); return true }
    return false
  }

  // Drag-and-drop is another path to add files — gate it the same way the "Add file"
  // button is gated: anonymous teaser users may drop a single file, but a drop that
  // would result in more than one file opens the sign-in wall instead.
  const handleDropGated = (e: React.DragEvent) => {
    const dropped = e.dataTransfer?.files?.length ?? 0
    if (context === "teaser" && !c.user && c.files.length + dropped > 1) {
      e.preventDefault()
      onAuthRequired?.()
      return
    }
    c.handleDrop(e)
  }

  return (
    <div id="converter">
      <div className="mx-auto max-w-2xl px-6">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4800]">
            The Converter
          </p>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            See it for yourself
          </h2>
          <p className="mt-3 text-sm text-[#888480]">
            Drop any document and get clean, AI-ready markdown in seconds.
          </p>
        </div>

        {/* Input mode toggle */}
        {c.files.length === 0 && c.batchStatus === 'idle' && (
          <div className="mb-4 flex justify-center">
            <div className="inline-flex gap-1 rounded-lg border border-[#2A2A2A] bg-[#161616] p-1">
              {(['upload', 'url'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    if (mode === 'url' && gatePower()) return
                    c.setInputMode(mode); c.setError(null)
                  }}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    c.inputMode === mode
                      ? 'bg-[#FF4800] text-white'
                      : 'text-[#888480] hover:text-[#F0EDE8]'
                  }`}
                >
                  {mode === 'upload' ? 'Upload files' : 'From URL'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upload zone */}
        {c.inputMode === 'upload' && (
        <div
          onDrop={handleDropGated}
          onDragOver={c.handleDragOver}
          onDragLeave={c.handleDragLeave}
          onClick={c.files.length === 0 && c.batchStatus === 'idle' ? c.handleBrowse : undefined}
          className={`
            group relative rounded-xl border-2 border-dashed transition-all duration-300
            ${c.files.length > 0 && c.batchStatus !== 'done'
              ? 'p-3'
              : 'flex min-h-[200px] flex-col items-center justify-center'}
            ${c.isDragOver
              ? "scale-[1.01] border-[#FF4800] bg-[#FF4800]/5 shadow-lg shadow-[#FF4800]/10"
              : "border-[#2A2A2A] bg-[#161616] hover:border-[#3A3A3A]"}
            ${c.appState === "converting" ? "opacity-60" : ""}
            ${c.files.length === 0 && c.batchStatus === 'idle' ? "cursor-pointer" : "cursor-default"}
          `}
        >
          <input
            ref={c.fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            onChange={c.handleFileInput}
            className="hidden"
          />

          {/* Empty state */}
          {c.files.length === 0 && (
            <div className="flex flex-col items-center">
              <div
                className={`mb-4 rounded-xl p-4 transition-all duration-300 ${
                  c.isDragOver
                    ? "bg-[#FF4800]/20"
                    : "bg-[#1E1E1E] group-hover:bg-[#2A2A2A]"
                }`}
              >
                <Upload
                  className={`h-6 w-6 transition-colors ${
                    c.isDragOver ? "text-[#FF4800]" : "text-[#4A4A46] group-hover:text-[#888480]"
                  }`}
                  strokeWidth={1.5}
                />
              </div>
              <p className="text-sm font-medium text-[#888480]">Drop your files here</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); c.handleBrowse() }}
                className="mt-1.5 text-sm text-[#4A4A46] underline underline-offset-4 transition-colors hover:text-[#FF4800]"
              >
                or browse
              </button>
            </div>
          )}

          {/* Files staged: card grid with inline + Add card */}
          {c.files.length > 0 && c.batchStatus !== 'done' && (
            <div className="flex flex-wrap gap-2">
              {c.files.map(fi => (
                <div
                  key={fi.id}
                  className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-3 py-2"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#888480]" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="max-w-[120px] truncate text-xs font-medium text-[#F0EDE8]">
                      {fi.name.replace(/\.[^/.]+$/, '')}
                    </p>
                    <span className="font-mono text-[10px] uppercase text-[#4A4A46]">{fi.fileType}</span>
                  </div>
                  {c.batchStatus !== 'converting' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); c.removeFile(fi.id) }}
                      className="shrink-0 rounded p-0.5 text-[#4A4A46] transition-colors hover:bg-[#2A2A2A] hover:text-[#888480]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {/* + Add card — always visible while under limit and not converting */}
              {c.files.length < 20 && c.batchStatus !== 'converting' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (gatePower()) return; c.handleBrowse() }}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#2A2A2A] bg-[#0C0C0C] px-3 py-2 text-[#4A4A46] transition-all hover:border-[#FF4800]/50 hover:text-[#FF4800]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-xs">Add file</span>
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {/* URL input */}
        {c.inputMode === 'url' && c.files.length === 0 && c.batchStatus !== 'done' && (
          <div className="rounded-xl border-2 border-dashed border-[#2A2A2A] bg-[#161616] p-6">
            <label htmlFor="url-input" className="mb-2 block text-sm font-medium text-[#888480]">
              Paste a link to a web page or file
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="url-input"
                type="url"
                inputMode="url"
                placeholder="https://example.com/article"
                value={c.url}
                onChange={(e) => c.setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') c.handleConvertUrl() }}
                disabled={c.batchStatus === 'converting'}
                className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#4A4A46] focus:border-[#FF4800] focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={c.handleConvertUrl}
                disabled={c.batchStatus === 'converting' || c.url.trim() === ''}
                className="rounded-lg bg-[#FF4800] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {c.batchStatus === 'converting' ? 'Converting…' : 'Convert'}
              </button>
            </div>
          </div>
        )}

        {/* Formats */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {SUPPORTED_FORMATS.map((format) => (
            <span
              key={format}
              className="rounded-full border border-[#2A2A2A] bg-[#161616] px-2.5 py-1 font-mono text-xs text-[#4A4A46]"
            >
              {format}
            </span>
          ))}
        </div>

        {/* Error */}
        {c.error && (
          <p className="mt-4 text-center text-sm text-red-400">{c.error}</p>
        )}

        {/* Spin button / Rate limit message */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={c.batchStatus === 'done' ? c.handleNewConversion : c.handleSpin}
              disabled={c.batchStatus !== 'done' && (c.files.length === 0 || c.batchStatus === 'converting' || c.rateLimited)}
              className={`
                group relative flex h-12 min-w-[140px] items-center justify-center gap-2
                rounded-full px-8 text-sm font-semibold transition-all duration-300
                ${c.batchStatus === 'done' || (c.files.length > 0 && c.batchStatus !== 'converting' && !c.rateLimited)
                  ? "bg-[#FF4800] text-white shadow-lg shadow-[#FF4800]/25 hover:scale-105 hover:shadow-xl hover:shadow-[#FF4800]/30 active:scale-[0.98]"
                  : "cursor-not-allowed bg-[#1E1E1E] text-[#4A4A46]"}
              `}
            >
              {c.batchStatus === "converting" ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Converting
                </span>
              ) : c.batchStatus === 'done' ? (
                <>
                  <Plus className="h-4 w-4 transition-transform group-hover:rotate-90 duration-200" />
                  Create new
                </>
              ) : (
                <>
                  <Sparkles className={`h-4 w-4 transition-transform ${c.files.length > 0 && !c.rateLimited ? "group-hover:rotate-12" : ""}`} />
                  {c.files.length > 0 ? `Spin ${c.files.length} file${c.files.length !== 1 ? 's' : ''}` : 'Spin'}
                </>
              )}
            </button>
            {c.batchStatus === 'done' && <BuyCoffee />}
          </div>
          {c.remaining !== null && c.dailyLimit !== null && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-[#4A4A46]">
                {c.user
                  ? `${c.remaining} of ${c.dailyLimit} conversions remaining today`
                  : `${c.remaining} of ${c.dailyLimit} free conversions remaining`}
              </p>
              {c.remaining === 0 && !c.user && (
                <Link
                  href="/auth/sign-in?next=/app"
                  className="text-xs text-[#FF4800] underline underline-offset-2 hover:text-[#FF6633] transition-colors"
                >
                  Sign in for up to 20 daily conversions
                </Link>
              )}
              {c.rateLimited && c.user && (
                <p className="text-xs text-[#4A4A46]">
                  Your limit resets at midnight UTC
                </p>
              )}
            </div>
          )}
        </div>

        {/* Per-file results */}
        {c.batchStatus === 'done' && !c.showMerged && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
            <AddToVaultPanel
              files={c.successfulFiles}
              user={c.user}
              onAuthRequired={onAuthRequired}
              stashForSignIn={c.stashPendingVaultAdd}
              resumeOpen={c.resumeVaultAdd}
              onResumeHandled={c.clearResumeVaultAdd}
              autoSaveSettled={c.autoSaveSettled}
            />
            {c.files.map(fi => (
              <div key={fi.id} className="overflow-hidden rounded-xl border border-[#2A2A2A]">
                {/* Card header */}
                <div className="flex items-center justify-between border-b border-[#2A2A2A] bg-[#161616] px-5 py-3">
                  <div className="flex items-center gap-2">
                    {fi.status === 'done'
                      ? <Check className="h-3.5 w-3.5 text-green-500" strokeWidth={2} />
                      : <span className="h-3.5 w-3.5 text-red-400">&#x2715;</span>}
                    <span className="text-sm font-medium text-[#F0EDE8] truncate max-w-[200px]">{fi.name}</span>
                  </div>
                  {fi.status === 'done' && fi.markdown && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => c.handleDownloadFile(fi.name, fi.markdown!)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                      >
                        <Download className="h-3.5 w-3.5" /> Download .md
                      </button>
                      <button
                        type="button"
                        onClick={() => c.handleCopyFile(fi.id, fi.markdown!)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                      >
                        {c.copiedId === fi.id
                          ? <><Check className="h-3.5 w-3.5 text-[#FF4800]" /> Copied</>
                          : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                      </button>
                    </div>
                  )}
                </div>

                {/* Content */}
                {fi.status === 'done' && fi.markdown && (
                  <details>
                    <summary className="cursor-pointer px-5 py-2 text-xs text-[#4A4A46] hover:text-[#888480] transition-colors">
                      Preview markdown
                    </summary>
                    <pre className="max-h-60 overflow-y-auto overflow-x-auto bg-[#0C0C0C] px-5 pb-5 font-mono text-xs leading-relaxed text-[#F0EDE8]/75">
                      <code>{fi.markdown}</code>
                    </pre>
                  </details>
                )}
                {fi.status === 'failed' && (
                  <p className="px-5 py-3 text-xs text-red-400">{fi.error ?? 'Conversion failed'}</p>
                )}
              </div>
            ))}

            {/* Aggregate ROI panel */}
            {(() => {
              // Token-savings is derived from source byte size; URL conversions have no source size, so the panel is omitted for them rather than showing a fabricated number.
              const successFiles = c.files.filter(fi => fi.status === 'done' && fi.markdown && fi.file)
              if (successFiles.length === 0) return null
              const totalWordCount = successFiles.reduce((sum, fi) => sum + (fi.wordCount ?? 0), 0)
              const totalMdTokens = estimateMarkdownTokens(totalWordCount)
              const totalOrigTokens = successFiles.reduce((sum, fi) => {
                const ext = fi.name.split('.').pop()?.toLowerCase() ?? 'pdf'
                return sum + estimateOriginalTokens(fi.file!.size, ext)
              }, 0)
              const { reductionPct, monthlySavings } = computeSavings({
                origTokens: totalOrigTokens,
                mdTokens: totalMdTokens,
                monthlyCalls,
              })
              return (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#161616]">
                  <div className="flex items-center gap-2 border-b border-[#2A2A2A] px-5 py-3">
                    <TrendingDown className="h-3.5 w-3.5 text-[#FF4800]" strokeWidth={2} />
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#FF4800]">Conversion Impact</span>
                    <span className="ml-auto text-[10px] text-[#4A4A46]">{successFiles.length} file{successFiles.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-[#1E1E1E]">
                    <div className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">Token Reduction</p>
                      <p className="mt-1.5 font-display text-2xl font-bold text-[#FF4800]">&minus;{reductionPct}%</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#888480]">~{totalOrigTokens.toLocaleString()} &rarr; ~{totalMdTokens.toLocaleString()} tokens</p>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4A4A46]">Cost Savings</p>
                      <p className="mt-1.5 font-display text-2xl font-bold text-[#FF4800]">
                        ~${monthlySavings.toFixed(2)}
                        <span className="text-sm font-normal text-[#888480]">/mo</span>
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] text-[#4A4A46]">at</span>
                        <input
                          type="number"
                          min={1}
                          max={100000}
                          value={monthlyCalls}
                          onChange={(e) => setMonthlyCalls(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 rounded border border-[#2A2A2A] bg-[#0C0C0C] px-1.5 py-0.5 text-center font-mono text-[10px] text-[#F0EDE8] outline-none focus:border-[#FF4800]/40"
                        />
                        <span className="text-[10px] text-[#4A4A46]">calls/mo</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Merged view */}
        {c.batchStatus === 'done' && c.showMerged && c.mergedMarkdown && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="overflow-hidden rounded-xl border border-[#2A2A2A]">
              <div className="flex items-center justify-between border-b border-[#2A2A2A] bg-[#161616] px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#FF4800]" />
                  <span className="text-xs font-medium text-[#888480]">Merged output ({c.files.filter(fi => fi.status === 'done').length} files)</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => c.handleDownloadFile('merged', c.mergedMarkdown!)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                  >
                    <Download className="h-3.5 w-3.5" /> Download .md
                  </button>
                  <button
                    type="button"
                    onClick={() => c.handleCopyFile('merged', c.mergedMarkdown!)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
                  >
                    {c.copiedId === 'merged' ? <><Check className="h-3.5 w-3.5 text-[#FF4800]" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                  </button>
                </div>
              </div>
              <pre className="max-h-80 overflow-y-auto overflow-x-auto bg-[#0C0C0C] p-5 font-mono text-xs leading-relaxed text-[#F0EDE8]/75">
                <code>{c.mergedMarkdown}</code>
              </pre>
            </div>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => c.setShowMerged(false)} className="text-sm text-[#4A4A46] transition-colors hover:text-[#888480]">
                &larr; Back to individual files
              </button>
            </div>
          </div>
        )}

        {/* Merge All / New buttons */}
        {c.batchStatus === 'done' && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {c.mergedMarkdown && !c.showMerged && (
              <button
                type="button"
                onClick={() => c.setShowMerged(true)}
                className="flex items-center gap-2 rounded-full bg-[#FF4800] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
              >
                <Sparkles className="h-4 w-4" /> Merge All
              </button>
            )}
            <button
              type="button"
              onClick={c.handleNewConversion}
              className="flex items-center gap-2 text-sm text-[#4A4A46] transition-colors hover:text-[#888480]"
            >
              <Zap className="h-3.5 w-3.5" /> Convert more files
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

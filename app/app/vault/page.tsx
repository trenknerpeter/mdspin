"use client"

import { ChevronLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { useLibrary } from "@/components/library/use-library"
import { FolderGrid } from "@/components/library/folder-grid"
import { LibraryRail } from "@/components/library/library-rail"
import { SpinDetailPanel } from "@/components/library/spin-detail-panel"
import { VaultListView } from "@/components/library/vault-list-view"
import { VaultViewToggle } from "@/components/library/vault-view-toggle"
import { AddToVaultMenu } from "@/components/vault/add-to-vault-menu"
import { EmbeddingBackfillBanner } from "@/components/vault/embedding-backfill-banner"
import { SummaryBackfillBanner } from "@/components/vault/summary-backfill-banner"
import { UNFILED } from "@/lib/library"

export default function VaultPage() {
  const lib = useLibrary()
  // "folders" is the default: at 28 docs across 6 projects, a grid of folders answers
  // "what's in my vault" far better than a flat wall of every document.
  const [view, setView] = useState<"folders" | "list">("folders")

  useEffect(() => {
    // window.location (not useSearchParams) is intentional: this runs client-side only
    // in a mount effect, so it needs no Suspense boundary and has no SSR/hydration concern.
    const params = new URLSearchParams(window.location.search)
    const id = params.get("spin")
    if (id) lib.openSpin(id).catch(() => {})
    if (params.get("view") === "list") setView("list")
    // Dashboard project-rail links land here as ?project=<id> or ?project=unfiled
    // (the readable form of the internal UNFILED sentinel). With a project selected the
    // folders view opens that folder rather than the top-level grid, so those deep links
    // keep working unchanged.
    const project = params.get("project")
    if (project) lib.setSelectedProject(project === "unfiled" ? UNFILED : project)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The top-level grid is the only view without a rail: there the grid *is* the project
  // navigation, and showing both would list every project twice.
  const inFolderGrid = view === "folders" && lib.selectedProject === null

  const openFolder = (projectId: string | null) => {
    lib.setSelectedProject(projectId ?? UNFILED)
    lib.setSelectedTag(null)
  }

  const currentFolderName =
    lib.selectedProject === UNFILED
      ? "Unfiled"
      : lib.projects.find((p) => p.id === lib.selectedProject)?.name ?? null

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#F0EDE8]">
            Knowledge Vault
          </h1>
          <p className="font-sans text-sm text-[#888480]">
            {lib.stats.total} item{lib.stats.total !== 1 ? "s" : ""} in your Vault
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VaultViewToggle active={view === "list" ? "list" : "folders"} />
          <AddToVaultMenu onNewNote={() => lib.addNote()} />
        </div>
      </div>

      {inFolderGrid ? (
        <>
          <EmbeddingBackfillBanner />
          <SummaryBackfillBanner />
          <FolderGrid
            projects={lib.projects}
            summaries={lib.folders}
            onOpenFolder={openFolder}
            onCreateProject={lib.addProject}
          />
        </>
      ) : (
        <div className="flex gap-8">
          <LibraryRail
            roots={lib.roots}
            childrenByParent={lib.childrenByParent}
            statsRollup={lib.statsRollup}
            tags={lib.tags}
            stats={lib.stats}
            selectedProject={lib.selectedProject}
            selectedTag={lib.selectedTag}
            onSelectProject={lib.setSelectedProject}
            onSelectTag={lib.setSelectedTag}
            onCreateProject={lib.addProject}
            onRenameProject={lib.renameProjectById}
            onSetProjectColor={lib.setProjectColorById}
            onDeleteProject={lib.removeProject}
          />

          <div className="min-w-0 flex-1">
            <EmbeddingBackfillBanner />
            <SummaryBackfillBanner />

            {view === "folders" && currentFolderName && (
              <button
                onClick={() => lib.setSelectedProject(null)}
                className="mb-3 inline-flex items-center gap-1 text-xs text-[#888480] transition-colors hover:text-[#F0EDE8]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                All projects
                <span className="text-[#4A4A46]"> / {currentFolderName}</span>
              </button>
            )}

            <VaultListView lib={lib} />
          </div>
        </div>
      )}

      <SpinDetailPanel
        spin={lib.selectedSpin}
        projects={lib.projects}
        onClose={lib.closeSpin}
        onSave={lib.saveSpin}
        onDelete={lib.removeSpin}
        onRemoveFromVault={lib.removeSpinFromVault}
        onOpen={lib.openSpin}
        onBriefGenerated={lib.patchSpinBrief}
        onSummaryGenerated={lib.patchSpinSummary}
      />
    </div>
  )
}

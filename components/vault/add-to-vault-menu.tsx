"use client"

import { useRouter } from "next/navigation"
import { Plus, FileEdit, Upload, FolderUp, ClipboardPaste } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Header menu for getting content into the Vault. "New note" opens straight in
// the detail panel (no navigation needed); the other three go to the dedicated
// ingest page, since they involve a scan/review step before anything is saved.
export function AddToVaultMenu({ onNewNote }: { onNewNote: () => void }) {
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4800] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e04200]">
          <Plus className="h-3.5 w-3.5" /> Add to Vault
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[#2A2A2A] bg-[#161616] text-[#F0EDE8]">
        <DropdownMenuItem onClick={onNewNote} className="gap-2 focus:bg-[#2A2A2A] focus:text-[#F0EDE8]">
          <FileEdit className="h-3.5 w-3.5" /> New note
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/app/vault/add")}
          className="gap-2 focus:bg-[#2A2A2A] focus:text-[#F0EDE8]"
        >
          <Upload className="h-3.5 w-3.5" /> Upload markdown
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/app/vault/add?mode=folder")}
          className="gap-2 focus:bg-[#2A2A2A] focus:text-[#F0EDE8]"
        >
          <FolderUp className="h-3.5 w-3.5" /> Import a folder
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/app/vault/add?mode=paste")}
          className="gap-2 focus:bg-[#2A2A2A] focus:text-[#F0EDE8]"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Paste markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Small "what is this" affordance for section labels (Summary, Brief). Kept
// as its own component so both sections style the icon/content identically.
export function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#4A4A46] transition-colors hover:text-[#888480]"
          aria-label="What is this?"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] border border-[#2A2A2A] bg-[#0E0E0E] text-[#F0EDE8]">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

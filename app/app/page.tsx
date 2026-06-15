"use client"
import { Converter } from "@/components/converter/converter"

export default function AppConvertPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-[#F0EDE8]">Convert</h1>
      <Converter context="app" />
    </div>
  )
}

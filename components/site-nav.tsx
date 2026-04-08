"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import {
  ArrowRight,
  User,
  LogOut,
  History,
  Menu,
  Eye,
  Cog,
  FileText,
  Code,
  Puzzle,
  BookOpen,
  Newspaper,
  ChevronDown,
} from "lucide-react"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"

const productLinks = [
  { href: "/overview", label: "Overview", icon: Eye, description: "What MDSpin does and why" },
  { href: "/how-it-works", label: "How it works", icon: Cog, description: "Web app, Chrome extension, batch" },
  { href: "/formats", label: "Formats", icon: FileText, description: "PDF, DOCX, PPTX and more" },
  { href: "/developer-api", label: "API", icon: Code, description: "Programmatic document conversion" },
  { href: "/integrations", label: "Integrations", icon: Puzzle, description: "Make.com and more" },
]

const resourceLinks = [
  { href: "/guides", label: "Guides", icon: BookOpen, description: "Tutorials and walkthroughs" },
  { href: "/blog", label: "Blog", icon: Newspaper, description: "Updates and insights" },
]

export function SiteNav() {
  const { user, isLoading: authLoading, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileProductOpen, setMobileProductOpen] = useState(false)
  const [mobileResourceOpen, setMobileResourceOpen] = useState(false)

  return (
    <nav className="fixed left-0 right-0 top-0 z-40 border-b border-[#1E1E1E] bg-[#0C0C0C]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="MDSpin" className="h-7 w-7 rounded-md" />
          <span className="font-display text-sm font-semibold tracking-tight text-white">
            MDSpin
          </span>
        </Link>

        {/* Center: Desktop nav */}
        <div className="hidden md:block">
          <NavigationMenu viewport={false}>
            <NavigationMenuList className="gap-0">
              {/* Product dropdown */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className="!bg-transparent text-sm text-[#888480] hover:!bg-transparent hover:text-[#F0EDE8] focus:!bg-transparent data-[state=open]:!bg-transparent data-[state=open]:text-[#F0EDE8]">
                  Product
                </NavigationMenuTrigger>
                <NavigationMenuContent className="!bg-[#161616] rounded-lg border border-[#2A2A2A] shadow-xl">
                  <ul className="grid w-[340px] gap-0.5 p-2">
                    {productLinks.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-[#1E1E1E]"
                        >
                          <link.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#4A4A46]" />
                          <div>
                            <div className="text-sm font-medium text-[#F0EDE8]">{link.label}</div>
                            <div className="text-xs text-[#888480]">{link.description}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Use Cases - direct link */}
              <NavigationMenuItem>
                <Link
                  href="/use-cases"
                  className="inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm text-[#888480] transition-colors hover:text-[#F0EDE8]"
                >
                  Use Cases
                </Link>
              </NavigationMenuItem>

              {/* Pricing - direct link */}
              <NavigationMenuItem>
                <Link
                  href="/pricing"
                  className="inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm text-[#888480] transition-colors hover:text-[#F0EDE8]"
                >
                  Pricing
                </Link>
              </NavigationMenuItem>

              {/* Resources dropdown */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className="!bg-transparent text-sm text-[#888480] hover:!bg-transparent hover:text-[#F0EDE8] focus:!bg-transparent data-[state=open]:!bg-transparent data-[state=open]:text-[#F0EDE8]">
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent className="!bg-[#161616] rounded-lg border border-[#2A2A2A] shadow-xl">
                  <ul className="grid w-[260px] gap-0.5 p-2">
                    {resourceLinks.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-[#1E1E1E]"
                        >
                          <link.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#4A4A46]" />
                          <div>
                            <div className="text-sm font-medium text-[#F0EDE8]">{link.label}</div>
                            <div className="text-xs text-[#888480]">{link.description}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Right: CTAs + auth */}
        <div className="flex items-center gap-3">
          <a
            href="/#converter"
            className="flex items-center gap-1.5 rounded-full bg-[#FF4800] px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#e04200]"
          >
            Try it <ArrowRight className="h-3 w-3" />
          </a>

          {!authLoading && (
            user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF4800]/20 text-xs font-semibold text-[#FF4800] transition-colors hover:bg-[#FF4800]/30"
                >
                  {user.email?.[0]?.toUpperCase() ?? "U"}
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-[#2A2A2A] bg-[#161616] py-1 shadow-xl">
                      <p className="truncate border-b border-[#2A2A2A] px-3 py-2 text-xs text-[#888480]">
                        {user.email}
                      </p>
                      <Link
                        href="/history"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[#F0EDE8] transition-colors hover:bg-[#1E1E1E]"
                      >
                        <History className="h-3.5 w-3.5" />
                        My Spins
                      </Link>
                      <button
                        onClick={() => { setShowUserMenu(false); signOut() }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#888480] transition-colors hover:bg-[#1E1E1E] hover:text-[#F0EDE8]"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/auth/sign-in"
                className="flex items-center gap-1.5 rounded-full border border-[#2A2A2A] px-4 py-1.5 text-xs font-medium text-[#888480] transition-all hover:border-[#4A4A46] hover:text-[#F0EDE8]"
              >
                <User className="h-3 w-3" />
                Sign in
              </Link>
            )
          )}

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-[#888480] transition-colors hover:text-[#F0EDE8] md:hidden">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] border-[#1E1E1E] bg-[#0C0C0C] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-1 p-6 pt-12">
                {/* Product section */}
                <button
                  onClick={() => setMobileProductOpen(!mobileProductOpen)}
                  className="flex items-center justify-between py-2 text-sm font-medium text-[#F0EDE8]"
                >
                  Product
                  <ChevronDown className={`h-4 w-4 text-[#888480] transition-transform ${mobileProductOpen ? "rotate-180" : ""}`} />
                </button>
                {mobileProductOpen && (
                  <div className="ml-2 flex flex-col gap-1 border-l border-[#2A2A2A] pl-3">
                    {productLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="py-1.5 text-sm text-[#888480] transition-colors hover:text-[#F0EDE8]"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Use Cases */}
                <Link
                  href="/use-cases"
                  onClick={() => setMobileOpen(false)}
                  className="py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:text-white"
                >
                  Use Cases
                </Link>

                {/* Pricing */}
                <Link
                  href="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:text-white"
                >
                  Pricing
                </Link>

                {/* Resources section */}
                <button
                  onClick={() => setMobileResourceOpen(!mobileResourceOpen)}
                  className="flex items-center justify-between py-2 text-sm font-medium text-[#F0EDE8]"
                >
                  Resources
                  <ChevronDown className={`h-4 w-4 text-[#888480] transition-transform ${mobileResourceOpen ? "rotate-180" : ""}`} />
                </button>
                {mobileResourceOpen && (
                  <div className="ml-2 flex flex-col gap-1 border-l border-[#2A2A2A] pl-3">
                    {resourceLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="py-1.5 text-sm text-[#888480] transition-colors hover:text-[#F0EDE8]"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-[#1E1E1E] pt-4">
                  <a
                    href="/#converter"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-[#FF4800] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e04200]"
                  >
                    Try it <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}

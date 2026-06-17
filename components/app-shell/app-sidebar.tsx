"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Sparkles, History, Library, Key, Settings, LogOut } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar"

const nav = [
  { href: "/app", label: "Convert", icon: Sparkles, exact: true },
  { href: "/app/history", label: "History", icon: History },
  { href: "/app/vault", label: "Knowledge Vault", icon: Library },
  { href: "/app/api-keys", label: "API Keys", icon: Key },
  { href: "/app/settings", label: "Settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
          <img src="/logo.png" alt="MDSpin" className="h-6 w-6 rounded-md" />
          <span className="font-semibold">MDSpin</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href}><item.icon className="h-4 w-4" />{item.label}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF4800]/20 text-xs font-semibold text-[#FF4800]">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="flex-1 truncate text-xs text-[#888480]" title={user?.email ?? undefined}>
            {user?.email ?? "Account"}
          </span>
          <button
            onClick={async () => { await signOut(); router.push("/") }}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#888480] transition-colors hover:bg-[#1E1E1E] hover:text-[#F0EDE8]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

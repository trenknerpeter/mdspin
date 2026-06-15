"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sparkles, History, Key, Settings } from "lucide-react"
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar"

const nav = [
  { href: "/app", label: "Convert", icon: Sparkles, exact: true },
  { href: "/app/spins", label: "My Spins", icon: History },
  { href: "/app/api-keys", label: "API Keys", icon: Key },
  { href: "/app/settings", label: "Settings", icon: Settings },
]

export function AppSidebar({ usage }: { usage?: { used: number; limit: number } }) {
  const pathname = usePathname()
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
        {usage && (
          <div className="px-3 py-2 text-xs text-[#888480]">{usage.used} / {usage.limit} today</div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-shell/app-sidebar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/sign-in?next=/app")

  return (
    // `dark` scopes the shadcn theme tokens (--sidebar, --background, …) to their
    // dark values across the whole app shell, matching the rest of MDSpin's dark UI.
    <SidebarProvider className="dark bg-[#0C0C0C]">
      <AppSidebar />
      <SidebarInset className="bg-[#0C0C0C]">
        <header className="flex h-12 items-center gap-2 border-b border-[#1E1E1E] px-4">
          <SidebarTrigger />
        </header>
        <main className="p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

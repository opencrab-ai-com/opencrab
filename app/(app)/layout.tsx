import { AppShell } from "@/components/app-shell/app-shell";
import { OpenCrabProvider } from "@/components/app-shell/opencrab-provider";
import { SidebarContent } from "@/components/sidebar/sidebar-content";
import { ensureAppShellRuntimeReady } from "@/lib/runtime/runtime-startup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  ensureAppShellRuntimeReady();

  return (
    <OpenCrabProvider>
      <AppShell sidebar={<SidebarContent />}>{children}</AppShell>
    </OpenCrabProvider>
  );
}

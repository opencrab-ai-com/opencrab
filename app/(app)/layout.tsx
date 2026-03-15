import { AppShell } from "@/components/app-shell/app-shell";
import { SidebarContent } from "@/components/sidebar/sidebar-content";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell sidebar={<SidebarContent />}>{children}</AppShell>;
}

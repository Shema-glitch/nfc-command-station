import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PenLine,
  KeyRound,
  ShieldAlert,
  Workflow,
  ScrollText,
  Smartphone,
  Nfc,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Station",
    items: [{ title: "Overview", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Tag Operations",
    items: [
      { title: "Write Builder", url: "/write", icon: PenLine },
      { title: "Crypto Workbench", url: "/crypto", icon: KeyRound },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { title: "Security Log", url: "/security", icon: ShieldAlert },
      { title: "Automation", url: "/automation", icon: Workflow },
      { title: "Socket Log", url: "/logs", icon: ScrollText },
    ],
  },
  {
    label: "Devices",
    items: [{ title: "Mobile Engine", url: "/mobile", icon: Smartphone }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Nfc className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                NFC-DDS
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Dual-Device Station
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label} defaultOpen>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link
                        to={item.url}
                        className="flex items-center gap-2 hover:bg-muted/50"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

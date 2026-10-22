import { Link, Outlet, useLocation, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Apple, ChevronsLeft, ChevronsRight, Dumbbell, LayoutDashboard, LogOut, MoreHorizontal, Ruler } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrlQuery, profileQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { APP_NAV } from "./nav";

const COLLAPSE_KEY = "ft-sidebar-collapsed";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export function UserAvatar({ className }: { className?: string }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const { data: profile } = useQuery(profileQuery(user.id));
  const { data: url } = useQuery(avatarUrlQuery(profile?.avatar_url));
  const initials = (profile?.username ?? user.email ?? "?").slice(0, 2).toUpperCase();
  return (
    <Avatar className={cn("h-9 w-9 border border-border", className)}>
      {url && <AvatarImage src={url} alt="" className="object-cover" />}
      <AvatarFallback className="bg-secondary font-display text-sm font-bold">{initials}</AvatarFallback>
    </Avatar>
  );
}

export function AppShell() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const { data: profile } = useQuery(profileQuery(user.id));
  const { pathname } = useLocation();
  const signOut = useSignOut();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  };

  return (
    <div className="min-h-screen bg-background bg-hex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur transition-[width] duration-300 md:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className={cn("flex h-20 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
          <Link to="/dashboard" aria-label="Dashboard">
            <Logo compact={collapsed} />
          </Link>
        </div>
        <div className="led-line mx-4 h-px opacity-50" />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {APP_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
              activeProps={{
                className: "border-sidebar-border bg-sidebar-accent text-foreground shadow-glow",
              }}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className={cn("flex items-center gap-3 rounded-lg p-2", collapsed && "justify-center")}>
            <UserAvatar />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{profile?.username}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            )}
          </div>
          <div className={cn("mt-2 flex gap-2", collapsed ? "flex-col items-center" : "")}>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              className={cn(!collapsed && "flex-1 justify-start")}
              onClick={signOut}
              title="Se déconnecter"
            >
              <LogOut />
              {!collapsed && "Déconnexion"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={collapsed ? "Déplier la barre latérale" : "Réduire la barre latérale"}
            >
              {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
        <Link to="/dashboard" aria-label="Dashboard">
          <Logo />
        </Link>
        <Link to="/profil" aria-label="Profil">
          <UserAvatar />
        </Link>
      </header>

      <main className={cn("pb-32 transition-[padding] duration-300 md:pb-14", collapsed ? "md:pl-[76px]" : "md:pl-64")}>
        <div key={pathname} className="mx-auto w-full max-w-7xl animate-fade-up px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid h-[72px] grid-cols-5 items-center">
          <MobileTab to="/dashboard" label="Accueil" icon={LayoutDashboard} />
          <MobileTab to="/nutrition" label="Nutrition" icon={Apple} />
          <Link
            to="/entrainements"
            className="mx-auto -mt-8 flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-foreground/30 bg-primary text-primary-foreground shadow-glow-strong"
            aria-label="Séance"
          >
            <Dumbbell className="h-6 w-6" />
            <span className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-widest">Séance</span>
          </Link>
          <MobileTab to="/physique" label="Physique" icon={Ruler} />
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-1 text-muted-foreground" aria-label="Plus">
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[11px] font-medium">Plus</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-border bg-surface">
              <SheetHeader>
                <SheetTitle className="font-display text-xl uppercase">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-2 pb-4">
                {APP_NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-4 text-sm font-medium"
                    activeProps={{ className: "border-foreground/40 shadow-glow" }}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
                <Button variant="outline" size="lg" className="col-span-2 mt-2" onClick={signOut}>
                  <LogOut /> Se déconnecter
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}

function MobileTab({ to, label, icon: Icon }: { to: "/dashboard" | "/nutrition" | "/physique"; label: string; icon: typeof Apple }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 text-muted-foreground"
      activeProps={{ className: "text-foreground" }}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}

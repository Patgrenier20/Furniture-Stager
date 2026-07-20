import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Image as ImageIcon, CreditCard, Settings, LogOut, Loader2, Sparkles } from "lucide-react";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe();
  const logout = useLogout();

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      setLocation("/login");
    }
  }, [isLoading, isError, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !user) {
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation("/")
    });
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "My Projects", icon: ImageIcon },
    { href: "/account", label: "Account & AI", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-muted/30">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="font-serif font-bold text-xl text-foreground">FurniFlip</span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4 mt-8">
          <div className="px-3 py-3 bg-muted rounded-lg">
            <p className="text-sm font-medium text-foreground mb-1">
              {user.plan === "pro" ? "Pro Plan" : "Basic"}
            </p>
            {user.plan === "free" && (
              <>
                <div className="w-full bg-border h-2 rounded-full mt-2 mb-1 overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${Math.min((user.trialUsed / user.trialLimit) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.trialUsed} / {user.trialLimit} edits used
                </p>
                {user.trialUsed >= user.trialLimit && (
                  <Link href="/pricing" className="block mt-2">
                    <Button variant="default" size="sm" className="w-full text-xs h-7">Upgrade to Pro</Button>
                  </Link>
                )}
              </>
            )}
          </div>

          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-foreground" 
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            {logout.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <LogOut className="w-5 h-5 mr-2" />}
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, BellRing, History, LogOut, Menu, Settings, SlidersHorizontal, MessageSquareText, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  active?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, to, active, onClick }) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors group",
        active 
          ? "bg-neutral-700/80 text-trendy-yellow" 
          : "text-neutral-400 hover:bg-neutral-700/50 hover:text-trendy-yellow"
      )}
      onClick={onClick}
    >
      <div className={cn(
        "w-6 h-6 flex items-center justify-center",
        active ? "text-trendy-yellow" : "text-neutral-500 group-hover:text-trendy-yellow"
      )}>
        {icon}
      </div>
      <span className={cn(
        "text-sm font-medium",
        active ? "text-trendy-yellow" : "text-neutral-300 group-hover:text-trendy-yellow"
      )}>
        {label}
      </span>
    </Link>
  );
};

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name && !user?.email) return "U";
    if (user.name) {
      const nameParts = user.name.split(" ");
      if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`;
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const isActive = (path: string) => {
    // Match base path or specific subpath for settings
    if (path === '/settings') return location.pathname.startsWith('/settings');
    return location.pathname === path;
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const mainNavItems = [
    { icon: <Youtube className="h-5 w-5" />, label: "Trending", to: "/trending" },
    { icon: <History className="h-5 w-5" />, label: "History", to: "/history" },
    { icon: <SlidersHorizontal className="h-5 w-5" />, label: "Alert Preferences", to: "/alert-preferences" },
    { icon: <MessageSquareText className="h-5 w-5" />, label: "Alert Templates", to: "/alert-templates" },
    { icon: <Bell className="h-5 w-5" />, label: "Notification Settings", to: "/notification-settings" },
    { icon: <Settings className="h-5 w-5" />, label: "Settings", to: "/settings" }
  ];

  const renderNavigation = (closeAfterClick = false) => (
    <>
      <div className="space-y-1 py-2">
        {mainNavItems.map((item) => (
          <NavItem 
            key={item.to}
            {...item} 
            active={isActive(item.to)}
            onClick={closeAfterClick ? closeMobileMenu : undefined}
          />
        ))}
      </div>
    </>
  );

  // Regular sidebar for desktop
  const DesktopSidebar = () => (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-neutral-700/50 bg-neutral-900 text-neutral-300">
          <SidebarHeader className="py-4 px-3 border-b border-neutral-700/50">
            <Logo className="h-8 w-auto text-trendy-yellow" />
          </SidebarHeader>
          <SidebarContent className="px-2 py-2">
            <SidebarGroup>{renderNavigation()}</SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-neutral-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarFallback className="bg-trendy-yellow text-trendy-brown">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-100">
                    {user?.name || user?.email}
                  </span>
                  <span className="text-xs text-neutral-500">
                    Free Account
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50"
                onClick={logout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col max-h-screen overflow-hidden bg-trendy-brown text-neutral-200">
          <header className="h-16 border-b flex items-center justify-end px-6 border-neutral-700/50">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-muted-foreground hover:text-trendy-yellow"
                onClick={() => navigate('/settings')}
              >
                <BellRing className="h-5 w-5" />
              </Button>
              <Separator orientation="vertical" className="h-8" />
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-trendy-yellow text-trendy-brown text-sm">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm font-medium">{user?.name || user?.email}</div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );

  // Mobile sidebar (hamburger menu)
  const MobileSidebar = () => (
    <div className="min-h-screen flex flex-col bg-trendy-brown text-neutral-200">
      <header className="h-16 border-b flex items-center justify-between px-4 border-neutral-700/50">
        <div className="flex items-center gap-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="left" 
              className="w-[80%] max-w-xs p-0 border-r border-neutral-700/50 bg-neutral-900 text-neutral-300"
            >
              <div className="flex flex-col h-full">
                <div className="px-4 py-4 border-b border-neutral-700/50">
                  <Logo className="h-8 w-auto text-trendy-yellow" />
                </div>
                <div className="flex-1 px-3 py-4 overflow-auto">
                  {renderNavigation(true)}
                </div>
                <div className="p-4 border-t border-neutral-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar>
                        <AvatarFallback className="bg-trendy-yellow text-trendy-brown">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-100">
                          {user?.name || user?.email}
                        </span>
                        <span className="text-xs text-neutral-500">
                          Free Account
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50"
                      onClick={() => {
                        closeMobileMenu();
                        logout();
                      }}
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="text-muted-foreground hover:text-trendy-yellow"
            onClick={() => navigate('/settings')}
          >
            <BellRing className="h-5 w-5" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-trendy-yellow text-trendy-brown text-sm">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );

  return isMobile ? <MobileSidebar /> : <DesktopSidebar />;
};

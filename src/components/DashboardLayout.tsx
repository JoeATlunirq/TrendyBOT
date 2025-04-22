import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, BellRing, History, LogOut, Menu, Settings, SlidersHorizontal, MessageSquareText, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import logoImage from '/Design/Custom Variant Logo\'s/TXT with \'Pro\' (1).svg';

// Constants from Settings page (or move to a shared config)
const PROFILE_PHOTO_URL_COLUMN = import.meta.env.VITE_PROFILE_PHOTO_URL_COLUMN || 'profile_photo_url';
const NAME_COLUMN = import.meta.env.VITE_NAME_COLUMN || 'Names';
const EMAIL_COLUMN = import.meta.env.VITE_EMAIL_COLUMN || 'Emails';
const BACKEND_API_BASE_URL = (import.meta.env.PROD ? '/api' : (import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api'));

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
          : "text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-100"
      )}
      onClick={onClick}
    >
      <div className={cn(
        "w-6 h-6 flex items-center justify-center",
        active ? "text-trendy-yellow" : "text-neutral-500 group-hover:text-neutral-100"
      )}>
        {icon}
      </div>
      <span className={cn(
        "text-sm font-medium",
        active ? "text-trendy-yellow" : "text-neutral-300 group-hover:text-neutral-100"
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

  // Function to generate fallback avatar URL
  const generateFallbackAvatar = (name: string | undefined, email: string | undefined) => {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email || 'U')}&background=404040&color=e5e5e5&bold=true`;
  };

  // Function to get the final avatar src (absolute URL or fallback)
  const getAvatarSrc = () => {
      const profileName = user?.[NAME_COLUMN];
      const relativePath = user?.[PROFILE_PHOTO_URL_COLUMN];
      let finalSrc = generateFallbackAvatar(profileName, user?.[EMAIL_COLUMN]);

      if (relativePath && typeof relativePath === 'string' && relativePath.startsWith('/uploads')) {
          try {
              const backendOrigin = BACKEND_API_BASE_URL.replace('/api', '');
              const imageUrl = new URL(relativePath, backendOrigin);
              // Add timestamp? Maybe not needed here if context updates handle it
              // imageUrl.searchParams.set('t', Date.now().toString()); 
              finalSrc = imageUrl.href;
          } catch (e) {
              console.error("Error constructing avatar URL:", e);
              // Fallback already set
          }
      }
      return finalSrc;
  };

  const avatarSrc = getAvatarSrc(); // Calculate once per render

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    const profileName = user?.[NAME_COLUMN];
    if (!profileName && !user?.[EMAIL_COLUMN]) return "U";
    if (profileName) {
      const nameParts = profileName.split(" ");
      if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`;
      }
      return profileName.substring(0, 2).toUpperCase();
    }
    return user?.[EMAIL_COLUMN]?.substring(0, 2).toUpperCase() ?? 'U';
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
          <SidebarHeader className="px-2 py-1 border-b border-neutral-700/50 flex items-center">
            <img src={logoImage} alt="Trendy Bot Logo" className="h-16 w-auto" />
          </SidebarHeader>
          <SidebarContent className="px-0 py-2">
            <SidebarGroup className="p-2">{renderNavigation()}</SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-neutral-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={avatarSrc} alt={user?.[NAME_COLUMN] || 'User Avatar'} />
                  <AvatarFallback className="bg-trendy-yellow text-trendy-brown">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-100">
                    {user?.[NAME_COLUMN] || user?.[EMAIL_COLUMN]}
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
                  <AvatarImage src={avatarSrc} alt={user?.[NAME_COLUMN] || 'User Avatar'} />
                  <AvatarFallback className="bg-trendy-yellow text-trendy-brown text-sm">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm font-medium">{user?.[NAME_COLUMN] || user?.[EMAIL_COLUMN]}</div>
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
                <div className="px-2 py-2 border-b border-neutral-700/50">
                  <img src={logoImage} alt="Trendy Bot Logo" className="h-16 w-auto" />
                </div>
                <div className="flex-1 px-3 py-4 overflow-auto">
                  {renderNavigation(true)}
                </div>
                <div className="p-4 border-t border-neutral-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar>
                        <AvatarImage src={avatarSrc} alt={user?.[NAME_COLUMN] || 'User Avatar'} />
                        <AvatarFallback className="bg-trendy-yellow text-trendy-brown">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-100">
                          {user?.[NAME_COLUMN] || user?.[EMAIL_COLUMN]}
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
          <img src={logoImage} alt="Trendy Bot Logo" className="h-12 w-auto" />
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
            <AvatarImage src={avatarSrc} alt={user?.[NAME_COLUMN] || 'User Avatar'} />
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

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Pages
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import VerifyEmail from "@/pages/VerifyEmail";
import Onboarding from "@/pages/Onboarding";
import Trending from "@/pages/Trending";
import TrendDetail from "@/pages/TrendDetail";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import Landing from "@/pages/Landing";
import History from "@/pages/History";
import AlertPreferences from "@/pages/AlertPreferences";
import AlertTemplates from "@/pages/AlertTemplates";
import NotificationSettings from "@/pages/NotificationSettings";

// Layout
import { DashboardLayout } from "@/components/DashboardLayout";

const queryClient = new QueryClient();

// Protected route wrapper
const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

// OnboardingRoute - Renders Onboarding only if user is authenticated
// (The decision to *send* them here is made in AuthContext)
const OnboardingRoute = () => {
  // const { user, isLoading } = useAuth(); // No longer need user directly
  const { isAuthenticated, isLoading } = useAuth(); // Check authentication status

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // If user exists but isn't a new user, redirect to dashboard
  // if (user && !user.isNewUser) {
  //   return <Navigate to="/trending" replace />;
  // }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
  }

  // If user is authenticated, allow rendering the nested route (Onboarding page)
  // AuthContext should have already determined they need onboarding.
  return <Outlet />;
};

// Public route - redirects to dashboard if already logged in
const PublicRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return isAuthenticated ? <Navigate to="/trending" replace /> : <Outlet />;
};

const AppRoutes = () => (
  <Routes>
    {/* Landing page */}
    <Route path="/" element={<Landing />} />
    
    {/* Public routes */}
    <Route element={<PublicRoute />}>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
    </Route>

    {/* Onboarding */}
    <Route element={<OnboardingRoute />}>
      <Route path="/onboarding" element={<Onboarding />} />
    </Route>

    {/* Protected routes */}
    <Route element={<ProtectedRoute />}>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Navigate to="/trending" replace />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/trending/:id" element={<TrendDetail />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/alert-preferences" element={<AlertPreferences />} />
        <Route path="/alert-templates" element={<AlertTemplates />} />
        <Route path="/notification-settings" element={<NotificationSettings />} />
      </Route>
    </Route>

    {/* 404 Not Found */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

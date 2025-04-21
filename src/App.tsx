import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";

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

// Environment Variable for Onboarding Column Name
const ONBOARDING_COLUMN_NAME = import.meta.env.VITE_ONBOARDING_COLUMN || 'onboarding_complete';

const queryClient = new QueryClient();

// Protected route wrapper
const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

// OnboardingRoute - Renders Onboarding only if user is authenticated AND has NOT completed onboarding
const OnboardingRoute = () => {
  const { user, isAuthenticated, isLoading } = useAuth(); // Now need user object too

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
  }

  // Check if onboarding is complete using the DB value (1 or "1")
  const onboardingValue = user ? user[ONBOARDING_COLUMN_NAME] : undefined;
  const isComplete = onboardingValue === 1 || onboardingValue === "1" || onboardingValue === true;

  // If authenticated AND onboarding is complete, redirect to dashboard
  if (isComplete) {
     console.log('OnboardingRoute: Redirecting to /trending (onboarding complete)');
     return <Navigate to="/trending" replace />;
  }

  // If user is authenticated AND onboarding is NOT complete, render Onboarding page
  console.log('OnboardingRoute: Rendering Onboarding page (onboarding incomplete or value unrecognized)');
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
      <BrowserRouter>
        <AuthProvider>
          <UserSettingsProvider>
            <AppRoutes />
          </UserSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    <Toaster />
    <Sonner />
  </QueryClientProvider>
);

export default App;

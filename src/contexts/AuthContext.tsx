import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import axios
import { useToast } from '@/components/ui/use-toast';

// --- Configuration ---
// Use environment variable for backend URL
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api/auth';
// Use environment variable for the column name
const ONBOARDING_COLUMN_NAME = import.meta.env.VITE_ONBOARDING_COLUMN || 'onboarding_complete';
// Add subscription column names (match backend .env / NocoDB)
const CURRENT_PLAN_COLUMN = import.meta.env.VITE_CURRENT_PLAN_COLUMN || 'current_plan';
const PAYPAL_SUB_ID_COLUMN = import.meta.env.VITE_PAYPAL_SUB_ID_COLUMN || 'paypal_subscription_id';
const SUB_STATUS_COLUMN = import.meta.env.VITE_SUB_STATUS_COLUMN || 'subscription_status';

// --- Types ---
// Simplify User type to avoid computed property issues
type User = {
  Id: string; 
  email: string;
  // Allow any other properties (less type-safe but avoids linter issue)
  [key: string]: any; 
};

type AuthContextType = {
  user: User | null;
  token: string | null; // Store the JWT
  isLoading: boolean;
  isAuthenticated: boolean;
  currentPlan: string | null; // Add currentPlan state
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  // verifyEmail removed as it's not implemented in the basic backend
};


// --- Context ---
const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  currentPlan: null, // Default value
  login: async () => {},
  signup: async () => {},
  logout: () => {},
});

// --- Hook ---
export const useAuth = () => useContext(AuthContext);


// --- Provider ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null); // Add token state
  const [currentPlan, setCurrentPlan] = useState<string | null>(null); // Add state
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check for existing token and user in localStorage on initial load
  useEffect(() => {
    const storedToken = localStorage.getItem('trendly_token');
    const storedUser = localStorage.getItem('trendly_user');
    
    if (storedToken && storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        // Ensure value passed to setCurrentPlan is string or null
        const plan = parsedUser[CURRENT_PLAN_COLUMN];
        setCurrentPlan(typeof plan === 'string' ? plan : 'Free'); 
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        localStorage.removeItem('trendly_user');
        localStorage.removeItem('trendly_token');
        setCurrentPlan(null); 
      }
    } else {
        setCurrentPlan(null); 
    }
    setIsLoading(false);
  }, []);

  // --- Helper Function for Navigation ---
  const navigateAfterAuth = (user: User | null) => {
    if (!user) {
      navigate('/login'); // Should not happen, but fallback
      return;
    }
    // Check the onboarding status using the configured column name
    const onboardingComplete = user[ONBOARDING_COLUMN_NAME]; 
    console.log('Onboarding status check:', onboardingComplete);
    
    if (onboardingComplete === true) { // Explicit check for true
      console.log('Navigating to /dashboard'); // Add log
      navigate('/dashboard');
    } else {
      // Navigate to onboarding if false, null, or undefined
      console.log('Navigating to /onboarding'); // Add log
      navigate('/onboarding'); 
    }
  }

  // Helper to set user state and plan
  const setUserAndPlan = (userData: User | null, tokenData: string | null) => {
      setUser(userData);
      setToken(tokenData);
      if (userData && tokenData) {
          localStorage.setItem('trendly_token', tokenData);
          localStorage.setItem('trendly_user', JSON.stringify(userData));
          // Ensure value passed to setCurrentPlan is string or null
          const plan = userData[CURRENT_PLAN_COLUMN];
          setCurrentPlan(typeof plan === 'string' ? plan : 'Free');
      } else {
          localStorage.removeItem('trendly_user');
          localStorage.removeItem('trendly_token');
          setCurrentPlan(null);
      }
  }

  // Login function - connects to backend
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${BACKEND_API_URL}/login`, { email, password });
      const { token: receivedToken, user: receivedUser } = response.data;

      if (receivedToken && receivedUser) {
        setUserAndPlan(receivedUser, receivedToken);
        toast({
          title: "Login successful",
          description: "Welcome back!",
        });
        // Navigate based on onboarding status
        navigateAfterAuth(receivedUser);
      } else {
        // Should not happen if backend is correct, but good practice
        throw new Error('Invalid response from server');
      }

    } catch (error: any) {
      setUserAndPlan(null, null); // Clear state on login error
      const message = error.response?.data?.message || error.message || "Login failed. Please check credentials.";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive"
      });
      console.error('Login error:', error.response?.data || error);
    } finally {
      setIsLoading(false);
    }
  };

  // Signup function - connects to backend
  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
       const response = await axios.post(`${BACKEND_API_URL}/signup`, { name, email, password });
       const { token: receivedToken, user: receivedUser } = response.data;

       if (receivedToken && receivedUser) {
         setUserAndPlan(receivedUser, receivedToken);
         toast({
           title: "Account created!",
           description: "Welcome! Let's get you set up.", // Adjusted message
         });
         // Navigate based on onboarding status (should be false after signup)
         navigateAfterAuth(receivedUser); 
       } else {
         // Should not happen if backend is correct
         throw new Error('Invalid response from server during signup');
       }

    } catch (error: any) {
      setUserAndPlan(null, null); // Clear state on signup error
      const message = error.response?.data?.message || error.message || "Signup failed. Please try again.";
      toast({
        title: "Signup failed",
        description: message,
        variant: "destructive"
      });
      console.error('Signup error:', error.response?.data || error);
    } finally {
      setIsLoading(false);
    }
  };

  // Email verification function REMOVED - Not implemented in backend

  // Logout function - Clears state and localStorage
  const logout = () => {
    setUserAndPlan(null, null); // Use helper to clear everything
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate('/login'); // Redirect to login page
  };

  // Provide context value including currentPlan
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        currentPlan, // Provide current plan
        login,
        signup,
        logout,
        // verifyEmail removed
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

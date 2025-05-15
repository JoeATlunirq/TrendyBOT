import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import axios
import { useToast } from '@/components/ui/use-toast';

// Determine the base API URL based on the environment
const getAuthApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/api/auth'; // Use relative path for Vercel production
  } else {
    // Use local backend URL for development (allow override via .env)
    return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api/auth';
  }
};

const AUTH_API_URL = getAuthApiBaseUrl();

// --- Configuration ---
const ONBOARDING_COLUMN_NAME = import.meta.env.VITE_ONBOARDING_COLUMN || 'onboarding_complete';
const CURRENT_PLAN_COLUMN = import.meta.env.VITE_CURRENT_PLAN_COLUMN || 'current_plan';
const TWO_FACTOR_ENABLED_COLUMN = import.meta.env.VITE_2FA_ENABLED_COLUMN || 'is_two_factor_enabled';

// --- Types ---
export type User = {
  Id: string; 
  Emails: string;
  [key: string]: any; 
};

export type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  currentPlan: string | null;
  isTelegramVerified: boolean;
  telegramChatId: string | null;
  isTwoFactorEnabled: boolean;
  is2FARequired: boolean;
  isVerifying2FA: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, accessCode: string) => Promise<void>;
  logout: () => void;
  updateUserContext: (updatedFields: Partial<User>) => void; 
  submit2FACode: (code: string) => Promise<void>;
  cancel2FA: () => void;
};

// --- Context ---
const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  currentPlan: null,
  isTelegramVerified: false,
  telegramChatId: null,
  isTwoFactorEnabled: false,
  is2FARequired: false,
  isVerifying2FA: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  updateUserContext: () => {},
  submit2FACode: async () => {},
  cancel2FA: () => {},
});

// --- Hook ---
export const useAuth = () => useContext(AuthContext);

// --- Provider ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isTelegramVerified, setIsTelegramVerified] = useState<boolean>(false);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [is2FARequired, setIs2FARequired] = useState<boolean>(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);
  const [isVerifying2FA, setIsVerifying2FA] = useState<boolean>(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = () => {
      const storedToken = localStorage.getItem('trendly_token');
      const storedUser = localStorage.getItem('trendly_user');
      
      if (storedToken && storedUser) {
        try {
          const parsedUser: User = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          const plan = parsedUser[CURRENT_PLAN_COLUMN];
          setCurrentPlan(plan && typeof plan === 'string' ? plan : null);
          const telegramVerified = parsedUser[import.meta.env.VITE_TELEGRAM_VERIFIED_COLUMN || 'telegram_verified'] === true;
          const chatId = parsedUser[import.meta.env.VITE_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id'] || null;
          setIsTelegramVerified(telegramVerified);
          setTelegramChatId(telegramVerified ? chatId : null);
          const twoFactorValue = parsedUser[TWO_FACTOR_ENABLED_COLUMN];
          const twoFactorEnabled = twoFactorValue === true || twoFactorValue === 1 || twoFactorValue === '1';
          setIsTwoFactorEnabled(twoFactorEnabled);
          
        } catch (error) {
          console.error("Failed to parse stored user data:", error);
          localStorage.removeItem('trendly_user');
          localStorage.removeItem('trendly_token');
          setCurrentPlan(null); 
          setIsTelegramVerified(false);
          setTelegramChatId(null);
          setIsTwoFactorEnabled(false);
        }
      } else {
        setCurrentPlan(null);
        setIsTelegramVerified(false);
        setTelegramChatId(null);
        setIsTwoFactorEnabled(false);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []); 

  // --- Helper Function for Navigation ---
  const navigateAfterAuth = useCallback((user: User | null) => {
    if (!user) {
      console.log('No user data, navigating to login');
      navigate('/login', { replace: true });
      return;
    }

    // Check if we're already on the correct page to prevent unnecessary navigation
    const onboardingValue = user[ONBOARDING_COLUMN_NAME];
    const isComplete = onboardingValue === 1 || onboardingValue === "1" || onboardingValue === true;
    const targetPath = isComplete ? '/dashboard' : '/onboarding';

    // Only navigate if we're not already on the target path
    if (window.location.pathname !== targetPath) {
      console.log(`Navigating to ${targetPath} (onboarding ${isComplete ? 'complete' : 'incomplete'})`);
      navigate(targetPath, { replace: true });
    } else {
      console.log(`Already on ${targetPath}, skipping navigation`);
    }
  }, [navigate]);

  // Update setUserAndPlan to handle Telegram status
  const setUserAndPlan = (userData: User | null, tokenData: string | null) => {
      setUser(userData);
      setToken(tokenData);
      if (userData && tokenData) {
          localStorage.setItem('trendly_token', tokenData);
          localStorage.setItem('trendly_user', JSON.stringify(userData));
          const plan = userData[CURRENT_PLAN_COLUMN];
          setCurrentPlan(plan && typeof plan === 'string' ? plan : null);
          const telegramVerified = userData[import.meta.env.VITE_TELEGRAM_VERIFIED_COLUMN || 'telegram_verified'] === true;
          const chatId = userData[import.meta.env.VITE_TELEGRAM_CHAT_ID_COLUMN || 'telegram_chat_id'] || null;
          setIsTelegramVerified(telegramVerified);
          setTelegramChatId(telegramVerified ? chatId : null);
          const twoFactorValue = userData[TWO_FACTOR_ENABLED_COLUMN];
          const twoFactorEnabled = twoFactorValue === true || twoFactorValue === 1 || twoFactorValue === '1';
          setIsTwoFactorEnabled(twoFactorEnabled);
          
      } else {
          localStorage.removeItem('trendly_user');
          localStorage.removeItem('trendly_token');
          setCurrentPlan(null);
          setIsTelegramVerified(false);
          setTelegramChatId(null);
          setIsTwoFactorEnabled(false);
      }
  }

  // Login function - connects to backend
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setIs2FARequired(false); // Reset 2FA state on new login attempt
    setPending2FAUserId(null);
    setUserAndPlan(null, null); // Clear any previous user/token state

    try {
      const response = await axios.post(`${AUTH_API_URL}/login`, { email, password });

      // Check if 2FA is required
      if (response.data.twoFactorRequired) {
        setPending2FAUserId(response.data.userId); // Store user ID for 2FA verification step
        setIs2FARequired(true);                   // Set flag to show 2FA input
        toast({ title: "2FA Required", description: "Please enter the code from your authenticator app.", variant: "default" });
        // Do not navigate yet, wait for 2FA code
      } else {
        // Standard login: 2FA not required or already passed (though verify handles that)
        const { token: receivedToken, user: receivedUser } = response.data;
        if (receivedToken && receivedUser) {
            setUserAndPlan(receivedUser, receivedToken);
            toast({ title: "Login successful", description: "Welcome back!" });
            navigateAfterAuth(receivedUser);
        } else {
            // Should not happen if backend logic is correct
            throw new Error('Invalid login response from server (missing token or user)');
        }
      }

    } catch (error: any) {
      setUserAndPlan(null, null); // Clear state on login error
      const message = error.response?.data?.message || error.message || "Login failed. Please check credentials.";
      toast({ title: "Login failed", description: message, variant: "destructive" });
      console.error('Login error:', error.response?.data || error);
    } finally {
      setIsLoading(false);
    }
  };

  // Signup function - connects to backend
  const signup = async (email: string, password: string, name: string, accessCode: string) => {
    setIsLoading(true);
    try {
       const response = await axios.post(`${AUTH_API_URL}/signup`, { name, email, password, accessCode });
       const { token: receivedToken, user: receivedUser } = response.data;

       if (receivedToken && receivedUser) {
         setUserAndPlan(receivedUser, receivedToken);
         toast({
           title: "Account created!",
           description: "Welcome! Your account is ready.", // Updated message
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
      throw error; // Re-throw the error so it can be caught in the Signup.tsx component
    } finally {
      setIsLoading(false);
    }
  };

  // Email verification function REMOVED - Not implemented in backend

  // Update logout to clear Telegram status
  const logout = () => {
    setUserAndPlan(null, null); // This already clears plan and telegram status
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate('/login', { replace: true }); // Add replace: true
  };

  // --- NEW: Function to update parts of the user context ---
  const updateUserContext = (updatedFields: Partial<User>) => {
    if (!user || !token) {
      console.warn("updateUserContext called when user or token is null. Ignoring.");
      return;
    }
    // Merge current user with updated fields
    const newUser = { ...user, ...updatedFields };
    // Use existing helper to update state and localStorage
    setUserAndPlan(newUser, token); 
    console.log("[AuthContext] User context updated with:", updatedFields);
  };
  // ----------------------------------------------------------

  // --- ADD submit2FACode function --- 
  const submit2FACode = async (code: string) => {
    if (!pending2FAUserId) {
        toast({ title: "Error", description: "User ID missing for 2FA verification.", variant: "destructive" });
        setIs2FARequired(false); // Reset state
        return;
    }
    if (!/\d{6}/.test(code)) { // Basic check for 6 digits
        toast({ title: "Invalid Code", description: "Please enter the 6-digit code.", variant: "destructive" });
        return;
    }

    setIsVerifying2FA(true);
    try {
        const response = await axios.post(`${AUTH_API_URL}/login/2fa/verify`, {
            userId: pending2FAUserId,
            token: code
        });

        // Verification successful, backend returns token and user
        const { token: receivedToken, user: receivedUser } = response.data;
        if (receivedToken && receivedUser) {
            setUserAndPlan(receivedUser, receivedToken);
            toast({ title: "Login successful", description: "Welcome back!" });
            setIs2FARequired(false); // Reset 2FA state
            setPending2FAUserId(null);
            navigateAfterAuth(receivedUser); // Navigate after successful 2FA
        } else {
            throw new Error('Invalid response from server during 2FA verification');
        }

    } catch (error: any) {
        // Clear user/token state just in case, keep 2FA prompt open
        // setUserAndPlan(null, null); 
        const message = error.response?.data?.message || error.message || "2FA verification failed.";
        toast({ title: "Verification Failed", description: message, variant: "destructive" });
        console.error('2FA verification error:', error.response?.data || error);
    } finally {
        setIsVerifying2FA(false);
    }
  };
  // ---------------------------------

  // --- ADD cancel2FA function --- 
  const cancel2FA = () => {
    setIs2FARequired(false);
    setPending2FAUserId(null);
    setUserAndPlan(null, null); // Clear any partial state
    // Optionally navigate back to login start or do nothing
    console.log("2FA step cancelled.");
  };
  // ------------------------------

  // --- Memoize Context Value --- 
  const contextValue = React.useMemo(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token, // Derive isAuthenticated
    currentPlan,
    isTelegramVerified,
    telegramChatId,
    isTwoFactorEnabled, // Expose 2FA status
    is2FARequired, // <-- Expose
    isVerifying2FA, // <-- Expose
    login, // Assuming login/logout etc are stable due to useCallback or definition outside render
    signup,
    logout,
    updateUserContext, 
    submit2FACode, 
    cancel2FA, 
  }), [
    user, token, isLoading, currentPlan, 
    isTelegramVerified, telegramChatId, isTwoFactorEnabled, 
    is2FARequired, isVerifying2FA,
    // Include stable function references if they are defined with useCallback, otherwise they might cause updates
    // Assuming login, signup, logout, updateUserContext, submit2FACode, cancel2FA are stable
  ]);
  // -----------------------------

  // Provide the memoized context value
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

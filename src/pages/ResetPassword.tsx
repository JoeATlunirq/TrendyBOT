import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { CheckCircle } from 'lucide-react';

// Determine the base API URL (Same logic as Login.tsx)
const getAuthApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/api/auth'; 
  } else {
    return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api/auth';
  }
};
const AUTH_API_URL = getAuthApiBaseUrl();

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      // No token found, redirect or show error
      console.error('Reset password token missing from URL');
      setError('Invalid or missing password reset link.');
      // Optionally redirect after a delay
      // setTimeout(() => navigate('/login'), 3000);
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (!token) {
       toast({ title: "Error", description: "Reset token is missing.", variant: "destructive" });
       return;
    }

    setIsLoading(true);
    setError(null); // Clear previous errors

    try {
      const response = await axios.post(`${AUTH_API_URL}/reset-password`, {
        token: token,
        newPassword: newPassword,
      });
      
      toast({ title: "Success", description: response.data.message });
      setResetSuccess(true); // Show success state
      // Optionally redirect to login after success
      setTimeout(() => navigate('/login'), 3000); 

    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to reset password. The link may be invalid or expired.";
      setError(message); // Show specific error on the page
      toast({ title: "Error", description: message, variant: "destructive" });
      console.error('Reset Password Error:', err.response?.data || err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Logic --- 

  // Initial loading or error state (before form)
  if (error && !resetSuccess) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-trendy-brown text-neutral-200 p-4 md:p-8">
          <div className="w-full max-w-md space-y-8 text-center">
             <Logo className="w-16 h-16 mb-4 text-trendy-yellow mx-auto" />
             <h1 className="text-3xl font-orbitron font-bold text-red-400">Error</h1>
             <p className="text-neutral-300">{error}</p>
             <Button variant="outline" asChild className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                 <Link to="/login">
                    Back to Login
                 </Link>
              </Button>
          </div>
        </div>
     );
  }

  // Success state
  if (resetSuccess) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-trendy-brown text-neutral-200 p-4 md:p-8">
          <div className="w-full max-w-md space-y-8 text-center">
             <Logo className="w-16 h-16 mb-4 text-trendy-yellow mx-auto" />
             <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
             <h1 className="text-3xl font-orbitron font-bold text-white">Password Reset Successful</h1>
             <p className="text-neutral-300">You can now log in with your new password.</p>
             <p className="text-sm text-neutral-400">(Redirecting to login...)</p>
             <Button variant="outline" asChild className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white mt-4">
                 <Link to="/login">
                    Go to Login Now
                 </Link>
              </Button>
          </div>
        </div>
     );
  }

  // Default: Render the password reset form
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-trendy-brown text-neutral-200 p-4 md:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="w-16 h-16 mb-4 text-trendy-yellow" />
          <h1 className="text-3xl font-orbitron font-bold text-white">Reset Your Password</h1>
          <p className="text-neutral-400 mt-2">
            Enter a new password for your account.
          </p>
        </div>

        <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-white font-orbitron">Create New Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-neutral-300">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                  disabled={isLoading}
                />
                 <p className="text-xs text-neutral-500">Must be at least 8 characters.</p>
              </div>
              <div className="space-y-2">
                 <Label htmlFor="confirm-password" className="text-neutral-300">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                  disabled={isLoading}
                />
              </div>
              {error && <p className="text-sm text-red-400">Error: {error}</p>} {/* Display specific error if needed */}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold"
                disabled={isLoading || !newPassword || newPassword !== confirmPassword || newPassword.length < 8 || !token}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
               <Link to="/login" className="text-sm text-neutral-400 hover:text-trendy-yellow/80 hover:underline">
                  Back to Login
                </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword; 
import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { MailCheck } from 'lucide-react'; // Icon for success state

// Determine the base API URL (Same logic as Login.tsx)
const getAuthApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/api/auth'; 
  } else {
    return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api/auth';
  }
};
const AUTH_API_URL = getAuthApiBaseUrl();

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessageSent(false); // Reset message state on new attempt

    try {
      const response = await axios.post(`${AUTH_API_URL}/forgot-password`, { email });
      // Backend always returns 200, use its message
      toast({ title: "Request Submitted", description: response.data.message });
      setMessageSent(true); // Show success state
      setEmail(""); // Clear email field
    } catch (error: any) {
      // Log the error but show a generic message to the user
      console.error('Forgot Password Error:', error.response?.data || error);
      toast({ 
        title: "Error", 
        description: "An error occurred. Please try again later.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-trendy-brown text-neutral-200 p-4 md:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-orbitron font-bold text-white">
            {messageSent ? "Check Your Email" : "Forgot Password?"}
          </h1>
          <p className="text-neutral-400 mt-2">
            {messageSent
              ? "If an account exists for the email provided, a password reset link has been sent."
              : "Enter your email address and we'll send you a link to reset your password."
            }
          </p>
        </div>

        <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
          {!messageSent ? (
            // --- Form State ---
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle className="text-white font-orbitron">Reset Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-neutral-300">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button 
                  type="submit" 
                  className="w-full bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold"
                  disabled={isLoading || !email}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
                 <Link to="/login" className="text-sm text-neutral-400 hover:text-trendy-yellow/80 hover:underline">
                  Back to Login
                </Link>
              </CardFooter>
            </form>
          ) : (
            // --- Success State ---
            <CardContent className="text-center py-10">
              <MailCheck className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-neutral-300 mb-6">Please check your inbox (and spam folder) for the password reset link.</p>
              <Button variant="outline" asChild className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                 <Link to="/login">
                    Back to Login
                 </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword; 
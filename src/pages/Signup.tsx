import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const Signup = () => {
  const [step, setStep] = useState(1); // Step 1: User details, Step 2: Access Code
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const { signup, isLoading } = useAuth();

  const validateStep1 = () => {
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields: Name, Email, and Password.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    // Basic email validation (can be improved with a regex if needed)
    if (!email.includes('@') || !email.includes('.')) {
        setError("Please enter a valid email address.");
        return false;
    }
    return true;
  };

  const validateStep2 = () => {
    setError("");
    if (!accessCode.trim()) {
      setError("Access code is required");
      return false;
    }
    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
      setError(""); // Clear previous errors
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) { // Re-validate step 1 data in case user navigates back or clears fields
        setStep(1); // Send user back to step 1 if its data is now invalid
        return;
    }
    if (!validateStep2()) return;
    
    try {
      await signup(email, password, name, accessCode);
      // Navigation on success is handled by AuthContext
    } catch (err: any) {
      console.error(err);
      // Error display will be handled by the existing error state and backend messages
      if (err && err.message) {
        setError(err.message);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError("Failed to create account. An unknown error occurred.");
    }
    }
  };
  
  const handleBack = () => {
    setStep(1);
    setError(""); // Clear errors when going back
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-trendy-brown text-neutral-200 p-4 md:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-3xl font-orbitron font-bold text-white">
            {step === 1 ? "Create an account" : "Enter Access Code"}
          </h1>
          <p className="text-neutral-400 mt-2">
            {step === 1 
              ? "Sign up for Trendy.bot to start tracking YouTube Shorts trends" 
              : "You're almost there! Enter your access code to complete signup."}
          </p>
        </div>

        <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="text-white font-orbitron">
              {step === 1 ? "Sign up - Step 1 of 2" : "Sign up - Step 2 of 2"}
            </CardTitle>
            <CardDescription className="text-neutral-400">
              {step === 1 
                ? "Enter your information to create an account" 
                : "Enter your one-time access code"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={step === 1 ? handleNextStep : handleFinalSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              {step === 1 && (
                <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-neutral-300">Full Name</Label>
                    <Input id="name" type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-300">Email</Label>
                    <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-neutral-300">Password</Label>
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"/>
                    <p className="text-xs text-neutral-500">Must be at least 8 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-neutral-300">Confirm Password</Label>
                    <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"/>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="accessCode" className="text-neutral-300">Access Code</Label>
                    <Input id="accessCode" type="text" placeholder="Your Access Code" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"/>
                    <p className="text-xs text-neutral-500">This is a one-time code required for signup.</p>
              </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              {step === 2 && (
                <Button variant="outline" type="button" onClick={handleBack} className="w-full border-neutral-600 bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/80">
                  Back
                </Button>
              )}
              <Button type="submit" className="w-full bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold" disabled={isLoading}>
                {isLoading 
                  ? (step === 1 ? "Proceeding..." : "Creating account...") 
                  : (step === 1 ? "Next: Access Code" : "Create account")}
              </Button>
              <div className="text-center text-sm">
                <span className="text-neutral-400">
                  Already have an account?{" "}
                </span>
                <Link to="/login" className="text-trendy-yellow hover:text-trendy-yellow/80 hover:underline font-medium">
                  Log in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Signup;

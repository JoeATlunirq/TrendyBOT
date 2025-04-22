import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  
  const { login, isLoading, is2FARequired, isVerifying2FA, submit2FACode, cancel2FA } = useAuth();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit2FACode(twoFACode);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-trendy-brown text-neutral-200 p-4 md:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="w-16 h-16 mb-4 text-trendy-yellow" />
          <h1 className="text-3xl font-orbitron font-bold text-white">
            {is2FARequired ? 'Enter Verification Code' : 'Welcome back'}
          </h1>
          <p className="text-neutral-400 mt-2">
            {is2FARequired 
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Log in to your Trendy.bot account to continue monitoring YouTube Shorts trends'
            }
          </p>
        </div>

        <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
          {!is2FARequired && (
            <>
              <CardHeader>
                <CardTitle className="text-white font-orbitron">Log in</CardTitle>
                <CardDescription className="text-neutral-400">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLoginSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-neutral-300">Email</Label>
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-neutral-300">Password</Label>
                      <Link to="/forgot-password" className="text-xs text-trendy-yellow hover:text-trendy-yellow/80 hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                      disabled={isLoading}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button 
                    type="submit" 
                    className="w-full bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? "Logging in..." : "Log in"}
                  </Button>
                  <div className="text-center text-sm">
                    <span className="text-neutral-400">
                      Don't have an account?{" "}
                    </span>
                    <Link to="/signup" className="text-trendy-yellow hover:text-trendy-yellow/80 hover:underline font-medium">
                      Sign up
                    </Link>
                  </div>
                </CardFooter>
              </form>
            </>
          )}
          
          {is2FARequired && (
            <>
              <CardHeader>
                <CardTitle className="text-white font-orbitron">Verify Your Identity</CardTitle>
                <CardDescription className="text-neutral-400">
                  Enter the 6-digit code from your authenticator app
                </CardDescription>
              </CardHeader>
              <form onSubmit={handle2FASubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="2fa-code" className="text-neutral-300">Authenticator Code</Label>
                    <Input
                      id="2fa-code"
                      type="text" 
                      inputMode="numeric" 
                      placeholder="123456"
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))} 
                      required
                      maxLength={6}
                      pattern="\d{6}" 
                      autoComplete="one-time-code"
                      className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-center tracking-widest font-mono text-lg"
                      disabled={isVerifying2FA} 
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold"
                    disabled={isVerifying2FA || twoFACode.length !== 6} 
                  >
                    {isVerifying2FA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isVerifying2FA ? "Verifying..." : "Verify Code"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost"
                    className="w-full text-neutral-400 hover:text-white hover:bg-neutral-700/50"
                    onClick={cancel2FA} 
                    disabled={isVerifying2FA}
                  >
                    Cancel
                  </Button>
                </CardFooter>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;

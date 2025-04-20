import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-trendy-brown text-neutral-200">
      <header className="py-4 px-6 border-b border-neutral-700/50">
        <div className="container">
          <Logo className="h-8 w-auto text-trendy-yellow" />
        </div>
      </header>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="text-trendy-yellow text-9xl font-bold font-orbitron">404</div>
          <h1 className="text-3xl font-bold text-white font-orbitron">Page not found</h1>
          <p className="text-neutral-400">
            Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
            <Button asChild className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold">
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.history.back()} className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

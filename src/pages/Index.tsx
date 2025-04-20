import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ArrowRight, Bell, LineChart, TrendingUp, Youtube } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="py-4 px-4 md:px-6 border-b">
        <div className="container flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button className="bg-trendy-purple hover:bg-trendy-purple/90" asChild>
              <Link to="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-10 md:pt-32 md:pb-20 flex items-center justify-center text-center bg-gradient-to-b from-primary/10 to-transparent">
        <div className="container z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>YouTube Shorts Trend Radar</span>
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">Spot Viral Shorts Instantly</h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                Trendy monitors YouTube Shorts in real-time, alerting you about trending videos
                before they peak. Stay ahead, grow faster.
              </p>
              <div className="flex justify-center gap-4">
                <Button size="lg" className="bg-trendy-purple hover:bg-trendy-purple/90" asChild>
                  <Link to="/signup">Get Started Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Live Demo</Link>
                </Button>
              </div>
            </div>
            <div className="relative rounded-xl overflow-hidden border shadow-xl">
              <img 
                src="https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
                alt="Dashboard Preview"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-6">
                <div className="text-white mb-2 text-lg font-bold">Real-time Trend Detection</div>
                <div className="flex items-center gap-2">
                  <Badge variant="alert" trend="rapid" views="420K" />
                  <Badge variant="alert" trend="viral" views="1.2M" />
                  <Badge variant="alert" trend="rising" views="180K" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-24 bg-muted">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-2">
              Why Creators Choose trendy
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get the competitive edge with our powerful trend detection tools
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<TrendingUp className="h-10 w-10 text-primary" />}
              title="Real-time Detection"
              description="Identify trending Shorts as they start gaining momentum, before they reach peak virality."
            />
            <FeatureCard 
              icon={<Bell className="h-10 w-10 text-primary" />}
              title="Instant Alerts"
              description="Get notifications via email, Telegram or Discord the moment a video meets your criteria."
            />
            <FeatureCard 
              icon={<LineChart className="h-10 w-10 text-primary" />}
              title="Advanced Analytics"
              description="Track performance data and gain insights into what makes content go viral."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 md:py-24 bg-muted/50">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">How trendy Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground">
                1
              </div>
              <HowItWorksCard
                image="https://images.unsplash.com/photo-1580130379624-3a069adbffc5?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
                title="Set Your Criteria"
                description="Choose the niches, channels, and growth thresholds that matter to you."
              />
            </div>
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground">
                2
              </div>
              <HowItWorksCard
                image="https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
                title="Stay Connected"
                description="Connect your preferred notification channels to receive instant alerts."
              />
            </div>
            <div className="relative">
              <div className="absolute -left-4 -top-4 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground">
                3
              </div>
              <HowItWorksCard
                image="https://images.unsplash.com/photo-1565106430482-8f6e74349ca1?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
                title="Take Action"
                description="React quickly to trending topics and create content that resonates with audiences."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-24 bg-trendy-dark text-white">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Get Started with trendy Today</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of content creators who use trendy to stay ahead of YouTube Shorts trends.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
              <Link to="/signup">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
              <Link to="/login">Log In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t">
        <div className="container flex flex-col md:flex-row justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-sm text-muted-foreground">© 2023 trendy. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => {
  return (
    <div className="flex flex-col items-center text-center p-6 space-y-4 bg-background rounded-lg border shadow-sm">
      <div className="p-3 rounded-full bg-primary/10">{icon}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

const HowItWorksCard = ({ image, title, description }: { image: string, title: string, description: string }) => {
  return (
    <div className="rounded-lg overflow-hidden bg-background border shadow-sm h-full flex flex-col">
      <div className="h-40 overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};

const Badge = ({ variant, trend, views }: { variant: string, trend: string, views: string }) => {
  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-white text-sm flex items-center gap-1.5">
      <Youtube className="h-3.5 w-3.5" />
      <span className="capitalize">{trend}:</span>
      <span className="font-bold">{views}</span>
    </div>
  );
};

export default Index;

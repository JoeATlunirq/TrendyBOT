import React from 'react';
import { AnimatedTestimonials } from '../components/ui/animated-testimonials';
import { TestimonialsSection } from '../components/ui/testimonials-section';
import { TestimonialAuthor } from '../components/ui/testimonial-card';
import { ProjectStatusCard } from '../components/ui/project-status-card';
import DatabaseWithRestApi from '../components/ui/database-with-rest-api';
import { CTASection } from '../components/ui/cta-section';
import { Pricing } from '../components/ui/pricing';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';

// Placeholder for missing components or types if needed
// Example: type Props = {};

const LandingPage: React.FC = () => {
  // Define testimonial data using local paths and updated quotes
  const testimonialsData = [
    { quote: "Trendy.bot is my secret weapon for Shorts! Knowing what's popping off instantly helps me jump on trends way faster than before.", name: "Samantha Collins", designation: "Shorts Creator", src: "/assets/figma/YkpUok2fGo3ld57plHxrpJnqs.jpg" },
    { quote: "No more guessing game for my Shorts content. The alerts are spot-on for my niche, helping me create relevant videos that actually get views.", name: "David Nguyen", designation: "Tech Reviewer (Shorts)", src: "/assets/figma/yQgwOMluRZbGnTNDvxzNruhpY0.jpg" },
    { quote: "This tool understands the *speed* of Shorts trends. The instant alerts are a game-changer for staying relevant and capturing viral waves.", name: "Emily Johnson", designation: "Social Media Strategist", src: "/assets/figma/rWhc7kSjY60xoaZdt0mdcw3KjuQ.jpg" },
    { quote: "It's simple, effective, and laser-focused on Shorts trends. Getting alerts directly means I spend less time researching and more time creating.", name: "Alex Rivera", designation: "YouTube Growth Consultant", src: "/assets/figma/YkpUok2fGo3ld57plHxrpJnqs.jpg" }, // Reusing image 
    { quote: "Our agency saw a clear difference in client Shorts performance after using Trendy.bot. Reacting faster to trends works.", name: "Jordan Lee", designation: "Marketing Agency Owner", src: "/assets/figma/yQgwOMluRZbGnTNDvxzNruhpY0.jpg" }, // Reusing image
    { quote: "If you make YouTube Shorts seriously, you need this. It cuts through the noise and delivers actionable trend data right when you need it.", name: "Casey Morgan", designation: "Creator Coach", src: "/assets/figma/rWhc7kSjY60xoaZdt0mdcw3KjuQ.jpg" } // Reusing image
  ];

  // Adapt data for the new TestimonialsSection structure
  const newTestimonialsData = testimonialsData.map(t => ({
    author: {
      name: t.name,
      handle: `@${t.name.split(' ')[0].toLowerCase()}`, // Create a dummy handle
      avatar: t.src, // Use existing src for avatar
    },
    text: t.quote,
    // href: optional - add twitter link if available
  }));

  // Demo data for ProjectStatusCard
  const projectCardData = [
    { title: "Real-Time Engine v2", progress: 75, dueDate: "Aug 31, 2024", contributors: [{ name: "Alex" }, { name: "Sam", image: "/assets/figma/YkpUok2fGo3ld57plHxrpJnqs.jpg" }], tasks: [{ title: "Improve velocity detection", completed: true }, { title: "Add category filtering", completed: false }], githubStars: 102, openIssues: 5 },
    { title: "Slack Integration", progress: 100, dueDate: "Jul 15, 2024", contributors: [{ name: "Jordan", image: "/assets/figma/yQgwOMluRZbGnTNDvxzNruhpY0.jpg" }], tasks: [{ title: "Test notification flow", completed: true }, { title: "Deploy to production", completed: true }], githubStars: 45, openIssues: 0 }
  ];

  // Demo data for Pricing Component (Copied from demo file, adjust as needed)
  const demoPlans = [
    {
      name: "CREATOR",
      price: "19",
      yearlyPrice: "15",
      period: "per month",
      features: [
        "Real-time Alerts",
        "1 Niche Tracked",
        "Email Notifications",
        "Basic Trend Insights",
        "Community Access",
      ],
      description: "Essential alerts for solo creators",
      buttonText: "Get Started",
      href: "/signup",
      isPopular: false,
      isYellowButton: false, // Use default button style
    },
    {
      name: "PRO",
      price: "49",
      yearlyPrice: "39",
      period: "per month",
      features: [
        "Everything in Creator",
        "Up to 5 Niches Tracked",
        "Slack Integration",
        "Competitor Tracking",
        "Priority Support",
      ],
      description: "For serious creators & marketers",
      buttonText: "Choose Pro",
      href: "/signup?plan=pro",
      isPopular: true,
      isYellowButton: true, // Make popular button yellow
    },
    {
      name: "SCALE",
      price: "Contact",
      yearlyPrice: "Contact",
      period: "Custom",
      features: [
        "Everything in Pro",
        "Unlimited Niches",
        "API Access (Beta)",
        "Custom Integrations",
        "Dedicated Support",
      ],
      description: "Tailored for agencies & teams",
      buttonText: "Talk to Sales",
      href: "/contact",
      isPopular: false,
      isYellowButton: false,
    },
  ];

  // Animation variants for sections
  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    // Ensured background gradient exists
    <div className="bg-trendy-brown text-neutral-200 flex flex-col items-center w-full font-sans bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800/30 via-trendy-brown to-trendy-brown min-h-screen">
      {/* Ensured Header is fixed top-8 */}
      <header className="fixed top-8 z-50 px-4 w-full flex justify-center">
        {/* Background/blur applied back to nav */}
        <nav className="flex items-center justify-center gap-10 bg-trendy-brown/70 backdrop-blur-md rounded-[18px] shadow-lg shadow-black/30 p-3 border border-neutral-700/50 max-w-fit">
          <a
            href="#home"
            rel="noopener noreferrer"
            className="flex items-center space-x-2"
          >
            <img src="/Design/500x500-logos/Object Logo.png" alt="Trendy.bot Logo" className="h-8 w-auto" />
            <span className="font-orbitron font-bold text-2xl text-white">trendy</span>
          </a>
          <div className="flex gap-8 items-center font-orbitron text-sm">
            {/* Light text links, yellow hover */}
            <a href="#home" className="text-neutral-300 hover:text-trendy-yellow font-medium leading-6 transition-colors">Home</a>
            <a href="#features" className="text-neutral-400 hover:text-trendy-yellow font-medium leading-6 transition-colors">Features</a>
            <a href="/pricing" className="text-neutral-400 hover:text-trendy-yellow font-medium leading-6 transition-colors">Pricing</a>
            <a href="/contact" className="text-neutral-400 hover:text-trendy-yellow font-medium leading-6 transition-colors">Contact</a>
          </div>
          <a
            href="/signup"
            // Yellow button, dark text
            className="bg-trendy-yellow text-trendy-brown text-sm font-orbitron font-bold leading-6 px-8 py-2 rounded-[15px] shadow-md hover:bg-opacity-90 transition-opacity"
          >
            Get Alerts
          </a>
        </nav>
      </header>

      {/* Main Content Area: REMOVED margin-top */}
      <main className="w-full">
        {/* Hero Section: Adjusted top padding to compensate for header height + offset */}
        <section
          id="home"
          className="relative w-full min-h-[700px] md:min-h-[800px] flex flex-col items-center justify-center text-center overflow-hidden rounded-b-[60px] md:rounded-b-[100px] pt-28 md:pt-32 pb-20 md:pb-28" // Example padding, adjust if needed 
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
        >
           {/* Re-added blurred circle elements with yellow theme - increased opacity slightly */}
           <div className="absolute top-[-100px] left-[-200px] w-[1000px] h-[1000px] rounded-full border border-trendy-yellow/10 opacity-40 blur-[100px] bg-trendy-yellow/5"></div>
           <div className="absolute top-[50px] right-[-300px] w-[800px] h-[800px] rounded-full border border-trendy-yellow/10 opacity-30 blur-[120px] bg-trendy-yellow/5"></div>
           <div className="absolute bottom-[-150px] left-[50px] w-[1200px] h-[1200px] rounded-full border border-trendy-yellow/10 opacity-50 blur-[100px] bg-trendy-yellow/5"></div>

           {/* Replaced mail images with floating bells */}
           <img src="/assets/bell-emoji.svg" alt="" className="absolute top-[15%] left-[10%] w-[80px] h-auto opacity-40 blur-sm pointer-events-none animate-pulse" />
           <img src="/assets/bell-emoji.svg" alt="" className="absolute top-[50%] right-[15%] w-[50px] h-auto opacity-50 blur-xs pointer-events-none animate-pulse delay-500" />
           <img src="/assets/bell-emoji.svg" alt="" className="absolute bottom-[20%] left-[25%] w-[60px] h-auto opacity-30 blur-md pointer-events-none animate-pulse delay-1000" />

           <div className="relative z-10 flex flex-col items-center gap-8 px-4">
             {/* --- Added User Pills Div --- */} 
             <div className="flex items-center gap-4 bg-black/20 backdrop-blur-[5px] border border-neutral-700/50 rounded-full px-4 py-1 shadow-md">
               <div className="flex -space-x-3">
                 <img className="inline-block h-9 w-9 rounded-full border-2 border-trendy-brown object-cover shadow-md" src="/assets/figma/E3taK89otlzdIR6McZAxomrQPyo.png" alt="User 1"/>
                 <img className="inline-block h-9 w-9 rounded-full border-2 border-trendy-brown object-cover shadow-md" src="/assets/figma/f83c9nwlZghmsOqr5KiPD7NpS1I.png" alt="User 2"/>
                 <img className="inline-block h-9 w-9 rounded-full border-2 border-trendy-brown object-cover shadow-md" src="/assets/figma/UaeMNaCCtVrxQXhyIzZB7ihAs.png" alt="User 3"/>
               </div>
               <p className="text-neutral-300 font-inter text-sm md:text-base leading-snug">6,000+ people use our product</p> 
             </div>
             {/* --- End User Pills Div --- */}

             {/* Headline: Orbitron font, large, light text, maybe yellow span */}
             <h1 className="font-orbitron font-black text-6xl md:text-8xl lg:text-9xl leading-tight text-white">
               Spot Viral Shorts<br />
               <span className="text-trendy-yellow">Instantly.</span>
             </h1>
             {/* Subheadline: Light text */}
             <p className="text-base md:text-lg leading-relaxed text-neutral-300 max-w-lg font-normal">
               Real-time YouTube Shorts trend detection. React fast, recreate winning formats, and grow quicker.
             </p>
             <div className="flex flex-col sm:flex-row gap-4 mt-4">
               {/* Primary Button: Yellow */}
               <a
                 href="/signup"
                 className="bg-trendy-yellow text-trendy-brown text-lg md:text-xl font-orbitron font-bold leading-normal px-12 py-4 rounded-[18px] shadow-lg hover:bg-opacity-90 transition-opacity transform hover:scale-105"
               >
                 Get Instant Alerts
               </a>
               {/* Secondary Button: Dark bg */}
               <a
                 href="#features"
                 className="bg-neutral-700/50 backdrop-blur-[2px] text-white text-lg md:text-xl font-orbitron font-medium leading-normal px-12 py-4 rounded-[18px] shadow-md border border-neutral-600/50 hover:bg-neutral-600/70 transition-colors"
               >
                 Learn More
               </a>
             </div>
           </div>
           {/* Removed decorative vectors */}
           {/* 
           <img src="/assets/figma/Vector_1_92.svg" alt="" className="absolute bottom-0 left-0 w-[15%] h-auto opacity-40 pointer-events-none filter invert brightness-150 sepia-[.2] hue-rotate-[10deg]" />
           <img src="/assets/figma/Vector_1_99.svg" alt="" className="absolute bottom-0 right-0 w-[10%] h-auto opacity-40 pointer-events-none filter invert brightness-150 sepia-[.2] hue-rotate-[10deg]" /> 
           */}
        </section>

        {/* Features Section: Dark cards, light text */}
        <motion.section 
          id="features" 
          className="py-20 md:py-28 px-4 flex flex-col items-center text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
          <div className="max-w-xl mb-12">
            {/* Heading: Orbitron, light text, yellow highlight */}
            <h2 className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-4">
              Why <span className="text-trendy-yellow">Trendy.bot?</span>
            </h2>
            {/* Text: Light */}
            <p className="text-base md:text-lg text-neutral-400 mb-12">
              Stop scrolling endlessly. Start creating strategically with real-time trend insights delivered directly to you. Here's how Trendy.bot helps:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl">
            {/* Feature Card 1: Dark bg, dark border */}
            <div className="bg-neutral-800/50 rounded-[40px] md:rounded-[50px] shadow-lg overflow-hidden border border-neutral-700/60">
              {/* Header: Dark gradient or solid color */}
              <div className="h-52 md:h-60 bg-gradient-to-b from-neutral-700/50 to-neutral-900/50 flex items-center justify-center p-8 relative">
                 {/* Icons: Adjust color/opacity for dark bg */}
                 <div className="flex items-center justify-center opacity-60">
                   <img src="/assets/figma/Vector_1_703.svg" alt="Real-time Icon" className="w-16 h-16 filter invert brightness-200"/> 
                 </div>
              </div>
              {/* Body: Light text */}
              <div className="p-6 md:p-8">
                <h3 className="font-orbitron text-xl text-white mb-2">Real-Time Detection</h3>
                <p className="text-neutral-400 text-sm md:text-base">
                  Spot viral YouTube Shorts the moment they start breaking out in your specific niche.
                </p>
              </div>
            </div>
            {/* Feature Card 2: Dark bg, dark border */}
            <div className="bg-neutral-800/50 rounded-[40px] md:rounded-[50px] shadow-lg overflow-hidden border border-neutral-700/60">
              {/* Header: Dark gradient or solid color */}
              <div className="h-52 md:h-60 bg-gradient-to-b from-neutral-700/50 to-neutral-900/50 flex items-center justify-center p-8 relative">
                 <div className="flex items-center justify-center opacity-60">
                    <img src="/assets/figma/Vector_1_690.svg" alt="Alert Icon" className="w-16 h-16 filter invert brightness-200"/>
                 </div>
                 <div className="absolute top-4 right-4 bg-trendy-yellow/80 text-trendy-brown rounded-md p-1 px-2 text-xs shadow-lg font-semibold">No Dashboards!</div>
                </div>
              {/* Body: Light text */}
              <div className="p-6 md:p-8">
                <h3 className="font-orbitron text-xl text-white mb-2">Instant Alerts</h3>
                <p className="text-neutral-400 text-sm md:text-base">
                  No dashboards to monitor. Get notified immediately when a trend takes off.
                </p>
              </div>
            </div>
             {/* Feature Card 3: Dark bg, dark border */}
             <div className="bg-neutral-800/50 rounded-[40px] md:rounded-[50px] shadow-lg overflow-hidden border border-neutral-700/60">
              {/* Header: Dark gradient or solid color */}
              <div className="h-52 md:h-60 bg-gradient-to-b from-neutral-700/50 to-neutral-900/50 flex items-center justify-center p-8 relative">
                 {/* Using original image path, added filter */}
                 <img src="/assets/figma/Vector_1_709.svg" alt="Growth Icon" className="w-16 h-16 filter invert brightness-200"/> 
              </div>
              {/* Body: Light text */}
              <div className="p-6 md:p-8">
                 <h3 className="font-orbitron text-xl text-white mb-2">Grow Faster</h3>
                 <p className="text-neutral-400 text-sm md:text-base">
                   React quickly, recreate winning video formats, and capture audience attention before the trend fades.
                 </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Categorization Section: Darker bg */}
        <section className="py-16 px-4 relative bg-gradient-radial from-neutral-800/30 to-trendy-brown rounded-[36px] md:rounded-[48px] border border-neutral-700/40 flex flex-col items-center text-center overflow-hidden mx-4">
           {/* Adjusted background elements */}
           <div className="absolute -top-20 -left-20 w-[518px] h-[518px] rounded-full border border-trendy-yellow/10 blur-[80px] opacity-30"></div>
           <div className="absolute -bottom-40 -right-30 w-[700px] h-[700px] rounded-full border border-trendy-yellow/10 opacity-40"></div>

          {/* Text: Lighter */}
          <p className="text-sm md:text-base font-orbitron font-bold text-neutral-500 tracking-widest mb-4">YOUR NICHE, REAL-TIME</p>
          {/* Heading: Orbitron, light text */}
          <h2 className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-12">
            Focus on What Matters.<br /> <span className="text-trendy-yellow">Act Instantly.</span>
          </h2>
          {/* Removed floating tags, replace with simple text or graphic */}
          <div className="relative w-full max-w-2xl h-32 md:h-40 flex items-center justify-center">
             <p className="text-neutral-400 text-lg md:text-xl italic">"Trendy.bot gives us the speed we need to stay relevant on Shorts."</p>
             {/* Optional: Add a small related graphic */} 
        </div>
      </section>

        {/* --- REMADE: Feature Visual Section (No Cards) --- */}
        <motion.section 
          className="py-20 md:py-28 px-4 flex flex-col items-center text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
           <h2 className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-6">
             Skip the Dashboard. <span className="text-trendy-yellow">Get the Alert.</span>
            </h2>
           <p className="text-base md:text-lg text-neutral-400 max-w-2xl mb-12">
             Trendy.bot cuts through the noise, delivering real-time trend notifications directly to your workflow when it matters most. Focus on creating, not hunting.
           </p>

           {/* Layout with icons and text */}
           <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
              {/* Item 1: Real-time Icon */}
              <div className="flex flex-col items-center gap-4">
                 {/* Placeholder - Replace with relevant icon if available */}
                 <svg className="w-16 h-16 text-trendy-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <h4 className="font-orbitron text-xl text-white font-semibold">Always On</h4>
                 <p className="text-neutral-400 text-sm">Our system continuously monitors YouTube for emerging Shorts trends in your niche.</p>
              </div>

               {/* Item 2: Alert Icon */}
               <div className="flex flex-col items-center gap-4">
                  {/* Placeholder - Replace with relevant icon */}
                  <svg className="w-16 h-16 text-trendy-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                  <h4 className="font-orbitron text-xl text-white font-semibold">Instant Alerts</h4>
                  <p className="text-neutral-400 text-sm">Get notified via Slack or Email the moment a relevant trend is detected.</p>
               </div>

               {/* Item 3: Growth Icon */}
               <div className="flex flex-col items-center gap-4">
                  {/* Placeholder - Replace with relevant icon */}
                   <svg className="w-16 h-16 text-trendy-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                  <h4 className="font-orbitron text-xl text-white font-semibold">Faster Growth</h4>
                  <p className="text-neutral-400 text-sm">Leverage timely insights to create content that resonates and captures audience attention.</p>
               </div>
           </div>
        </motion.section>

        {/* --- Added DatabaseWithRestApi Demo Section --- */}
        <motion.section 
          className="py-20 md:py-28 px-4 flex flex-col items-center text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
           <div className="relative z-10 flex flex-col items-center text-center mb-12 md:mb-16 max-w-3xl mx-auto">
             <h2 className="text-4xl md:text-5xl font-orbitron font-semibold text-white leading-tight mb-4">
               Powered by <span className="text-trendy-yellow">Real-Time Data</span>
             </h2>
             <p className="text-base md:text-lg text-neutral-400">Our backend continuously monitors trends.</p>
          </div>
           <DatabaseWithRestApi 
             title="Trendy.bot Data Engine" 
             circleText="BOT"
             lightColor="#F6D44C" // Explicitly set yellow
             buttonTexts={{ first: "Fast", second: "Reliable" }}
             badgeTexts={{ first: "Views", second: "Likes", third: "Shares", fourth: "Velocity" }}
            />
        </motion.section>
        
        {/* Testimonials Section: Replaced with TestimonialsSection */}
        <motion.section 
          className="relative py-20 md:py-28 px-4 w-full"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }} // Trigger sooner for wide component
          variants={sectionVariants}
        >
          <TestimonialsSection
            title="Creators React Faster with Trendy.bot"
            description="Hear from creators leveraging real-time trend alerts."
            testimonials={newTestimonialsData}
          />
        </motion.section>

        {/* Call to Action Section (Old One): Reduced bottom padding */}
        <motion.section 
          className="pt-20 md:pt-28 pb-10 md:pb-16 mx-4 bg-neutral-800/60 backdrop-blur-md rounded-[40px] md:rounded-[50px] p-10 md:p-16 flex flex-col items-center text-center shadow-lg border border-neutral-700/40 relative overflow-hidden"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
          {/* Background Images Removed */}
          {/* 
          <img src="/assets/figma/Ek4jm9XYBkfc95qizgGu7WuXk.png" alt="" className="absolute -top-10 -left-10 w-24 md:w-32 h-auto opacity-20 transform rotate-12 pointer-events-none"/>
          <img src="/assets/figma/dxazM98wV4jrpKqeSjDoAvintYI.png" alt="" className="absolute -bottom-12 -right-5 w-32 md:w-40 h-auto opacity-30 transform -rotate-15 pointer-events-none"/>
          <img src="/assets/figma/0HmAIeahJK92x7YFwiWVTB2JBV4.png" alt="" className="absolute top-1/2 -right-10 md:-right-20 w-28 md:w-36 h-auto opacity-25 transform -translate-y-1/2 rotate-6 pointer-events-none"/>
          */}

          <h2 className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-4">
            Catch the Next <br /> <span className="text-trendy-yellow">Viral Wave</span>
          </h2>
          {/* Text: Light */}
          <p className="text-base md:text-lg text-neutral-400 max-w-md mb-8">
            Stop missing out on breakout Shorts. Get real-time alerts and the insights you need to grow faster.
          </p>
          {/* Button: Yellow */}
          <a
             href="/signup"
             className="bg-trendy-yellow text-trendy-brown text-base md:text-lg font-orbitron font-bold px-8 py-3 rounded-2xl shadow-md hover:bg-opacity-90 transition-opacity transform hover:scale-105"
          >
             Get Started with Trendy.bot
          </a>
        </motion.section>

        {/* CTASection Demo - Apply motion directly? Or wrap? Wrapping for consistency */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        > 
          <CTASection
            className="pt-8 md:pt-12 pb-12 md:pb-20 px-4" 
            title="Ready to Outsmart the Algorithm?"
            description="Get started with Trendy.bot today and never miss a viral YouTube Short again."
            action={{
              text: "Start Free Trial Now",
              href: "/signup",
              isYellow: true 
            }}
          />
        </motion.div>

        {/* Integrations Section: Reduced top padding */}
        <section className="pt-10 md:pt-16 pb-20 md:pb-28 px-4 flex flex-col items-center text-center">
           {/* Heading: Orbitron, light text */}
           <h2 className="text-4xl md:text-6xl font-orbitron font-bold text-white leading-tight mb-4">
             Integrates with
           </h2>
           <h2 className="text-4xl md:text-6xl font-orbitron font-bold text-white leading-tight mb-12 md:mb-16">
             <span className="text-trendy-yellow">your workflow</span>...
           </h2>
           {/* Icon Cloud: Darker bg */}
           <div className="relative w-full max-w-5xl h-80 md:h-96 flex items-center justify-center">
              {/* Icons: Using original paths, wrap in dark bg circle, added filter */}
              {[ 
                { src: "/assets/figma/Vector_1_660.svg", pos: "top-[10%] left-[15%]", size: "h-12 w-12 md:h-16 md:w-16", padding: "p-5 md:p-8" },
                { src: "/assets/figma/Vector_1_666.svg", pos: "top-[20%] right-[10%]", size: "h-10 w-10 md:h-14 md:w-14", padding: "p-4 md:p-7" },
                { src: "/assets/figma/Vector_1_672.svg", pos: "bottom-[15%] left-[25%]", size: "h-8 w-8 md:h-12 md:w-12", padding: "p-4 md:p-6" },
                { src: "/assets/figma/Vector_1_684.svg", pos: "bottom-[10%] right-[20%]", size: "h-12 w-12 md:h-16 md:w-16", padding: "p-5 md:p-8" },
                { src: "/assets/figma/Vector_1_696.svg", pos: "top-[50%] left-[45%] transform -translate-x-1/2 -translate-y-1/2", size: "h-16 w-16 md:h-20 md:w-20", padding: "p-6 md:p-9" },
                { src: "/assets/figma/Vector_1_678.svg", pos: "top-[5%] right-[30%]", size: "h-6 w-6 md:h-8 md:w-8", padding: "p-3 md:p-4" },
                { src: "/assets/figma/Vector_1_690.svg", pos: "bottom-[5%] left-[10%]", size: "h-6 w-6 md:h-8 md:w-8", padding: "p-3 md:p-4" },
                { src: "/assets/figma/Vector_1_703.svg", pos: "bottom-[40%] right-[5%]", size: "h-8 w-8 md:h-10 md:w-10", padding: "p-4 md:p-5" },
                { src: "/assets/figma/Vector_1_709.svg", pos: "top-[35%] left-[5%]", size: "h-8 w-8 md:h-10 md:w-10", padding: "p-4 md:p-5" },
              ].map((icon, index) => (
                <div key={index} className={`absolute ${icon.pos} bg-gradient-to-b from-neutral-700/50 to-neutral-800/50 rounded-full shadow-lg ${icon.padding} border border-neutral-600/50 flex items-center justify-center`}>
                  <img src={icon.src} alt={`Tool ${index + 1}`} className={`${icon.size} filter invert brightness-150 opacity-80`} />
          </div>
              ))}
        </div>
             <p className="text-neutral-500 mt-8">(Slack, Email, Webhooks, more coming soon)</p>
      </section>

        {/* FAQ Section: Updated Icons */}
        <section className="py-20 md:py-28 px-4 flex flex-col items-center text-center">
           <h2 className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-4">
             Frequently asked <br/> <span className="text-trendy-yellow">questions</span>
            </h2>
           <p className="text-base md:text-lg text-neutral-400 mb-12 max-w-md">
             Got questions? We've got the answers to help you get started smoothly.
           </p>
           <div className="w-full max-w-3xl space-y-4">
             {[
               { q: "How does Trendy.bot detect trends?", a: "We analyze YouTube Shorts view velocity, engagement signals, and niche relevance in real-time to identify videos gaining abnormal traction." }, 
               { q: "What kind of alerts do I get?", a: "You receive instant notifications via your chosen method (like Slack or Email) with details about the trending Short and its performance." }, 
               { q: "Is there a dashboard?", a: "No! Trendy.bot is designed for speed. We skip the complex dashboards and send alerts directly, so you can act fast." }, 
               { q: "Can I track specific competitors?", a: "Yes, you can define specific channels or keywords related to competitors to monitor their breakout content." }, 
             ].map((faq, index) => (
                <details key={index} className="group bg-gradient-to-b from-neutral-800/60 to-neutral-900/60 rounded-2xl shadow-md border border-neutral-700/50 p-5 md:p-6 transition duration-300 ease-in-out">
                   <summary className="flex justify-between items-center font-orbitron font-medium text-white text-base md:text-lg cursor-pointer list-none">
                     <span>{faq.q}</span>
                     {/* Replaced img with Plus icon and rotation */}
                     <span className="transition-transform duration-300 group-open:rotate-45">
                       <Plus className="w-5 h-5 text-trendy-yellow"/> 
                     </span>
                   </summary>
                   <p className="text-neutral-400 text-sm md:text-base mt-3 text-left group-open:animate-fadeIn">
                     {faq.a}
                   </p>
                 </details>
             ))}
          </div>
        </section>

        {/* Pricing Section (uses demoPlans with updated hrefs) */}
        <motion.div 
          className="w-full flex justify-center px-4"
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={sectionVariants}
        > 
           <Pricing plans={demoPlans} className="py-20 md:py-28 px-4" />
        </motion.div>

      </main>

      {/* Footer Redesign */}
      <footer className="w-full bg-neutral-900/70 border-t border-neutral-700/50 backdrop-blur-sm text-neutral-400 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Column 1: Logo and Description */}
            <div className="md:col-span-1 flex flex-col items-center md:items-start text-center md:text-left">
              <img src="/Design/500x500-logos/Object Logo.png" alt="Trendy.bot Logo" className="h-12 w-auto mb-4" />
              <p className="text-sm leading-relaxed">
                Real-time YouTube Shorts trend detection to help creators and marketers grow faster.
              </p>
            </div>
            
            {/* Column 2-4: Links (Centering on small screens) */}
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-8 text-center md:text-left">
              <div>
                <h4 className="text-base font-orbitron font-semibold text-white mb-4">Menu</h4>
                <ul className="space-y-2">
                  <li><a href="#home" className="text-sm hover:text-trendy-yellow transition-colors">Home</a></li>
                  <li><a href="#features" className="text-sm hover:text-trendy-yellow transition-colors">Features</a></li>
                  <li><a href="/pricing" className="text-sm hover:text-trendy-yellow transition-colors">Pricing</a></li>
                  <li><a href="/contact" className="text-sm hover:text-trendy-yellow transition-colors">Contact</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-orbitron font-semibold text-white mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-sm hover:text-trendy-yellow transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="text-sm hover:text-trendy-yellow transition-colors">Terms of Service</a></li>
                </ul>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <h4 className="text-base font-orbitron font-semibold text-white mb-4">Social Media</h4>
                <div className="flex gap-4 justify-center md:justify-start">
                  {/* Social Icons (No filters) */}
                  <a href="#" className="text-neutral-500 hover:text-trendy-yellow transition-colors"><img src="/assets/figma/Vector_1_1127.svg" alt="Social 1" className="w-6 h-6"/></a>
                  <a href="#" className="text-neutral-500 hover:text-trendy-yellow transition-colors"><img src="/assets/figma/Vector_1_1133.svg" alt="Social 2" className="w-6 h-6"/></a>
                  <a href="#" className="text-neutral-500 hover:text-trendy-yellow transition-colors"><img src="/assets/figma/Vector_1_1138.svg" alt="Social 3" className="w-6 h-6"/></a>
          </div>
        </div>
            </div>
          </div>
          {/* Copyright - Centered */}
          <div className="text-center text-xs text-neutral-600 pt-8 border-t border-neutral-700/50">
             &copy; {new Date().getFullYear()} Trendy.bot. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
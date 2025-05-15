import React from 'react';
import { motion } from 'framer-motion';
import { CTASection } from '../components/ui/cta-section';
import DatabaseWithRestApi from '../components/ui/database-with-rest-api'; // Keep for "Data Engine"
import { Plus, Search, Users, Filter, BarChart3, Target, Lightbulb, Zap, LayoutDashboard, Menu, TrendingUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Import existing assets (will reuse some)
import objectLogo from "@/assets/design-logos/object-logo.png";
import userPfp1 from "@/assets/landing/12.jpg";
import userPfp2 from "@/assets/landing/24.jpg";
import userPfp3 from "@/assets/landing/54.jpg";
import dashboardMockup from "@/assets/landing/dashboard-mockup.png";
import backgroundImage from "@/assets/landing/BackGround.jpg";

const LandingPage: React.FC = () => {
  const testimonialsData = [
    { quote: "Trendy.bot's research dashboard is a goldmine! I can finally see what my competitors are doing and find video ideas backed by data.", name: "Alex Chen", designation: "Content Strategist", src: userPfp1 },
    { quote: "The filtering capabilities are insane. I can pinpoint exactly the type of high-performing content I need to analyze for my niche.", name: "Maria Rodriguez", designation: "YouTube Growth Hacker", src: userPfp2 },
    { quote: "No more flying blind. Understanding channel dynamics and content trends in my groups has been a game-changer for my content planning.", name: "Sam 'The Niche' King", designation: "Gaming Channel Owner", src: userPfp3 },
  ];

  const newTestimonialsData = testimonialsData.map(t => ({
    author: {
      name: t.name,
      handle: `@${t.name.split(' ')[0].toLowerCase()}`,
      avatar: t.src,
    },
    text: t.quote,
  }));

  const sectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.2 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="relative bg-trendy-brown text-neutral-200 flex flex-col items-center w-full font-sans bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800/30 via-trendy-brown/50 to-trendy-brown/70 min-h-screen overflow-x-hidden">
      {/* Background Image - Restoring parent BG with transparency, adjusting image opacity */}
      <img 
        src={backgroundImage} 
        alt="Abstract background" 
        className="absolute inset-0 w-full h-full object-cover opacity-50 -z-10 pointer-events-none" // Adjusted opacity
      />

      <header className="fixed top-4 md:top-8 z-50 px-2 sm:px-4 w-full flex justify-center">
        <nav className="flex items-center justify-between sm:justify-center gap-2 sm:gap-6 md:gap-10 bg-trendy-brown/70 backdrop-blur-md rounded-[18px] shadow-lg shadow-black/30 p-2.5 md:p-3 border border-neutral-700/50 w-full max-w-xs sm:max-w-sm md:max-w-fit">
          <a href="#home" className="flex items-center space-x-1.5 md:space-x-2">
            <img src={objectLogo} alt="Trendy.bot Logo" className="h-7 md:h-8 w-auto" />
            <span className="font-orbitron font-bold text-lg md:text-2xl text-white">trendy</span>
          </a>
          <div className="hidden sm:flex items-center gap-3 md:gap-8 font-orbitron text-xs md:text-sm">
            <a href="#home" className="text-neutral-300 hover:text-trendy-yellow font-medium leading-6 transition-colors">Home</a>
            <a href="#features" className="text-neutral-400 hover:text-trendy-yellow font-medium leading-6 transition-colors">Features</a>
            <a href="/contact" className="hidden md:block text-neutral-400 hover:text-trendy-yellow font-medium leading-6 transition-colors">Contact</a>
          </div>
          <a href="/signup" className="bg-trendy-yellow text-trendy-brown text-xs sm:text-sm font-orbitron font-bold leading-normal px-4 py-1.5 sm:px-6 md:px-8 sm:py-2 rounded-[12px] md:rounded-[15px] shadow-md hover:bg-opacity-90 transition-opacity whitespace-nowrap">
            Sign Up
          </a>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-neutral-700">
                  <Menu className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-neutral-800 border-neutral-700 text-neutral-200 w-48 mr-2">
                <DropdownMenuItem onSelect={() => window.location.hash = '#home'} className="hover:bg-neutral-700 focus:bg-neutral-700">Home</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.location.hash = '#features'} className="hover:bg-neutral-700 focus:bg-neutral-700">Features</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.location.pathname = '/contact'} className="hover:bg-neutral-700 focus:bg-neutral-700">Contact</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </header>

      <main className="w-full">
        {/* Hero Section */}
        <motion.section
          id="home"
          className="relative w-full min-h-[75vh] md:min-h-[85vh] flex flex-col items-center justify-center text-center overflow-hidden rounded-b-[60px] md:rounded-b-[100px] pt-32 pb-20"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="absolute inset-0 opacity-30">
             <div className="absolute top-[-100px] left-[-200px] w-[1000px] h-[1000px] rounded-full border border-trendy-yellow/10 blur-[100px] bg-trendy-yellow/5"></div>
             <div className="absolute top-[50px] right-[-300px] w-[800px] h-[800px] rounded-full border border-trendy-yellow/10 blur-[120px] bg-trendy-yellow/5"></div>
          </div>
          
          <div className="relative z-10 flex flex-col items-center gap-8 px-4">
            <motion.div variants={itemVariants} className="flex items-center gap-3 bg-black/20 backdrop-blur-[5px] border border-neutral-700/50 rounded-full px-4 py-2 shadow-md">
              <div className="flex -space-x-3">
                <img className="inline-block h-8 w-8 rounded-full border-2 border-trendy-brown object-cover shadow-md" src={userPfp1} alt="User"/>
                <img className="inline-block h-8 w-8 rounded-full border-2 border-trendy-brown object-cover shadow-md" src={userPfp2} alt="User"/>
                <img className="inline-block h-8 w-8 rounded-full border-2 border-trendy-brown object-cover shadow-md" src={userPfp3} alt="User"/>
              </div>
              <p className="text-neutral-300 font-inter text-sm">Join smart creators analyzing their niche!</p>
            </motion.div>

            <motion.h1 variants={itemVariants} className="font-orbitron font-black text-5xl md:text-7xl lg:text-8xl leading-tight text-white">
              Dominate Your Niche. <br /> Start tracking.
            </motion.h1>
            <motion.p variants={itemVariants} className="text-base md:text-lg leading-relaxed text-neutral-300 max-w-2xl font-normal">
              Deep dive into niche analytics, competitor strategies, and content goldmines with the ultimate YouTube Research Dashboard.
            </motion.p>
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 mt-6">
              <a href="#features" className="bg-trendy-yellow text-trendy-brown text-lg font-orbitron font-bold px-10 py-3.5 rounded-[18px] shadow-lg hover:bg-opacity-90 transition-opacity transform hover:scale-105">
                Explore Features
              </a>
              <a href="/signup" className="bg-neutral-700/50 backdrop-blur-[2px] text-white text-lg font-orbitron font-medium px-10 py-3.5 rounded-[18px] shadow-md border border-neutral-600/50 hover:bg-neutral-600/70 transition-colors">
                Sign Up Free
              </a>
            </motion.div>
          </div>
        </motion.section>

        {/* Intro Problem/Solution with Visual */}
        <motion.section 
          className="py-20 md:py-28 px-4 text-center"
          variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        >
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-6">
            Tired of Guesswork? <span className="text-trendy-yellow">Discover with Data.</span>
          </motion.h2>
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-neutral-400 max-w-3xl mx-auto mb-12">
            Stop scrolling endlessly for content ideas. Pinpoint high-performing videos, analyze competitor tactics, and understand niche dynamics with unparalleled precision. Trendy.bot's Research Dashboard empowers you to create with confidence.
          </motion.p>
          <motion.div 
            variants={itemVariants} 
            className="flex justify-center items-center space-x-6 md:space-x-10 text-trendy-yellow/70"
          >
            <Search size={48} strokeWidth={1.5} className="opacity-80"/>
            <div className="flex flex-col items-center">
                <TrendingUp size={64} strokeWidth={1.5} className="mb-2"/>
                <p className="text-xs text-neutral-500">Find Growth</p>
            </div>
            <Lightbulb size={48} strokeWidth={1.5} className="opacity-80"/>
          </motion.div>
        </motion.section>

        {/* Core Features Section */}
        <motion.section 
          id="features" 
          className="py-12 md:py-20 px-4"
          variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
        >
          <div className="text-center mb-16 md:mb-20">
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight">
              Your Command Center for <span className="text-trendy-yellow">Niche Domination</span>
            </motion.h2>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
            {[
              { 
                icon: <BarChart3 className="w-12 h-12 text-trendy-yellow mb-4"/>, 
                title: "Competitor Channel Intelligence", 
                desc: "Go beyond surface-level stats. Track channel performance over various time frames, compare key metrics (subscribers, views on new content, engagement rates), and identify top players in your niche groups."
              },
              { 
                icon: <Filter className="w-12 h-12 text-trendy-yellow mb-4"/>, 
                title: "Granular Content Discovery", 
                desc: "Sift through thousands of videos with surgical precision. Our advanced f ilters (by views, likes, comments, engagement, duration, publish date, and more!) help you uncover viral patterns and content goldmines."
              },
              { 
                icon: <Users className="w-12 h-12 text-trendy-yellow mb-4"/>, 
                title: "Laser-Focused Niche Groups", 
                desc: "Organize your research by creating custom Niche Groups. Focus your analysis on the channels and content types that matter most to you, eliminating noise and saving valuable time."
              },
              { 
                icon: <Lightbulb className="w-12 h-12 text-trendy-yellow mb-4"/>, 
                title: "Actionable Insights, Not Just Data", 
                desc: "Understand what your data means. Identify what content resonates, how top channels structure their videos, and spot opportunities to innovate and stand out in your niche."
              }
            ].map((feature, index) => (
              <motion.div 
                key={index} 
                variants={itemVariants}
                className="bg-neutral-800/50 p-8 rounded-[30px] shadow-xl border border-neutral-700/60 flex flex-col items-center text-center md:items-start md:text-left"
              >
                {feature.icon}
                <h3 className="font-orbitron text-2xl text-white mb-3 font-semibold">{feature.title}</h3>
                <p className="text-neutral-400 text-md leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
        
        {/* Visual Feature: Dashboard Mockup Area - UPDATED */}
        <motion.section
          className="py-20 md:py-28 px-4 flex flex-col items-center text-center"
          variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        >
            <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-6">
                Visualize Your <span className="text-trendy-yellow">Path to Growth.</span>
            </motion.h2>
            <motion.p variants={itemVariants} className="text-lg text-neutral-400 max-w-2xl mx-auto mb-12">
                Our intuitive dashboard puts powerful analytics at your fingertips. Clean, actionable, and built for speed.
            </motion.p>
            <motion.div variants={itemVariants} className="w-full max-w-5xl bg-neutral-800/50 border-2 border-trendy-yellow/30 rounded-[20px] shadow-2xl flex items-center justify-center aspect-video overflow-hidden">
                <img 
                    src={dashboardMockup} 
                    alt="Trendy.bot Research Dashboard Mockup" 
                    className="object-cover w-full h-full rounded-[12px]"
                />
            </motion.div>
        </motion.section>


        {/* How It Works Section */}
        <motion.section 
          className="py-20 md:py-28 px-4 text-center"
          variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        >
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-16">
            Get Started in <span className="text-trendy-yellow">3 Simple Steps</span>
          </motion.h2>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { num: "01", title: "Sign Up", desc: "Quick and easy registration to unlock the dashboard." },
              { num: "02", title: "Define Your Niche", desc: "Create custom channel groups to focus your research." },
              { num: "03", title: "Research & Discover", desc: "Dive into powerful analytics and find your next hit." }
            ].map((step, index) => (
              <motion.div key={index} variants={itemVariants} className="flex flex-col items-center">
                <div className="bg-trendy-yellow text-trendy-brown font-orbitron font-bold text-2xl w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg">{step.num}</div>
                <h3 className="font-orbitron text-xl text-white mb-2 font-semibold">{step.title}</h3>
                <p className="text-neutral-400 text-md">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
        
        {/* Data Engine Section */}
        <motion.section 
          className="py-20 md:py-28 px-4 flex flex-col items-center text-center"
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={sectionVariants}
        >
           <motion.div variants={itemVariants} className="relative z-10 flex flex-col items-center text-center mb-12 md:mb-16 max-w-3xl mx-auto">
             <h2 className="text-4xl md:text-5xl font-orbitron font-semibold text-white leading-tight mb-4">
               Powered by a <span className="text-trendy-yellow">Robust Data Engine</span>
             </h2>
             <p className="text-base md:text-lg text-neutral-400">Our backend continuously analyzes millions of data points to bring you the freshest insights.</p>
          </motion.div>
           <motion.div variants={itemVariants}>
             <DatabaseWithRestApi 
               title="Trendy.bot Analytics Core" 
               circleText="AI"
               lightColor="#F6D44C"
               buttonTexts={{ first: "Fast", second: "Scalable" }}
               badgeTexts={{ first: "Views", second: "ER", third: "Trends", fourth: "Velocity" }}
              />
           </motion.div>
        </motion.section>

        {/* Testimonials Section - REPLACED with static display */}
        <motion.section 
          className="py-20 md:py-28 px-4 w-full text-center"
          variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
        >
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-6">
            Trusted by Smart Creators & Marketers
          </motion.h2>
          <motion.p variants={itemVariants} className="text-lg text-neutral-400 max-w-2xl mx-auto mb-12 md:mb-16">
            Hear how Trendy.bot is transforming their YouTube strategy.
          </motion.p>
          <motion.div 
            variants={itemVariants} 
            className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10"
          >
            {newTestimonialsData.slice(0, 3).map((testimonial, index) => (
              <div key={index} className="bg-neutral-800/60 border border-neutral-700/50 rounded-2xl p-6 shadow-lg flex flex-col items-center text-center">
                <img src={testimonial.author.avatar} alt={testimonial.author.name} className="w-20 h-20 rounded-full mb-4 border-2 border-trendy-yellow/50"/>
                <p className="text-neutral-300 italic mb-4 leading-relaxed text-md">"{testimonial.text}"</p>
                <h4 className="font-orbitron text-lg font-semibold text-white">{testimonial.author.name}</h4>
                <p className="text-sm text-neutral-500">{testimonial.author.handle}</p>
              </div>
            ))}
          </motion.div>
        </motion.section>

        {/* FAQ Section - Reduced bottom margin/padding */}
        <motion.section 
          className="py-20 md:pt-28 md:pb-20 px-4 flex flex-col items-center text-center" // Reduced bottom padding
          variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        >
           <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-orbitron font-bold text-white leading-tight mb-4">
             Frequently Asked <span className="text-trendy-yellow">Questions</span>
            </motion.h2>
           <motion.p variants={itemVariants} className="text-base md:text-lg text-neutral-400 mb-12 max-w-md mx-auto">
             Your questions, answered.
           </motion.p>
           <motion.div variants={itemVariants} className="w-full max-w-3xl space-y-4">
             {[
               { q: "What kind of data can I see in the Research Dashboard?", a: "You can see detailed channel statistics (subs, views on new content, engagement), and individual video metrics (views, likes, comments, ER, duration, publish date). Powerful filters let you narrow down to specific content." }, 
               { q: "How do Niche Groups work?", a: "You create groups of YouTube channels that define your specific niches. All dashboard analytics can then be focused on these curated groups, giving you highly relevant insights." }, 
               { q: "Is this for Shorts, long-form, or both?", a: "The dashboard is designed to analyze any public YouTube video data, making it useful for both Shorts and long-form content research within your defined niches." },
               { q: "Will you offer trend alerts?", a: "Our powerful research dashboard is the foundation! We are actively developing intelligent alert systems based on the insights and patterns you can uncover, to notify you about significant movements in your niche." }
             ].map((faq, index) => (
                <details key={index} className="group bg-gradient-to-b from-neutral-800/60 to-neutral-900/60 rounded-2xl shadow-md border border-neutral-700/50 p-5 md:p-6 transition duration-300 ease-in-out">
                   <summary className="flex justify-between items-center font-orbitron font-medium text-white text-base md:text-lg cursor-pointer list-none">
                     <span>{faq.q}</span>
                     <span className="transition-transform duration-300 group-open:rotate-45">
                       <Plus className="w-5 h-5 text-trendy-yellow"/> 
                     </span>
                   </summary>
                   <p className="text-neutral-400 text-sm md:text-base mt-3 text-left group-open:animate-fadeIn">
                     {faq.a}
                   </p>
                 </details>
             ))}
          </motion.div>
        </motion.section>

        {/* Final CTA Section - Adjusted top margin to control spacing */}
        <motion.div
          className="mt-0" 
          variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
        >
          <CTASection
            className="pt-12 pb-0 px-4" 
            title="Ready to Dominate Your Niche?"
            description="Gain the analytical edge you need. Sign up for Trendy.bot and transform your YouTube research process today."
            action={{ text: "Get Started Now", href: "/signup", isYellow: true }}
          />
        </motion.div>
      </main>

      {/* Footer - Adjusted top margin */}
      <footer className="w-full bg-neutral-900/70 border-t border-neutral-700/50 backdrop-blur-sm text-neutral-400 mt-0">
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-1 flex flex-col items-center md:items-start text-center md:text-left">
              <img src={objectLogo} alt="Trendy.bot Logo" className="h-10 w-auto mb-4" />
              <p className="text-sm leading-relaxed">
                Advanced YouTube analytics for serious creators and marketers.
              </p>
            </div>
            
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-8 text-center md:text-left">
              <div>
                <h4 className="text-base font-orbitron font-semibold text-white mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><a href="#home" className="text-sm hover:text-trendy-yellow transition-colors">Home</a></li>
                  <li><a href="#features" className="text-sm hover:text-trendy-yellow transition-colors">Features</a></li>
                  <li><a href="/contact" className="text-sm hover:text-trendy-yellow transition-colors">Contact Us</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-orbitron font-semibold text-white mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><a href="/privacy" className="text-sm hover:text-trendy-yellow transition-colors">Privacy Policy</a></li>
                  <li><a href="/terms" className="text-sm hover:text-trendy-yellow transition-colors">Terms of Service</a></li>
                </ul>
              </div>
              <div className="col-span-2 sm:col-span-1">
                 <h4 className="text-base font-orbitron font-semibold text-white mb-4">Built with</h4>
                 <Zap className="w-8 h-8 text-trendy-yellow" />
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-neutral-600 pt-8 border-t border-neutral-700/50">
             &copy; {new Date().getFullYear()} Trendy.bot. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

// Basic CSS for animations if not already present globally (tailwind.config.js or index.css)
/*
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.group-open\:animate-fadeIn:is(.group-open *) {
  animation: fadeIn 0.3s ease-out forwards;
}
*/

// Ensure your tailwind.config.js has Orbitron and Inter fonts configured,
// and the custom colors like trendy-brown, trendy-yellow.
// Example for tailwind.config.js (theme extensions):
/*
extend: {
  colors: {
    'trendy-brown': '#262220', // Or your actual dark brown/bg color
    'trendy-yellow': '#F6D44C', // Your primary accent yellow
  },
  fontFamily: {
    orbitron: ['Orbitron', 'sans-serif'],
    sans: ['Inter', 'sans-serif'], // Ensuring Inter is default sans
  },
  animation: {
    fadeIn: 'fadeIn 0.3s ease-out forwards',
  },
  keyframes: {
    fadeIn: {
      '0%': { opacity: '0', transform: 'translateY(-10px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
    }
  }
}
*/
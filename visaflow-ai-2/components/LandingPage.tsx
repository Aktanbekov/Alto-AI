import React, { useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle, Shield, Zap, Globe, MessageSquare, Play, Star, TrendingUp, Users, Calendar } from 'lucide-react';
import { Button } from './ui/Button';
import SpotlightCard from './ui/SpotlightCard';

interface LandingPageProps {
  onStart: () => void;
  onPricing: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onPricing }) => {
  // Simple parallax effect for floating shapes
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const scrolled = window.scrollY;
      const shapes = document.querySelectorAll('.parallax-shape');
      shapes.forEach((shape, index) => {
        const speed = (index + 1) * 0.1;
        (shape as HTMLElement).style.transform = `translateY(${scrolled * speed}px)`;
      });
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full min-h-screen flex flex-col items-center overflow-hidden bg-white text-black">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
        <div className="absolute bottom-0 left-0 w-full h-[300px] bg-gradient-to-t from-white to-transparent" />
        {/* Parallax Shapes */}
        <div className="parallax-shape absolute top-40 right-20 w-16 h-16 border border-black/5 rounded-full" />
        <div className="parallax-shape absolute top-80 left-20 w-24 h-24 border border-black/5 rotate-45" />
      </div>

      {/* Navigation */}
      <nav className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-50 sticky top-0 backdrop-blur-md bg-white/70 border-b border-black/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">VisaFlow AI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
          <a href="#features" className="hover:text-black transition-colors">Features</a>
          <a href="#proof" className="hover:text-black transition-colors">Success Stories</a>
          <button onClick={onPricing} className="hover:text-black transition-colors">Pricing</button>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => window.open('https://ai.google.dev', '_blank')}>Log In</Button>
          <Button size="sm" onClick={onStart}>Get Started</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-32 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/5 text-sm text-neutral-600 mb-8 animate-fade-in-up">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
          </span>
          Powered by Gemini 3 Flash
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 text-black pb-2">
          Secure Your Future.<br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">Master the Visa Interview.</span>
        </h1>

        <p className="text-xl text-neutral-600 max-w-2xl mx-auto mb-12 leading-relaxed">
          The world's most advanced AI simulator for F-1 Visa interviews. 
          Practice with a strict digital officer, get real-time feedback, and increase your approval odds by 300%.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" onClick={onStart} className="w-full sm:w-auto">
            Start Simulation <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="lg" className="w-full sm:w-auto">
            Watch Demo
          </Button>
        </div>
        
        {/* Hero Visual / Dashboard Preview */}
        <div className="mt-20 relative rounded-xl border border-black/10 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] backdrop-blur-xl aspect-video overflow-hidden group max-w-4xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
                <Play className="w-6 h-6 text-black ml-1" />
              </div>
              <p className="text-neutral-500 font-medium">Interactive Session Preview</p>
            </div>
          </div>
          {/* Faux UI Elements */}
          <div className="absolute bottom-4 left-4 right-4 h-16 bg-white/60 rounded-lg backdrop-blur-md border border-black/5 flex items-center px-4 gap-4 shadow-sm">
             <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs text-red-600 font-bold">AI</div>
             <div className="h-2 flex-1 bg-black/5 rounded-full overflow-hidden">
               <div className="h-full w-3/4 bg-blue-500" />
             </div>
          </div>
        </div>
      </section>

      {/* Value Prop Details */}
      <section id="features" className="w-full max-w-7xl mx-auto px-6 py-24 border-t border-black/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Why VisaFlow?</h2>
          <p className="text-neutral-600">Designed by former consular officers and AI engineers.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SpotlightCard className="p-8 h-full flex flex-col">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Real-time Latency</h3>
            <p className="text-neutral-600 leading-relaxed flex-grow">
              Experience the pressure of a real interview. Our AI responds instantly, analyzing your tone, pace, and hesitation markers.
            </p>
          </SpotlightCard>

          <SpotlightCard className="p-8 h-full flex flex-col">
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Proven Frameworks</h3>
            <p className="text-neutral-600 leading-relaxed flex-grow">
              Trained on thousands of successful visa transcripts. We guide you to the answers officers are legally required to look for.
            </p>
          </SpotlightCard>

          <SpotlightCard className="p-8 h-full flex flex-col">
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mb-6">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Confidence Scoring</h3>
            <p className="text-neutral-600 leading-relaxed flex-grow">
              Get a detailed breakdown of your performance after every session. Improve your score to guarantee your visa.
            </p>
          </SpotlightCard>
        </div>
      </section>

      {/* Statistics & Data Bento Grid (Light Mode) */}
      <section className="w-full max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 grid-rows-2 gap-4">
          
          {/* Main Stat Card - Visa Approval */}
          <div className="md:col-span-8 md:row-span-2 bg-white text-black rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between group min-h-[320px] shadow-lg border border-neutral-200">
            <div className="absolute top-0 right-0 p-6">
               <div className="bg-green-50 border border-green-100 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm text-green-700 font-medium">
                 <TrendingUp className="w-4 h-4" /> +124% vs average
               </div>
            </div>
            
            <div className="relative z-10 mt-2">
              <h3 className="text-neutral-500 font-medium tracking-wide uppercase text-xs mb-3">Total Visa Value Secured</h3>
              <div className="text-5xl md:text-7xl font-bold tracking-tighter mb-1">$1,240,000+</div>
              <p className="text-neutral-500 text-sm">Estimated scholarship & tuition value retained</p>
            </div>

            {/* Decorative Smooth Graph */}
            <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20">
               <svg viewBox="0 0 500 150" className="w-full h-full" preserveAspectRatio="none">
                 <path d="M0,150 C100,100 200,120 250,80 C350,20 400,60 500,0 L500,150 Z" fill="url(#gradient)" />
                 <defs>
                   <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                     <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                     <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                   </linearGradient>
                 </defs>
               </svg>
            </div>
            
            {/* Approval Rate Badge overlay */}
            <div className="absolute bottom-8 right-8 text-right hidden md:block">
                <div className="text-3xl font-bold text-black">98.5%</div>
                <div className="text-xs text-neutral-500 uppercase tracking-wider">Approval Rate</div>
            </div>
          </div>

          {/* Secondary Stat: Students */}
          <div className="md:col-span-4 bg-white text-black rounded-3xl p-8 flex flex-col justify-center border border-neutral-200 shadow-lg">
            <div className="flex items-start justify-between mb-4">
               <h3 className="text-4xl font-bold">40k+</h3>
               <div className="p-2 bg-neutral-100 rounded-xl border border-neutral-200 text-black">
                 <Calendar className="w-5 h-5" />
               </div>
            </div>
            <p className="text-neutral-600 font-medium">Students Practicing</p>
          </div>

          {/* Tertiary Stat: Satisfaction */}
          <div className="md:col-span-4 bg-white text-black rounded-3xl p-8 flex flex-col justify-center border border-neutral-200 shadow-lg">
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <h3 className="text-4xl font-bold mb-2">4.9/5</h3>
            <p className="text-neutral-600 font-medium">Student Satisfaction</p>
          </div>

        </div>

        {/* Featured Review Banner */}
        <div className="mt-4 bg-neutral-50 text-black rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden shadow-lg border border-neutral-200">
            {/* Subtle glow effect */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-100/50 rounded-full blur-[100px]"></div>
            
            <div className="hidden md:block text-7xl text-neutral-200 font-serif leading-none self-start">"</div>
            
            <div className="relative z-10 flex-1">
              <p className="text-lg md:text-xl font-medium leading-relaxed mb-6 text-neutral-700">
                Finally, a system that actually integrates with the real embassy experience. The AI handles the pressure so I could focus on my answers. <span className="text-black font-bold">I filled my passport with a visa stamp on the first try.</span>
              </p>
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center font-bold text-sm shadow-sm">MC</div>
                 <div className="text-left">
                    <div className="font-bold text-black">Dr. Michael Chen</div>
                    <div className="text-neutral-500 text-xs uppercase tracking-wider">Owner, Chen Dental Group (Simulated)</div>
                 </div>
              </div>
            </div>
        </div>
      </section>

      {/* Proof / Testimonials */}
      <section id="proof" className="w-full border-t border-black/5 bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-12 text-center">Trusted by ambitious students worldwide</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "Sarah J.", uni: "Stanford '25", quote: "The AI officer was tougher than the real one. I was over-prepared." },
              { name: "Rahul M.", uni: "NYU '24", quote: "My confidence score went from 45% to 92% in a week." },
              { name: "Li W.", uni: "MIT '26", quote: "It flagged a red flag in my finances answer I didn't even know existed." },
              { name: "Ahmed K.", uni: "Georgia Tech '25", quote: "The best investment I made for my study abroad journey." }
            ].map((t, i) => (
              <div key={i} className="p-6 rounded-xl bg-white border border-black/5 shadow-sm hover:-translate-y-1 transition-transform duration-300">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="w-4 h-4 text-yellow-500 flex items-center justify-center text-[10px]">★</div>
                  ))}
                </div>
                <p className="text-neutral-600 text-sm mb-4">"{t.quote}"</p>
                <div>
                  <div className="font-semibold text-black">{t.name}</div>
                  <div className="text-xs text-neutral-500">{t.uni}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full max-w-4xl mx-auto px-6 py-32 text-center">
        <h2 className="text-4xl font-bold mb-6">Ready to secure your spot?</h2>
        <p className="text-neutral-600 mb-10 max-w-xl mx-auto">
          Join 10,000+ students who have successfully navigated the complexities of the US Visa process.
        </p>
        <Button size="lg" onClick={onStart}>Start Your Free Simulation</Button>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-black/5 py-12 text-center text-neutral-500 text-sm">
        <p>© 2025 VisaFlow AI Inc. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
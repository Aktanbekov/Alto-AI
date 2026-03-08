import React from 'react';
import { Globe, Check } from 'lucide-react';
import { Button } from './ui/Button';
import SpotlightCard from './ui/SpotlightCard';

interface PricingPageProps {
  onBack: () => void;
  onStart: () => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onBack, onStart }) => {
  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center animate-fade-in">
      {/* Navigation */}
      <nav className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-50 sticky top-0 backdrop-blur-md bg-white/70 border-b border-black/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">VisaFlow AI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
          <button onClick={onBack} className="hover:text-black transition-colors">Home</button>
          <button className="text-black font-semibold">Pricing</button>
        </div>
        <div className="flex items-center gap-4">
           <Button variant="secondary" size="sm" onClick={onBack}>Back</Button>
           <Button size="sm" onClick={onStart}>Get Started</Button>
        </div>
      </nav>

      {/* Pricing Section Content */}
      <section className="w-full max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/5 text-sm text-neutral-600 mb-6">
            Simple Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Invest in your American Dream</h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Choose the plan that fits your timeline. No hidden fees. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
           {/* Free Tier */}
           <SpotlightCard className="p-8 h-full flex flex-col">
             <div className="mb-4">
               <h3 className="font-semibold text-lg">Starter</h3>
               <div className="mt-2 flex items-baseline gap-1">
                 <span className="text-4xl font-bold tracking-tight">$0</span>
                 <span className="text-neutral-500 text-sm">/ forever</span>
               </div>
               <p className="text-neutral-500 text-sm mt-4">Essential practice for your upcoming interview.</p>
             </div>
             <div className="flex-1 space-y-4 mb-8">
               {['1 Simulation per day', 'Basic Feedback', 'Standard Response Latency', 'Community Access'].map(feature => (
                  <div key={feature} className="flex items-center gap-3 text-sm text-neutral-600">
                     <Check className="w-4 h-4 text-neutral-900" />
                     {feature}
                  </div>
               ))}
             </div>
             <Button variant="secondary" className="w-full" onClick={onStart}>Start Free</Button>
          </SpotlightCard>

          {/* Pro Tier - 3 Months */}
          <div className="relative p-8 rounded-2xl border border-black bg-neutral-900 text-white flex flex-col shadow-2xl transform md:-translate-y-4 z-10">
             <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
               Most Popular
             </div>
             <div className="mb-4">
               <h3 className="font-semibold text-lg text-neutral-200">Pro Access</h3>
               <div className="mt-2 flex items-baseline gap-1">
                 <span className="text-4xl font-bold tracking-tight text-white">$49</span>
                 <span className="text-neutral-400 text-sm">/ 3 months</span>
               </div>
               <p className="text-neutral-400 text-sm mt-4">Perfect for the semester leading up to your appointment.</p>
             </div>
             <div className="flex-1 space-y-4 mb-8">
               {['Unlimited Simulations', 'Advanced Confidence Analysis', 'Speech Pattern Coaching', 'Red Flag Detection', '3 Months Access'].map(feature => (
                  <div key={feature} className="flex items-center gap-3 text-sm text-neutral-300">
                     <div className="bg-blue-600 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>
                     {feature}
                  </div>
               ))}
             </div>
             <Button variant="secondary" className="w-full bg-white text-black hover:bg-neutral-200 border-none transition-colors" onClick={onStart}>Get Pro Access</Button>
          </div>

          {/* Premium Tier - 1 Year */}
          <SpotlightCard className="p-8 h-full flex flex-col">
             <div className="mb-4">
               <h3 className="font-semibold text-lg">Premium</h3>
               <div className="mt-2 flex items-baseline gap-1">
                 <span className="text-4xl font-bold tracking-tight">$99</span>
                 <span className="text-neutral-500 text-sm">/ year</span>
               </div>
               <p className="text-neutral-500 text-sm mt-4">Long-term preparation and re-application support.</p>
             </div>
             <div className="flex-1 space-y-4 mb-8">
               {['Everything in Pro', '1 Year Access', 'Priority Server Access', 'Visa Approval Guarantee*', 'Exclusive Webinars'].map(feature => (
                  <div key={feature} className="flex items-center gap-3 text-sm text-neutral-600">
                     <Check className="w-4 h-4 text-neutral-900" />
                     {feature}
                  </div>
               ))}
             </div>
             <Button variant="secondary" className="w-full" onClick={onStart}>Get Premium</Button>
          </SpotlightCard>
        </div>
      </section>

      <footer className="w-full border-t border-black/5 py-12 text-center text-neutral-500 text-sm mt-auto">
        <p>© 2025 VisaFlow AI Inc. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PricingPage;
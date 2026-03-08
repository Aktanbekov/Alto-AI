import React, { useState } from 'react';
import { Landing } from './components/Landing';
import { Quiz } from './components/Quiz';
import { StrategyResult } from './components/StrategyResult';
import { AppState, UserProfile, StrategyResult as StrategyResultType } from './types';
import { generateStrategy } from './services/geminiService';
import { Globe, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LANDING);
  const [result, setResult] = useState<StrategyResultType | null>(null);

  const startQuiz = () => setView(AppState.QUIZ);
  
  const handleQuizComplete = async (data: UserProfile) => {
    setView(AppState.GENERATING);
    try {
      const strategy = await generateStrategy(data);
      setResult(strategy);
      setView(AppState.RESULT);
    } catch (error) {
      console.error("Failed to generate strategy", error);
      // In a real app, handle error state better
      setView(AppState.LANDING);
    }
  };

  const resetApp = () => {
    setResult(null);
    setView(AppState.LANDING);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 font-sans selection:bg-purple-100 selection:text-purple-900">
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div 
          className="flex items-center gap-2 font-bold text-xl cursor-pointer"
          onClick={resetApp}
        >
          <div className="bg-black text-white p-1.5 rounded-lg">
            <Globe size={20} />
          </div>
          <span>AI Interviewer</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
          <a href="#" className="hover:text-purple-600 transition-colors">Features</a>
          <a href="#" className="hover:text-purple-600 transition-colors">Success Stories</a>
          <a href="#" className="hover:text-purple-600 transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                AA
            </div>
            <button 
                onClick={view === AppState.LANDING ? startQuiz : undefined}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
                {view === AppState.RESULT ? 'Upgrade' : 'Start Interview'}
            </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="px-6 py-8 md:py-12 max-w-7xl mx-auto w-full">
        {view === AppState.LANDING && (
          <Landing onStart={startQuiz} />
        )}

        {view === AppState.QUIZ && (
          <Quiz onComplete={handleQuizComplete} onCancel={() => setView(AppState.LANDING)} />
        )}

        {view === AppState.GENERATING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fadeIn">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-200 rounded-full animate-ping opacity-75"></div>
              <div className="bg-white p-4 rounded-full shadow-xl relative z-10">
                <Loader2 size={48} className="text-purple-600 animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mt-8 mb-2">Analyzing Profile...</h2>
            <p className="text-gray-500 max-w-md">
              Our AI is consulting with 10,000+ past visa cases to build your perfect strategy.
            </p>
          </div>
        )}

        {view === AppState.RESULT && result && (
          <StrategyResult strategy={result} onReset={resetApp} />
        )}
      </main>
    </div>
  );
};

export default App;
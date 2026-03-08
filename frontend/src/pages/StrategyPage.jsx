import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Globe } from "lucide-react";
import { generateStrategy } from "../api";
import { StrategyLanding } from "./strategy/StrategyLanding";
import { StrategyQuiz } from "./strategy/StrategyQuiz";
import { StrategyResultView } from "./strategy/StrategyResultView";

const VIEW = { LANDING: "landing", QUIZ: "quiz", GENERATING: "generating", RESULT: "result" };

export default function StrategyPage() {
  const [view, setView] = useState(VIEW.QUIZ);
  const [result, setResult] = useState(null);

  const startQuiz = () => setView(VIEW.QUIZ);

  const handleQuizComplete = async (data) => {
    setView(VIEW.GENERATING);
    try {
      const strategy = await generateStrategy(data);
      setResult(strategy);
      setView(VIEW.RESULT);
    } catch (err) {
      console.error("Failed to generate strategy", err);
      setView(VIEW.LANDING);
    }
  };

  const resetApp = () => {
    setResult(null);
    setView(VIEW.LANDING);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 font-sans">
      <nav className="w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto border-b border-black/5 bg-white/80 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-black hover:opacity-80">
          <div className="bg-black text-white p-1.5 rounded-lg">
            <Globe className="w-5 h-5" />
          </div>
          <span>AI Interviewer</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
          <a href="/#features" className="hover:text-purple-600 transition-colors">Features</a>
          <a href="/#proof" className="hover:text-purple-600 transition-colors">Success Stories</a>
          <a href="/#pricing" className="hover:text-purple-600 transition-colors">Pricing</a>
        </div>
        {view === VIEW.LANDING ? (
          <button
            type="button"
            onClick={startQuiz}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Start Interview
          </button>
        ) : (
          <Link
            to="/chat"
            className="bg-black text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            {view === VIEW.RESULT ? "Practice Interview" : "Start Interview"}
          </Link>
        )}
      </nav>

      <main className="px-6 py-8 md:py-12 max-w-7xl mx-auto w-full">
        {view === VIEW.LANDING && <StrategyLanding onStart={startQuiz} />}
        {view === VIEW.QUIZ && (
          <StrategyQuiz
            onComplete={handleQuizComplete}
            onCancel={() => setView(VIEW.LANDING)}
          />
        )}
        {view === VIEW.GENERATING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-200 rounded-full animate-ping opacity-75" />
              <div className="bg-white p-4 rounded-full shadow-xl relative z-10">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mt-8 mb-2">Analyzing Profile...</h2>
            <p className="text-gray-500 max-w-md">
              Our AI is consulting with 10,000+ past visa cases to build your perfect strategy.
            </p>
          </div>
        )}
        {view === VIEW.RESULT && result && (
          <StrategyResultView strategy={result} onReset={resetApp} />
        )}
      </main>
    </div>
  );
}

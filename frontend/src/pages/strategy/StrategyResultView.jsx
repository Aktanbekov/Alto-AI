import { AlertTriangle, Star, CheckCircle2, TrendingUp, RefreshCw, Lightbulb } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Link } from "react-router-dom";

export function StrategyResultView({ strategy, onReset }) {
  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold mb-4">
          <Star className="w-4 h-4 fill-purple-700" />
          Personalized Strategy Ready
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Your Visa Approval Roadmap</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className={`p-6 rounded-2xl border ${strategy.riskLevel === "High" ? "bg-red-50 border-red-100" : strategy.riskLevel === "Medium" ? "bg-orange-50 border-orange-100" : "bg-green-50 border-green-100"}`}>
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className={`w-6 h-6 ${strategy.riskLevel === "High" ? "text-red-600" : strategy.riskLevel === "Medium" ? "text-orange-600" : "text-green-600"}`} />
            <h3 className="font-bold text-gray-900">Risk Assessment</h3>
          </div>
          <div className="text-2xl font-bold mb-1">{strategy.riskLevel} Risk</div>
          <p className="text-sm text-gray-600">Based on your gaps, funding, and major choice.</p>
          {strategy.riskFactors?.length > 0 && (
            <ul className="mt-4 space-y-1">
              {strategy.riskFactors.map((risk, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="mt-1 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-6 rounded-2xl border border-gray-100 bg-white md:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h3 className="font-bold text-gray-900">Your Key Strengths</h3>
          </div>
          <ul className="space-y-3">
            {(strategy.strengths || []).map((strength, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
        <h3 className="text-xl font-bold mb-4">Executive Summary</h3>
        <p className="text-gray-700 leading-relaxed text-lg">{strategy.personalizedStrategy}</p>
      </div>

      <div className="space-y-8">
        <h3 className="text-2xl font-bold text-gray-900">Predicted Interview Questions</h3>
        {(strategy.questions || []).map((q, index) => (
          <div key={index} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
              <h4 className="text-xl font-bold text-gray-900">{q.question}</h4>
              <span className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap">
                Question #{index + 1}
              </span>
            </div>
            <div className="space-y-5">
              <div className="flex gap-3">
                <div className="mt-1 w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Star className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Interviewer's Intent</p>
                  <p className="text-sm text-gray-700">{q.intent}</p>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-white p-5 rounded-xl border border-purple-100">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Golden Answer</p>
                <p className="text-gray-800 font-medium italic leading-relaxed">"{q.sampleAnswer}"</p>
              </div>
              <div className="flex gap-3 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                <Lightbulb className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Expert Tip</p>
                  <p className="text-sm text-gray-800">{q.tips}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {strategy.closingAdvice && (
        <div className="mt-12 bg-gray-900 text-white rounded-2xl p-8 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-3">Final Words of Advice</h3>
            <p className="text-gray-300 max-w-2xl mx-auto">{strategy.closingAdvice}</p>
          </div>
        </div>
      )}

      <div className="mt-12 text-center flex flex-wrap justify-center gap-4">
        <Button type="button" variant="outline" onClick={onReset}>
          <RefreshCw className="w-4 h-4 mr-2" /> Generate New Strategy
        </Button>
        <Link to="/chat">
          <Button type="button">Start Practice Interview</Button>
        </Link>
      </div>
    </div>
  );
}

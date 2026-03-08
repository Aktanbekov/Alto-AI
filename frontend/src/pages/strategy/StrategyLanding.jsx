import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, GraduationCap, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";

export function StrategyLanding({ onStart }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 max-w-5xl mx-auto">
      <div className="bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-sm font-medium mb-8 inline-flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Powered by Advanced AI
      </div>

      <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-6">
        Secure Your Future.
        <br />
        <span className="text-purple-600">Master the Visa Interview.</span>
      </h1>

      <p className="text-xl text-gray-500 max-w-2xl mb-10 leading-relaxed">
        The world's most advanced AI strategist for F-1 Visa interviews. Get a personalized risk assessment, golden answers, and a tailored roadmap to approval.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Button type="button" size="lg" onClick={onStart}>
          Generate My Strategy <ArrowRight className="w-5 h-5" />
        </Button>
        <Link to="/#proof">
          <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto">
            View Success Stories
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 w-full text-left">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4 text-purple-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg mb-2">Risk Assessment</h3>
          <p className="text-gray-500">Identify potential red flags in your profile before the officer does.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg mb-2">University Match</h3>
          <p className="text-gray-500">Tailored answers explaining why you chose your specific university and major.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center mb-4 text-yellow-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg mb-2">Golden Answers</h3>
          <p className="text-gray-500">Get phrasing that sounds natural, confident, and convincing.</p>
        </div>
      </div>
    </div>
  );
}

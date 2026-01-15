import { Link } from "react-router-dom";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 cursor-pointer">
            <img src="/logo.svg" alt="Alto Visas Logo" className="h-8 sm:h-10 w-auto" />
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AI Interviewer
            </span>
          </Link>
          <Link
            to="/"
            className="px-4 lg:px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all text-sm lg:text-base min-h-[44px] flex items-center"
          >
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
          About Us
        </h1>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-12 space-y-6 sm:space-y-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Our Mission</h2>
            <p className="text-gray-600 leading-relaxed">
              At Alto Visas, we believe that everyone deserves the opportunity to prepare effectively for their visa interviews. Our mission is to empower candidates with AI-powered interview practice that helps them build confidence and improve their chances of success.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">What We Do</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              AI Interviewer is an innovative platform that uses advanced artificial intelligence to simulate real visa interview scenarios. We provide:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Personalized interview practice sessions</li>
              <li>Detailed feedback on your answers</li>
              <li>Multiple difficulty levels to match your needs</li>
              <li>Comprehensive analysis across key interview dimensions</li>
              <li>24/7 availability for practice anytime, anywhere</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Our Technology</h2>
            <p className="text-gray-600 leading-relaxed">
              Powered by cutting-edge AI technology, our platform analyzes your responses in real-time, providing insights on clarity, completeness, financial proof, goal understanding, and more. We continuously improve our system to deliver the most accurate and helpful feedback.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Privacy & Security</h2>
            <p className="text-gray-600 leading-relaxed">
              Your privacy is our priority. All interview sessions are confidential, and we use industry-standard security measures to protect your personal information. We never share your data with third parties.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Get Started</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Ready to improve your interview skills? Sign up for free and start practicing today. No credit card required.
            </p>
            <Link
              to="/signup"
              className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all"
            >
              Start Practicing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


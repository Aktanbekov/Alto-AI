import { Link } from "react-router-dom";

export default function FAQPage() {
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
          Frequently Asked Questions
        </h1>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-12 space-y-6 sm:space-y-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">What is AI Interviewer?</h2>
            <p className="text-gray-600 leading-relaxed">
              AI Interviewer is an AI-powered platform that helps you practice visa interviews. Our intelligent system provides personalized feedback and helps you improve your answers to common interview questions.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">How does it work?</h2>
            <p className="text-gray-600 leading-relaxed">
              Simply sign up, choose your difficulty level (Easy, Medium, or Hard), and start practicing. Our AI will ask you questions tailored to your profile and provide detailed feedback on your answers.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Is it free?</h2>
            <p className="text-gray-600 leading-relaxed">
              Yes! AI Interviewer is completely free to use. No credit card required.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">What types of questions are asked?</h2>
            <p className="text-gray-600 leading-relaxed">
              We cover various categories including academic background, financial proofs, goals and intentions, travel history, and more. Questions are tailored based on your selected difficulty level.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">How accurate is the feedback?</h2>
            <p className="text-gray-600 leading-relaxed">
              Our AI analyzes your answers across multiple dimensions including clarity, completeness, and relevance. While it's designed to help you practice, remember that actual visa interviews may vary.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Can I practice multiple times?</h2>
            <p className="text-gray-600 leading-relaxed">
              Absolutely! You can practice as many times as you want. Each session provides new questions and feedback to help you improve.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Is my data secure?</h2>
            <p className="text-gray-600 leading-relaxed">
              Yes, we take your privacy seriously. Your interview sessions and personal information are kept confidential and secure. Please see our Privacy Policy for more details.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Do I need to verify my email?</h2>
            <p className="text-gray-600 leading-relaxed">
              Yes, email verification is required to ensure account security. You'll receive a verification code after signing up.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}


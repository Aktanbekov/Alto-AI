import { Link } from "react-router-dom";

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="text-center text-gray-600 mb-8">Last updated: January 2025</p>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-12 space-y-6 sm:space-y-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              By accessing and using AI Interviewer, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our service.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">2. Use of Service</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              You agree to use AI Interviewer only for lawful purposes and in accordance with these Terms. You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Use the service for any illegal or unauthorized purpose</li>
              <li>Attempt to gain unauthorized access to any part of the service</li>
              <li>Interfere with or disrupt the service or servers</li>
              <li>Share your account credentials with others</li>
              <li>Use automated systems to access the service without permission</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">3. Account Registration</h2>
            <p className="text-gray-600 leading-relaxed">
              To use certain features of our service, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate. You are responsible for maintaining the confidentiality of your account credentials.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">4. Service Availability</h2>
            <p className="text-gray-600 leading-relaxed">
              We strive to provide continuous access to our service, but we do not guarantee that the service will be available at all times. We may experience downtime for maintenance, updates, or due to unforeseen circumstances.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">5. AI Feedback Disclaimer</h2>
            <p className="text-gray-600 leading-relaxed">
              The feedback and analysis provided by our AI system are for practice purposes only. While we strive for accuracy, the feedback is not a guarantee of visa interview outcomes. Actual visa interviews may vary, and decisions are made by immigration authorities, not by our platform.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p className="text-gray-600 leading-relaxed">
              All content, features, and functionality of the service, including but not limited to text, graphics, logos, and software, are owned by Alto Visas and are protected by copyright, trademark, and other intellectual property laws.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">7. User Content</h2>
            <p className="text-gray-600 leading-relaxed">
              You retain ownership of any content you submit through the service. By submitting content, you grant us a license to use, store, and process that content solely for the purpose of providing and improving our services.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">8. Limitation of Liability</h2>
            <p className="text-gray-600 leading-relaxed">
              To the maximum extent permitted by law, Alto Visas shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">9. Termination</h2>
            <p className="text-gray-600 leading-relaxed">
              We reserve the right to terminate or suspend your account and access to the service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users or our service.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">10. Changes to Terms</h2>
            <p className="text-gray-600 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the updated Terms on this page and updating the "Last updated" date.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">11. Contact Information</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us through our website.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


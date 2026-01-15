import { Link } from "react-router-dom";

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-center text-gray-600 mb-8">Last updated: January 2025</p>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-12 space-y-6 sm:space-y-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Name and email address when you create an account</li>
              <li>College and major information for interview personalization</li>
              <li>Interview responses and practice session data</li>
              <li>Account preferences and settings</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Provide and improve our AI interview practice services</li>
              <li>Personalize your interview experience</li>
              <li>Send you verification emails and important account updates</li>
              <li>Analyze usage patterns to enhance our platform</li>
              <li>Ensure platform security and prevent fraud</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">3. Data Storage and Security</h2>
            <p className="text-gray-600 leading-relaxed">
              We implement industry-standard security measures to protect your personal information. Your data is stored securely in encrypted databases and is only accessible to authorized personnel. We use secure connections (HTTPS) for all data transmission.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">4. Data Sharing</h2>
            <p className="text-gray-600 leading-relaxed">
              We do not sell, trade, or rent your personal information to third parties. We may share anonymized, aggregated data for analytical purposes, but this data cannot be used to identify individual users.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">5. Your Rights</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Access your personal information</li>
              <li>Update or correct your information</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of non-essential communications</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">6. Cookies and Tracking</h2>
            <p className="text-gray-600 leading-relaxed">
              We use cookies and similar technologies to enhance your experience, analyze usage, and maintain your session. You can control cookie preferences through your browser settings.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">7. Children's Privacy</h2>
            <p className="text-gray-600 leading-relaxed">
              Our service is not intended for users under the age of 18. We do not knowingly collect personal information from children.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">8. Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">9. Contact Us</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us through our website.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


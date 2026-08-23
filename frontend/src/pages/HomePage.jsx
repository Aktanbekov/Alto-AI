import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { getMe } from "../api";
import ProfileDropdown from "../components/ProfileDropdown";
import { setAccessToken } from "../utils/tokenStorage";

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const observerRef = useRef(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle Google OAuth callback - extract access_token from query parameter
  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const redirect = searchParams.get("redirect");
    if (accessToken) {
      setAccessToken(accessToken);
      // Remove access_token and redirect from URL
      searchParams.delete("access_token");
      if (redirect) {
        searchParams.delete("redirect");
      }
      setSearchParams(searchParams, { replace: true });
      // Refresh user data
      getMe().then((userData) => {
        setUser(userData);
        // Redirect to intended destination if specified
        if (redirect) {
          navigate(redirect);
        }
      }).catch(() => {
        setUser(null);
      });
    }
  }, [searchParams, setSearchParams, navigate]);

  const startInterview = () => {
    if (user) {
      navigate("/choose-level");
    } else {
      navigate("/login?redirect=/choose-level");
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        const userData = await getMe();
        setUser(userData);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    // Lightweight scroll animation using Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    observerRef.current = observer;

    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const elements = document.querySelectorAll(".fade-in-on-scroll");
      elements.forEach((el) => {
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const addToRefs = (el) => {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  };

  return (
    <div className="bg-stone-50 min-h-screen">
      {/* Navigation */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer bg-transparent border-none outline-none p-0"
          >
            <img src="/logo.svg" alt="Alto Visas Logo" className="h-8 sm:h-10 w-auto" />
            <span className="text-xl sm:text-2xl font-bold text-indigo-700">
              AI Interviewer
            </span>
          </button>

          {/* Desktop: nav links + profile/sign in */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            <a href="#features" className="text-stone-700 hover:text-indigo-700 font-medium transition-colors py-2 min-h-[44px] flex items-center">Features</a>
            <a href="#how-it-works" className="text-stone-700 hover:text-indigo-700 font-medium transition-colors py-2 min-h-[44px] flex items-center">How It Works</a>
            {!loading && (
              user ? (
                <ProfileDropdown user={user} onLogout={handleLogout} />
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  className="px-4 lg:px-6 py-2 bg-indigo-700 text-white rounded-full hover:bg-indigo-800 transition-colors text-sm lg:text-base min-h-[44px]"
                >
                  Sign In
                </button>
              )
            )}
          </div>

          {/* Mobile: same as chat - profile picture (dropdown) or sign-in avatar */}
          <div className="flex md:hidden items-center gap-2">
            {!loading && (
              user ? (
                <ProfileDropdown user={user} onLogout={handleLogout} />
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-white min-w-[44px] min-h-[44px] hover:bg-indigo-800 transition-colors"
                  aria-label="Sign in"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section - on mobile: robot emoji above headline only; on desktop: text left, full card right */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          <div className="flex-1 w-full lg:min-w-[300px] animate-fade-in-up text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              <span>✨</span>
              <span>Powered by Advanced AI</span>
            </div>
            {/* Robot between badge and headline - phone only (bigger, subtle jump) */}
            <div className="flex justify-center mb-4 sm:mb-6 md:hidden">
              <span className="text-8xl sm:text-9xl animate-bounce-low inline-block" role="img" aria-label="AI Robot">🤖</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-stone-900 mb-4 sm:mb-6 leading-tight">
              Practice Interviews with Your
              <span className="text-indigo-700"> AI Companion</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-stone-700 mb-6 sm:mb-8 leading-relaxed">
              Get personalized feedback, improve your answers, and ace your next interview with our intelligent AI interviewer that adapts to your needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <button
                onClick={startInterview}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-indigo-700 text-white rounded-full font-semibold text-base sm:text-lg hover:bg-indigo-800 transition-colors min-h-[44px]"
              >
                {user ? "Start Interview" : "Start Free Interview"}
              </button>
              <button className="px-6 sm:px-8 py-3 sm:py-4 bg-white text-stone-800 rounded-full font-semibold text-base sm:text-lg hover:bg-stone-100 transition-colors border-2 border-stone-300 min-h-[44px]">
                Watch Demo
              </button>
            </div>
          </div>
          <div className="flex-1 w-full lg:min-w-[300px] relative animate-fade-in-scale" style={{ animationDelay: "0.2s" }}>
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8 md:p-12 text-center">
              {/* Robot in card - tablet and desktop only (phone shows robot between badge and headline) */}
              <div className="hidden md:block text-6xl sm:text-7xl md:text-8xl lg:text-9xl mb-4 sm:mb-6 animate-bounce">🤖</div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-2">Meet Your AI Interviewer</h3>
              <p className="text-sm sm:text-base text-stone-600">Ready to help you succeed!</p>
              <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="bg-indigo-700 rounded-xl p-3 sm:p-4">
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2 text-white font-bold">10k+</div>
                  <div className="text-indigo-50">Interviews Conducted</div>
                </div>
                <div className="bg-stone-800 rounded-xl p-3 sm:p-4">
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2 text-white font-bold">95%</div>
                  <div className="text-stone-300">Success Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white border-y border-stone-200 py-12 sm:py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-3 sm:mb-4">Why Choose AI Interviewer?</h2>
            <p className="text-base sm:text-lg md:text-xl text-stone-700">Everything you need to ace your next interview</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div
              ref={addToRefs}
              className="fade-in-on-scroll bg-stone-50 border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-300 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-700 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-white text-2xl sm:text-3xl">
                ⚡
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">Instant Feedback</h3>
              <p className="text-sm sm:text-base text-stone-700">Get real-time feedback on your answers and suggestions for improvement after every response.</p>
            </div>
            <div
              ref={addToRefs}
              className="fade-in-on-scroll bg-stone-50 border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-300 hover:shadow-md transition-all"
              style={{ transitionDelay: "0.1s" }}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-700 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-white text-2xl sm:text-3xl">
                💬
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">Natural Conversation</h3>
              <p className="text-sm sm:text-base text-stone-700">Experience realistic interview scenarios with our AI that understands context and adapts to you.</p>
            </div>
            <div
              ref={addToRefs}
              className="fade-in-on-scroll bg-stone-50 border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-300 hover:shadow-md transition-all"
              style={{ transitionDelay: "0.2s" }}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-700 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-white text-2xl sm:text-3xl">
                📈
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">Track Progress</h3>
              <p className="text-sm sm:text-base text-stone-700">Monitor your improvement over time with detailed analytics and performance insights.</p>
            </div>
            <div
              ref={addToRefs}
              className="fade-in-on-scroll bg-stone-50 border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-300 hover:shadow-md transition-all"
              style={{ transitionDelay: "0.3s" }}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-700 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-white text-2xl sm:text-3xl">
                ⏰
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">24/7 Availability</h3>
              <p className="text-sm sm:text-base text-stone-700">Practice anytime, anywhere. Your AI interviewer is always ready when you are.</p>
            </div>
            <div
              ref={addToRefs}
              className="fade-in-on-scroll bg-stone-50 border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-300 hover:shadow-md transition-all"
              style={{ transitionDelay: "0.4s" }}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-700 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-white text-2xl sm:text-3xl">
                🛡️
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">Private &amp; Secure</h3>
              <p className="text-sm sm:text-base text-stone-700">Your interviews are completely confidential. We prioritize your privacy and data security.</p>
            </div>
            <div
              ref={addToRefs}
              className="fade-in-on-scroll bg-stone-50 border border-stone-200 rounded-2xl p-6 sm:p-8 hover:border-stone-300 hover:shadow-md transition-all"
              style={{ transitionDelay: "0.5s" }}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-700 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-white text-2xl sm:text-3xl">
                ✨
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">Personalized</h3>
              <p className="text-sm sm:text-base text-stone-700">Tailored questions based on your visa, goal, and experience for maximum relevance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-12 sm:py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-stone-900 mb-3 sm:mb-4">How It Works</h2>
            <p className="text-base sm:text-lg md:text-xl text-stone-700">Get started in three simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 md:gap-12">
            <div
              ref={addToRefs}
              className="fade-in-on-scroll text-center"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-indigo-700 rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-bold mx-auto mb-4 sm:mb-6">
                1
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">Create Your Profile</h3>
              <p className="text-sm sm:text-base text-stone-700">Tell us about your background, the visa you're applying for, and your goals level.</p>
            </div>
            <div
              ref={addToRefs}
              className="fade-in-on-scroll text-center"
              style={{ transitionDelay: "0.2s" }}
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-indigo-700 rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-bold mx-auto mb-4 sm:mb-6">
                2
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">Start Practicing</h3>
              <p className="text-sm sm:text-base text-stone-700">Chat with your AI interviewer and answer questions tailored to your specific needs.</p>
            </div>
            <div
              ref={addToRefs}
              className="fade-in-on-scroll text-center"
              style={{ transitionDelay: "0.4s" }}
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-indigo-700 rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-bold mx-auto mb-4 sm:mb-6">
                3
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-3 sm:mb-4">Get Better</h3>
              <p className="text-sm sm:text-base text-stone-700">Review feedback, track your progress, and improve with every practice session.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-800 py-12 sm:py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">Ready to Ace Your Interview?</h2>
          <p className="text-base sm:text-lg md:text-xl text-indigo-50 mb-6 sm:mb-8">Join thousands of successful candidates who practiced with AI Interviewer</p>
          <button
            onClick={startInterview}
            className="px-8 sm:px-12 py-3 sm:py-4 md:py-5 bg-white text-indigo-800 rounded-full font-bold text-base sm:text-lg md:text-xl hover:bg-indigo-50 transition-colors min-h-[44px]"
          >
            Start Your Free Trial Now
          </button>
          {/* <p className="text-sm sm:text-base text-indigo-50 mt-4 sm:mt-6">No credit card required • 7-day free trial • Cancel anytime</p> */}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Alto Visas Logo" className="h-7 w-auto" />
            <span className="text-lg font-bold text-white">AI Interviewer</span>
          </div>
          <p className="text-sm">Empowering candidates with AI-powered interview practice.</p>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm" aria-label="Footer">
            <a href="#features" className="text-stone-400 hover:text-white transition-colors py-1">Features</a>
            <Link to="/faq" className="text-stone-400 hover:text-white transition-colors py-1">FAQ</Link>
            <Link to="/about" className="text-stone-400 hover:text-white transition-colors py-1">About Us</Link>
            <Link to="/privacy" className="text-stone-400 hover:text-white transition-colors py-1">Privacy Policy</Link>
            <Link to="/terms" className="text-stone-400 hover:text-white transition-colors py-1">Terms of Service</Link>
            <a href="#" className="text-stone-400 hover:text-white transition-colors py-1">Contact</a>
          </nav>
          <p className="text-xs text-stone-500 border-t border-stone-800 pt-4 w-full">© 2025 AI Interviewer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from './api';
import ProfileDropdown from './components/ProfileDropdown';

const LevelSelection = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

    const handleLogout = () => {
        setUser(null);
    };

    const levels = [
        {
            id: 'easy',
            name: 'Easy',
            questions: 4,
            color: 'from-green-400 to-green-500',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            textColor: 'text-green-700',
            description: 'Perfect for first-time practice',
            icon: '🌱'
        },
        {
            id: 'medium',
            name: 'Medium',
            questions: 7,
            color: 'from-blue-400 to-blue-500',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            textColor: 'text-blue-700',
            description: 'Build your confidence',
            icon: '🎯'
        },
        {
            id: 'hard',
            name: 'Hard',
            questions: 12,
            color: 'from-purple-400 to-purple-500',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200',
            textColor: 'text-purple-700',
            description: 'Master the interview',
            icon: '🏆'
        }
    ];

    const handleLevelSelect = (level) => {
        // Navigate to chat with level as query parameter
        navigate(`/chat?level=${level.id}`);
    };

    return (
        <div className="w-full h-screen flex flex-col bg-gradient-to-b from-green-50 to-blue-50">
            {/* Navigation */}
            <nav className="bg-white shadow-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate("/")}
                        className="flex items-center gap-2 sm:gap-3 cursor-pointer bg-transparent border-none outline-none p-0"
                    >
                        <img src="/logo.svg" alt="Alto Visas Logo" className="h-8 sm:h-10 w-auto" />
                        <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            AI Interviewer
                        </span>
                    </button>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6 lg:gap-8">
                        {!loading && (
                            user ? (
                                <ProfileDropdown user={user} onLogout={handleLogout} />
                            ) : (
                                <button
                                    onClick={() => navigate("/login")}
                                    className="px-4 lg:px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all text-sm lg:text-base min-h-[44px]"
                                >
                                    Sign In
                                </button>
                            )
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 text-gray-600 hover:text-indigo-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t bg-white">
                        <div className="px-4 py-4 space-y-3">
                            {!loading && (
                                user ? (
                                    <div className="px-4">
                                        <ProfileDropdown user={user} onLogout={handleLogout} />
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => navigate("/login")}
                                        className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full hover:shadow-lg transition-all text-sm"
                                    >
                                        Sign In
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Page Title Section */}
            <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-6 shadow-lg">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="text-5xl mb-3">🎓</div>
                    <h1 className="text-3xl font-bold mb-2">F1 Visa Interview Practice</h1>
                    <p className="text-green-100">Choose your difficulty level to begin</p>
                </div>
            </div>

            {/* Level Cards */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                    {levels.map((level) => (
                        <div
                            key={level.id}
                            className={`${level.bgColor} border-2 ${level.borderColor} rounded-3xl p-8 cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl`}
                            onClick={() => handleLevelSelect(level)}
                        >
                            <div className="text-center">
                                <div className="text-6xl mb-4">{level.icon}</div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">{level.name}</h2>
                                <div className={`inline-block px-4 py-2 rounded-full bg-white ${level.textColor} font-semibold mb-4`}>
                                    {level.questions} Questions
                                </div>
                                <p className="text-gray-600 mb-6">{level.description}</p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleLevelSelect(level);
                                    }}
                                    className={`w-full bg-gradient-to-r ${level.color} text-white py-3 rounded-full font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all`}
                                >
                                    Start Practice
                                    <span className="text-lg">→</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Tip */}
            <div className="bg-white border-t p-4 text-center text-gray-500 text-sm">
                💡 Start with Easy if this is your first time practicing
            </div>
        </div>
    );
};

export default LevelSelection;
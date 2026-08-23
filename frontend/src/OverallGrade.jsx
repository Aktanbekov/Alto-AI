import React from 'react';

const OverallGrade = ({ scoreData }) => {
    // Default data if not provided
    const defaultScoreData = {
        score: 85,
        categoryScores: [
            { name: 'Goals', score: 90, emoji: '🎯' },
            { name: 'Home Intent', score: 85, emoji: '🏠' },
            { name: 'Financial Proofs', score: 95, emoji: '💰' },
            { name: 'Sufficient Details', score: 70, emoji: '📋' }
        ],
        feedback: 'You showed strong preparation and clear communication. Focus on being more specific about your post-graduation plans to improve further.'
    };

    const data = scoreData || defaultScoreData;

    const getReadiness = (score) => {
        if (score >= 85) return { text: 'Overall Grade Ready!', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
        if (score >= 70) return { text: 'Almost There!', color: 'text-lime-700', bgColor: 'bg-lime-50' };
        return { text: 'Keep Practicing', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    };

    const readiness = getReadiness(data.score);

    return (
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-3xl mx-auto">

            {/* Readiness Badge */}
            <div className={`${readiness.bgColor} p-6 text-center border-b`}>
                <div className="text-3xl mb-2">
                    {data.score >= 85 ? '🎉' : data.score >= 70 ? '💪' : '📖'}
                </div>
                <h2 className={`text-2xl font-bold ${readiness.color}`}>{readiness.text}</h2>
            </div>

            {/* Performance Cards */}
            <div className="p-8">
                <h3 className="text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
                    <span className="text-2xl">⭐</span>
                    Your Performance
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    {data.categoryScores.map((category, idx) => (
                        <div key={idx} className="bg-stone-50 rounded-2xl p-5 border-2 border-stone-100 hover:border-lime-300 transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-3xl">{category.emoji}</span>
                                <span className={`text-2xl font-bold ${category.score >= 80 ? 'text-emerald-600' :
                                    category.score >= 60 ? 'text-lime-700' : 'text-amber-600'
                                    }`}>
                                    {category.score}%
                                </span>
                            </div>
                            <div className="text-sm font-medium text-stone-700">{category.name}</div>
                        </div>
                    ))}
                </div>

                {/* Feedback */}
                <div className="bg-lime-50 border-l-4 border-lime-600 rounded-lg p-6">
                    <h4 className="font-bold text-lime-900 mb-2 flex items-center gap-2">
                        <span className="text-xl">📈</span>
                        Personalized Feedback
                    </h4>
                    <p className="text-stone-700 leading-relaxed whitespace-pre-line">{data.feedback}</p>
                </div>
            </div>
        </div>
    );
};

export default OverallGrade;
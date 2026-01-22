import React from "react";

interface AnalysisScores {
  migration_intent: number | null;
  financial_understanding: number | null;
  academic_credibility: number | null;
  specificity_research: number | null;
  consistency: number | null;
  communication_quality: number | null;
  red_flags: number | null;
  total_score: number;
}

interface FeedbackByCriterion {
  migration_intent: string;
  financial_understanding: string;
  academic_credibility: string;
  specificity_research: string;
  consistency: string;
  communication_quality: string;
  red_flags: string;
}

interface StructuredFeedback {
  overall: string;
  by_criterion: FeedbackByCriterion;
  improvements: string[];
}

interface ChatAnalysis {
  scores: AnalysisScores;
  classification: string;
  feedback: StructuredFeedback;
}

interface AnswerFeedbackCardProps {
  analysis: ChatAnalysis;
  questionNumber?: number;
}

const AnswerFeedbackCard: React.FC<AnswerFeedbackCardProps> = ({
  analysis,
  questionNumber,
}) => {
  if (!analysis || !analysis.scores) {
    return null;
  }

  const { scores, classification, feedback } = analysis;
  const totalScore = scores.total_score || 0;
  
  // Count relevant criteria (non-null)
  const countRelevantCriteria = () => {
    let count = 0;
    if (scores.migration_intent !== null && scores.migration_intent !== undefined) count++;
    if (scores.financial_understanding !== null && scores.financial_understanding !== undefined) count++;
    if (scores.academic_credibility !== null && scores.academic_credibility !== undefined) count++;
    if (scores.specificity_research !== null && scores.specificity_research !== undefined) count++;
    if (scores.consistency !== null && scores.consistency !== undefined) count++;
    if (scores.communication_quality !== null && scores.communication_quality !== undefined) count++;
    if (scores.red_flags !== null && scores.red_flags !== undefined) count++;
    return count || 1; // Avoid division by zero
  };

  const criteriaCount = countRelevantCriteria();
  const maxScore = criteriaCount * 5;
  const minScore = criteriaCount * 1;
  const scoreRange = maxScore - minScore;
  const percentage = scoreRange > 0 
    ? Math.max(0, Math.min(100, ((totalScore - minScore) / scoreRange) * 100))
    : 0;
  
  // Helper to check if feedback has content
  const hasFeedback = feedback && (
    feedback.by_criterion?.migration_intent ||
    feedback.by_criterion?.financial_understanding ||
    feedback.by_criterion?.academic_credibility ||
    feedback.by_criterion?.specificity_research ||
    feedback.by_criterion?.consistency ||
    feedback.by_criterion?.communication_quality ||
    feedback.by_criterion?.red_flags ||
    (feedback.improvements && feedback.improvements.length > 0)
  );

  const getClassificationStyle = () => {
    const lowerClass = classification?.toLowerCase() || "";
    if (lowerClass.includes("excellent")) {
      return {
        gradient: "from-green-500 to-emerald-600",
        bg: "bg-green-50",
        border: "border-green-200",
        emoji: "😇",
        badgeBg: "bg-green-100",
        badgeText: "text-green-800",
        progressBar: "bg-green-500",
      };
    }
    if (lowerClass.includes("good")) {
      return {
        gradient: "from-blue-500 to-indigo-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        emoji: "☺️",
        badgeBg: "bg-blue-100",
        badgeText: "text-blue-800",
        progressBar: "bg-blue-500",
      };
    }
    if (lowerClass.includes("average")) {
      return {
        gradient: "from-yellow-500 to-orange-500",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        emoji: "😕",
        badgeBg: "bg-yellow-100",
        badgeText: "text-yellow-800",
        progressBar: "bg-yellow-500",
      };
    }
    if (lowerClass.includes("weak")) {
      return {
        gradient: "from-orange-500 to-red-500",
        bg: "bg-orange-50",
        border: "border-orange-200",
        emoji: "😟",
        badgeBg: "bg-orange-100",
        badgeText: "text-orange-800",
        progressBar: "bg-orange-500",
      };
    }
    return {
      gradient: "from-red-500 to-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
      emoji: "❌",
      badgeBg: "bg-red-100",
      badgeText: "text-red-800",
      progressBar: "bg-red-500",
    };
  };

  const style = getClassificationStyle();

  const getScoreColor = (score: number | null) => {
    if (score === null || score === undefined) {
      return "text-gray-500 bg-gray-100 border-gray-300"; // Gray for N/A
    }
    if (score >= 4) return "text-green-600 bg-green-50 border-green-300";
    if (score === 3) return "text-yellow-600 bg-yellow-50 border-yellow-300";
    return "text-red-600 bg-red-50 border-red-300";
  };

  const criteriaLabels: Record<
    keyof AnalysisScores,
    { label: string; icon: string }
  > = {
    migration_intent: { label: "Intent", icon: "🏠" },
    financial_understanding: { label: "Financial", icon: "💰" },
    academic_credibility: { label: "Academic", icon: "🎓" },
    specificity_research: { label: "Research", icon: "🔍" },
    consistency: { label: "Consistency", icon: "🔗" },
    communication_quality: { label: "Communication", icon: "💬" },
    red_flags: { label: "Red Flags", icon: "⚠️" },
    total_score: { label: "Total", icon: "📊" },
  };

  return (
    <div className="my-3 animate-slide-in">
      <div
        className={`${style.bg} ${style.border} border-2 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow`}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${style.gradient} p-4 text-white`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{style.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                {questionNumber && (
                  <span className="bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-xs font-bold">
                    Q{questionNumber}
                  </span>
                )}
                <span
                  className={`${style.badgeBg} ${style.badgeText} px-3 py-1 rounded-full text-xs font-bold`}
                >
                  {classification}
                </span>
              </div>
              <p className="text-sm opacity-90 mt-1">Answer Analysis</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-200 h-2">
          <div
            className={`${style.progressBar} h-full transition-all duration-1000`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Score Breakdown */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(
              [
                "migration_intent",
                "financial_understanding",
                "academic_credibility",
                "specificity_research",
                "consistency",
                "communication_quality",
                "red_flags",
              ] as (keyof AnalysisScores)[]
            ).map((key) => {
              const meta = criteriaLabels[key];
              const score = scores[key]; // Keep null as null, don't convert to 0
              return (
                <div
                  key={key}
                  className={`${getScoreColor(
                    score
                  )} rounded-lg p-2 text-center border-2 transition-transform hover:scale-105`}
                >
                  <div className="text-xl mb-1">{meta.icon}</div>
                  <div className="text-xs font-medium">{meta.label}</div>
                  {score === null && (
                    <div className="text-[10px] text-gray-400 mt-0.5">N/A</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feedback */}
          {hasFeedback && (
            <div className="space-y-3">
              {/* Feedback by Criterion */}
              {(feedback.by_criterion?.migration_intent || 
                feedback.by_criterion?.financial_understanding ||
                feedback.by_criterion?.academic_credibility ||
                feedback.by_criterion?.specificity_research ||
                feedback.by_criterion?.consistency ||
                feedback.by_criterion?.communication_quality ||
                feedback.by_criterion?.red_flags) && (
                <div className="bg-white border-l-4 border-blue-500 p-3 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    DETAILED FEEDBACK
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    {feedback.by_criterion.migration_intent && (
                      <div>
                        <span className="font-medium">Return Intent: </span>
                        {feedback.by_criterion.migration_intent}
                      </div>
                    )}
                    {feedback.by_criterion.financial_understanding && (
                      <div>
                        <span className="font-medium">Financial Understanding: </span>
                        {feedback.by_criterion.financial_understanding}
                      </div>
                    )}
                    {feedback.by_criterion.academic_credibility && (
                      <div>
                        <span className="font-medium">Academic Credibility: </span>
                        {feedback.by_criterion.academic_credibility}
                      </div>
                    )}
                    {feedback.by_criterion.specificity_research && (
                      <div>
                        <span className="font-medium">Specificity & Research: </span>
                        {feedback.by_criterion.specificity_research}
                      </div>
                    )}
                    {feedback.by_criterion.consistency && (
                      <div>
                        <span className="font-medium">Consistency: </span>
                        {feedback.by_criterion.consistency}
                      </div>
                    )}
                    {feedback.by_criterion.communication_quality && (
                      <div>
                        <span className="font-medium">Communication Quality: </span>
                        {feedback.by_criterion.communication_quality}
                      </div>
                    )}
                    {feedback.by_criterion.red_flags && (
                      <div>
                        <span className="font-medium">Red Flags: </span>
                        {feedback.by_criterion.red_flags}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Improvements */}
              {feedback.improvements && feedback.improvements.length > 0 && (
                <div className="bg-white border-l-4 border-green-500 p-3 rounded-lg shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    SUGGESTIONS FOR IMPROVEMENT
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    {feedback.improvements.map((improvement, idx) => (
                      <li key={idx}>{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AnswerFeedbackCard;




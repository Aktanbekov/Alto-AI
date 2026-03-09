import React from "react";

interface Contradiction {
  answer_index_a: number;
  answer_index_b: number;
  description: string;
  severity: string;
}

interface ConsistencyReport {
  contradictions: Contradiction[];
  overall_score: number;
  summary: string;
}

interface ConsistencyWarningProps {
  report: ConsistencyReport;
}

const ConsistencyWarning: React.FC<ConsistencyWarningProps> = ({ report }) => {
  if (!report) return null;

  const hasContradictions = report.contradictions && report.contradictions.length > 0;

  const getHeaderStyle = () => {
    if (report.overall_score >= 4) return { bg: "bg-green-50", border: "border-green-300", badge: "bg-green-600" };
    if (report.overall_score >= 3) return { bg: "bg-yellow-50", border: "border-yellow-300", badge: "bg-yellow-600" };
    return { bg: "bg-red-50", border: "border-red-300", badge: "bg-red-600" };
  };

  const style = getHeaderStyle();

  return (
    <div className={`${style.bg} ${style.border} border-2 rounded-2xl overflow-hidden shadow-lg mt-4`}>
      <div className={`${style.badge} px-4 py-3 text-white`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🔗</span>
          <div>
            <h3 className="font-semibold text-sm sm:text-base">Cross-Answer Consistency</h3>
            <p className="text-xs opacity-90">Score: {report.overall_score}/5</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {report.summary && (
          <p className="text-sm text-gray-700">{report.summary}</p>
        )}

        {hasContradictions ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Contradictions Found</p>
            {report.contradictions.map((c, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 text-sm ${
                  c.severity === "major"
                    ? "bg-red-100 border border-red-200 text-red-800"
                    : "bg-yellow-100 border border-yellow-200 text-yellow-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/60">
                    {c.severity === "major" ? "🚩 Major" : "⚠️ Minor"}
                  </span>
                  <span className="text-xs text-gray-600">
                    Answer {c.answer_index_a + 1} vs Answer {c.answer_index_b + 1}
                  </span>
                </div>
                <p className="leading-snug">{c.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 rounded-lg p-3">
            <span>✅</span>
            <span>No contradictions detected. Your answers are consistent.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsistencyWarning;

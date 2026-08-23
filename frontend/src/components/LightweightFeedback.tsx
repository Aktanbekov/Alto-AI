import React from "react";

interface PrefilterFlag {
  code: string;
  severity: string;
  message: string;
}

interface PrefilterResult {
  flags: PrefilterFlag[];
  needs_ai: boolean;
}

interface LightweightAnalysis {
  communication_quality: number;
  red_flags: number;
  quick_feedback: string;
  prefilter?: PrefilterResult;
}

interface LightweightFeedbackProps {
  analysis: LightweightAnalysis;
}

const LightweightFeedback: React.FC<LightweightFeedbackProps> = ({ analysis }) => {
  if (!analysis) return null;

  const avg = (analysis.communication_quality + analysis.red_flags) / 2;

  const getStyle = () => {
    if (avg >= 4) return { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", icon: "✅" };
    if (avg >= 3) return { bg: "bg-lime-50", border: "border-lime-300", text: "text-lime-800", icon: "💬" };
    if (avg >= 2) return { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", icon: "⚠️" };
    return { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", icon: "🚩" };
  };

  const style = getStyle();

  const criticalFlags = analysis.prefilter?.flags?.filter(f => f.severity === "critical") || [];
  const warningFlags = analysis.prefilter?.flags?.filter(f => f.severity === "warning") || [];

  return (
    <div className={`${style.bg} ${style.border} border rounded-xl px-3 py-2 mt-2 text-xs sm:text-sm`}>
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0">{style.icon}</span>
        <div className="flex-1 min-w-0">
          {analysis.quick_feedback && (
            <p className={`${style.text} font-medium leading-snug`}>{analysis.quick_feedback}</p>
          )}

          {criticalFlags.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {criticalFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-1.5 text-rose-700 bg-rose-100 rounded-lg px-2 py-1">
                  <span className="flex-shrink-0">🚩</span>
                  <span className="text-xs leading-snug">{flag.message}</span>
                </div>
              ))}
            </div>
          )}

          {warningFlags.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {warningFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-1.5 text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                  <span className="flex-shrink-0 text-xs">⚠️</span>
                  <span className="text-xs leading-snug">{flag.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-600">
            <span>Communication: {analysis.communication_quality}/5</span>
            <span>Red Flags: {analysis.red_flags}/5</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LightweightFeedback;

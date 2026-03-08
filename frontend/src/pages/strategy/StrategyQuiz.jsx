import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "../../components/ui/Button";

const STEPS = [
  { id: "academic", title: "Academic Profile" },
  { id: "financial", title: "Financials" },
  { id: "background", title: "Background" },
  { id: "intent", title: "Visa Intent" },
];

const INITIAL_DATA = {
  major: "",
  programLevel: "",
  university: "",
  funding: "",
  budget: "",
  gpa: "",
  studyGaps: "",
  majorSwitch: "",
  workExperience: "",
  relativesInUS: "",
  priorRefusal: "",
  postGradPlan: "",
  tiesToHome: "",
};

export function StrategyQuiz({ onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(INITIAL_DATA);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep((prev) => prev + 1);
    else onComplete(formData);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
    else onCancel();
  };

  const renderInput = (label, field, placeholder, type = "text", options = []) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {type === "select" ? (
        <select
          value={formData[field]}
          onChange={(e) => updateField(field, e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all bg-white"
        >
          <option value="" disabled>Select {label}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={formData[field]}
          onChange={(e) => updateField(field, e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-none"
        />
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((step, idx) => (
            <span
              key={step.id}
              className={`text-xs font-semibold uppercase tracking-wider ${idx <= currentStep ? "text-purple-600" : "text-gray-400"}`}
            >
              {step.title}
            </span>
          ))}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{STEPS[currentStep].title}</h2>

        <div className="min-h-[300px]">
          {currentStep === 0 && (
            <div className="space-y-4">
              {renderInput("Target Degree Level", "programLevel", "", "select", ["Bachelor's", "Master's", "PhD", "MBA", "Associate's"])}
              {renderInput("Intended Major", "major", "e.g., Computer Science")}
              {renderInput("University Applied To", "university", "e.g., Arizona State University")}
              {renderInput("Current GPA", "gpa", "e.g., 3.5/4.0 or 8.5/10")}
            </div>
          )}
          {currentStep === 1 && (
            <div className="space-y-4">
              {renderInput("Funding Plan", "funding", "", "select", ["Personal/Family Funds", "Education Loan", "Full Scholarship", "Partial Scholarship", "Employer Sponsorship"])}
              {renderInput("Total Budget (USD)", "budget", "e.g., $45,000 / year")}
            </div>
          )}
          {currentStep === 2 && (
            <div className="space-y-4">
              {renderInput("Years of Work Experience", "workExperience", "e.g., 2 years as Software Engineer")}
              {renderInput("Do you have any study gaps?", "studyGaps", "e.g., No, or Yes (1 year preparing for exams)")}
              {renderInput("Is this a major switch?", "majorSwitch", "", "select", ["No, same field", "Yes, slight change", "Yes, completely different field"])}
            </div>
          )}
          {currentStep === 3 && (
            <div className="space-y-4">
              {renderInput("Relatives in the US?", "relativesInUS", "e.g., None, or Yes (Uncle in California)")}
              {renderInput("Any prior visa refusals?", "priorRefusal", "", "select", ["No", "Yes, once", "Yes, multiple times"])}
              {renderInput("Post Graduation Plans", "postGradPlan", "What will you do after graduating?")}
              {renderInput("Strongest Tie to Home Country", "tiesToHome", "e.g., Job offer, Family business, Property")}
            </div>
          )}
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={handleBack} className="px-0 text-gray-500 border-0">
            <ArrowLeft className="w-4 h-4 mr-2 inline" /> Back
          </Button>
          <Button type="button" onClick={handleNext}>
            {currentStep === STEPS.length - 1 ? "Generate Strategy" : "Next Step"}
            {currentStep !== STEPS.length - 1 && <ArrowRight className="w-4 h-4 ml-2 inline" />}
            {currentStep === STEPS.length - 1 && <Check className="w-4 h-4 ml-2 inline" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

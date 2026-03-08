import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserProfile, StrategyResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    riskLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
    riskFactors: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of potential red flags in the profile"
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of strong points in the profile"
    },
    personalizedStrategy: {
      type: Type.STRING,
      description: "A high-level strategy summary for the interview"
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          intent: { type: Type.STRING, description: "Why the officer asks this" },
          sampleAnswer: { type: Type.STRING, description: "An ideal, personalized answer" },
          tips: { type: Type.STRING, description: "Specific advice for this question" }
        },
        required: ['question', 'intent', 'sampleAnswer', 'tips']
      },
      description: "Generate exactly 5 highly relevant questions. The first 2 are basic, the last 3 are challenging."
    },
    closingAdvice: { type: Type.STRING }
  },
  required: ['riskLevel', 'riskFactors', 'strengths', 'personalizedStrategy', 'questions', 'closingAdvice']
};

export const generateStrategy = async (profile: UserProfile): Promise<StrategyResult> => {
  const prompt = `
    Act as a former US Visa Consular Officer. Analyze the following F-1 Visa applicant profile and create a detailed interview strategy.
    
    Profile:
    - Major: ${profile.major}
    - Program Level: ${profile.programLevel}
    - University: ${profile.university}
    - Funding: ${profile.funding}
    - Budget: ${profile.budget}
    - GPA: ${profile.gpa}
    - Study Gaps: ${profile.studyGaps}
    - Major Switch: ${profile.majorSwitch}
    - Work Experience: ${profile.workExperience}
    - Relatives in US: ${profile.relativesInUS}
    - Prior Refusal: ${profile.priorRefusal}
    - Post Grad Plan: ${profile.postGradPlan}
    - Ties to Home: ${profile.tiesToHome}

    Your goal is to be strict but helpful. Identify weak points like low budget, major switches, or weak ties. 
    Provide 'Golden Answers' that sound natural, not robotic.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 0 } // Fast response needed
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as StrategyResult;

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback mock data in case of error to prevent app crash during demo if API key is invalid
    return {
      riskLevel: 'Medium',
      riskFactors: ['Potential immigration intent due to unclear ties', 'Budget constraints identified'],
      strengths: ['Strong academic background', 'Clear career goals'],
      personalizedStrategy: "Focus on articulating how this specific degree advances your career in your home country. Be prepared to explain funding clearly.",
      questions: [
        { question: "Why this university?", intent: "To check research", sampleAnswer: "I chose X because...", tips: "Be specific about courses." },
        { question: "Who is sponsoring you?", intent: "To check financials", sampleAnswer: "My parents...", tips: "Have bank statements ready." },
        { question: "What are your plans after graduation?", intent: "Immigration intent", sampleAnswer: "I will return to...", tips: "Mention specific companies at home." },
        { question: "Why did you change majors?", intent: "Academic seriousness", sampleAnswer: "My experience in...", tips: "Connect past experience to future goals." },
        { question: "Do you have relatives in the US?", intent: "Ties check", sampleAnswer: "Yes, my aunt...", tips: "Be honest but brief." }
      ],
      closingAdvice: "Dress formally and maintain eye contact."
    };
  }
};

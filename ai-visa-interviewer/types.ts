export interface UserProfile {
  major: string;
  programLevel: string;
  university: string;
  funding: string;
  budget: string;
  gpa: string;
  studyGaps: string;
  majorSwitch: string;
  workExperience: string;
  relativesInUS: string;
  priorRefusal: string;
  postGradPlan: string;
  tiesToHome: string;
}

export interface InterviewQuestion {
  question: string;
  intent: string;
  sampleAnswer: string;
  tips: string;
}

export interface StrategyResult {
  riskLevel: 'Low' | 'Medium' | 'High';
  riskFactors: string[];
  strengths: string[];
  personalizedStrategy: string;
  questions: InterviewQuestion[];
  closingAdvice: string;
}

export enum AppState {
  LANDING,
  QUIZ,
  GENERATING,
  RESULT
}

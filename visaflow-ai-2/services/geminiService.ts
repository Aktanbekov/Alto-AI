import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

const SYSTEM_INSTRUCTION = `
You are a strict, professional, but fair United States Visa Officer conducting an F-1 Student Visa interview.
Your goal is to assess if the student is a genuine scholar and has non-immigrant intent.

IMPORTANT: You must output your response in valid JSON format.
The JSON object must have this structure:
{
  "text": "Your spoken response to the student (the question or comment).",
  "feedback": {
    "score": <integer 0-100 representing the quality of the student's LAST answer>,
    "weakness": "<brief string pointing out a specific weakness in the student's LAST answer, or 'None' if good>",
    "suggestion": "<brief string giving a tip for the NEXT answer>"
  }
}

Rules:
1. Ask one question at a time.
2. Be concise.
3. If the student's answer is vague, press them for details.
4. If this is the start of the conversation, set score to 100, weakness to "None", and suggestion to "Be confident and clear".
`;

export interface InterviewResponse {
  text: string;
  feedback: {
    score: number;
    weakness: string;
    suggestion: string;
  };
}

export const createInterviewChat = (): Chat => {
  const ai = getClient();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });
};

export const sendMessageToChat = async (chat: Chat, message: string): Promise<InterviewResponse> => {
  try {
    const result: GenerateContentResponse = await chat.sendMessage({ message });
    const textResponse = result.text;
    
    if (!textResponse) {
        throw new Error("Empty response from AI");
    }

    try {
        // Attempt to parse the JSON response
        const parsed = JSON.parse(textResponse) as InterviewResponse;
        return parsed;
    } catch (parseError) {
        console.warn("Failed to parse JSON, falling back to raw text", textResponse);
        // Fallback structure if the model outputs raw text occasionally
        return {
            text: textResponse,
            feedback: {
                score: 0,
                weakness: "Could not analyze response format.",
                suggestion: "Please continue."
            }
        };
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
        text: "I'm having trouble connecting to the consulate server. Please repeat that.",
        feedback: {
            score: 0,
            weakness: "Connection Error",
            suggestion: "Check your internet connection."
        }
    };
  }
};
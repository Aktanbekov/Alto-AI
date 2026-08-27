import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { sendChatMessage, getMe } from "../api";
import AnswerFeedbackCard from "../components/AnswerFeedbackCard";
import LightweightFeedback from "../components/LightweightFeedback";
import ConsistencyWarning from "../components/ConsistencyWarning";
import ProfileDropdown from "../components/ProfileDropdown";
import OverallGrade from "../OverallGrade";
import CollegeMajorForm from "../components/CollegeMajorForm";

interface Message {
  id: number;
  text: string;
  sender: "user" | "ai";
  timestamp?: Date;
}

type EmojiState = "default" | "thinking" | "bad" | "worst" | "good" | "perfect";

const emojiStates: Record<EmojiState, string> = {
  // Default when starting the interview
  default: "😃",
  // While waiting for the response from GPT
  thinking: "🤔",
  // Answer quality buckets
  bad: "😕",
  worst: "😟",
  good: "☺️",
  perfect: "😇",
};

const statusTexts: Record<EmojiState, string> = {
  default: "Active & Listening",
  thinking: "Analyzing Response...",
  bad: "Needs Improvement",
  worst: "Significant Issues Detected",
  good: "Good Answer!",
  perfect: "Excellent Answer!",
};


interface InterviewScores {
  academic: number;
  financial: number;
  intent_to_return: number;
  overall_risk: number;
}

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

interface AnswerAnalysis {
  question_id: string;
  question_text: string;
  answer_text: string;
  analysis?: ChatAnalysis;
}

// V2 types
interface PrefilterFlag {
  code: string;
  severity: string;
  message: string;
}

interface PrefilterResult {
  flags: PrefilterFlag[];
  needs_ai: boolean;
  auto_comm_score?: number;
  auto_red_flag_score?: number;
}

interface LightweightAnalysis {
  communication_quality: number;
  red_flags: number;
  quick_feedback: string;
  prefilter?: PrefilterResult;
}

interface DeepAnswerAnalysis {
  question_id: string;
  question_text: string;
  category: string;
  answer_text: string;
  scores: AnalysisScores;
  classification: string;
  feedback: StructuredFeedback;
}

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

interface SessionEvaluation {
  answers: DeepAnswerAnalysis[];
  consistency?: ConsistencyReport;
  overall_score: number;
  overall_grade: string;
  verdict: string;
  recommendation: string;
  strong_areas: string[];
  weak_areas: string[];
}

interface ChatResponse {
  content: string;
  session_id?: string;
  question_id?: string;
  finished: boolean;
  scores?: InterviewScores;
  is_new_session?: boolean;
  // V1 fields
  analysis?: ChatAnalysis;
  grade?: string;
  suggestions?: string[];
  improved_version?: string;
  all_analyses?: AnswerAnalysis[];
  // V2 fields
  lightweight_analysis?: LightweightAnalysis;
  session_evaluation?: SessionEvaluation;
}

// Typewriter component for AI messages
const TypewriterText: React.FC<{ text: string; messageId: number }> = ({ text, messageId }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let currentIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const typeChar = () => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
        // Variable speed: faster for spaces, normal for characters
        const char = text[currentIndex - 1];
        const speed = char === ' ' ? 10 : char === '.' || char === '!' || char === '?' ? 50 : 15;
        timeoutId = setTimeout(typeChar, speed);
      }
    };

    // Start typing after a short delay
    timeoutId = setTimeout(typeChar, 100);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [text, messageId]);

  return <span>{displayedText}</span>;
};

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [emojiState, setEmojiState] = useState<EmojiState>("default");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scores, setScores] = useState<InterviewScores | null>(null);
  const [finished, setFinished] = useState(false);
  const [answerAnalyses, setAnswerAnalyses] = useState<Array<{ question: string, answer: string, questionId?: string, analysis: ChatResponse['analysis'] }>>([]);
  const [sessionEvaluation, setSessionEvaluation] = useState<SessionEvaluation | null>(null);
  const [lightweightFeedbacks, setLightweightFeedbacks] = useState<Array<{ question: string, answer: string, lightweight: LightweightAnalysis }>>([]);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [collegeMajorComplete, setCollegeMajorComplete] = useState(false);
  const [checkingCollegeMajor, setCheckingCollegeMajor] = useState(true);
  const [isRestarting, setIsRestarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only scroll to bottom if interview is not finished
    // When finished, keep the scroll position at the last answer
    if (!finished) {
      scrollToBottom();
    }
  }, [messages, isTyping, finished]);

  // Debug: Log analyses when interview finishes
  useEffect(() => {
    if (finished && answerAnalyses.length > 0) {
      console.log(`[DEBUG] Interview finished. Total analyses stored: ${answerAnalyses.length}`);
      answerAnalyses.forEach((item, idx) => {
        console.log(`[DEBUG] Analysis ${idx + 1}: questionId=${item.questionId || 'none'}, hasAnalysis=${!!item.analysis}, question="${item.question.substring(0, 50)}..."`);
      });
      const expectedCount = selectedLevel === "easy" ? 4 : selectedLevel === "medium" ? 7 : 12;
      if (answerAnalyses.length < expectedCount) {
        console.warn(`[DEBUG] WARNING: Expected ${expectedCount} analyses but only have ${answerAnalyses.length}`);
      }
    }
  }, [finished, answerAnalyses, selectedLevel]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, []);

  // Get level from URL parameter (keep it in URL so refresh preserves difficulty)
  useEffect(() => {
    const level = searchParams.get("level");
    if (level) {
      setSelectedLevel(level);
    }
  }, [searchParams]);

  // Check authentication and college/major info on mount
  useEffect(() => {
    const checkAuthAndInfo = async () => {
      try {
        const user = await getMe();
        if (!user) {
          navigate("/login");
          return;
        }
        // Only show form if BOTH college and major are null/empty
        // If either has a value, skip the form
        if (!user.college && !user.major) {
          // Both are null/empty, show form
          setCollegeMajorComplete(false);
        } else {
          // At least one has a value, skip form
          setCollegeMajorComplete(true);
        }
      } catch (err) {
        navigate("/login");
        return;
      } finally {
        setCheckingCollegeMajor(false);
      }
    };
    checkAuthAndInfo();
  }, [navigate]);

  // Initialize interview on mount (wait for level to be set if present and college/major complete)
  useEffect(() => {
    // Don't initialize if still checking or if college/major not complete
    if (checkingCollegeMajor || !collegeMajorComplete) {
      return;
    }

    const initializeInterview = async () => {
      try {
        // Check auth before initializing
        const user = await getMe();
        if (!user) {
          navigate("/login");
          return;
        }

        // Get level from URL if not already set (handle case where level is in URL but state not updated yet)
        const levelFromUrl = searchParams.get("level");
        const levelToUse = selectedLevel || levelFromUrl || null;

        setIsTyping(true);
        changeEmoji("thinking");
        const response: ChatResponse = await sendChatMessage([], null, levelToUse as any);

        // Store the level in state if we got it from URL
        if (levelFromUrl && !selectedLevel) {
          setSelectedLevel(levelFromUrl);
        }

        if (response.session_id) {
          setSessionId(response.session_id);
        }

        if (response.content) {
          const initialMessage: Message = {
            id: 1,
            sender: "ai",
            text: response.content,
            timestamp: new Date(),
          };
          setMessages([initialMessage]);
        }

        if (response.scores) {
          setScores(response.scores);
        }

        if (response.finished) {
          setFinished(true);
        }

        setIsTyping(false);
        changeEmoji("default");
      } catch (error) {
        setIsTyping(false);
        changeEmoji("default");

        // Check if it's an authentication error
        if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthorized") || error.message.includes("authentication"))) {
          navigate("/login");
          return;
        }

        const errorMessage: Message = {
          id: 1,
          text: `Failed to start interview: ${error instanceof Error ? error.message : "Unknown error"}`,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages([errorMessage]);
      }
    };

    initializeInterview();
  }, [navigate, selectedLevel, searchParams, checkingCollegeMajor, collegeMajorComplete]);

  // Calculate progress based on messages
  const qaPairs = messages.filter(m => m.sender === "user").length;
  const aiQuestions = messages.filter(m => m.sender === "ai" && !m.text.includes("Failed to") && !m.text.includes("Your answer is too short")).length;

  // Calculate progress based on selected level
  // Easy: 4 questions, Medium: 7 questions (6 + 1 extra), Hard: 12 questions (2 from each category)
  const getTotalQuestions = () => {
    if (selectedLevel === "easy") return 4; // 4 category questions
    if (selectedLevel === "medium") return 7; // 6 category questions + 1 extra
    if (selectedLevel === "hard") return 12; // 2 questions from each of 6 categories
    return 12; // default: same as hard
  };

  const totalQuestions = getTotalQuestions();
  const progress = finished ? 100 : Math.min((qaPairs / totalQuestions) * 100, 95);
  const messageCount = messages.length;
  const timeElapsed = "12m"; // You can calculate this based on start time

  // Calculate overall grade data from V2 session evaluation or V1 answer analyses
  const overallGradeData = useMemo(() => {
    if (!finished) return null;

    // V2: Use session evaluation directly
    if (sessionEvaluation) {
      return {
        score: sessionEvaluation.overall_score,
        grade: sessionEvaluation.overall_grade,
        verdict: sessionEvaluation.verdict,
        categoryScores: [
          ...(sessionEvaluation.strong_areas || []).map(area => ({ name: area, score: 85, emoji: '✅' })),
          ...(sessionEvaluation.weak_areas || []).map(area => ({ name: area, score: 35, emoji: '⚠️' })),
        ],
        feedback: sessionEvaluation.recommendation,
        consistency: sessionEvaluation.consistency,
      };
    }

    // V1 fallback
    if (answerAnalyses.length === 0) return null;

    let totalScoreSum = 0;
    let migrationIntentSum = 0;
    let migrationIntentCount = 0;
    let count = 0;
    let totalCriteriaCount = 0;

    answerAnalyses.forEach((item) => {
      if (item.analysis?.scores) {
        const scores = item.analysis.scores;
        totalScoreSum += scores.total_score || 0;
        
        let criteriaCount = 0;
        if (scores.migration_intent !== null && scores.migration_intent !== undefined) criteriaCount++;
        if (scores.financial_understanding !== null && scores.financial_understanding !== undefined) criteriaCount++;
        if (scores.academic_credibility !== null && scores.academic_credibility !== undefined) criteriaCount++;
        if (scores.specificity_research !== null && scores.specificity_research !== undefined) criteriaCount++;
        if (scores.consistency !== null && scores.consistency !== undefined) criteriaCount++;
        if (scores.communication_quality !== null && scores.communication_quality !== undefined) criteriaCount++;
        if (scores.red_flags !== null && scores.red_flags !== undefined) criteriaCount++;
        totalCriteriaCount += criteriaCount || 1;
        
        if (scores.migration_intent !== null && scores.migration_intent !== undefined) {
          migrationIntentSum += scores.migration_intent;
          migrationIntentCount++;
        }
        count++;
      }
    });

    if (count === 0) return null;

    const avgCriteriaCount = totalCriteriaCount / count;
    const maxScore = avgCriteriaCount * 5;
    const minScore = avgCriteriaCount * 1;
    const scoreRange = maxScore - minScore;
    const avgTotal = scoreRange > 0 
      ? Math.max(0, Math.min(100, ((totalScoreSum / count - minScore) / scoreRange) * 100))
      : 0;
    
    const avgMigrationIntent = migrationIntentCount > 0 
      ? Math.max(0, Math.min(100, ((migrationIntentSum / migrationIntentCount - 1) / 4) * 100))
      : 0;

    const lastAiMessage = [...messages].reverse().find(m => m.sender === "ai");
    const overallFeedback = lastAiMessage?.text?.includes("Thank you for completing")
      ? lastAiMessage.text
      : "Review your answers above to see detailed feedback for each question.";

    return {
      score: Math.round(avgTotal),
      categoryScores: [
        { name: 'Home Intent', score: Math.round(avgMigrationIntent), emoji: '🏠' },
        { name: 'Overall Quality', score: Math.round(avgTotal), emoji: '⭐' }
      ],
      feedback: overallFeedback
    };
  }, [finished, answerAnalyses, messages, sessionEvaluation]);

  // Filter out the overall feedback message (the last AI message when finished)
  const displayMessages = useMemo(() => {
    if (!finished) return messages;

    // Check if the last AI message contains overall feedback keywords
    const lastAiMessage = [...messages].reverse().find(m => m.sender === "ai");
    if (lastAiMessage && (
      lastAiMessage.text?.includes("Thank you for completing") ||
      lastAiMessage.text?.includes("overall grade") ||
      lastAiMessage.text?.includes("Average Score") ||
      lastAiMessage.text?.includes("interview practice session")
    )) {
      return messages.filter(m => m.id !== lastAiMessage.id);
    }
    return messages;
  }, [messages, finished]);

  const changeEmoji = (state: EmojiState) => {
    setEmojiState(state);
  };

  // Validate user input before sending
  const validateAnswer = (answer: string): { valid: boolean; error?: string } => {
    const trimmed = answer.trim();

    // Check if empty
    if (!trimmed) {
      return { valid: false, error: "Your answer is too short." };
    }

    // Check for obvious misspellings or gibberish
    // - Too many repeated characters (e.g., "aaaaaa", "testtttt")
    const hasRepeatedChars = /(.)\1{4,}/.test(trimmed);
    if (hasRepeatedChars) {
      return { valid: false, error: "Your answer is too short." };
    }

    return { valid: true };
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || finished) return;

    // Check authentication before sending
    try {
      const user = await getMe();
      if (!user) {
        navigate("/login");
        return;
      }
    } catch (err) {
      navigate("/login");
      return;
    }

    const messageText = inputValue.trim();

    // Validate the answer before sending
    const validation = validateAnswer(messageText);
    if (!validation.valid) {
      // Get the last question BEFORE adding error message
      const aiMessages = messages.filter(m => m.sender === "ai");
      const lastQuestion = aiMessages[aiMessages.length - 1];

      // Show simple error message
      const errorMessage: Message = {
        id: messages.length + 1,
        text: "Your answer is too short.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      // Resend the question if we found one
      if (lastQuestion && lastQuestion.text !== "Your answer is too short.") {
        const resendQuestion: Message = {
          id: messages.length + 2,
          text: lastQuestion.text,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, resendQuestion]);
      }

      // Clear input but don't send to API
      setInputValue("");
      return;
    }

    // Clear any existing timeouts to prevent double updates
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current = [];

    // Add user message
    const newUserMessage: Message = {
      id: messages.length + 1,
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue("");

    // Immediately change emoji to thinking
    changeEmoji("thinking");
    setIsTyping(true);

    try {
      // Last AI question before this answer (from previous messages state)
      const aiMessagesBeforeAnswer = messages.filter(m => m.sender === "ai");
      const lastQuestionText = aiMessagesBeforeAnswer[aiMessagesBeforeAnswer.length - 1]?.text || "";

      // Build conversation history for interview
      const conversationHistory = [
        ...messages.map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        })),
        {
          role: "user",
          content: messageText,
        },
      ];

      // Send to interview API (cast to any to allow string sessionId)
      const response: ChatResponse = await (sendChatMessage as any)(
        conversationHistory,
        sessionId ?? null,
        selectedLevel || undefined
      );

      // Update session ID if provided
      if (response.session_id && !sessionId) {
        setSessionId(response.session_id);
      }

      // V2: Store lightweight analysis for real-time feedback
      if (response.lightweight_analysis && messageText) {
        const questionText = lastQuestionText || `Question ${lightweightFeedbacks.length + 1}`;
        setLightweightFeedbacks(prev => [
          ...prev,
          { question: questionText, answer: messageText, lightweight: response.lightweight_analysis! },
        ]);
      }

      // V1: Store full analysis for later display (only show at end)
      if (response.analysis && messageText) {
        let questionText = lastQuestionText;
        if (!questionText || questionText.trim() === "") {
          const aiMessages = messages.filter(m => 
            m.sender === "ai" && 
            !m.text.includes("Thank you") && 
            !m.text.includes("completing") &&
            !m.text.includes("overall grade") &&
            !m.text.includes("Good luck")
          );
          questionText = aiMessages[aiMessages.length - 1]?.text || `Question ${answerAnalyses.length + 1}`;
        }
        
        const answerText = messageText;
        const questionId = response.question_id;

        setAnswerAnalyses(prev => {
          const exists = questionId
            ? prev.some(a => a.questionId === questionId)
            : prev.some(a => a.answer === answerText && a.question === questionText);
          if (exists) return prev;
          return [
            ...prev,
            { question: questionText, answer: answerText, questionId, analysis: response.analysis },
          ];
        });
      }

      if (response.scores) {
        setScores(response.scores);
      }

      if (response.finished) {
        setFinished(true);
        changeEmoji("perfect");

        // V2: Use session_evaluation if available
        if (response.session_evaluation) {
          setSessionEvaluation(response.session_evaluation);
          // Convert deep answers to answerAnalyses format for backward-compatible display
          setAnswerAnalyses(
            response.session_evaluation.answers.map(a => ({
              question: a.question_text || '',
              answer: a.answer_text || '',
              questionId: a.question_id || undefined,
              analysis: {
                scores: a.scores,
                classification: a.classification,
                feedback: a.feedback,
              },
            }))
          );
        } else if (response.all_analyses && response.all_analyses.length > 0) {
          // V1 fallback
          setAnswerAnalyses(
            response.all_analyses.map(item => ({
              question: item.question_text || '',
              answer: item.answer_text || '',
              questionId: item.question_id || undefined,
              analysis: item.analysis || undefined,
            }))
          );
        } else if (response.analysis && messageText) {
          // V1 final safety net
          setAnswerAnalyses(prev => {
            const questionId = response.question_id;
            const exists = questionId
              ? prev.some(a => a.questionId === questionId)
              : prev.some(a => a.answer === messageText);
            if (exists) return prev;
            let questionText = lastQuestionText;
            if (!questionText || questionText.trim() === "") {
              const aiMessages = messages.filter(m => 
                m.sender === "ai" && 
                !m.text.includes("Thank you") && !m.text.includes("completing") &&
                !m.text.includes("overall grade") && !m.text.includes("Good luck")
              );
              questionText = aiMessages[aiMessages.length - 1]?.text || `Question ${prev.length + 1}`;
            }
            return [...prev, { question: questionText, answer: messageText, questionId, analysis: response.analysis }];
          });
        }
      } else {
        // During interview: set emoji based on lightweight or V1 analysis
        if (response.lightweight_analysis) {
          const lw = response.lightweight_analysis;
          const avg = (lw.communication_quality + lw.red_flags) / 2;
          if (avg >= 4.5) changeEmoji("perfect");
          else if (avg >= 3.5) changeEmoji("good");
          else if (avg >= 2.5) changeEmoji("bad");
          else changeEmoji("worst");
        } else if (response.analysis?.scores) {
          const totalScore = response.analysis.scores.total_score || 0;
          if (totalScore >= 15) changeEmoji("perfect");
          else if (totalScore >= 13) changeEmoji("good");
          else if (totalScore >= 11) changeEmoji("bad");
          else changeEmoji("worst");
        } else {
          changeEmoji("default");
        }
      }

      // Add AI response message (just the question, no analysis during interview)
      if (response.content) {
        const newAiMessage: Message = {
          id: messages.length + 2,
          text: response.content,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newAiMessage]);
      }

      // AI has finished responding for this turn
      setIsTyping(false);
    } catch (error) {
      setIsTyping(false);
      changeEmoji("default");

      // Check if it's an authentication error
      if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthorized") || error.message.includes("authentication") || error.message.includes("Session expired"))) {
        navigate("/login");
        return;
      }

      // Log the full error for debugging
      console.error('[DEBUG] Error in handleSend:', error);
      if (error instanceof Error) {
        console.error('[DEBUG] Error message:', error.message);
        console.error('[DEBUG] Error stack:', error.stack);
      }

      const errorMessage: Message = {
        id: messages.length + 2,
        text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = () => {
    const emojiElement = document.getElementById("aiEmoji");
    if (emojiElement) {
      emojiElement.style.transform = "scale(1.2) rotate(5deg)";
      setTimeout(() => {
        emojiElement.style.transform = "scale(1)";
      }, 200);
    }
  };

  const handleRestartInterview = async () => {
    // Set restarting flag immediately to hide action buttons
    setIsRestarting(true);
    
    // Reset all state IMMEDIATELY and synchronously
    setFinished(false);
    setAnswerAnalyses([]);
    setMessages([]);
    setInputValue("");
    setEmojiState("default");
    setIsTyping(false);
    setSessionId(null);
    setScores(null);
    
    // Check authentication before restarting
    try {
      const user = await getMe();
      if (!user) {
        setIsRestarting(false);
        navigate("/login");
        return;
      }
    } catch (err) {
      setIsRestarting(false);
      navigate("/login");
      return;
    }

    // Clear any timeouts
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current = [];

    // Initialize new interview
    try {
      setIsTyping(true);
      changeEmoji("thinking");
      const response: ChatResponse = await sendChatMessage([], null, (selectedLevel || null) as any);

      if (response.session_id) {
        setSessionId(response.session_id);
      }

      if (response.content) {
        const initialMessage: Message = {
          id: 1,
          sender: "ai",
          text: response.content,
          timestamp: new Date(),
        };
        setMessages([initialMessage]);
      }

      if (response.scores) {
        setScores(response.scores);
      }

      if (response.finished) {
        setFinished(true);
      }

      setIsTyping(false);
      changeEmoji("default");
      setIsRestarting(false);
    } catch (error) {
      setIsTyping(false);
      changeEmoji("default");
      setIsRestarting(false);

      // Check if it's an authentication error
      if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthorized") || error.message.includes("authentication"))) {
        navigate("/login");
        return;
      }

      const errorMessage: Message = {
        id: 1,
        text: `Failed to start interview: ${error instanceof Error ? error.message : "Unknown error"}`,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
    }
  };

  // Show college/major form if not complete
  if (checkingCollegeMajor || !collegeMajorComplete) {
    return (
      <CollegeMajorForm onComplete={() => setCollegeMajorComplete(true)} />
    );
  }

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md flex-shrink-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer bg-transparent border-none outline-none p-0"
            >
              <img src="/logo.svg" alt="Alto Visas Logo" className="h-8 sm:h-10 w-auto" />
              <span className="text-xl sm:text-2xl font-bold text-indigo-700">
                AI Interviewer
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ProfileDropdown />
          </div>
        </div>
      </nav>

      {/* Main Chat Container */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 flex-1 flex overflow-hidden w-full">
        <div className="flex gap-4 sm:gap-6 items-start relative w-full h-full">
          {/* Large AI Character Sidebar */}
          <div key={`sidebar-${sessionId}-${finished}`} className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative top-16 lg:top-0 left-0 z-40 lg:z-auto h-[calc(100vh-4rem)] lg:h-full overflow-y-auto flex-shrink-0 w-80 sm:w-96 bg-white rounded-r-3xl lg:rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center transition-transform duration-300 ease-in-out`}>
            {/* Close button for mobile */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* AI Emoji */}
            <div
              id="aiEmoji"
              onClick={handleEmojiClick}
              key={emojiState}
              className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl mb-4 sm:mb-6 cursor-pointer animate-fade-in-scale"
            >
              {emojiStates[emojiState]}
            </div>

            {/* AI Info */}
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-800 mb-2">AI Interviewer</h2>
            <p className="text-stone-600 text-center text-xs sm:text-sm mb-4 sm:mb-6">
              I'm here to chat with you and learn about your experiences!
            </p>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-50 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm text-emerald-700 font-medium">{statusTexts[emojiState]}</span>
            </div>

            {/* Progress Section */}
            <div className="w-full mb-4 sm:mb-6">
              <div className="flex justify-between text-xs text-stone-600 mb-2">
                <span>Interview Progress</span>
              </div>
              <div className="bg-stone-200 rounded-full h-2 sm:h-3 w-full overflow-hidden">
                <div
                  className="bg-emerald-500 rounded-full h-2 sm:h-3 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* Action Buttons - Show when finished */}
            {!isRestarting && finished && messages.length > 0 && answerAnalyses.length > 0 ? (
              <div className="w-full space-y-3 mb-4 sm:mb-6">
                {/* Try Next Level Button */}
                {selectedLevel && selectedLevel !== "hard" && (
                  <button
                    onClick={() => {
                      const nextLevel = selectedLevel === "easy" ? "medium" : "hard";
                      navigate(`/chat?level=${nextLevel}`);
                      // Reload the page to restart with new level
                      window.location.reload();
                    }}
                    className="w-full bg-emerald-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 font-medium text-sm sm:text-base min-h-[44px]"
                  >
                    ⬆️ Try Next Level
                  </button>
                )}
                {/* Restart Interview Button */}
                <button
                  onClick={handleRestartInterview}
                  className="w-full bg-indigo-700 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl hover:bg-indigo-800 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 font-medium text-sm sm:text-base min-h-[44px]"
                >
                  🔄 Restart Interview
                </button>
              </div>
            ) : null}
          </div>

          {/* Overlay for mobile sidebar */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Chat Area */}
          <div className="flex-1 w-full bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full max-h-full">
            {/* Chat Header */}
            <div className="bg-indigo-700 p-4 sm:p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate mb-1">Interview Session</h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-indigo-100 text-xs sm:text-sm truncate">F1 Visa • Interview Practice</p>
                    {selectedLevel && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm ${selectedLevel === "easy" ? "bg-emerald-500/20 border border-emerald-300/30" :
                        selectedLevel === "medium" ? "bg-amber-500/20 border border-amber-300/30" :
                          "bg-rose-500/20 border border-rose-300/30"
                        }`}>
                        <span className="text-sm">
                          {selectedLevel === "easy" ? "🌱" :
                            selectedLevel === "medium" ? "🎯" :
                              "🏆"}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-white">
                          {selectedLevel === "easy" ? "Easy" :
                            selectedLevel === "medium" ? "Medium" :
                              "Hard"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 bg-stone-50 to-white">
              {/* Overall Grade Component - Show when finished */}
              {finished && overallGradeData && messages.length > 0 && (
                <div className="mb-6">
                  <OverallGrade scoreData={overallGradeData} />
                </div>
              )}

              {displayMessages.map((message, index) => {
                const lwFeedback = message.sender === "user" && !finished
                  ? lightweightFeedbacks.find(lf => lf.answer === message.text)
                  : null;

                return (
                  <div key={message.id}>
                    <div
                      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[80%] rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 shadow-md transition-all hover:shadow-lg ${message.sender === "ai"
                          ? "bg-white text-stone-900 border-2 border-indigo-100"
                          : "bg-indigo-700 text-white"
                          }`}
                      >
                        {message.sender === "ai" && (
                          <div className="flex items-center gap-2 mb-1 sm:mb-2">
                            <span className="text-lg sm:text-xl">🤖</span>
                            <span className="text-sm font-semibold text-indigo-600">AI Interviewer</span>
                          </div>
                        )}
                        <p className="text-sm sm:text-base leading-relaxed break-words">
                          {message.sender === "ai" ? (
                            <TypewriterText text={message.text} messageId={message.id} />
                          ) : (
                            message.text
                          )}
                        </p>
                      </div>
                    </div>
                    {lwFeedback && (
                      <div className="flex justify-end mt-1">
                        <div className="max-w-[85%] sm:max-w-[80%]">
                          <LightweightFeedback analysis={lwFeedback.lightweight} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Final per-answer analysis cards */}
              {finished && answerAnalyses.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm sm:text-base font-semibold text-stone-900 flex items-center gap-2">
                    <span>📊 Interview Results ({answerAnalyses.filter(a => a.analysis).length} of {selectedLevel === "easy" ? 4 : selectedLevel === "medium" ? 7 : 12} answers analyzed)</span>
                  </h3>

                  {/* V2: Verdict banner */}
                  {sessionEvaluation && (
                    <div className={`rounded-xl p-4 text-center font-semibold text-sm sm:text-base ${
                      sessionEvaluation.verdict === "Likely Approved"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : sessionEvaluation.verdict === "Needs Work"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-rose-100 text-rose-800 border border-rose-300"
                    }`}>
                      {sessionEvaluation.verdict === "Likely Approved" ? "✅" : sessionEvaluation.verdict === "Needs Work" ? "⚠️" : "🚩"}{" "}
                      Verdict: {sessionEvaluation.verdict} — Score: {sessionEvaluation.overall_score}/100
                    </div>
                  )}

                  {answerAnalyses
                    .filter(item => item.analysis)
                    .map((item, index) => (
                      <div
                        key={`${index}-${item.questionId || item.question}-${item.answer}`}
                        className="space-y-2"
                      >
                        <div className="text-xs sm:text-sm text-stone-800">
                          <div className="font-semibold">
                            Question {index + 1}:
                          </div>
                          <div className="mt-0.5">{item.question}</div>
                          <div className="mt-1">
                            <span className="font-semibold">Your Answer:</span>{" "}
                            <span className="italic">"{item.answer}"</span>
                          </div>
                        </div>
                        <AnswerFeedbackCard
                          analysis={item.analysis as any}
                          questionNumber={index + 1}
                        />
                      </div>
                    ))}

                  {/* V2: Consistency Report */}
                  {sessionEvaluation?.consistency && (
                    <ConsistencyWarning report={sessionEvaluation.consistency} />
                  )}
                </div>
              )}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex items-center gap-2 sm:gap-3 max-w-[85%] sm:max-w-[80%]">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-2xl bg-indigo-100 flex-shrink-0">
                    🤖
                  </div>
                  <div className="bg-white border-2 border-indigo-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-2 sm:py-3">
                    <div className="flex gap-1">
                      <div
                        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t-2 border-stone-100 p-3 sm:p-4 md:p-6 bg-white">
              <form onSubmit={handleSend} className="flex gap-2 sm:gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={finished ? "Interview completed" : "Type your answer here..."}
                  disabled={finished}
                  className="flex-1 px-4 sm:px-6 py-3 sm:py-4 border-2 border-stone-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base transition-all text-stone-900 min-h-[44px] disabled:bg-stone-100 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  className="bg-indigo-700 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-full hover:bg-indigo-800 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 font-medium text-sm sm:text-base min-h-[44px] min-w-[80px] sm:min-w-[100px]"
                >
                  <span className="hidden sm:inline">Send ➤</span>
                  <span className="sm:hidden">➤</span>
                </button>
              </form>
              <div className="hidden sm:flex items-center gap-4 mt-2 sm:mt-3 text-xs text-stone-600">
                <span>💡 Press Enter to send</span>
                <span>•</span>
                <span>Shift + Enter for new line</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

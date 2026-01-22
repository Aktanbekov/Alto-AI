import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { sendChatMessage, getMe } from "../api";
import AnswerFeedbackCard from "../components/AnswerFeedbackCard";
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

interface ChatResponse {
  content: string;
  session_id?: string;
  question_id?: string;
  finished: boolean;
  scores?: InterviewScores;
  is_new_session?: boolean;
  analysis?: ChatAnalysis;
  grade?: string;
  suggestions?: string[];
  improved_version?: string;
  all_analyses?: AnswerAnalysis[]; // All answers with analyses (when finished)
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

  // Get level from URL parameter
  useEffect(() => {
    const level = searchParams.get("level");
    if (level) {
      setSelectedLevel(level);
      // Remove level from URL after reading it
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("level");
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  // Calculate overall grade data from answer analyses
  const overallGradeData = useMemo(() => {
    if (!finished || answerAnalyses.length === 0) return null;

    // Calculate average scores from all analyses
    let totalScoreSum = 0;
    let migrationIntentSum = 0;
    let migrationIntentCount = 0;
    let count = 0;
    let totalCriteriaCount = 0;

    answerAnalyses.forEach((item) => {
      if (item.analysis?.scores) {
        const scores = item.analysis.scores;
        totalScoreSum += scores.total_score || 0;
        
        // Count criteria for this answer to calculate dynamic percentage
        let criteriaCount = 0;
        if (scores.migration_intent !== null && scores.migration_intent !== undefined) criteriaCount++;
        if (scores.financial_understanding !== null && scores.financial_understanding !== undefined) criteriaCount++;
        if (scores.academic_credibility !== null && scores.academic_credibility !== undefined) criteriaCount++;
        if (scores.specificity_research !== null && scores.specificity_research !== undefined) criteriaCount++;
        if (scores.consistency !== null && scores.consistency !== undefined) criteriaCount++;
        if (scores.communication_quality !== null && scores.communication_quality !== undefined) criteriaCount++;
        if (scores.red_flags !== null && scores.red_flags !== undefined) criteriaCount++;
        totalCriteriaCount += criteriaCount || 1;
        
        // Only count migration_intent if it's not null
        if (scores.migration_intent !== null && scores.migration_intent !== undefined) {
          migrationIntentSum += scores.migration_intent;
          migrationIntentCount++;
        }
        count++;
      }
    });

    if (count === 0) return null;

    // Convert scores to percentages using dynamic criteria count
    // Average criteria count per answer
    const avgCriteriaCount = totalCriteriaCount / count;
    const maxScore = avgCriteriaCount * 5;
    const minScore = avgCriteriaCount * 1;
    const scoreRange = maxScore - minScore;
    const avgTotal = scoreRange > 0 
      ? Math.max(0, Math.min(100, ((totalScoreSum / count - minScore) / scoreRange) * 100))
      : 0;
    
    // Migration intent percentage (only if we have values)
    const avgMigrationIntent = migrationIntentCount > 0 
      ? Math.max(0, Math.min(100, ((migrationIntentSum / migrationIntentCount - 1) / 4) * 100))
      : 0;

    // Get overall feedback from the last AI message if it contains overall feedback
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
  }, [finished, answerAnalyses, messages]);

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

      // Store analysis for later display (only show at end)
      // IMPORTANT: Store analysis BEFORE adding completion message to messages array
      // This ensures we can correctly identify the question text
      if (response.analysis && messageText) {
        // Use lastQuestionText captured before API call (most reliable)
        let questionText = lastQuestionText;
        
        // Only fallback if lastQuestionText is empty
        if (!questionText || questionText.trim() === "") {
          // Fallback: get the last AI message that's not a completion message
          // Use current messages state (before completion message is added)
          const aiMessages = messages.filter(m => 
            m.sender === "ai" && 
            !m.text.includes("Thank you") && 
            !m.text.includes("completing") &&
            !m.text.includes("overall grade") &&
            !m.text.includes("Good luck")
          );
          questionText = aiMessages[aiMessages.length - 1]?.text || `Question ${answerAnalyses.length + 1}`;
          console.log(`[DEBUG] Using fallback question text: ${questionText.substring(0, 50)}...`);
        }
        
        const answerText = messageText;
        const questionId = response.question_id; // Use question_id for more reliable duplicate detection

        setAnswerAnalyses(prev => {
          // Avoid duplicates - check by question_id if available, otherwise by question and answer text
          const exists = questionId
            ? prev.some(a => a.questionId === questionId)
            : prev.some(a => a.answer === answerText && a.question === questionText);

          if (exists) {
            console.log(`[DEBUG] Analysis already exists for question_id: ${questionId}, question: ${questionText.substring(0, 30)}...`);
            return prev;
          }

          console.log(`[DEBUG] Storing analysis #${prev.length + 1} for question_id: ${questionId || 'none'}, question: "${questionText.substring(0, 50)}..."`);
          return [
            ...prev,
            {
              question: questionText,
              answer: answerText,
              questionId: questionId,
              analysis: response.analysis,
            },
          ];
        });
      } else if (response.analysis && !messageText) {
        console.warn("[DEBUG] Analysis received but no messageText available");
      } else if (!response.analysis && messageText && !response.finished) {
        // Don't warn on finished responses without analysis - it might be a completion-only response
        console.warn(`[DEBUG] No analysis in response for answer: ${messageText.substring(0, 50)}...`);
      }

      // Update scores if provided (but don't display during interview)
      if (response.scores) {
        setScores(response.scores);
      }

      // Check if interview is finished
      if (response.finished) {
        setFinished(true);
        // Use the best emoji when the interview is fully finished
        changeEmoji("perfect");

        // If backend provides all_analyses, use that instead (most reliable)
        if (response.all_analyses && response.all_analyses.length > 0) {
          console.log(`[DEBUG] Received all_analyses from backend: ${response.all_analyses.length} analyses`);
          try {
            setAnswerAnalyses(
              response.all_analyses.map(item => ({
                question: item.question_text || '',
                answer: item.answer_text || '',
                questionId: item.question_id || undefined,
                analysis: item.analysis || undefined,
              }))
            );
          } catch (error) {
            console.error('[DEBUG] Error processing all_analyses:', error);
            // Fall through to fallback logic
          }
        } else {
          // Fallback: Final check: Ensure the last answer's analysis is stored when interview finishes
          // The analysis should already be stored above, but we verify here as a safety net
          if (response.analysis && messageText) {
            setAnswerAnalyses(prev => {
              // Check if this analysis is already stored
              const questionId = response.question_id;
              const exists = questionId
                ? prev.some(a => a.questionId === questionId)
                : prev.some(a => a.answer === messageText);

              if (exists) {
                console.log(`[DEBUG] Final check: Analysis already stored for question_id: ${questionId || 'none'}`);
                return prev;
              }

              // If not stored, store it now with the question text we captured before API call
              let questionText = lastQuestionText;
              if (!questionText || questionText.trim() === "") {
                // Last resort: try to get from messages before completion message
                const aiMessages = messages.filter(m => 
                  m.sender === "ai" && 
                  !m.text.includes("Thank you") && 
                  !m.text.includes("completing") &&
                  !m.text.includes("overall grade") &&
                  !m.text.includes("Good luck")
                );
                questionText = aiMessages[aiMessages.length - 1]?.text || `Question ${prev.length + 1}`;
              }

              console.log(`[DEBUG] Final check: Storing missing analysis #${prev.length + 1} for question_id: ${questionId || 'none'}`);
              return [
                ...prev,
                {
                  question: questionText,
                  answer: messageText,
                  questionId: questionId,
                  analysis: response.analysis,
                },
              ];
            });
          } else if (!response.analysis && messageText) {
            console.error(`[DEBUG] CRITICAL: Interview finished but no analysis for last answer! Answer: ${messageText.substring(0, 50)}...`);
          }
        }
      } else {
        // Change emoji based on answer quality – only once per answer, using new 5–25 grading system
        if (response.analysis && response.analysis.scores) {
          const totalScore = response.analysis.scores.total_score || 0;
          // New grading system mapping:
          // 15: Excellent     -> 😇 (perfect)
          // 13–14: Good       -> ☺️ (good)
          // 11–12: Average    -> 😕 (bad)
          //  3–10: Weak       -> 😟 (worst)
          if (totalScore === 15) {
            changeEmoji("perfect");
          } else if (totalScore >= 13) {
            changeEmoji("good");
          } else if (totalScore >= 11) {
            changeEmoji("bad");
          } else {
            changeEmoji("worst");
          }
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
    <div className="h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md flex-shrink-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-600 hover:text-indigo-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer bg-transparent border-none outline-none p-0"
            >
              <span className="text-2xl sm:text-3xl">🤖</span>
              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
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
              className="lg:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">AI Interviewer</h2>
            <p className="text-gray-500 text-center text-xs sm:text-sm mb-4 sm:mb-6">
              I'm here to chat with you and learn about your experiences!
            </p>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-50 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm text-green-700 font-medium">{statusTexts[emojiState]}</span>
            </div>

            {/* Progress Section */}
            <div className="w-full mb-4 sm:mb-6">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Interview Progress</span>
              </div>
              <div className="bg-gray-200 rounded-full h-2 sm:h-3 w-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-emerald-500 rounded-full h-2 sm:h-3 transition-all duration-500"
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
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-medium text-sm sm:text-base min-h-[44px]"
                  >
                    ⬆️ Try Next Level
                  </button>
                )}
                {/* Restart Interview Button */}
                <button
                  onClick={handleRestartInterview}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-medium text-sm sm:text-base min-h-[44px]"
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
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate mb-1">Interview Session</h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-indigo-100 text-xs sm:text-sm truncate">F1 Visa • Interview Practice</p>
                    {selectedLevel && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm ${selectedLevel === "easy" ? "bg-green-500/20 border border-green-300/30" :
                        selectedLevel === "medium" ? "bg-blue-500/20 border border-blue-300/30" :
                          "bg-purple-500/20 border border-purple-300/30"
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
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 bg-gradient-to-b from-gray-50 to-white">
              {/* Overall Grade Component - Show when finished */}
              {finished && overallGradeData && messages.length > 0 && (
                <div className="mb-6">
                  <OverallGrade scoreData={overallGradeData} />
                </div>
              )}

              {displayMessages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 shadow-md transition-all hover:shadow-lg ${message.sender === "ai"
                      ? "bg-white text-gray-800 border-2 border-indigo-100"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                      }`}
                  >
                    {message.sender === "ai" && (
                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                        <span className="text-lg sm:text-xl">🤖</span>
                        <span className="text-xs font-semibold text-indigo-600">AI Interviewer</span>
                      </div>
                    )}
                    <p className="text-xs sm:text-sm leading-relaxed break-words">
                      {message.sender === "ai" ? (
                        <TypewriterText text={message.text} messageId={message.id} />
                      ) : (
                        message.text
                      )}
                    </p>
                  </div>
                </div>
              ))}

              {/* Final per-answer analysis cards */}
              {finished && answerAnalyses.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-700 flex items-center gap-2">
                    <span>📊 Interview Results ({answerAnalyses.filter(a => a.analysis).length} of {selectedLevel === "easy" ? 4 : selectedLevel === "medium" ? 7 : 12} answers analyzed)</span>
                  </h3>
                  {answerAnalyses
                    .filter(item => item.analysis) // Only show items with analysis
                    .map((item, index) => (
                      <div
                        key={`${index}-${item.questionId || item.question}-${item.answer}`}
                        className="space-y-2"
                      >
                        <div className="text-xs sm:text-sm text-gray-600">
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
            <div className="border-t-2 border-gray-100 p-3 sm:p-4 md:p-6 bg-white">
              <form onSubmit={handleSend} className="flex gap-2 sm:gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={finished ? "Interview completed" : "Type your answer here..."}
                  disabled={finished}
                  className="flex-1 px-4 sm:px-6 py-3 sm:py-4 border-2 border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base transition-all text-gray-900 min-h-[44px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-medium text-sm sm:text-base min-h-[44px] min-w-[80px] sm:min-w-[100px]"
                >
                  <span className="hidden sm:inline">Send ➤</span>
                  <span className="sm:hidden">➤</span>
                </button>
              </form>
              <div className="hidden sm:flex items-center gap-4 mt-2 sm:mt-3 text-xs text-gray-400">
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

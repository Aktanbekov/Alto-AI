import React, { useState, useEffect, useRef } from 'react';
import { Send, X, AlertCircle, Sparkles, AlertTriangle, Lightbulb, User } from 'lucide-react';
import { Button } from './ui/Button';
import { createInterviewChat, sendMessageToChat, InterviewResponse } from '../services/geminiService';
import { Message } from '../types';
import { Chat } from "@google/genai";

interface SimulatorProps {
  onClose: () => void;
}

const Simulator: React.FC<SimulatorProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  
  // Feedback State
  const [feedback, setFeedback] = useState<InterviewResponse['feedback']>({
    score: 100,
    weakness: "None",
    suggestion: "Prepare to answer clearly."
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Chat
  useEffect(() => {
    const initChat = async () => {
      const chat = createInterviewChat();
      setChatSession(chat);
      setIsLoading(true);
      
      // Initial greeting from "Officer"
      try {
        const response = await sendMessageToChat(chat, "Start the interview now. Ask the first question.");
        setMessages([{
          id: 'init',
          role: 'model',
          text: response.text,
          timestamp: Date.now()
        }]);
        setFeedback(response.feedback);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    initChat();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !chatSession || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendMessageToChat(chatSession, userMsg.text);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, aiMsg]);
      setFeedback(response.feedback);

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col md:flex-row text-black overflow-hidden animate-fade-in">
      
      {/* Sidebar / AI Coach Hero */}
      <div className="w-full md:w-80 lg:w-96 bg-surface-alt border-r border-neutral-200 flex flex-col h-[40vh] md:h-full relative overflow-hidden">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between z-10">
          <span className="font-bold flex items-center gap-2 text-sm tracking-wider text-neutral-600">
            <Sparkles className="w-4 h-4 text-blue-500" />
            AI COACH
          </span>
          <button onClick={onClose} className="text-neutral-500 hover:text-black transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Animated Hero Area */}
        <div className="flex-1 flex flex-col items-center justify-start pt-8 px-6 relative z-10">
          
          {/* VisaBot Avatar */}
          <div className="relative w-32 h-32 mb-8 animate-float">
            {/* Glow behind */}
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl transform scale-150 animate-pulse-slow"></div>
            
            {/* Robot SVG */}
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
               {/* Body */}
               <rect x="20" y="20" width="60" height="60" rx="15" fill="#1a1a1a" />
               {/* Screen/Face */}
               <rect x="25" y="25" width="50" height="40" rx="10" fill="#000" />
               {/* Eyes Container */}
               <g className="animate-pulse">
                 {/* Left Eye */}
                 <circle cx="40" cy="45" r="5" fill="#3b82f6" />
                 {/* Right Eye */}
                 <circle cx="60" cy="45" r="5" fill="#3b82f6" />
               </g>
               {/* Mouth - changes based on loading */}
               {isLoading ? (
                  <rect x="40" y="55" width="20" height="2" fill="#fff" className="animate-ping" />
               ) : (
                  <path d="M 35 55 Q 50 60 65 55" stroke="#fff" strokeWidth="2" fill="none" />
               )}
               {/* Antennas */}
               <line x1="30" y1="20" x2="25" y2="10" stroke="#1a1a1a" strokeWidth="3" />
               <circle cx="25" cy="10" r="3" fill="#ef4444" />
            </svg>

            {/* Status Badge */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm border border-neutral-100 whitespace-nowrap">
              {isLoading ? "ANALYZING..." : "LISTENING"}
            </div>
          </div>

          {/* Real-time Feedback Cards */}
          <div className="w-full space-y-4 perspective-1000">
             
             {/* Recommendation Card */}
             <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-blue-50 rounded-lg">
                      <Lightbulb className="w-4 h-4 text-blue-600" />
                   </div>
                   <div>
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Suggestion</h4>
                      <p className="text-sm text-neutral-700 leading-snug">{feedback.suggestion}</p>
                   </div>
                </div>
             </div>

             {/* Weakness Card (Conditional) */}
             {feedback.weakness && feedback.weakness !== 'None' && (
               <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm relative overflow-hidden animate-fade-in-up">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <div className="flex items-start gap-3">
                     <div className="p-2 bg-red-50 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                     </div>
                     <div>
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Weak Point</h4>
                        <p className="text-sm text-neutral-700 leading-snug">{feedback.weakness}</p>
                     </div>
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* Background Decor */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-50">
           <div className="absolute top-[20%] right-[-20%] w-64 h-64 bg-blue-200/20 rounded-full blur-3xl"></div>
           <div className="absolute bottom-[-10%] left-[-20%] w-64 h-64 bg-purple-200/20 rounded-full blur-3xl"></div>
        </div>

        {/* Live Score at bottom */}
        <div className="p-6 bg-white border-t border-neutral-200 z-10">
            <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-semibold text-neutral-500">ANSWER SCORE</span>
                <span className={`text-xl font-bold ${feedback.score > 80 ? 'text-green-600' : feedback.score > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {feedback.score}/100
                </span>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                <div 
                    className={`h-full transition-all duration-1000 ease-out ${feedback.score > 80 ? 'bg-green-500' : feedback.score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${feedback.score}%` }}
                />
            </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-[60vh] md:h-full relative bg-white">
        
        {/* Officer Avatar/Placeholder header */}
        <div className="h-16 border-b border-neutral-200 flex items-center px-6 bg-white/80 backdrop-blur sticky top-0 z-20">
             <div className="w-8 h-8 bg-neutral-900 rounded-full flex items-center justify-center mr-3 border border-neutral-200 shadow-sm text-white">
                <User className="w-4 h-4" />
             </div>
             <div>
                 <h3 className="font-medium text-sm text-black">Consular Officer Smith</h3>
                 <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-xs text-neutral-500">Online</p>
                 </div>
             </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div 
                        className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-6 py-4 text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                                ? 'bg-black text-white rounded-br-none' 
                                : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-none'
                        }`}
                    >
                        {msg.text}
                    </div>
                </div>
            ))}
            {isLoading && (
                 <div className="flex justify-start animate-fade-in">
                    <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-none px-5 py-4 flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce delay-150"></span>
                        <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce delay-300"></span>
                    </div>
                 </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-neutral-200 bg-white/80 backdrop-blur-lg">
            <div className="max-w-3xl mx-auto relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your answer..."
                    disabled={isLoading}
                    autoFocus
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-full pl-6 pr-14 py-4 text-sm text-black focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 transition-all placeholder:text-neutral-400 shadow-sm"
                />
                <button 
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    className="absolute right-2 top-2 p-2 bg-black text-white rounded-full hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
            <div className="text-center mt-3">
                 <p className="text-[10px] text-neutral-400 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    AI can make mistakes. Treat this as practice, not legal advice.
                 </p>
            </div>
        </div>
      </div>

    </div>
  );
};

export default Simulator;
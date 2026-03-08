import React, { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, Award, MessageSquare, Sparkles, Bot, Zap } from 'lucide-react';

const F1VisaSimulator = () => {
  const [mode, setMode] = useState('select'); // select, interview, results
  const [interviewMode, setInterviewMode] = useState('standard'); // standard or ai-hybrid
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFollowUp, setAiFollowUp] = useState(null);
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);

  const questions = [
    {
      id: 'purpose',
      question: "Why do you want to study in the United States?",
      category: 'Intent',
      keyPoints: ['specific academic goals', 'program uniqueness', 'career aspirations', 'home country ties'],
      redFlags: ['immigrate', 'stay permanently', 'work only', 'vague reasons']
    },
    {
      id: 'university',
      question: "Why did you choose this particular university?",
      category: 'Academic Preparation',
      keyPoints: ['specific program features', 'faculty research', 'facilities', 'rankings/reputation'],
      redFlags: ['just any university', 'random choice', 'only because accepted']
    },
    {
      id: 'major',
      question: "What will you study and why this field?",
      category: 'Academic Preparation',
      keyPoints: ['specific major', 'background alignment', 'career connection', 'passion/interest'],
      redFlags: ['unsure', 'changed multiple times', 'no clear connection to background']
    },
    {
      id: 'funding',
      question: "How will you pay for your education?",
      category: 'Financial Capability',
      keyPoints: ['specific funding sources', 'family support', 'scholarships', 'sufficient amount'],
      redFlags: ['work in US', 'will find a way', 'loans without collateral', 'vague sources']
    },
    {
      id: 'plans',
      question: "What are your plans after graduation?",
      category: 'Non-immigrant Intent',
      keyPoints: ['return home', 'specific career in home country', 'family ties', 'opportunities back home'],
      redFlags: ['stay in US', 'work in US long-term', 'immigrate', 'no plans']
    },
    {
      id: 'ties',
      question: "What ties do you have to your home country?",
      category: 'Non-immigrant Intent',
      keyPoints: ['family', 'property', 'job offers', 'cultural/social connections'],
      redFlags: ['none', 'weak connections', 'no family', 'nothing important']
    }
  ];

  const analyzeAnswerRuleBased = (question, answer) => {
    const analysis = {
      score: 0,
      strengths: [],
      weaknesses: [],
      redFlags: [],
      suggestions: []
    };

    const lowerAnswer = answer.toLowerCase();
    const wordCount = answer.trim().split(/\s+/).length;

    if (wordCount < 15) {
      analysis.weaknesses.push('Answer is too brief - lacks detail and specificity');
      analysis.suggestions.push('Provide more detailed explanations with specific examples');
    } else if (wordCount > 100) {
      analysis.weaknesses.push('Answer is too lengthy - may lose interviewer\'s attention');
      analysis.suggestions.push('Be more concise while maintaining key information');
    } else {
      analysis.score += 15;
      analysis.strengths.push('Appropriate length and detail');
    }

    let keyPointsFound = 0;
    question.keyPoints.forEach(point => {
      const keywords = point.split(' ');
      if (keywords.some(kw => lowerAnswer.includes(kw.toLowerCase()))) {
        keyPointsFound++;
      }
    });

    if (keyPointsFound >= 2) {
      analysis.score += 30;
      analysis.strengths.push(`Covers ${keyPointsFound} important aspects expected by visa officers`);
    } else if (keyPointsFound === 1) {
      analysis.score += 15;
      analysis.weaknesses.push('Could mention more relevant details');
      analysis.suggestions.push(`Try to include: ${question.keyPoints.join(', ')}`);
    } else {
      analysis.weaknesses.push('Missing key information visa officers look for');
      analysis.suggestions.push(`Should address: ${question.keyPoints.slice(0, 2).join(', ')}`);
    }

    question.redFlags.forEach(flag => {
      if (lowerAnswer.includes(flag.toLowerCase())) {
        analysis.redFlags.push(`Concerning phrase detected: "${flag}"`);
        analysis.score -= 20;
      }
    });

    const specificIndicators = /\b(specifically|particular|because|example|such as|\d{4}|university of|program in)\b/gi;
    const specificMatches = (answer.match(specificIndicators) || []).length;
    
    if (specificMatches >= 2) {
      analysis.score += 20;
      analysis.strengths.push('Answer shows good specificity and concrete details');
    } else {
      analysis.weaknesses.push('Answer could be more specific');
      analysis.suggestions.push('Include specific names, numbers, or examples to strengthen credibility');
    }

    const confidentPhrases = /\b(I will|I am|I have|my goal|I plan)\b/gi;
    const uncertainPhrases = /\b(maybe|might|probably|I think|I guess|not sure)\b/gi;
    
    const confidentCount = (answer.match(confidentPhrases) || []).length;
    const uncertainCount = (answer.match(uncertainPhrases) || []).length;

    if (confidentCount > uncertainCount) {
      analysis.score += 15;
      analysis.strengths.push('Demonstrates confidence and clear intent');
    } else if (uncertainCount > 0) {
      analysis.weaknesses.push('Shows uncertainty or lack of conviction');
      analysis.suggestions.push('Use more confident language (I will, I am, My plan is)');
    }

    if (question.category === 'Financial Capability') {
      const hasNumbers = /\$|USD|\d+,?\d*/.test(answer);
      const hasSources = /(parent|family|sponsor|scholarship|savings|bank)/gi.test(answer);
      
      if (hasNumbers && hasSources) {
        analysis.score += 20;
        analysis.strengths.push('Provides specific financial information with sources');
      } else if (!hasNumbers) {
        analysis.weaknesses.push('Missing specific financial amounts');
        analysis.suggestions.push('Mention approximate costs and funding amounts');
      } else if (!hasSources) {
        analysis.weaknesses.push('Unclear funding sources');
        analysis.suggestions.push('Clearly state who is funding your education');
      }
    }

    if (question.category === 'Non-immigrant Intent') {
      const homeCountryMentions = /(home|country|back|return|family|India|China|Nigeria|Brazil|Mexico)/gi.test(answer);
      const usFocused = /(stay in us|live in america|settle|green card)/gi.test(answer);
      
      if (homeCountryMentions && !usFocused) {
        analysis.score += 25;
        analysis.strengths.push('Clearly demonstrates intent to return home');
      } else if (usFocused) {
        analysis.redFlags.push('CRITICAL: Suggests intent to immigrate - major visa denial risk');
        analysis.score -= 30;
      } else {
        analysis.weaknesses.push('Does not clearly establish ties to home country');
        analysis.suggestions.push('Emphasize your connections and plans in your home country');
      }
    }

    analysis.score = Math.max(0, Math.min(100, analysis.score + 40));
    return analysis;
  };

  const generateAIFollowUp = async (question, answer) => {
    setIsLoadingFollowUp(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are a U.S. visa officer conducting an F1 visa interview. Based on the applicant's answer, generate ONE challenging but fair follow-up question that a real visa officer would ask. The question should probe deeper into potential concerns or verify the authenticity of their claims.

Original Question: ${question.question}
Category: ${question.category}
Applicant's Answer: "${answer}"

Key concerns visa officers look for:
- Non-immigrant intent (will they return home?)
- Financial capability (legitimate funding sources)
- Academic preparation (genuine interest and plans)
- Consistency and specificity in answers

Generate a follow-up question that:
1. Sounds natural and conversational (like a real officer)
2. Probes any vague or concerning aspects of their answer
3. Tests their knowledge and authenticity
4. Is direct and specific (not generic)

Respond with ONLY the follow-up question, nothing else.`
            }
          ]
        })
      });

      const data = await response.json();
      const followUpQuestion = data.content[0].text.trim();
      
      setAiFollowUp({
        question: followUpQuestion,
        originalQuestion: question.question,
        originalAnswer: answer
      });
      
      setConversationHistory([
        ...conversationHistory,
        { type: 'main', question: question.question, answer },
        { type: 'followup', question: followUpQuestion }
      ]);
      
    } catch (error) {
      console.error('Error generating follow-up:', error);
      setAiFollowUp(null);
    }
    setIsLoadingFollowUp(false);
  };

  const generateAIEnhancedAnalysis = async (allAnswers) => {
    try {
      const conversationText = questions.map((q, idx) => {
        const answer = allAnswers[q.id] || '';
        const followUpAnswer = allAnswers[`${q.id}_followup`] || '';
        let text = `Q${idx + 1}: ${q.question}\nAnswer: ${answer}`;
        if (followUpAnswer) {
          const followUpQ = conversationHistory.find(h => h.type === 'followup' && conversationHistory[conversationHistory.indexOf(h) - 1]?.answer === answer);
          if (followUpQ) {
            text += `\n  Follow-up: ${followUpQ.question}\n  Answer: ${followUpAnswer}`;
          }
        }
        return text;
      }).join('\n\n');

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: `You are an experienced U.S. visa officer evaluating an F1 visa interview. Analyze this complete interview and provide a comprehensive assessment.

Interview Transcript:
${conversationText}

Provide your analysis in this EXACT JSON format (no markdown, just pure JSON):
{
  "overallVerdict": "Strong Approval / Moderate Chance / High Risk of Denial",
  "approvalLikelihood": 75,
  "criticalIssues": ["issue 1", "issue 2"],
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "redFlags": ["red flag 1"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "officerNotes": "Brief narrative assessment as a visa officer would write (2-3 sentences)",
  "questionAnalysis": {
    "purpose": {
      "aiScore": 85,
      "aiStrengths": ["specific strength"],
      "aiWeaknesses": ["specific weakness"],
      "aiSuggestions": ["specific suggestion"]
    },
    "university": { "aiScore": 70, "aiStrengths": [], "aiWeaknesses": [], "aiSuggestions": [] },
    "major": { "aiScore": 80, "aiStrengths": [], "aiWeaknesses": [], "aiSuggestions": [] },
    "funding": { "aiScore": 90, "aiStrengths": [], "aiWeaknesses": [], "aiSuggestions": [] },
    "plans": { "aiScore": 75, "aiStrengths": [], "aiWeaknesses": [], "aiSuggestions": [] },
    "ties": { "aiScore": 65, "aiStrengths": [], "aiWeaknesses": [], "aiSuggestions": [] }
  }
}

Focus on:
1. Non-immigrant intent (most critical - 40% weight)
2. Financial capability (25% weight)
3. Academic preparation (20% weight)
4. Answer consistency and credibility (15% weight)

For each question, provide AI scores (0-100) and specific feedback. Be realistic and direct - this is practice for a real interview.`
            }
          ]
        })
      });

      const data = await response.json();
      let aiAnalysisText = data.content[0].text.trim();
      
      // Remove markdown code blocks if present
      aiAnalysisText = aiAnalysisText.replace(/```json\n?|\n?```/g, '').trim();
      
      const aiAnalysis = JSON.parse(aiAnalysisText);
      
      return aiAnalysis;
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return null;
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) return;

    const newAnswers = {
      ...answers,
      [questions[currentQuestion].id]: currentAnswer
    };
    setAnswers(newAnswers);

    if (interviewMode === 'ai-hybrid' && currentQuestion < questions.length - 1) {
      await generateAIFollowUp(questions[currentQuestion], currentAnswer);
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setCurrentAnswer('');
      setAiFollowUp(null);
    } else {
      await generateFinalAnalysis(newAnswers);
    }
  };

  const handleFollowUpAnswer = () => {
    if (!currentAnswer.trim()) return;
    
    const followUpKey = `${questions[currentQuestion].id}_followup`;
    setAnswers({
      ...answers,
      [followUpKey]: currentAnswer
    });

    setConversationHistory([
      ...conversationHistory.slice(0, -1),
      { ...conversationHistory[conversationHistory.length - 1], answer: currentAnswer }
    ]);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setCurrentAnswer('');
      setAiFollowUp(null);
    } else {
      generateFinalAnalysis({
        ...answers,
        [followUpKey]: currentAnswer
      });
    }
  };

  const generateFinalAnalysis = async (finalAnswers) => {
    setIsAnalyzing(true);
    
    // Always do rule-based analysis
    const detailedAnalysis = {};
    let totalScore = 0;
    let categoryScores = {};

    questions.forEach(q => {
      const answer = finalAnswers[q.id] || '';
      const analysis = analyzeAnswerRuleBased(q, answer);
      detailedAnalysis[q.id] = analysis;
      totalScore += analysis.score;

      if (!categoryScores[q.category]) {
        categoryScores[q.category] = { total: 0, count: 0 };
      }
      categoryScores[q.category].total += analysis.score;
      categoryScores[q.category].count += 1;
    });

    const avgScore = totalScore / questions.length;
    
    Object.keys(categoryScores).forEach(cat => {
      categoryScores[cat].average = categoryScores[cat].total / categoryScores[cat].count;
    });

    let verdict = '';
    let verdictColor = '';
    let recommendations = [];

    if (avgScore >= 80) {
      verdict = 'Strong Approval Likelihood';
      verdictColor = 'text-green-600';
      recommendations.push('Your answers demonstrate clear intent, good preparation, and strong ties to home country');
      recommendations.push('Minor refinements suggested above will further strengthen your interview');
    } else if (avgScore >= 65) {
      verdict = 'Moderate Approval Chance';
      verdictColor = 'text-yellow-600';
      recommendations.push('You have a reasonable chance but need to address the weaknesses identified');
      recommendations.push('Focus on demonstrating non-immigrant intent more clearly');
      recommendations.push('Provide more specific details about your plans and funding');
    } else {
      verdict = 'High Risk of Denial';
      verdictColor = 'text-red-600';
      recommendations.push('Significant concerns about visa approval based on current answers');
      recommendations.push('Must address all red flags and weaknesses before real interview');
      recommendations.push('Consider practicing with an immigration consultant');
    }

    let aiInsights = null;
    if (interviewMode === 'ai-hybrid') {
      aiInsights = await generateAIEnhancedAnalysis(finalAnswers);
      
      // Merge AI analysis into detailed analysis
      if (aiInsights && aiInsights.questionAnalysis) {
        Object.keys(aiInsights.questionAnalysis).forEach(qId => {
          if (detailedAnalysis[qId]) {
            detailedAnalysis[qId].aiScore = aiInsights.questionAnalysis[qId].aiScore;
            detailedAnalysis[qId].aiStrengths = aiInsights.questionAnalysis[qId].aiStrengths;
            detailedAnalysis[qId].aiWeaknesses = aiInsights.questionAnalysis[qId].aiWeaknesses;
            detailedAnalysis[qId].aiSuggestions = aiInsights.questionAnalysis[qId].aiSuggestions;
          }
        });
      }
    }

    setAnalysis({
      detailed: detailedAnalysis,
      overall: avgScore,
      categoryScores,
      verdict,
      verdictColor,
      recommendations,
      aiInsights,
      conversationHistory
    });

    setIsAnalyzing(false);
    setShowResults(true);
  };

  const resetSimulator = () => {
    setMode('select');
    setCurrentQuestion(0);
    setAnswers({});
    setCurrentAnswer('');
    setShowResults(false);
    setAnalysis(null);
    setAiFollowUp(null);
    setConversationHistory([]);
  };

  if (mode === 'select') {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">F1 Visa Interview Simulator</h1>
          <p className="text-gray-600 mb-8">Choose your interview experience level</p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Standard Mode - No AI */}
            <div 
              onClick={() => {
                setInterviewMode('standard');
                setMode('interview');
              }}
              className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition cursor-pointer"
            >
              <div className="flex items-center mb-4">
                <Zap className="w-8 h-8 text-blue-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-800">Quick Practice</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Fast rule-based analysis without AI. Perfect for quick practice sessions.
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <p>✓ 6 essential questions</p>
                <p>✓ Instant rule-based feedback</p>
                <p>✓ Category scoring</p>
                <p>✓ No AI processing (fast)</p>
                <p>✓ ~3-5 minutes</p>
              </div>
              <div className="mt-4 bg-gray-50 rounded p-3 text-xs text-gray-600">
                <strong>Analysis Method:</strong> Keyword matching, length checks, red flag detection
              </div>
              <button className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                Start Quick Practice
              </button>
            </div>

            {/* AI-Hybrid Mode */}
            <div 
              onClick={() => {
                setInterviewMode('ai-hybrid');
                setMode('interview');
              }}
              className="border-2 border-purple-200 rounded-lg p-6 hover:border-purple-500 hover:shadow-lg transition cursor-pointer bg-gradient-to-br from-purple-50 to-blue-50"
            >
              <div className="flex items-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-800">AI-Enhanced Interview</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Hybrid approach: instant rule-based scores + deep AI analysis for realistic practice.
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <p>✓ AI-generated follow-up questions</p>
                <p>✓ Rule-based instant scoring</p>
                <p>✓ AI visa officer perspective</p>
                <p>✓ Per-question AI feedback</p>
                <p>✓ ~8-12 minutes</p>
              </div>
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded p-3 text-xs text-gray-700">
                <strong>Analysis Method:</strong> Rule-based scores + AI contextual analysis + AI follow-ups
              </div>
              <button className="mt-6 w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition">
                Start AI Interview
              </button>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 Recommendation:</strong> Start with Quick Practice for speed, then use AI-Enhanced for deeper, realistic preparation before your actual interview.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showResults && analysis) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Interview Analysis Report</h1>
            {interviewMode === 'ai-hybrid' && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                <Sparkles className="w-4 h-4 mr-1" />
                AI-Enhanced
              </span>
            )}
          </div>
          
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Rule-Based Score</h2>
                <p className="text-4xl font-bold">{analysis.overall.toFixed(1)}%</p>
                <p className="text-sm mt-2 opacity-90">Based on keyword analysis, structure, and red flags</p>
              </div>
              <Award className="w-16 h-16 opacity-80" />
            </div>
            <div className="mt-4">
              <p className={`text-2xl font-semibold ${analysis.verdictColor.replace('text-', 'text-white')}`}>
                {analysis.verdict}
              </p>
            </div>
          </div>

          {/* AI Insights */}
          {analysis.aiInsights && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
              <div className="flex items-center mb-4">
                <Bot className="w-6 h-6 text-purple-600 mr-2" />
                <h3 className="text-xl font-semibold text-purple-900">AI Visa Officer Assessment</h3>
              </div>
              
              <div className="mb-4 bg-white rounded-lg p-4 border border-purple-100">
                <p className="text-sm font-semibold text-purple-800 mb-2">Officer's Verdict</p>
                <p className="text-lg font-semibold text-gray-800">{analysis.aiInsights.overallVerdict}</p>
                <div className="mt-2 flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-4 mr-3">
                    <div 
                      className={`h-4 rounded-full ${
                        analysis.aiInsights.approvalLikelihood >= 75 ? 'bg-green-500' : 
                        analysis.aiInsights.approvalLikelihood >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${analysis.aiInsights.approvalLikelihood}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{analysis.aiInsights.approvalLikelihood}% Approval Likelihood</span>
                </div>
              </div>

              <div className="mb-4 bg-white rounded-lg p-4 border border-purple-100">
                <p className="text-sm font-semibold text-purple-800 mb-2">Officer's Notes</p>
                <p className="text-gray-700 italic">"{analysis.aiInsights.officerNotes}"</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {analysis.aiInsights.criticalIssues && analysis.aiInsights.criticalIssues.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-sm font-semibold text-red-700 mb-2 flex items-center">
                      <XCircle className="w-4 h-4 mr-1" /> Critical Issues
                    </p>
                    <ul className="space-y-1">
                      {analysis.aiInsights.criticalIssues.map((issue, idx) => (
                        <li key={idx} className="text-sm text-gray-700">• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.aiInsights.strengths && analysis.aiInsights.strengths.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-sm font-semibold text-green-700 mb-2 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" /> Key Strengths
                    </p>
                    <ul className="space-y-1">
                      {analysis.aiInsights.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-gray-700">• {strength}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {analysis.aiInsights.recommendations && analysis.aiInsights.recommendations.length > 0 && (
                <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800 mb-2">AI Recommendations</p>
                  <ul className="space-y-1">
                    {analysis.aiInsights.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-gray-700">💡 {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-4">Category Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(analysis.categoryScores).map(([category, data]) => (
                <div key={category} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-700 mb-2">{category}</h4>
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
                      <div 
                        className={`h-3 rounded-full ${
                          data.average >= 75 ? 'bg-green-500' : 
                          data.average >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${data.average}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold">{data.average.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Detailed Question Analysis</h3>
            {questions.map((q, idx) => {
              const ans = analysis.detailed[q.id];
              const hasAI = interviewMode === 'ai-hybrid' && ans.aiScore !== undefined;
              
              return (
                <div key={q.id} className="border border-gray-200 rounded-lg p-5 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 mb-1">Q{idx + 1}: {q.question}</p>
                      <p className="text-sm text-gray-600 italic mb-2">"{answers[q.id]}"</p>
                    </div>
                    <div className="ml-4">
                      <div className={`text-2xl font-bold ${
                        ans.score >= 75 ? 'text-green-600' : 
                        ans.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {ans.score}
                      </div>
                      <p className="text-xs text-gray-500 text-center">Rule-based</p>
                      {hasAI && (
                        <>
                          <div className={`text-2xl font-bold mt-2 ${
                            ans.aiScore >= 75 ? 'text-green-600' : 
                            ans.aiScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {ans.aiScore}
                          </div>
                          <p className="text-xs text-purple-600 text-center flex items-center">
                            <Sparkles className="w-3 h-3 mr-1" />AI Score
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Rule-based Analysis */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Rule-Based Analysis</p>
                    
                    {ans.strengths.length > 0 && (
                      <div className="mb-3">
                        <p className="font-semibold text-green-700 mb-1 flex items-center text-sm">
                          <CheckCircle className="w-4 h-4 mr-2" /> Strengths
                        </p>
                        <ul className="ml-6 text-sm text-gray-700">
                          {ans.strengths.map((s, i) => (
                            <li key={i} className="mb-1">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ans.weaknesses.length > 0 && (
                      <div className="mb-3">
                        <p className="font-semibold text-yellow-700 mb-1 flex items-center text-sm">
                          <AlertCircle className="w-4 h-4 mr-2" /> Areas for Improvement
                        </p>
                        <ul className="ml-6 text-sm text-gray-700">
                          {ans.weaknesses.map((w, i) => (
                            <li key={i} className="mb-1">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ans.redFlags.length > 0 && (
                      <div className="mb-3">
                        <p className="font-semibold text-red-700 mb-1 flex items-center text-sm">
                          <XCircle className="w-4 h-4 mr-2" /> Critical Issues
                        </p>
                        <ul className="ml-6 text-sm text-gray-700">
                          {ans.redFlags.map((r, i) => (
                            <li key={i} className="mb-1 text-red-600 font-medium">• {r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ans.suggestions.length > 0 && (
                      <div>
                        <p className="font-semibold text-blue-700 mb-1 text-sm">💡 Suggestions</p>
                        <ul className="ml-6 text-sm text-gray-700">
                          {ans.suggestions.map((s, i) => (
                            <li key={i} className="mb-1">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* AI Analysis */}
                  {hasAI && (ans.aiStrengths?.length > 0 || ans.aiWeaknesses?.length > 0 || ans.aiSuggestions?.length > 0) && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <p className="text-xs font-semibold text-purple-700 mb-2 uppercase flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" /> AI Officer Feedback
                      </p>
                      
                      {ans.aiStrengths && ans.aiStrengths.length > 0 && (
                        <div className="mb-3">
                          <p className="font-semibold text-green-700 mb-1 flex items-center text-sm">
                            <CheckCircle className="w-4 h-4 mr-2" /> AI Identified Strengths
                          </p>
                          <ul className="ml-6 text-sm text-gray-700">
                            {ans.aiStrengths.map((s, i) => (
                              <li key={i} className="mb-1">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {ans.aiWeaknesses && ans.aiWeaknesses.length > 0 && (
                        <div className="mb-3">
                          <p className="font-semibold text-orange-700 mb-1 flex items-center text-sm">
                            <AlertCircle className="w-4 h-4 mr-2" /> AI Identified Concerns
                          </p>
                          <ul className="ml-6 text-sm text-gray-700">
                            {ans.aiWeaknesses.map((w, i) => (
                              <li key={i} className="mb-1">• {w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {ans.aiSuggestions && ans.aiSuggestions.length > 0 && (
                        <div>
                          <p className="font-semibold text-purple-700 mb-1 text-sm">🤖 AI Suggestions</p>
                          <ul className="ml-6 text-sm text-gray-700">
                            {ans.aiSuggestions.map((s, i) => (
                              <li key={i} className="mb-1">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={resetSimulator}
            className="mt-8 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Start New Practice Interview
          </button>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="max-w-2xl mx-auto p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-700">
            {interviewMode === 'ai-hybrid' ? 'AI is analyzing your interview...' : 'Analyzing your interview responses...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {interviewMode === 'ai-hybrid' ? 'Getting rule-based scores + AI visa officer perspective' : 'Evaluating answers against visa officer criteria'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-800">F1 Visa Interview</h1>
            {interviewMode === 'ai-hybrid' && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                <Sparkles className="w-4 h-4 mr-1" />
                AI-Enhanced
              </span>
            )}
          </div>
          <p className="text-gray-600">Practice with realistic questions and get detailed feedback</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>{Math.round(((currentQuestion) / questions.length) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {!aiFollowUp ? (
          <>
            <div className="bg-blue-50 border-l-4 border-blue-600 p-6 mb-6 rounded">
              <div className="flex items-start">
                <MessageSquare className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm text-blue-800 font-semibold mb-2">
                    {questions[currentQuestion].category}
                  </p>
                  <p className="text-lg text-gray-800 font-medium">
                    {questions[currentQuestion].question}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Answer
              </label>
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="6"
                placeholder="Type your answer here as you would speak in the interview..."
              />
              <p className="text-sm text-gray-500 mt-2">
                Tip: Be specific, confident, and honest. Aim for 20-50 words.
              </p>
            </div>

            <div className="flex gap-4">
              {currentQuestion > 0 && (
                <button
                  onClick={() => {
                    setCurrentQuestion(currentQuestion - 1);
                    setCurrentAnswer(answers[questions[currentQuestion - 1].id] || '');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Previous
                </button>
              )}
              <button
                onClick={handleSubmitAnswer}
                disabled={!currentAnswer.trim() || isLoadingFollowUp}
                className={`flex-1 py-3 rounded-lg font-semibold transition ${
                  currentAnswer.trim() && !isLoadingFollowUp
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoadingFollowUp ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating AI follow-up...
                  </span>
                ) : (
                  currentQuestion === questions.length - 1 ? 'Finish & Get Analysis' : 'Next Question'
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-purple-50 border-l-4 border-purple-600 p-6 mb-6 rounded">
              <div className="flex items-start">
                <Bot className="w-6 h-6 text-purple-600 mr-3 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm text-purple-800 font-semibold mb-2 flex items-center">
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI Follow-up Question
                  </p>
                  <p className="text-lg text-gray-800 font-medium">
                    {aiFollowUp.question}
                  </p>
                  <p className="text-xs text-gray-500 mt-3 italic">
                    Based on your answer: "{aiFollowUp.originalAnswer}"
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Follow-up Answer
              </label>
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                className="w-full p-4 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows="5"
                placeholder="Answer the follow-up question..."
              />
              <p className="text-sm text-purple-600 mt-2">
                💡 Visa officers ask follow-ups to verify your claims. Stay consistent and specific.
              </p>
            </div>

            <button
              onClick={handleFollowUpAnswer}
              disabled={!currentAnswer.trim()}
              className={`w-full py-3 rounded-lg font-semibold transition ${
                currentAnswer.trim()
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {currentQuestion === questions.length - 1 ? 'Finish & Get Analysis' : 'Continue to Next Question'}
            </button>
          </>
        )}

        <div className="mt-8 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-2">💡 Interview Tips:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Be specific with names, numbers, and details</li>
            <li>• Show strong ties to your home country</li>
            <li>• Demonstrate clear post-graduation plans to return home</li>
            <li>• Avoid mentioning desire to work or stay in the US</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default F1VisaSimulator;
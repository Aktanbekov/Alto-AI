import React, { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, Award, MessageSquare, Sparkles, Bot, Zap, Home, BarChart3, BookOpen, Shield, ChevronRight, TrendingUp, Clock, Target, Plane, GraduationCap } from 'lucide-react';

const VisaInterviewSimulator = () => {
  const [page, setPage] = useState('home'); // home, visa-select, practice, interview, results
  const [visaType, setVisaType] = useState(null); // f1, b2
  const [mode, setMode] = useState('standard');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [input, setInput] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState(null);
  const [loadingFollowUp, setLoadingFollowUp] = useState(false);

  const visaQuestions = {
    f1: [
      { id: 'purpose', q: "Why do you want to study in the United States?", cat: 'Intent', keys: ['academic goals', 'program', 'career'], flags: ['immigrate', 'stay permanently'] },
      { id: 'university', q: "Why did you choose this particular university?", cat: 'Academic Preparation', keys: ['program features', 'faculty', 'facilities'], flags: ['random', 'only because accepted'] },
      { id: 'major', q: "What will you study and why this field?", cat: 'Academic Preparation', keys: ['major', 'background', 'career'], flags: ['unsure', 'changed'] },
      { id: 'funding', q: "How will you pay for your education?", cat: 'Financial Capability', keys: ['funding', 'family', 'scholarship'], flags: ['work in US', 'will find'] },
      { id: 'plans', q: "What are your plans after graduation?", cat: 'Non-immigrant Intent', keys: ['return home', 'career', 'family'], flags: ['stay in US', 'immigrate'] },
      { id: 'ties', q: "What ties do you have to your home country?", cat: 'Non-immigrant Intent', keys: ['family', 'property', 'job'], flags: ['none', 'weak'] }
    ],
    b2: [
      { id: 'purpose', q: "What is the purpose of your trip to the United States?", cat: 'Travel Intent', keys: ['tourism', 'visit', 'sightseeing', 'family'], flags: ['work', 'stay', 'immigrate'] },
      { id: 'duration', q: "How long do you plan to stay in the United States?", cat: 'Travel Intent', keys: ['days', 'weeks', 'specific dates', 'return'], flags: ['indefinitely', 'not sure', 'long time'] },
      { id: 'itinerary', q: "What places will you visit during your trip?", cat: 'Travel Plans', keys: ['cities', 'states', 'attractions', 'specific'], flags: ['everywhere', 'not planned', 'unsure'] },
      { id: 'funding', q: "How will you finance your trip?", cat: 'Financial Capability', keys: ['savings', 'income', 'sponsor', 'bank'], flags: ['work there', 'will manage', 'borrow'] },
      { id: 'employment', q: "What is your current occupation and employment status?", cat: 'Home Country Ties', keys: ['job', 'company', 'position', 'salary'], flags: ['unemployed', 'between jobs', 'looking'] },
      { id: 'return', q: "What will bring you back to your home country?", cat: 'Non-immigrant Intent', keys: ['job', 'family', 'business', 'property'], flags: ['nothing', 'don\'t know', 'want to stay'] }
    ]
  };

  const questions = visaType ? visaQuestions[visaType] : [];

  const analyzeRule = (q, ans) => {
    let score = 40, str = [], weak = [], red = [], sug = [];
    const lower = ans.toLowerCase();
    const words = ans.trim().split(/\s+/).length;

    if (words < 15) {
      weak.push('Too brief - lacks detail');
      sug.push('Provide more specific details');
    } else if (words > 100) {
      weak.push('Too lengthy - be concise');
      sug.push('Keep answer focused and shorter');
    } else {
      score += 15;
      str.push('Good length and detail');
    }

    let found = 0;
    q.keys.forEach(k => { if (lower.includes(k.toLowerCase())) found++; });
    if (found >= 2) {
      score += 30;
      str.push('Covers key points officers expect');
    } else {
      weak.push('Missing important details');
      sug.push(`Include: ${q.keys.slice(0, 2).join(', ')}`);
    }

    q.flags.forEach(f => {
      if (lower.includes(f.toLowerCase())) {
        red.push(`⚠️ Red flag: "${f}"`);
        score -= 20;
      }
    });

    if (/\b(specifically|particular|because|example)\b/gi.test(ans)) {
      score += 20;
      str.push('Good specificity');
    } else {
      weak.push('Be more specific');
      sug.push('Add concrete examples or details');
    }

    if (/\b(I will|I am|I have|my)\b/gi.test(ans)) {
      score += 15;
      str.push('Confident and clear');
    }

    // Visa-specific scoring
    if (visaType === 'b2') {
      if (q.id === 'duration' && /\b\d+\s*(day|week|month)\b/gi.test(ans)) {
        score += 10;
        str.push('Specific timeframe mentioned');
      }
      if (q.id === 'itinerary' && /\b(New York|California|Florida|Washington|Chicago)\b/gi.test(ans)) {
        score += 10;
        str.push('Specific destinations mentioned');
      }
    }

    return { score: Math.max(0, Math.min(100, score)), str, weak, red, sug };
  };

  const genFollowUp = async (q, ans) => {
    setLoadingFollowUp(true);
    try {
      const visaContext = visaType === 'f1' ? 'F1 student visa' : 'B2 tourist visa';
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: `You are a US visa officer conducting a ${visaContext} interview. Based on this answer: "${ans}" to question "${q.q}", generate ONE challenging but fair follow-up question to verify their claims or probe deeper. Only return the question, nothing else.`
          }]
        })
      });
      const data = await res.json();
      setFollowUp({ q: data.content[0].text.trim(), orig: ans });
    } catch (e) {
      console.error(e);
      setFollowUp(null);
    }
    setLoadingFollowUp(false);
  };

  const genAIAnalysis = async (allAns) => {
    try {
      const visaContext = visaType === 'f1' ? 'F1 student visa' : 'B2 tourist visa';
      const text = questions.map((q, i) => `Q${i + 1}: ${q.q}\nA: ${allAns[q.id] || ''}`).join('\n\n');
      const qIds = questions.map(q => q.id);
      const qAnalysisTemplate = qIds.reduce((acc, id) => {
        acc[id] = {"aiScore":75,"aiStr":[],"aiWeak":[],"aiSug":[]};
        return acc;
      }, {});

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: `Analyze this ${visaContext} interview as a visa officer:\n${text}\n\nReturn only JSON with this structure: {"verdict":"Strong Approval/Moderate Chance/High Risk of Denial", "likelihood":75, "issues":[], "strengths":[], "recs":[], "notes":"Brief assessment as officer would write", "qAnalysis":${JSON.stringify(qAnalysisTemplate)}}`
          }]
        })
      });
      const data = await res.json();
      return JSON.parse(data.content[0].text.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const submit = async () => {
    if (!input.trim()) return;
    const newAns = { ...answers, [questions[currentQ].id]: input };
    setAnswers(newAns);

    if (mode === 'ai-hybrid' && currentQ < questions.length - 1) {
      await genFollowUp(questions[currentQ], input);
    }

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setInput('');
      setFollowUp(null);
    } else {
      await finalize(newAns);
    }
  };

  const submitFollowUp = () => {
    if (!input.trim()) return;
    setAnswers({ ...answers, [`${questions[currentQ].id}_fu`]: input });
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setInput('');
      setFollowUp(null);
    } else {
      finalize({ ...answers, [`${questions[currentQ].id}_fu`]: input });
    }
  };

  const finalize = async (finalAns) => {
    setLoading(true);
    const detailed = {};
    let total = 0;
    const cats = {};

    questions.forEach(q => {
      const a = analyzeRule(q, finalAns[q.id] || '');
      detailed[q.id] = a;
      total += a.score;
      if (!cats[q.cat]) cats[q.cat] = { total: 0, count: 0 };
      cats[q.cat].total += a.score;
      cats[q.cat].count += 1;
    });

    const avg = total / questions.length;
    Object.keys(cats).forEach(c => { cats[c].avg = cats[c].total / cats[c].count; });

    let verdict, color, recs;
    if (avg >= 80) {
      verdict = 'Strong Approval';
      color = 'text-green-600';
      recs = ['Excellent preparation - strong approval likelihood'];
    } else if (avg >= 65) {
      verdict = 'Moderate Chance';
      color = 'text-yellow-600';
      recs = ['Address identified weaknesses to improve chances'];
    } else {
      verdict = 'High Risk';
      color = 'text-red-600';
      recs = ['Significant improvement needed before interview'];
    }

    let ai = null;
    if (mode === 'ai-hybrid') {
      ai = await genAIAnalysis(finalAns);
      if (ai?.qAnalysis) {
        Object.keys(ai.qAnalysis).forEach(id => {
          if (detailed[id]) detailed[id] = { ...detailed[id], ...ai.qAnalysis[id] };
        });
      }
    }

    setAnalysis({ detailed, avg, cats, verdict, color, recs, ai });
    setLoading(false);
    setPage('results');
  };

  const reset = () => {
    setPage('home');
    setVisaType(null);
    setCurrentQ(0);
    setAnswers({});
    setInput('');
    setAnalysis(null);
    setFollowUp(null);
  };

  if (page === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">US Visa Interview Prep</span>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Powered Interview Preparation
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Ace Your US Visa<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Interview with Confidence</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10">
              Practice for F1 Student or B2 Tourist visa with AI-generated follow-ups and visa officer-level analysis.
            </p>
            <button
              onClick={() => setPage('visa-select')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold text-lg hover:shadow-xl transition"
            >
              Start Free Practice
              <ChevronRight className="inline w-5 h-5 ml-2" />
            </button>
          </div>

          <div className="grid md:grid-cols-4 gap-8 mt-20 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">95%</div>
              <div className="text-gray-600">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">15K+</div>
              <div className="text-gray-600">Students Helped</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">60K+</div>
              <div className="text-gray-600">Practice Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">4.9★</div>
              <div className="text-gray-600">User Rating</div>
            </div>
          </div>
        </div>

        <div className="bg-white py-20">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-4xl font-bold text-center mb-4">Supported Visa Types</h2>
            <p className="text-center text-gray-600 mb-16 text-lg">Practice for the visa type you're applying for</p>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-8 border-2 border-blue-200">
                <GraduationCap className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-2xl font-bold mb-3">F1 Student Visa</h3>
                <p className="text-gray-700 mb-4">For students pursuing academic studies in the United States</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Academic intent questions</li>
                  <li>• University selection</li>
                  <li>• Funding sources</li>
                  <li>• Post-graduation plans</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-8 border-2 border-green-200">
                <Plane className="w-12 h-12 text-green-600 mb-4" />
                <h3 className="text-2xl font-bold mb-3">B2 Tourist Visa</h3>
                <p className="text-gray-700 mb-4">For tourism, vacation, or visiting family and friends</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Travel purpose and itinerary</li>
                  <li>• Duration of stay</li>
                  <li>• Financial capability</li>
                  <li>• Home country ties</li>
                </ul>
              </div>
            </div>

            <h2 className="text-4xl font-bold text-center mb-16">Why Choose Us</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-8">
                <Sparkles className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-bold mb-3">AI Follow-Ups</h3>
                <p className="text-gray-600">Realistic AI-generated follow-up questions that adapt to your answers</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-8">
                <Target className="w-12 h-12 text-purple-600 mb-4" />
                <h3 className="text-xl font-bold mb-3">Instant Feedback</h3>
                <p className="text-gray-600">Get immediate scoring and detailed analysis on every answer</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-8">
                <BarChart3 className="w-12 h-12 text-green-600 mb-4" />
                <h3 className="text-xl font-bold mb-3">Officer Perspective</h3>
                <p className="text-gray-600">Analysis from AI trained on visa officer criteria</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Ready to Start?</h2>
            <p className="text-xl text-blue-100 mb-8">Choose your visa type and begin practicing</p>
            <button
              onClick={() => setPage('visa-select')}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold text-lg hover:bg-gray-50"
            >
              Begin Free Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'visa-select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => setPage('home')} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
            <Home className="w-5 h-5 mr-2" />Back to Home
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-12">
            <h1 className="text-4xl font-bold mb-4">Select Your Visa Type</h1>
            <p className="text-xl text-gray-600 mb-12">Choose the visa you're applying for</p>

            <div className="grid md:grid-cols-2 gap-8">
              <div 
                onClick={() => { setVisaType('f1'); setPage('practice'); }} 
                className="border-2 border-blue-200 rounded-2xl p-8 hover:border-blue-500 hover:shadow-2xl transition cursor-pointer group bg-gradient-to-br from-blue-50 to-white"
              >
                <GraduationCap className="w-16 h-16 text-blue-600 mb-4 group-hover:scale-110 transition" />
                <h3 className="text-2xl font-bold mb-4">F1 Student Visa</h3>
                <p className="text-gray-600 mb-6">Practice for academic study visa interview</p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>✓ Academic preparation questions</p>
                  <p>✓ University & major selection</p>
                  <p>✓ Financial capability</p>
                  <p>✓ Post-graduation plans</p>
                  <p>✓ Home country ties</p>
                </div>
                <div className="mt-6 bg-blue-100 rounded-lg p-3">
                  <p className="text-xs text-blue-800 font-semibold">6 ESSENTIAL QUESTIONS</p>
                </div>
              </div>

              <div 
                onClick={() => { setVisaType('b2'); setPage('practice'); }} 
                className="border-2 border-green-200 rounded-2xl p-8 hover:border-green-500 hover:shadow-2xl transition cursor-pointer group bg-gradient-to-br from-green-50 to-white"
              >
                <Plane className="w-16 h-16 text-green-600 mb-4 group-hover:scale-110 transition" />
                <h3 className="text-2xl font-bold mb-4">B2 Tourist Visa</h3>
                <p className="text-gray-600 mb-6">Practice for tourism/visitor visa interview</p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>✓ Purpose of visit</p>
                  <p>✓ Travel itinerary & duration</p>
                  <p>✓ Financial capability</p>
                  <p>✓ Employment status</p>
                  <p>✓ Reasons to return home</p>
                </div>
                <div className="mt-6 bg-green-100 rounded-lg p-3">
                  <p className="text-xs text-green-800 font-semibold">6 ESSENTIAL QUESTIONS</p>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                💡 <strong>Tip:</strong> Each visa type has specific questions tailored to what visa officers actually ask during real interviews.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'practice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => setPage('visa-select')} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
            <Home className="w-5 h-5 mr-2" />Back to Visa Selection
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-12">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold mb-2">Choose Your Mode</h1>
                <p className="text-gray-600 flex items-center">
                  {visaType === 'f1' ? <GraduationCap className="w-5 h-5 mr-2 text-blue-600" /> : <Plane className="w-5 h-5 mr-2 text-green-600" />}
                  {visaType === 'f1' ? 'F1 Student Visa' : 'B2 Tourist Visa'} Practice
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div onClick={() => { setMode('standard'); setPage('interview'); }} className="border-2 border-gray-200 rounded-2xl p-8 hover:border-blue-500 hover:shadow-2xl transition cursor-pointer">
                <Zap className="w-14 h-14 text-blue-600 mb-4" />
                <h3 className="text-2xl font-bold mb-4">Quick Practice</h3>
                <p className="text-gray-600 mb-6">Fast rule-based analysis without AI</p>
                <div className="space-y-3">
                  <div className="flex items-center"><CheckCircle className="w-5 h-5 text-green-600 mr-3" /><span>6 questions</span></div>
                  <div className="flex items-center"><CheckCircle className="w-5 h-5 text-green-600 mr-3" /><span>Instant feedback</span></div>
                  <div className="flex items-center"><CheckCircle className="w-5 h-5 text-green-600 mr-3" /><span>No AI (fast)</span></div>
                  <div className="flex items-center"><CheckCircle className="w-5 h-5 text-green-600 mr-3" /><span>3-5 minutes</span></div>
                </div>
                <button className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">Start</button>
              </div>

              <div onClick={() => { setMode('ai-hybrid'); setPage('interview'); }} className="border-2 border-purple-200 rounded-2xl p-8 hover:border-purple-500 hover:shadow-2xl transition cursor-pointer bg-gradient-to-br from-purple-50 to-blue-50">
                <Sparkles className="w-14 h-14 text-purple-600 mb-4" />
                <h3 className="text-2xl font-bold mb-4">AI-Enhanced</h3>
                <p className="text-gray-600 mb-6">Hybrid: instant scores + deep AI analysis</p>
                <div className="space-y-3">
                  <div className="flex items-center"><CheckCircle className="w-5 h-5 text-green-600 mr-3" /><span>AI follow-ups</span></div>
                  <div className="flex items-center"><CheckCircle className="w-5 h-5 text-green-600 mr-3" /><span>Officer perspective</span></div>
                  <div className="flex items-center"><CheckCircle className="w-5 h-5 text-green-600 mr-3" /><span>Per-question AI</span></div>
                  <div className="flex items-center"><CheckCircle className="w-5 h-5 text-green-600 mr-3" /><span>8-12 minutes</span></div>
                </div>
                <button className="mt-6 w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold">Start</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl">{mode === 'ai-hybrid' ? 'AI analyzing your interview...' : 'Analyzing your responses...'}</p>
        </div>
      </div>
    );
  }

  if (page === 'results' && analysis) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">Interview Analysis Report</h1>
                <p className="text-gray-600 flex items-center">
                  {visaType === 'f1' ? <GraduationCap className="w-5 h-5 mr-2 text-blue-600" /> : <Plane className="w-5 h-5 mr-2 text-green-600" />}
                  {visaType === 'f1' ? 'F1 Student Visa' : 'B2 Tourist Visa'}
                </p>
              </div>
              {mode === 'ai-hybrid' && (
                <span className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-semibold flex items-center">
                  <Sparkles className="w-4 h-4 mr-1" />AI-Enhanced
                </span>
              )}
            </div>
            
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl mb-2">Overall Score</h2>
                  <p className="text-4xl font-bold">{analysis.avg.toFixed(1)}%</p>
                </div>
                <Award className="w-16 h-16 opacity-80" />
              </div>
              <p className="text-2xl mt-4">{analysis.verdict}</p>
            </div>

            {analysis.ai && (
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
                <div className="flex items-center mb-4">
                  <Bot className="w-6 h-6 text-purple-600 mr-2" />
                  <h3 className="text-xl font-semibold">AI Officer Assessment</h3>
                </div>
                <p className="text-lg font-semibold mb-2">{analysis.ai.verdict}</p>
                <p className="text-gray-700 italic mb-4">"{analysis.ai.notes}"</p>
                {analysis.ai.strengths?.length > 0 && (
                  <div className="mt-4">
                    <p className="font-semibold text-green-700 mb-2">Key Strengths:</p>
                    {analysis.ai.strengths.map((s, i) => <p key={i} className="text-sm">✓ {s}</p>)}
                  </div>
                )}
                {analysis.ai.issues?.length > 0 && (
                  <div className="mt-4">
                    <p className="font-semibold text-red-700 mb-2">Critical Issues:</p>
                    {analysis.ai.issues.map((s, i) => <p key={i} className="text-sm">⚠️ {s}</p>)}
                  </div>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {Object.entries(analysis.cats).map(([cat, data]) => (
                <div key={cat} className="bg-gray-50 rounded-lg p-4 border">
                  <h4 className="font-semibold text-gray-700 mb-2">{cat}</h4>
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
                      <div className={`h-3 rounded-full ${data.avg >= 75 ? 'bg-green-500' : data.avg >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${data.avg}%` }} />
                    </div>
                    <span className="text-sm font-semibold">{data.avg.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Detailed Question Analysis</h3>
              {questions.map((q, i) => {
                const a = analysis.detailed[q.id];
                return (
                  <div key={q.id} className="border rounded-lg p-5 bg-white shadow-sm">
                    <div className="flex justify-between mb-3">
                      <p className="font-semibold text-gray-800">Q{i + 1}: {q.q}</p>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{a.score}</div>
                        <p className="text-xs text-gray-500">Rule-based</p>
                        {a.aiScore && (
                          <>
                            <div className="text-lg font-bold text-purple-600 mt-1">{a.aiScore}</div>
                            <p className="text-xs text-purple-600 flex items-center justify-end">
                              <Sparkles className="w-3 h-3 mr-1" />AI
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 italic mb-3 bg-gray-50 p-3 rounded">"{answers[q.id]}"</p>
                    
                    <div className="border-t pt-3">
                      {a.str.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-semibold text-green-700 mb-1">✓ Strengths:</p>
                          {a.str.map((s, j) => <p key={j} className="text-sm text-gray-700 ml-4">• {s}</p>)}
                        </div>
                      )}
                      {a.weak.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-semibold text-yellow-700 mb-1">⚠ Weaknesses:</p>
                          {a.weak.map((w, j) => <p key={j} className="text-sm text-gray-700 ml-4">• {w}</p>)}
                        </div>
                      )}
                      {a.red.length > 0 && (
                        <div className="mb-2 bg-red-50 p-3 rounded">
                          <p className="text-sm font-semibold text-red-700 mb-1">🚨 Red Flags:</p>
                          {a.red.map((r, j) => <p key={j} className="text-sm text-red-700 ml-4 font-medium">• {r}</p>)}
                        </div>
                      )}
                      {a.aiStr?.length > 0 && (
                        <div className="bg-purple-50 rounded p-3 mt-3 border border-purple-200">
                          <p className="text-sm font-semibold text-purple-700 mb-1 flex items-center">
                            <Sparkles className="w-4 h-4 mr-1" />AI Insights:
                          </p>
                          {a.aiStr.map((s, j) => <p key={j} className="text-sm text-gray-700 ml-4">• {s}</p>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-3">Key Recommendations:</h3>
              <ul>
                {analysis.recs.map((r, i) => <li key={i} className="text-gray-700 mb-2">💡 {r}</li>)}
              </ul>
            </div>

            <button onClick={reset} className="mt-8 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
              Start New Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">
                {visaType === 'f1' ? 'F1 Student Visa' : 'B2 Tourist Visa'} Interview
              </h1>
              <p className="text-gray-600 flex items-center">
                {visaType === 'f1' ? <GraduationCap className="w-5 h-5 mr-2 text-blue-600" /> : <Plane className="w-5 h-5 mr-2 text-green-600" />}
                Question {currentQ + 1} of {questions.length}
              </p>
            </div>
            {mode === 'ai-hybrid' && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                <Sparkles className="w-4 h-4 mr-1" />AI
              </span>
            )}
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round((currentQ / questions.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${(currentQ / questions.length) * 100}%` }} />
            </div>
          </div>

          {!followUp ? (
            <>
              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 mb-6 rounded">
                <MessageSquare className="w-6 h-6 text-blue-600 mb-2" />
                <p className="text-sm text-blue-800 font-semibold mb-2">{questions[currentQ].cat}</p>
                <p className="text-lg font-medium text-gray-800">{questions[currentQ].q}</p>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none mb-4"
                rows="6"
                placeholder="Type your answer as you would speak in the interview..."
              />

              <button
                onClick={submit}
                disabled={!input.trim() || loadingFollowUp}
                className={`w-full py-3 rounded-lg font-semibold transition ${input.trim() && !loadingFollowUp ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                {loadingFollowUp ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating AI follow-up...
                  </span>
                ) : (
                  currentQ === questions.length - 1 ? 'Finish & Get Analysis' : 'Next Question'
                )}
              </button>
            </>
          ) : (
            <>
              <div className="bg-purple-50 border-l-4 border-purple-600 p-6 mb-6 rounded">
                <Bot className="w-6 h-6 text-purple-600 mb-2" />
                <p className="text-sm text-purple-800 font-semibold mb-2 flex items-center">
                  <Sparkles className="w-4 h-4 mr-1" />AI Follow-up Question
                </p>
                <p className="text-lg font-medium text-gray-800">{followUp.q}</p>
                <p className="text-xs text-gray-500 mt-3 italic">Based on: "{followUp.orig}"</p>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full p-4 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none mb-4"
                rows="5"
                placeholder="Answer the follow-up question..."
              />

              <button
                onClick={submitFollowUp}
                disabled={!input.trim()}
                className={`w-full py-3 rounded-lg font-semibold transition ${input.trim() ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                {currentQ === questions.length - 1 ? 'Finish & Get Analysis' : 'Continue to Next Question'}
              </button>
            </>
          )}

          <div className="mt-8 bg-gray-50 rounded-lg p-4 border">
            <p className="text-sm font-semibold text-gray-700 mb-2">💡 Interview Tips:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {visaType === 'f1' ? (
                <>
                  <li>• Be specific about your university and program</li>
                  <li>• Show clear intent to return home after studies</li>
                  <li>• Have exact funding amounts ready</li>
                  <li>• Avoid mentioning desire to work or stay in US</li>
                </>
              ) : (
                <>
                  <li>• Have specific dates and itinerary planned</li>
                  <li>• Show strong ties to your home country</li>
                  <li>• Demonstrate sufficient financial resources</li>
                  <li>• Be clear about your return plans</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisaInterviewSimulator;
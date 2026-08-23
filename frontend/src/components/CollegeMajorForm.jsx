import { useState, useEffect } from 'react';
import { getMe, updateUserProfile } from '../api';

const CollegeMajorForm = ({ onComplete }) => {
  const [college, setCollege] = useState('');
  const [major, setMajor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await getMe();
        if (user) {
          setCollege(user.college || '');
          setMajor(user.major || '');
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!college.trim() || !major.trim()) {
      setError('Please fill in both college and major');
      return;
    }

    setSaving(true);
    setError('');
    
    try {
      await updateUserProfile({
        college: college.trim(),
        major: major.trim(),
      });
      onComplete();
    } catch (err) {
      setError(err.message || 'Failed to save information');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-stone-700">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user has existing data (from database)
  const hasExistingData = college && major && college.trim() !== '' && major.trim() !== '';

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">
            {hasExistingData ? 'Your Information' : 'Tell Us About Yourself'}
          </h2>
          <p className="text-stone-700 text-sm">
            {hasExistingData 
              ? 'Review and update your information before starting the interview'
              : 'We need this information to personalize your interview experience'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="college" className="block text-sm font-medium text-stone-700 mb-2">
              Which college/university will you attend? *
            </label>
            <input
              id="college"
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="e.g., Stanford University"
              className="w-full px-4 py-3 border-2 border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-stone-900"
              required
            />
          </div>

          <div>
            <label htmlFor="major" className="block text-sm font-medium text-stone-700 mb-2">
              What is your major? *
            </label>
            <input
              id="major"
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="e.g., Computer Science"
              className="w-full px-4 py-3 border-2 border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-stone-900"
              required
            />
          </div>

          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving || !college.trim() || !major.trim()}
              className="w-full bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollegeMajorForm;

import { useState, useEffect } from "react";
import { useAsync } from "./adminUtils";
import { Card, Loading, ErrorNote, Badge } from "./AdminUI";

const TYPES = ["factual_yesno", "factual_short", "elaboration"];

export default function AdminQuestions({ load, save }) {
  const { loading, error, data, reload } = useAsync(load, []);
  const [draft, setDraft] = useState(null);
  const [rules, setRules] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setDraft(data.categories || {});
      setRules(data.selection_rules || {});
    }
  }, [data]);

  if (loading) return <Loading what="questions" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!draft) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.categories);

  const update = (category, index, patch) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      [category]: d[category].map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  const addQuestion = (category) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      [category]: [...d[category], { text: "", type: "elaboration" }],
    }));
  };

  const removeQuestion = (category, index) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [category]: d[category].filter((_, i) => i !== index) }));
  };

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await save(draft);
      setSaved(true);
      reload();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-stone-900">Question bank</h2>
          <p className="text-sm text-stone-600">
            Saved to <code className="text-xs">{data.path || "questions.json"}</code> and reloaded
            immediately. Required categories must keep at least one question.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && !dirty && <span className="text-sm text-emerald-700">Saved</span>}
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Card>

      {saveError && <ErrorNote error={saveError} />}

      {Object.keys(draft).sort().map((category) => (
        <Card key={category} className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-stone-900">{category}</h3>
              <Badge tone={rules[category] ? "indigo" : "stone"}>
                {draft[category].length} question{draft[category].length === 1 ? "" : "s"}
              </Badge>
              {rules[category] != null && (
                <Badge tone="amber">{rules[category]} asked per interview</Badge>
              )}
            </div>
            <button
              onClick={() => addQuestion(category)}
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
            >
              + Add
            </button>
          </div>

          <ul className="space-y-2">
            {draft[category].map((q, i) => (
              <li key={i} className="flex flex-col sm:flex-row gap-2">
                <textarea
                  value={q.text}
                  onChange={(e) => update(category, i, { text: e.target.value })}
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 resize-y"
                />
                <div className="flex sm:flex-col gap-2">
                  <select
                    value={q.type}
                    onChange={(e) => update(category, i, { type: e.target.value })}
                    className="px-2 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeQuestion(category, i)}
                    disabled={rules[category] != null && draft[category].length <= 1}
                    title={
                      rules[category] != null && draft[category].length <= 1
                        ? "Required categories need at least one question"
                        : "Remove question"
                    }
                    className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-sm hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Difficulty, UserSettings, AiProvider, SRSettings } from "@/lib/types";
import { getUserSettings, saveUserSettings, getQuestions } from "@/lib/storage";
import { Settings, Tag, Bot, Eye, EyeOff, Plug, Brain, Check, Save, BookOpen, Layers } from "lucide-react";

const ALL_DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];
const DIFF_COLORS: Record<Difficulty, { border: string; bg: string; text: string; shadow: string }> = {
  Easy:   { border: "var(--green)",  bg: "var(--green-lt)",  text: "var(--green-dk)",  shadow: "#b2eecf" },
  Medium: { border: "#ff9f43",       bg: "#fff3e0",          text: "#c47c00",          shadow: "#ffd59e" },
  Hard:   { border: "var(--red)",    bg: "var(--red-lt)",    text: "var(--red-dk)",    shadow: "#ffb3bb" },
};

const AI_PROVIDERS: { value: AiProvider; label: string; defaultModel: string; defaultBase: string }[] = [
  { value: "openai",   label: "OpenAI",   defaultModel: "gpt-4o-mini",  defaultBase: "https://api.openai.com/v1" },
  { value: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat", defaultBase: "https://api.deepseek.com/v1" },
  { value: "custom",   label: "Custom",   defaultModel: "gpt-4o-mini",  defaultBase: "" },
];

const SESSION_SIZES = [5, 10, 15, 20];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    Promise.all([getUserSettings(), getQuestions()]).then(([s, qs]) => {
      setSettings(s);
      setAllTags(Array.from(new Set(qs.flatMap(q => q.tags))).sort());
      setLoading(false);
    });
  }, []);

  if (loading || !settings) return (
    <div style={{ minHeight: "calc(100vh - 160px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 12, color: "var(--purple)" }}><Settings size={48} /></div>
        <p style={{ color: "var(--text-dim)", fontWeight: 700 }}>Loading settings…</p>
      </div>
    </div>
  );

  const patch   = (p: Partial<UserSettings>) => { setSettings(prev => ({ ...prev!, ...p })); setSaved(false); };
  const patchAi = (p: Partial<UserSettings["ai"]>) => { setSettings(prev => ({ ...prev!, ai: { ...prev!.ai, ...p } })); setSaved(false); };
  const patchSR = (p: Partial<SRSettings>) => { setSettings(prev => ({ ...prev!, sr: { ...prev!.sr, ...p } })); setSaved(false); };

  const toggleDiff = (d: Difficulty) => patch({
    selectedDifficulties: settings.selectedDifficulties.includes(d)
      ? settings.selectedDifficulties.filter(x => x !== d)
      : [...settings.selectedDifficulties, d],
  });

  const toggleTag = (t: string) => patch({
    selectedTags: settings.selectedTags.includes(t)
      ? settings.selectedTags.filter(x => x !== t)
      : [...settings.selectedTags, t],
  });

  const handleProviderChange = (p: AiProvider) => {
    const prov = AI_PROVIDERS.find(x => x.value === p)!;
    patchAi({ provider: p, model: prov.defaultModel, baseUrl: prov.value === "custom" ? "" : prov.defaultBase });
  };

  const handleSave = async () => {
    await saveUserSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    setTestResult(null);
    await saveUserSettings(settings);
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "notes",
          questionTitle: "Two Sum",
          questionDescription: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
          examples: [{ input: "nums = [2,7,11,15], target = 9", output: "[0,1]" }],
          constraints: ["2 <= nums.length <= 10^4"],
          tags: ["Array", "Hash Table"],
          difficulty: "Easy",
        }),
      });
      const data = await res.json();
      if (data.error) setTestResult({ ok: false, msg: data.error });
      else setTestResult({ ok: true, msg: "Connection works!" });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message });
    }
    setTestingAI(false);
  };

  const selectedProvider = AI_PROVIDERS.find(p => p.value === settings.ai.provider) ?? AI_PROVIDERS[0];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 80px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Settings size={24} style={{ color: "var(--purple)" }} /> Settings</h1>
        <p style={{ color: "var(--text-dim)", fontWeight: 600 }}>Configure Learn mode and AI assistance</p>
      </div>

      {/* ── Session Size ── */}
      <div className="card-surface" style={{ padding: "24px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 17, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Layers size={16} style={{ color: "var(--purple)" }} /> Session Size</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          Cards per session before a break prompt. After each batch you can continue or stop.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {SESSION_SIZES.map(n => {
            const active = settings.sessionSize === n;
            return (
              <button key={n} onClick={() => patch({ sessionSize: n })} style={{
                flex: 1, fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 17,
                padding: "13px 0", borderRadius: 14, cursor: "pointer",
                border: `2px solid ${active ? "var(--purple)" : "var(--border)"}`,
                background: active ? "var(--purple)" : "transparent",
                color: active ? "#fff" : "var(--text-dim)",
                boxShadow: active ? "0 4px 0 var(--purple-dk)" : "var(--shadow-sm)",
                transition: "all 0.15s",
              }}>{n}</button>
            );
          })}
        </div>
      </div>

      {/* ── Difficulty ── */}
      <div className="card-surface" style={{ padding: "24px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 17, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><BookOpen size={16} style={{ color: "var(--purple)" }} /> Difficulty</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 18 }}>Which difficulties appear in your queue.</p>
        <div style={{ display: "flex", gap: 12 }}>
          {ALL_DIFFICULTIES.map(d => {
            const active = settings.selectedDifficulties.includes(d);
            const c = DIFF_COLORS[d];
            return (
              <button key={d} onClick={() => toggleDiff(d)} style={{
                flex: 1, fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 14,
                padding: "13px 0", borderRadius: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                border: `2px solid ${active ? c.border : "var(--border)"}`,
                background: active ? c.bg : "var(--bg)",
                color: active ? c.text : "var(--text-muted)",
                boxShadow: active ? `0 3px 0 ${c.shadow}` : "none",
                transition: "all 0.15s",
              }}>
                {active && <Check size={13} strokeWidth={3} />}
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Topics ── */}
      <div className="card-surface" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ fontWeight: 900, fontSize: 17, display: "flex", alignItems: "center", gap: 6 }}><Tag size={16} style={{ color: "var(--purple)" }} /> Topics</h2>
          {settings.selectedTags.length > 0 && (
            <button onClick={() => patch({ selectedTags: [] })} style={{ fontSize: 12, fontWeight: 800, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>
              Clear all
            </button>
          )}
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          {settings.selectedTags.length === 0 ? "All topics included." : `${settings.selectedTags.length} topic${settings.selectedTags.length > 1 ? "s" : ""} selected.`}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allTags.map(t => {
            const active = settings.selectedTags.includes(t);
            return (
              <button key={t} onClick={() => toggleTag(t)} style={{
                fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13,
                padding: "7px 16px", borderRadius: 20, cursor: "pointer", border: "2px solid",
                borderColor: active ? "var(--purple-dk)" : "var(--border)",
                background: active ? "var(--purple)" : "var(--bg)",
                color: active ? "#fff" : "var(--text-dim)",
                transition: "all 0.15s",
                boxShadow: active ? "0 3px 0 var(--purple-dk)" : "none",
              }}>{t}</button>
            );
          })}
        </div>
      </div>

      {/* ── AI Section ── */}
      <div className="card-surface" style={{ padding: "24px", borderColor: "var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Bot size={20} style={{ color: "var(--purple)" }} />
          <h2 style={{ fontWeight: 900, fontSize: 17 }}>AI Assistance</h2>
          <span style={{ background: "var(--purple-lt)", color: "var(--purple)", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>Optional</span>
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
          Add your API key to auto-generate notes and solutions on the back of each card.
          Your key is stored locally and only sent to your chosen provider.
        </p>

        {/* Provider */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Provider</label>
          <div style={{ display: "flex", gap: 8 }}>
            {AI_PROVIDERS.map(p => {
              const active = settings.ai.provider === p.value;
              return (
                <button key={p.value} onClick={() => handleProviderChange(p.value)} style={{
                  flex: 1, fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 13,
                  padding: "11px 8px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${active ? "var(--purple)" : "var(--border)"}`,
                  background: active ? "var(--purple-lt)" : "var(--bg)",
                  color: active ? "var(--purple)" : "var(--text-dim)",
                  transition: "all 0.15s",
                  display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4,
                }}>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* API Key */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>API Key</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showKey ? "text" : "password"}
              value={settings.ai.apiKey}
              onChange={e => patchAi({ apiKey: e.target.value })}
              placeholder={`Your ${selectedProvider.label} API key…`}
              style={{ flex: 1, padding: "10px 14px", fontSize: 13, fontFamily: "var(--font-mono)" }}
            />
            <button onClick={() => setShowKey(v => !v)} className="btn btn-ghost" style={{ padding: "8px 14px" }}>
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Model */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Model</label>
          <input
            type="text"
            value={settings.ai.model}
            onChange={e => patchAi({ model: e.target.value })}
            placeholder="e.g. gpt-4o-mini, deepseek-chat, o1-mini"
            style={{ width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: "var(--font-mono)" }}
          />
        </div>

        {/* Base URL for custom/deepseek */}
        {(settings.ai.provider === "custom" || settings.ai.provider === "deepseek") && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Base URL</label>
            <input
              type="text"
              value={settings.ai.baseUrl}
              onChange={e => patchAi({ baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              style={{ width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: "var(--font-mono)" }}
            />
          </div>
        )}

        {/* Test */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={handleTestAI} disabled={testingAI || !settings.ai.apiKey} style={{ padding: "8px 18px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plug size={13} />{testingAI ? "Testing…" : "Test connection"}
          </button>
          {testResult && (
            <span style={{ fontSize: 13, fontWeight: 700, color: testResult.ok ? "var(--green-dk)" : "var(--red-dk)", flex: 1 }}>
              {testResult.ok ? "Connection works!" : testResult.msg}
            </span>
          )}
        </div>

        <hr style={{ marginBottom: 20 }} />

        {/* Prompt: Notes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes Prompt</label>
            <button onClick={() => patchAi({ promptNotes: "You are a coding interview coach. Given the following LeetCode problem, write concise study notes covering: the core insight/pattern, time and space complexity, edge cases to watch for, and any helpful mnemonics. Be brief and practical — max 150 words." })}
              style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
              Reset
            </button>
          </div>
          <textarea
            value={settings.ai.promptNotes}
            onChange={e => patchAi({ promptNotes: e.target.value })}
            style={{ width: "100%", minHeight: 90, padding: "10px 14px", fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
            placeholder="System prompt for notes generation…"
          />
        </div>

        {/* Prompt: Code */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Code Prompt</label>
            <button onClick={() => patchAi({ promptCode: "You are a coding interview coach. Given the following LeetCode problem, write a clean Python solution with a brief inline comment explaining the key idea. Include the function signature. Aim for the optimal approach." })}
              style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
              Reset
            </button>
          </div>
          <textarea
            value={settings.ai.promptCode}
            onChange={e => patchAi({ promptCode: e.target.value })}
            style={{ width: "100%", minHeight: 90, padding: "10px 14px", fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
            placeholder="System prompt for code generation…"
          />
        </div>
      </div>

      {/* ── Spaced Repetition ── */}
      <div className="card-surface" style={{ padding: "24px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 17, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <Brain size={16} style={{ color: "var(--purple)" }} /> Spaced Repetition
        </h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
          SM-2 algorithm — each card tracks its own ease factor that adapts to how hard it is for you.
          Response time maps to quality grades: fast (&lt;30s) = easy, normal (30–120s) = good, slow (&gt;120s) = hard.
        </p>

        {/* Interval Modifier */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Interval Modifier</label>
            <span style={{ fontSize: 15, fontWeight: 900, color: "var(--purple)", fontFamily: "var(--font-mono)" }}>
              {settings.sr.intervalModifier.toFixed(2)}×
            </span>
          </div>
          <input type="range"
            min={0.5} max={2.0} step={0.05}
            value={settings.sr.intervalModifier}
            onChange={e => patchSR({ intervalModifier: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--purple)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 3 }}>
            <span>0.5× shorter (harder)</span><span>2.0× longer (easier)</span>
          </div>
        </div>

        {/* Starting Ease */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Starting Ease</label>
            <span style={{ fontSize: 15, fontWeight: 900, color: "var(--purple)", fontFamily: "var(--font-mono)" }}>
              {settings.sr.startingEase.toFixed(1)}
            </span>
          </div>
          <input type="range"
            min={1.5} max={2.8} step={0.1}
            value={settings.sr.startingEase}
            onChange={e => patchSR({ startingEase: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--purple)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 3 }}>
            <span>1.5 difficult by default</span><span>2.8 easy by default</span>
          </div>
        </div>

        {/* Easy Bonus */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Easy Bonus</label>
            <span style={{ fontSize: 15, fontWeight: 900, color: "var(--purple)", fontFamily: "var(--font-mono)" }}>
              {settings.sr.easyBonus.toFixed(2)}×
            </span>
          </div>
          <input type="range"
            min={1.0} max={2.0} step={0.05}
            value={settings.sr.easyBonus}
            onChange={e => patchSR({ easyBonus: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--purple)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 3 }}>
            <span>1.0 no bonus</span><span>2.0 double interval for fast answers</span>
          </div>
        </div>

        {/* Lapse Interval */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Lapse Interval</label>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
              how soon a failed card reappears
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {([
              { label: "10 min", hours: 10/60 },
              { label: "30 min", hours: 0.5   },
              { label: "1 hr",   hours: 1      },
              { label: "4 hrs",  hours: 4      },
              { label: "1 day",  hours: 24     },
            ] as const).map(opt => {
              const active = Math.abs(settings.sr.lapseIntervalHours - opt.hours) < 0.01;
              return (
                <button key={opt.label} onClick={() => patchSR({ lapseIntervalHours: opt.hours })} style={{
                  fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 13,
                  padding: "8px 16px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${active ? "var(--purple)" : "var(--border)"}`,
                  background: active ? "var(--purple)" : "transparent",
                  color: active ? "#fff" : "var(--text-dim)",
                  transition: "all 0.15s",
                }}>{opt.label}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Save ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button className="btn btn-primary" onClick={handleSave} style={{ minWidth: 160 }}>
          <>{saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Settings</>}</>

        </button>
        {saved && <span style={{ fontWeight: 700, color: "var(--green-dk)", fontSize: 14 }}>Applied to Learn mode</span>}
      </div>
    </div>
  );
}

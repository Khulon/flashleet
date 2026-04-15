"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Question, CardState, ProgressState } from "@/lib/types";
import { getQuestions, getCardStates } from "@/lib/storage";
import DifficultyBadge from "@/components/DifficultyBadge";
import { BarChart2, Target, Flame, Clock, Plus, BookOpen, RefreshCw, Star } from "lucide-react";

interface ComputedStats {
  total: number;
  byProgress: Record<ProgressState, number>;
  byDifficulty: Record<string, { total: number; mastered: number; attempted: number }>;
  byTag: Record<string, { total: number; mastered: number; attempted: number }>;
  totalAttempts: number;
  totalKnow: number;
  overallAccuracy: number | null;
  avgStreak: number;
  longestStreak: number;
  topQuestion: { title: string; streak: number } | null;
  dueSoon: number; // due in next 24h
  masteredCount: number;
}

function computeStats(questions: Question[], cardStates: Record<number, CardState>): ComputedStats {
  const total = questions.length;
  const byProgress: Record<ProgressState, number> = { new: 0, learning: 0, review: 0, mastered: 0 };
  const byDifficulty: Record<string, { total: number; mastered: number; attempted: number }> = {};
  const byTag: Record<string, { total: number; mastered: number; attempted: number }> = {};

  let totalAttempts = 0;
  let streakSum = 0;
  let longestStreak = 0;
  let topQuestion: { title: string; streak: number } | null = null;
  let dueSoon = 0;
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

  // Init difficulty buckets
  for (const q of questions) {
    if (!byDifficulty[q.difficulty]) byDifficulty[q.difficulty] = { total: 0, mastered: 0, attempted: 0 };
    byDifficulty[q.difficulty].total++;
    for (const tag of q.tags) {
      if (!byTag[tag]) byTag[tag] = { total: 0, mastered: 0, attempted: 0 };
      byTag[tag].total++;
    }
  }

  for (const q of questions) {
    const st = cardStates[q.id];
    const progress: ProgressState = st?.progress ?? "new";
    byProgress[progress]++;

    if (st) {
      byDifficulty[q.difficulty].attempted++;
      if (st.progress === "mastered") byDifficulty[q.difficulty].mastered++;

      for (const tag of q.tags) {
        byTag[tag].attempted++;
        if (st.progress === "mastered") byTag[tag].mastered++;
      }

      totalAttempts += st.totalAttempts;
      streakSum += st.successStreak;
      if (st.successStreak > longestStreak) {
        longestStreak = st.successStreak;
        topQuestion = { title: q.title, streak: st.successStreak };
      }

      const due = new Date(st.nextDueAt);
      if (due > now && due <= in24h) dueSoon++;
    }
  }

  const attempted = questions.filter(q => cardStates[q.id]).length;
  const avgStreak = attempted > 0 ? Math.round((streakSum / attempted) * 10) / 10 : 0;
  const masteredCount = byProgress.mastered;

  // accuracy: we don't store per-attempt know/dontknow counts separately, approximate from streaks
  const overallAccuracy = totalAttempts > 0
    ? Math.round(((byProgress.review * 2 + byProgress.mastered * 5) / Math.max(totalAttempts, 1)) * 100)
    : null;

  return { total, byProgress, byDifficulty, byTag, totalAttempts, totalKnow: 0, overallAccuracy, avgStreak, longestStreak, topQuestion, dueSoon, masteredCount };
}

const PROGRESS_COLORS: Record<ProgressState, { bg: string; text: string; label: string; barColor: string }> = {
  new:      { bg: "var(--bg-3)",      text: "var(--text-muted)", label: "New",      barColor: "#c8c8cc" },
  learning: { bg: "var(--yellow-lt)", text: "#c47c00",           label: "Learning", barColor: "#ffd93d" },
  review:   { bg: "#dbeafe",          text: "#1d4ed8",           label: "Review",   barColor: "#60a5fa" },
  mastered: { bg: "var(--green-lt)",  text: "var(--green-dk)",   label: "Mastered", barColor: "var(--green)" },
};

export default function StatsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});
  const [loading, setLoading] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const [listOffset, setListOffset] = useState(0);

  useEffect(() => {
    Promise.all([getQuestions(), getCardStates()]).then(([qs, cs]) => {
      setQuestions(qs);
      setCardStates(cs);
      setLoading(false);
    });
  }, []);

  // Recompute list's distance from page top after content loads
  useLayoutEffect(() => {
    if (listRef.current) setListOffset(listRef.current.offsetTop);
  }, [loading]);

  const rowVirtualizer = useWindowVirtualizer({
    count: loading ? 0 : questions.length,
    estimateSize: () => 82,
    overscan: 8,
    scrollMargin: listOffset,
  });

  if (loading) return (
    <div style={{ minHeight: "calc(100vh - 160px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 12, color: "var(--purple)" }}><BarChart2 size={56} /></div>
        <p style={{ color: "var(--text-dim)", fontWeight: 700 }}>Crunching numbers…</p>
      </div>
    </div>
  );

  const stats = computeStats(questions, cardStates);
  const attempted = questions.filter(q => cardStates[q.id]).length;
  const masteredPct = stats.total > 0 ? Math.round((stats.masteredCount / stats.total) * 100) : 0;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><BarChart2 size={26} style={{ color: "var(--purple)" }} /> Your Stats</h1>
        <p style={{ color: "var(--text-dim)", fontWeight: 600 }}>{stats.total} problems in deck · {attempted} attempted</p>
      </div>

      {/* ── Hero: mastery progress bar ── */}
      <div className="card-surface" style={{ padding: "28px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 2 }}>Overall Mastery</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13, fontWeight: 600 }}>
              {stats.masteredCount} of {stats.total} problems mastered
            </p>
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "var(--purple)" }}>
            {masteredPct}%
          </div>
        </div>
        <div className="progress-strip">
          <div className="progress-strip-fill" style={{ width: `${masteredPct}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
          <span>0</span>
          <span>{stats.total}</span>
        </div>
      </div>

      {/* ── Progress breakdown ── */}
      <div className="card-surface" style={{ padding: "24px 24px", marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, fontSize: 17, marginBottom: 16 }}>Progress Breakdown</h2>
        {/* Stacked horizontal bar */}
        <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden" }}>
          {(["new", "learning", "review", "mastered"] as ProgressState[]).map(p => {
            const pct = stats.total > 0 ? (stats.byProgress[p] / stats.total) * 100 : 0;
            return pct > 0 ? (
              <div key={p} style={{ width: `${pct}%`, background: PROGRESS_COLORS[p].barColor }} />
            ) : null;
          })}
        </div>
        {/* Rows */}
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {(["new", "learning", "review", "mastered"] as ProgressState[]).map(p => {
            const cfg = PROGRESS_COLORS[p];
            const count = stats.byProgress[p];
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.barColor, flexShrink: 0 }} />
                  <span style={{ color: cfg.text }}>{cfg.label}</span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{count}</span>
                </div>
                <span style={{ color: cfg.text }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 24 }}>
        <div className="stat-card">
          <div style={{ marginBottom: 4, color: "var(--purple)" }}><Target size={22} /></div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--purple)" }}>{stats.totalAttempts}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Reviews</div>
        </div>
        <div className="stat-card">
          <div style={{ marginBottom: 4, color: "var(--orange)" }}><Flame size={22} /></div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--orange)" }}>{stats.longestStreak}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Best Streak</div>
          {stats.topQuestion && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {stats.topQuestion.title}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div style={{ marginBottom: 4, color: "var(--green-dk)" }}><Clock size={22} /></div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--green-dk)" }}>{stats.dueSoon}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Due in 24h</div>
        </div>
      </div>

      {/* ── By Difficulty ── */}
      <div className="card-surface" style={{ padding: "24px 24px", marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, fontSize: 17, marginBottom: 18 }}>By Difficulty</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(["Easy", "Medium", "Hard"] as const).map(d => {
            const b = stats.byDifficulty[d] ?? { total: 0, mastered: 0, attempted: 0 };
            const pct = b.total > 0 ? Math.round((b.mastered / b.total) * 100) : 0;
            const attemptedPct = b.total > 0 ? Math.round((b.attempted / b.total) * 100) : 0;
            return (
              <div key={d}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <DifficultyBadge difficulty={d} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)" }}>
                      {b.mastered}/{b.total} mastered · {b.attempted} attempted
                    </span>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 14, color: "var(--purple)" }}>{pct}%</span>
                </div>
                <div className="progress-strip">
                  {/* attempted bar */}
                  <div style={{
                    height: "100%", borderRadius: 5, width: `${attemptedPct}%`,
                    background: "var(--bg-3)", position: "absolute",
                    transition: "width 0.5s",
                  }} />
                  <div className="progress-strip-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── By Tag ── */}
      <div className="card-surface" style={{ padding: "24px 24px" }}>
        <h2 style={{ fontWeight: 900, fontSize: 17, marginBottom: 18 }}>By Topic</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Object.entries(stats.byTag)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([tag, b]) => {
              const pct = b.total > 0 ? Math.round((b.mastered / b.total) * 100) : 0;
              const attemptedPct = b.total > 0 ? Math.round((b.attempted / b.total) * 100) : 0;
              const color = pct >= 80 ? "var(--green)" : pct >= 40 ? "var(--orange)" : "var(--purple)";
              return (
                <div key={tag}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="tag">{tag}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                        {b.mastered}/{b.total}
                      </span>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 13, color }}>{pct}%</span>
                  </div>
                  <div className="progress-strip" style={{ height: 7 }}>
                    <div className="progress-strip-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── Individual cards (virtualised) ── */}
      <div className="card-surface" style={{ padding: "24px 24px", marginTop: 20 }}>
        <h2 style={{ fontWeight: 900, fontSize: 17, marginBottom: 16 }}>All Problems</h2>
        <div ref={listRef} style={{ position: "relative", height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map(vRow => {
            const q = questions[vRow.index];
            const st = cardStates[q.id];
            const progress = st?.progress ?? "new";
            const cfg = PROGRESS_COLORS[progress];
            return (
              <div
                key={vRow.key}
                data-index={vRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute", top: 0, left: 0, width: "100%",
                  transform: `translateY(${vRow.start - listOffset}px)`,
                  paddingBottom: 6,
                }}
              >
                <div style={{
                  padding: "10px 12px", borderRadius: 12,
                  border: "2px solid var(--border)", background: "var(--bg-card)",
                }}>
                  {/* row 1 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>#{q.id}</span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</span>
                    <DifficultyBadge difficulty={q.difficulty} />
                  </div>
                  {/* row 2 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                      background: cfg.bg, color: cfg.text, flexShrink: 0,
                    }}>{cfg.label}</span>
                    {(st?.successStreak ?? 0) > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#c47c00", display: "inline-flex", alignItems: "center", gap: 1 }}><Flame size={11} />×{st!.successStreak}</span>
                    )}
                    {st && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: "auto" }}>
                        {st.totalAttempts} reviews
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

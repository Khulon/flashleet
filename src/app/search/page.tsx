"use client";

import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Question, CardState, Difficulty, ProgressState } from "@/lib/types";
import { getQuestions, getCardStates, saveLearnSession, getLearnSession } from "@/lib/storage";
import DifficultyBadge from "@/components/DifficultyBadge";
import ProgressBadge from "@/components/ProgressBadge";
import { Search, Flame, ChevronDown, SlidersHorizontal, X, Plus } from "lucide-react";

const ALL_DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];
const ALL_PROGRESS: ProgressState[] = ["new", "learning", "review", "mastered"];

export default function SearchPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});
  const [query, setQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState<Set<Difficulty>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [progressFilter, setProgressFilter] = useState<Set<ProgressState>>(new Set());
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterBodyRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(0);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [addedToQueue, setAddedToQueue] = useState<number | null>(null);

  // Virtualizer
  const listRef = useRef<HTMLDivElement>(null);
  const [listOffset, setListOffset] = useState(0);

  const toggleFilters = () => {
    const next = !filtersOpen;
    if (next && filterBodyRef.current) {
      setFilterHeight(filterBodyRef.current.scrollHeight);
    } else {
      setFilterHeight(0);
    }
    setFiltersOpen(next);
  };

  useEffect(() => {
    Promise.all([getQuestions(), getCardStates()]).then(([qs, cs]) => {
      setQuestions(qs);
      setCardStates(cs);
      setAllTags(Array.from(new Set(qs.flatMap(q => q.tags))).sort());
      setLoading(false);
    });
  }, []);

  const toggle = <T,>(set: Set<T>, val: T) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    return next;
  };

  const filtered = questions.filter(q => {
    const matchQ = !query || q.title.toLowerCase().includes(query.toLowerCase());
    const matchD = diffFilter.size === 0 || diffFilter.has(q.difficulty);
    const matchT = tagFilter.size === 0 || q.tags.some(t => tagFilter.has(t));
    const prog: ProgressState = cardStates[q.id]?.progress ?? "new";
    const matchP = progressFilter.size === 0 || progressFilter.has(prog);
    return matchQ && matchD && matchT && matchP;
  });

  const handleAddToQueue = async (q: Question) => {
    setAddedToQueue(q.id);
    setTimeout(() => setAddedToQueue(null), 2000);
    const sess = await getLearnSession();
    await saveLearnSession({ ...sess, injectedQuestionId: q.id });
  };

  // Recompute list's distance from page top whenever the filter panel animates open/closed
  useLayoutEffect(() => {
    if (listRef.current) setListOffset(listRef.current.offsetTop);
  }, [filterHeight, loading]);

  const rowVirtualizer = useWindowVirtualizer({
    count: filtered.length,
    estimateSize: () => 104,   // ~card height (88px) + 8px gap + 8px safety margin
    overscan: 8,
    scrollMargin: listOffset,
  });

  if (loading) return (
    <div style={{ minHeight: "calc(100vh - 160px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 12, color: "var(--purple)" }}><Search size={48} /></div>
        <p style={{ color: "var(--text-dim)", fontWeight: 700 }}>Loading problems…</p>
      </div>
    </div>
  );

  const diffColors: Record<Difficulty, string> = { Easy: "var(--green)", Medium: "var(--orange)", Hard: "var(--red)" };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 80px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Search size={24} style={{ color: "var(--purple)" }} /> Search</h1>
        <p style={{ color: "var(--text-dim)", fontWeight: 600 }}>{questions.length} problems in your deck</p>
      </div>

      {/* Search bar */}
      <input
        type="search" value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by problem title…"
        style={{ width: "100%", padding: "14px 18px", fontSize: 15, marginBottom: 16 }}
      />

      {/* Filters */}
      {(() => {
        const activeCount = diffFilter.size + progressFilter.size + tagFilter.size;
        return (
          <div className="card-surface" style={{ marginBottom: 20, overflow: "hidden" }}>
            {/* Header row — always visible */}
            <button
              onClick={toggleFilters}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px", background: "none", border: "none", cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SlidersHorizontal size={15} style={{ color: "var(--text-dim)" }} />
                <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text-dim)" }}>Filters</span>
                {activeCount > 0 && (
                  <span style={{
                    background: "var(--purple)", color: "#fff",
                    borderRadius: 20, fontSize: 11, fontWeight: 900,
                    padding: "1px 8px",
                  }}>{activeCount}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {activeCount > 0 && (
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); setDiffFilter(new Set()); setProgressFilter(new Set()); setTagFilter(new Set()); }}
                    style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    Clear all
                  </span>
                )}
                <ChevronDown size={16} style={{
                  color: "var(--text-muted)",
                  transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }} />
              </div>
            </button>

            {/* Collapsible body */}
            <div style={{
              height: filterHeight,
              overflow: "hidden",
              transition: "height 0.25s ease",
            }}>
              <div ref={filterBodyRef}>
                <div style={{
                  padding: "4px 20px 18px",
                  borderTop: "2px solid var(--border)",
                  display: "flex", flexDirection: "column", gap: 14,
                }}>
                  {/* Difficulty */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, marginTop: 14 }}>Difficulty</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {ALL_DIFFICULTIES.map(d => {
                        const active = diffFilter.has(d);
                        return (
                          <button key={d} onClick={() => setDiffFilter(prev => toggle(prev, d))}
                            style={{
                              fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 12,
                              padding: "6px 16px", borderRadius: 20, cursor: "pointer",
                              border: `2px solid ${diffColors[d]}`,
                              background: active ? diffColors[d] : "transparent",
                              color: active ? "#fff" : diffColors[d],
                              transition: "all 0.15s",
                            }}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Progress</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {ALL_PROGRESS.map(p => {
                        const active = progressFilter.has(p);
                        return (
                          <button key={p} onClick={() => setProgressFilter(prev => toggle(prev, p))}
                            style={{
                              fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 12,
                              padding: "6px 16px", borderRadius: 20, cursor: "pointer",
                              border: "2px solid var(--border)",
                              background: active ? "var(--purple)" : "transparent",
                              color: active ? "#fff" : "var(--text-dim)",
                              transition: "all 0.15s", textTransform: "capitalize",
                            }}>
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Topics */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Topics</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {allTags.map(t => {
                        const active = tagFilter.has(t);
                        return (
                          <button key={t} onClick={() => setTagFilter(prev => toggle(prev, t))}
                            style={{
                              fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 12,
                              padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                              border: "2px solid",
                              borderColor: active ? "var(--purple-dk)" : "var(--border)",
                              background: active ? "var(--purple)" : "var(--bg)",
                              color: active ? "#fff" : "var(--text-dim)",
                              transition: "all 0.15s",
                            }}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Count */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12 }}>
        {filtered.length} result{filtered.length !== 1 ? "s" : ""}
      </div>

      {/* Results — virtualised so only visible rows are in the DOM */}
      <div ref={listRef} style={{ position: "relative", height: rowVirtualizer.getTotalSize() }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontWeight: 700, fontSize: 15 }}>
            No results found
          </div>
        )}
        {rowVirtualizer.getVirtualItems().map(vRow => {
          const q = filtered[vRow.index];
          const st = cardStates[q.id];
          const progress: ProgressState = st?.progress ?? "new";
          const queued = addedToQueue === q.id;
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute", top: 0, left: 0, width: "100%",
                transform: `translateY(${vRow.start - listOffset}px)`,
                paddingBottom: 8,
              }}
            >
              <div
                onClick={() => setPreviewQuestion(q)}
                style={{
                  padding: "12px 14px",
                  background: "var(--bg-card)", border: "2px solid var(--border)", borderRadius: 14,
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--text-dim)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
              >
                {/* Row 1: id + title + add-to-queue button */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>#{q.id}</span>
                  <span style={{ flex: 1, fontWeight: 800, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</span>
                  <button
                    className="btn btn-primary"
                    onClick={e => { e.stopPropagation(); handleAddToQueue(q); }}
                    style={{ padding: "5px 12px", fontSize: 12, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                      background: queued ? "var(--green)" : undefined, borderColor: queued ? "var(--green)" : undefined }}
                  >
                    {queued ? "Added!" : <><Plus size={12} /> Queue</>}
                  </button>
                </div>
                {/* Row 2: badges + tags */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <DifficultyBadge difficulty={q.difficulty} />
                  <ProgressBadge state={progress} />
                  {(st?.successStreak ?? 0) > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#c47c00", display: "inline-flex", alignItems: "center", gap: 1 }}><Flame size={11} />×{st!.successStreak}</span>
                  )}
                  {q.tags.slice(0, 3).map(t => <span key={t} className="tag" style={{ fontSize: 10 }}>{t}</span>)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewQuestion && (() => {
        const q = previewQuestion;
        const st = cardStates[q.id];
        const progress: ProgressState = st?.progress ?? "new";
        const queued = addedToQueue === q.id;
        return (
          <>
            <div
              onClick={() => setPreviewQuestion(null)}
              style={{
                position: "fixed", inset: 0, zIndex: 1100,
                background: "rgba(26,31,54,0.5)", backdropFilter: "blur(3px)",
                animation: "fadeIn 0.15s ease",
              }}
            />
            <div style={{
              position: "fixed", inset: 0, zIndex: 1101,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "16px", pointerEvents: "none",
            }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "var(--bg-card)", border: "2px solid var(--border)", borderRadius: 18,
                width: "100%", maxWidth: 640, maxHeight: "85vh",
                display: "flex", flexDirection: "column",
                overflow: "hidden", pointerEvents: "auto",
                animation: "popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              {/* Modal header */}
              <div style={{ padding: "16px 20px", borderBottom: "2px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>#{q.id}</div>
                  <div style={{ fontWeight: 900, fontSize: 17, lineHeight: 1.3, marginBottom: 8 }}>{q.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <ProgressBadge state={progress} />
                    {(st?.successStreak ?? 0) > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#c47c00", display: "inline-flex", alignItems: "center", gap: 1 }}><Flame size={11} />×{st!.successStreak}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setPreviewQuestion(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, flexShrink: 0 }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {/* Description */}
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-wrap", marginBottom: 20 }}>{q.description}</p>

                {/* Examples */}
                {q.examples.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Examples</div>
                    {q.examples.map((ex, i) => (
                      <div key={i} style={{ background: "var(--bg)", border: "2px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, fontSize: 13 }}>
                        <div><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Input:</span> <code style={{ fontFamily: "var(--font-mono, monospace)" }}>{ex.input}</code></div>
                        <div><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Output:</span> <code style={{ fontFamily: "var(--font-mono, monospace)" }}>{ex.output}</code></div>
                        {ex.explanation && <div style={{ marginTop: 4, color: "var(--text-dim)", fontSize: 12 }}>{ex.explanation}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Constraints */}
                {q.constraints.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Constraints</div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                      {q.constraints.map((c, i) => (
                        <li key={i} style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-mono, monospace)" }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Follow-up */}
                {q.follow_up && (
                  <div style={{ marginBottom: 20, padding: "10px 14px", background: "var(--bg)", border: "2px solid var(--border)", borderRadius: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Follow-up</span>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-dim)" }}>{q.follow_up}</p>
                  </div>
                )}

                {/* Tags */}
                {q.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {q.tags.map(t => <span key={t} className="tag" style={{ fontSize: 11 }}>{t}</span>)}
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{ padding: "14px 20px", borderTop: "2px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  className="btn"
                  onClick={() => setPreviewQuestion(null)}
                  style={{ padding: "8px 18px", fontSize: 13 }}
                >
                  Close
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleAddToQueue(q)}
                  style={{ padding: "8px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                    background: queued ? "var(--green)" : undefined, borderColor: queued ? "var(--green)" : undefined }}
                >
                  {queued ? "Added to Queue!" : <><Plus size={14} /> Add to Queue</>}
                </button>
              </div>
            </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

"use client";
import { Question, CardState, LearnSession } from "@/lib/types";
import DifficultyBadge from "./DifficultyBadge";
import ProgressBadge from "./ProgressBadge";
import { List, Pin, Zap, Clock, Flame } from "lucide-react";

interface Props {
  queue: Question[];
  cardStates: Record<number, CardState>;
  session: LearnSession;
  onClose: () => void;
  onSelect: (q: Question) => void;
}

function formatDue(nextDueAt: string): string {
  const diff = new Date(nextDueAt).getTime() - Date.now();
  if (diff <= 0) return "Due now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function QueueDrawer({ queue, cardStates, session, onClose, onSelect }: Props) {

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "2px solid var(--border)",
          position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 2 }}><List size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Up Next</h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                {queue.length} card{queue.length !== 1 ? "s" : ""} in queue — in this order
              </p>
            </div>
            <button onClick={onClose} style={{
              width: 36, height: 36, borderRadius: 18,
              background: "var(--bg-2)", border: "2px solid var(--border)",
              cursor: "pointer", fontSize: 16, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontWeight: 900, color: "var(--text-dim)",
            }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {queue.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontWeight: 600 }}>
              Queue is empty
            </div>
          )}
          {queue.map((q, idx) => {
            const st = cardStates[q.id];
            const isDue = st && new Date(st.nextDueAt) <= new Date();
            const isInjected = session.injectedQuestionId === q.id;

            return (
              <div key={q.id} onClick={() => onSelect(q)} style={{
                padding: "12px 14px", borderRadius: 12,
                border: `2px solid ${isInjected ? "var(--purple)" : "var(--border)"}`,
                background: isInjected ? "var(--purple-lt)" : "var(--bg-card)",
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", flexDirection: "column", gap: 8,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isInjected ? "var(--purple-lt)" : "var(--bg-2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isInjected ? "var(--purple-lt)" : "var(--bg-card)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: isInjected ? "var(--purple)" : "var(--text-muted)", minWidth: 22 }}>
                      {isInjected ? <Pin size={12} /> : idx + 1}
                    </span>
                    <span style={{
                      fontWeight: 800, fontSize: 14,
                      color: isInjected ? "var(--purple)" : "var(--text)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{q.title}</span>
                  </div>
                  <DifficultyBadge difficulty={q.difficulty} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 30 }}>
                  {st ? (
                    <>
                      <ProgressBadge state={st.progress} />
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: isDue ? "var(--green-dk)" : "var(--text-muted)",
                        background: isDue ? "var(--green-lt)" : "var(--bg-2)",
                        borderRadius: 20, padding: "2px 8px",
                      }}>
                        {isDue ? <><Zap size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />Due now</> : <><Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />{formatDue(st.nextDueAt)}</>}
                      </span>
                      {st.successStreak > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#c47c00" }}><Flame size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />×{st.successStreak}</span>
                      )}
                    </>
                  ) : (
                    <span className="badge-new">NEW</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--purple)" }}>
                    Study now →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

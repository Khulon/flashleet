"use client";

import { useEffect, useState, useCallback, useRef, CSSProperties } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Brain, Trophy, CheckCircle2, XCircle, List, Zap, Clock, Flame, Sparkles, Info, Layers, Target, Timer, Award, Lightbulb, RotateCcw, X, AlarmClock } from "lucide-react";
import { Question, CardState, UserSettings, LearnSession } from "@/lib/types";
import {
  getQuestions, getCardStates, saveCardState,
  getUserSettings, getLearnSession, saveLearnSession,
} from "@/lib/storage";
import { createInitialCardState, updateCardState } from "@/lib/scheduler";
import { buildQueue } from "@/lib/queue";
import { useTimer } from "@/lib/useTimer";
import { useDebounce } from "@/lib/useDebounce";
import DifficultyBadge from "@/components/DifficultyBadge";
import ProgressBadge from "@/components/ProgressBadge";
import QueueDrawer from "@/components/QueueDrawer";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

type ResultFlash = "know" | "dontknow" | null;

// Fixed card height — never changes regardless of content
const CARD_HEIGHT = 340;
const SWIPE_THRESHOLD = 110;

export default function LearnPage() {
  // ── data ──
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});
  const [settings, setSettings]     = useState<UserSettings | null>(null);
  const [session, setSession]       = useState<LearnSession | null>(null);
  const [loading, setLoading]       = useState(true);

  // ── card ui ──
  const [currentQ, setCurrentQ]   = useState<Question | null>(null);
  const [flipped, setFlipped]           = useState(false);
  const [hasFlippedOnce, setHasFlippedOnce] = useState(false);
  const [notes, setNotes]         = useState("");
  const [code, setCode]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [langModules, setLangModules] = useState<{ python: any; oneDark: any } | null>(null);

  // ── problem modal ──
  const [modalOpen, setModalOpen] = useState(false);

  // ── session batch ──
  const [batchQueue, setBatchQueue] = useState<Question[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const batchQueueRef = useRef<Question[]>([]);
  const batchIndexRef = useRef(0);
  batchQueueRef.current = batchQueue;
  batchIndexRef.current = batchIndex;

  // ── swipe ──
  const dragXRef = useRef(0);  // current drag offset — mutated directly, no re-renders
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX  = useRef<number | null>(null);
  const dragStartY  = useRef<number | null>(null);
  const dragIsHoriz = useRef<boolean | null>(null);
  const cardWrapRef = useRef<HTMLDivElement>(null);
  const knowLabelRef = useRef<HTMLDivElement>(null);
  const dontLabelRef = useRef<HTMLDivElement>(null);

  // ── feedback ──
  const [answering, setAnswering]   = useState(false);
  const [resultFlash, setResultFlash] = useState<ResultFlash>(null);
  const [sessionStats, setSessionStats] = useState({ know: 0, dontknow: 0 });

  // ── skip menu ──
  const [skipMenuOpen, setSkipMenuOpen] = useState(false);

  // ── queue drawer ──
  const [queueOpen, setQueueOpen] = useState(false);

  // ── info modal ──
  const [infoOpen, setInfoOpen] = useState(false);

  // ── AI ──
  const [aiLoadingNotes, setAiLoadingNotes] = useState(false);
  const [aiLoadingCode, setAiLoadingCode]   = useState(false);
  const [aiError, setAiError]               = useState<string | null>(null);
  const [hasAiKey, setHasAiKey]             = useState(false);

  // ── stable refs ──
  const currentQIdRef = useRef<number | null>(null);
  const cardStatesRef = useRef(cardStates);
  const questionsRef  = useRef(questions);
  const settingsRef   = useRef(settings);
  const sessionRef    = useRef(session);
  const notesRef      = useRef(notes);
  const codeRef       = useRef(code);
  const answeringRef  = useRef(answering);

  cardStatesRef.current = cardStates;
  questionsRef.current  = questions;
  settingsRef.current   = settings;
  sessionRef.current    = session;
  notesRef.current      = notes;
  codeRef.current       = code;
  answeringRef.current  = answering;

  // This is a real page so it is always active when mounted
  const isActive = true;

  const timer = useTimer();

  // Pause timer while on another tab; resume when returning to learn
  const pathname = usePathname();
  const isLearnTab = pathname === "/learn" || pathname === "/";
  useEffect(() => {
    if (isLearnTab) {
      timer.resume();
    } else {
      timer.pause();
    }
  }, [isLearnTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([import("@codemirror/lang-python"), import("@codemirror/theme-one-dark")])
      .then(([py, th]) => setLangModules({ python: py.python, oneDark: th.oneDark }));
  }, []);

  useEffect(() => {
    // All four calls return instantly from cache after first visit.
    // Promise.all still needed for first load (4 parallel network requests).
    Promise.all([getQuestions(), getCardStates(), getUserSettings(), getLearnSession()])
      .then(([qs, cs, s, sess]) => {
        setQuestions(qs); setCardStates(cs); setSettings(s); setSession(sess);
        setHasAiKey(!!s.ai?.apiKey);
        setLoading(false);
      });
  }, []);

  // ── start a new batch ──
  const startBatch = useCallback((
    qs: Question[], cs: Record<number, CardState>, s: UserSettings, sess: LearnSession,
  ) => {
    const size = s.sessionSize ?? 10;
    const batch = buildQueue(qs, cs, s, sess).slice(0, size);
    setBatchQueue(batch);
    setBatchIndex(0);
    setSessionDone(false);
    if (batch.length === 0) { setCurrentQ(null); return; }
    const first = batch[0];
    const finalSess: LearnSession = { injectedQuestionId: null, recentQuestionIds: sess.recentQuestionIds };
    setCurrentQ(first); setFlipped(false); setModalOpen(false);
    setResultFlash(null); resetDragStyle();
    currentQIdRef.current = first.id;
    const st = cs[first.id];
    setNotes(st?.notes ?? ""); setCode(st?.code ?? "");
    setSession(finalSess); saveLearnSession(finalSess);
    timer.start();
  }, [timer]);

  useEffect(() => {
    if (!loading && questions.length > 0 && settings && session) {
      startBatch(questions, cardStates, settings, session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── advance within batch ──
  const advanceInBatch = useCallback((cs: Record<number, CardState>, sess: LearnSession, completedId: number) => {
    const nextIndex = batchIndexRef.current + 1;
    const batch = batchQueueRef.current;
    const finalSess: LearnSession = {
      injectedQuestionId: null,
      recentQuestionIds: [...sess.recentQuestionIds, completedId].slice(-10),
    };
    setSession(finalSess); saveLearnSession(finalSess);

    if (nextIndex >= batch.length) {
      setBatchIndex(nextIndex); setSessionDone(true);
      setCurrentQ(null); currentQIdRef.current = null; timer.stop(); return;
    }
    const next = batch[nextIndex];
    setBatchIndex(nextIndex);
    setCurrentQ(next); setFlipped(false); setHasFlippedOnce(false); setModalOpen(false);
    setResultFlash(null); resetDragStyle();
    currentQIdRef.current = next.id;
    const st = cs[next.id];
    setNotes(st?.notes ?? ""); setCode(st?.code ?? "");
    timer.start();
  }, [timer]);

  // ── inject from queue drawer ──
  const injectCard = useCallback((q: Question, sess: LearnSession) => {
    const remaining = batchQueueRef.current.slice(batchIndexRef.current + 1);
    const newBatch = [
      ...batchQueueRef.current.slice(0, batchIndexRef.current + 1),
      q,
      ...remaining.filter(x => x.id !== q.id),
    ];
    setBatchQueue(newBatch);
    const finalSess: LearnSession = { ...sess, injectedQuestionId: null };
    setCurrentQ(q); setFlipped(false); setModalOpen(false);
    setResultFlash(null); resetDragStyle();
    currentQIdRef.current = q.id;
    const st = cardStatesRef.current[q.id];
    setNotes(st?.notes ?? ""); setCode(st?.code ?? "");
    setSession(finalSess); saveLearnSession(finalSess);
    timer.start();
  }, [timer]);

  // ── autosave ──
  const persistNoteCode = useCallback(async (n: string, c: string) => {
    const qId = currentQIdRef.current;
    if (!qId) return;
    setSaving(true);
    const existing = cardStatesRef.current[qId] ?? createInitialCardState(qId);
    const updated = { ...existing, notes: n, code: c };
    await saveCardState(updated);
    setCardStates(prev => ({ ...prev, [qId]: updated }));
    setSaving(false);
  }, []);
  const debouncedSave = useDebounce(persistNoteCode, 400);

  // ── answer ──
  const handleAnswer = useCallback(async (knew: boolean) => {
    if (answeringRef.current || !currentQIdRef.current) return;
    const q = questionsRef.current.find(x => x.id === currentQIdRef.current);
    if (!q) return;
    setAnswering(true);
    const elapsed = timer.stop();
    setResultFlash(knew ? "know" : "dontknow");
    setSessionStats(prev => knew ? { ...prev, know: prev.know + 1 } : { ...prev, dontknow: prev.dontknow + 1 });
    const existing = cardStatesRef.current[q.id] ?? createInitialCardState(q.id);
    const updated  = updateCardState({ ...existing, notes: notesRef.current, code: codeRef.current }, knew, elapsed, settingsRef.current?.sr);
    await saveCardState(updated);
    const newCS = { ...cardStatesRef.current, [q.id]: updated };
    setCardStates(newCS);
    await new Promise(r => setTimeout(r, 500));
    setResultFlash(null); resetDragStyle();
    if (sessionRef.current) advanceInBatch(newCS, sessionRef.current, q.id);
    setAnswering(false);
  }, [timer, advanceInBatch]);

  // ── skip ──
  const handleSkipOption = useCallback(async (option: "back" | "remove" | "snooze", snoozeHours?: number) => {
    if (answeringRef.current || !currentQIdRef.current) return;
    setSkipMenuOpen(false);
    const batch = batchQueueRef.current;
    const idx   = batchIndexRef.current;

    let newBatch: Question[];
    if (option === "back") {
      // Shuffle current card to end of remaining queue
      newBatch = [...batch.slice(0, idx), ...batch.slice(idx + 1), batch[idx]];
    } else {
      // Drop current card from batch entirely
      newBatch = [...batch.slice(0, idx), ...batch.slice(idx + 1)];
      // Both "remove" (hide indefinitely) and "snooze" update nextDueAt
      const hours = option === "remove" ? 87_600 /* ~10 years */ : snoozeHours ?? 0;
      if (hours > 0) {
        const q = questionsRef.current.find(x => x.id === currentQIdRef.current);
        if (q) {
          const existing = cardStatesRef.current[q.id] ?? createInitialCardState(q.id);
          const updated = { ...existing, nextDueAt: new Date(Date.now() + hours * 3_600_000).toISOString() };
          await saveCardState(updated);
          setCardStates(prev => ({ ...prev, [q.id]: updated }));
        }
      }
    }

    setBatchQueue(newBatch);

    // Check if session is now empty
    if (newBatch.length === 0 || idx >= newBatch.length) {
      setSessionDone(true); setCurrentQ(null); currentQIdRef.current = null; timer.stop(); return;
    }

    const next = newBatch[idx];
    setCurrentQ(next); setFlipped(false); setHasFlippedOnce(false); setModalOpen(false);
    setResultFlash(null); resetDragStyle();
    currentQIdRef.current = next.id;
    const st = cardStatesRef.current[next.id];
    setNotes(st?.notes ?? ""); setCode(st?.code ?? "");
    timer.start();
  }, [timer]);

  // ── AI ──
  const generateAI = useCallback(async (type: "notes" | "code") => {
    const q = questionsRef.current.find(x => x.id === currentQIdRef.current);
    if (!q) return;
    setAiError(null);
    if (type === "notes") setAiLoadingNotes(true); else setAiLoadingCode(true);
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, questionTitle: q.title, questionDescription: q.description, examples: q.examples, constraints: q.constraints, tags: q.tags, difficulty: q.difficulty }),
      });
      const data = await res.json();
      if (data.error) { setAiError(data.error); }
      else if (type === "notes") { setNotes(data.result); debouncedSave(data.result, codeRef.current); }
      else { setCode(data.result); debouncedSave(notesRef.current, data.result); }
    } catch (e: any) { setAiError(e.message); }
    if (type === "notes") setAiLoadingNotes(false); else setAiLoadingCode(false);
  }, [debouncedSave]);

  // ── swipe / drag ──────────────────────────────────────────────────────
  //
  // Architecture:
  //   • React pointer events on the card wrapper handle MOUSE (desktop).
  //     They work perfectly because mouse events always bubble correctly.
  //
  //   • A useEffect registers NON-PASSIVE touch listeners directly on the
  //     wrapper DOM node. This is the only way to call preventDefault() on
  //     touch events (React synthetic touch events are passive by default).
  //     Non-passive + preventDefault lets us steal horizontal swipes away
  //     from children like <textarea> that would otherwise claim the touch.
  //
  //   • Both paths share the same applyDragStyle / resetDragStyle helpers
  //     and the same dragStartX/Y/dragIsHoriz refs, so state is consistent.
  //
  //   • isDraggingRef (plain ref, no state) tracks whether we've committed
  //     to a horizontal drag — zero React re-renders during the gesture.

  const isDraggingRef = useRef(false);

  const applyDragStyle = (dx: number) => {
    const el = cardWrapRef.current;
    if (!el) return;
    el.style.transform = `translateX(${dx}px) rotate(${(dx / SWIPE_THRESHOLD) * 18}deg)`;
    dragXRef.current = dx;
    const tintKnow = document.getElementById("swipe-tint-know");
    const tintDont = document.getElementById("swipe-tint-dont");
    if (tintKnow) tintKnow.style.background = dx > 30 ? `rgba(46,204,113,${Math.min((dx/SWIPE_THRESHOLD)*0.22,0.22)})` : "transparent";
    if (tintDont) tintDont.style.background = dx < -30 ? `rgba(255,71,87,${Math.min((-dx/SWIPE_THRESHOLD)*0.22,0.22)})` : "transparent";
    if (knowLabelRef.current) knowLabelRef.current.style.opacity = dx > 30 ? String(Math.min((dx/SWIPE_THRESHOLD)*1.5,1)) : "0";
    if (dontLabelRef.current) dontLabelRef.current.style.opacity = dx < -30 ? String(Math.min((-dx/SWIPE_THRESHOLD)*1.5,1)) : "0";
  };

  const resetDragStyle = () => {
    const el = cardWrapRef.current;
    if (!el) return;
    el.style.transform = "";
    dragXRef.current = 0;
    const tintKnow = document.getElementById("swipe-tint-know");
    const tintDont = document.getElementById("swipe-tint-dont");
    if (tintKnow) tintKnow.style.background = "transparent";
    if (tintDont) tintDont.style.background = "transparent";
    if (knowLabelRef.current) knowLabelRef.current.style.opacity = "0";
    if (dontLabelRef.current) dontLabelRef.current.style.opacity = "0";
  };

  const commitHorizontal = () => {
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const finishDrag = (finalDx: number) => {
    isDraggingRef.current = false;
    dragStartX.current = null;
    dragStartY.current = null;
    dragIsHoriz.current = null;
    setIsDragging(false);
    if (Math.abs(finalDx) >= SWIPE_THRESHOLD) {
      handleAnswer(finalDx > 0);
    } else {
      resetDragStyle();
    }
  };

  // ── TOUCH handlers (non-passive, registered imperatively) ──────────
  // Must be useEffect so we can pass { passive: false } — impossible with
  // React's synthetic events. We re-attach whenever currentQ changes so
  // handleAnswer closure stays fresh.
  const handleAnswerRef = useRef(handleAnswer);
  handleAnswerRef.current = handleAnswer;

  useEffect(() => {
    // When this tab is hidden, don't register ANY touch listeners.
    // A non-passive touchmove listener anywhere in the document forces the
    // browser to wait for JS before scrolling — makes the whole app laggy.
    if (!isActive) return;

    const el = cardWrapRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (answeringRef.current) return;
      const t = e.touches[0];
      dragStartX.current = t.clientX;
      dragStartY.current = t.clientY;
      dragIsHoriz.current = null;
      isDraggingRef.current = false;
      dragXRef.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (dragStartX.current === null) return;
      const t = e.touches[0];
      const dx = t.clientX - dragStartX.current;
      const dy = t.clientY - (dragStartY.current ?? t.clientY);

      if (dragIsHoriz.current === null) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        dragIsHoriz.current = Math.abs(dx) > Math.abs(dy);
        if (!dragIsHoriz.current) {
          // Vertical swipe — abandon, let textarea/page scroll naturally
          dragStartX.current = null;
          dragStartY.current = null;
          return;
        }
        // Horizontal confirmed — steal gesture from any scrolling child
        commitHorizontal();
      }

      if (dragIsHoriz.current) {
        // Prevent page scroll AND textarea scroll while swiping horizontally
        e.preventDefault();
        applyDragStyle(dx);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDraggingRef.current) {
        // Not a swipe — check if it was a tap (tiny movement)
        const startX = dragStartX.current;
        const startY = dragStartY.current;
        dragStartX.current = null;
        dragStartY.current = null;
        dragIsHoriz.current = null;

        if (startX === null) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - (startY ?? t.clientY);
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
          // It's a tap — flip unless the tap was on an interactive element
          const target = e.target as HTMLElement;
          const isInteractive = target.closest(
            "button, a, textarea, input, .cm-editor, .cm-content, [data-no-drag]"
          );
          if (!isInteractive) {
            // Use flippedRef so closure has fresh value
            setFlipped(f => { if (!f) setHasFlippedOnce(true); return !f; });
          }
        }
        return;
      }
      finishDrag(dragXRef.current);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });
    el.addEventListener("touchcancel",() => {
      isDraggingRef.current = false;
      dragStartX.current = null;
      dragStartY.current = null;
      resetDragStyle();
      setIsDragging(false);
    }, { passive: true });

    return () => {
      el.removeEventListener("touchstart",  onTouchStart as EventListener);
      el.removeEventListener("touchmove",   onTouchMove  as EventListener);
      el.removeEventListener("touchend",    onTouchEnd   as EventListener);
    };
  // Remove listeners when tab is hidden so they don't block touches on other tabs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, isActive]);

  // ── MOUSE / POINTER handlers (desktop only) ────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // handled by touch listeners above
    if (answering) return;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragIsHoriz.current = null;
    isDraggingRef.current = false;
    dragXRef.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - (dragStartY.current ?? e.clientY);
    if (dragIsHoriz.current === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      dragIsHoriz.current = Math.abs(dx) > Math.abs(dy);
      if (!dragIsHoriz.current) {
        dragStartX.current = null;
        dragStartY.current = null;
        return;
      }
      commitHorizontal();
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    }
    if (dragIsHoriz.current) {
      e.preventDefault();
      applyDragStyle(dx);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    const wasDragging = isDraggingRef.current;
    const startX = dragStartX.current;
    const startY = dragStartY.current;

    if (wasDragging) {
      finishDrag(dragXRef.current);
      return;
    }

    // Mouse tap — flip if not on an interactive element
    isDraggingRef.current = false;
    dragStartX.current = null;
    dragStartY.current = null;
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - (startY ?? e.clientY);
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest(
        "button, a, textarea, input, .cm-editor, .cm-content, [data-no-drag]"
      );
      if (!isInteractive) setFlipped(f => { if (!f) setHasFlippedOnce(true); return !f; });
    }
  };

  // ── derived ──
  // dragX-derived values now computed imperatively in applyDragStyle/resetDragStyle
  const totalSess  = sessionStats.know + sessionStats.dontknow;
  const accuracyPct = totalSess > 0 ? Math.round((sessionStats.know / totalSess) * 100) : null;
  const batchSize   = batchQueue.length;
  const batchProgress = batchSize > 0 ? Math.round((batchIndex / batchSize) * 100) : 0;

  // ─── Loading ───
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 12, color: "var(--purple)" }}><Brain size={48} /></div>
        <p style={{ color: "var(--text-dim)", fontWeight: 700, fontSize: 16 }}>Loading your deck…</p>
      </div>
    </div>
  );

  // ─── Session done / empty ───
  if (sessionDone || (!currentQ && !loading)) {
    const allDone = !sessionDone;
    const totalQueue = settings && session ? buildQueue(questions, cardStates, settings, session).length : 0;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
        <div className="card-surface" style={{ maxWidth: 440, width: "calc(100% - 32px)", padding: "40px 36px", textAlign: "center" }}>
          <div style={{ marginBottom: 16, color: allDone ? "var(--green)" : "var(--orange)" }}>{allDone ? <CheckCircle2 size={52} /> : <Trophy size={52} />}</div>
          <h2 style={{ fontWeight: 900, fontSize: 26, marginBottom: 8 }}>{allDone ? "All caught up!" : "Session complete!"}</h2>
          <p style={{ color: "var(--text-dim)", fontWeight: 600, marginBottom: 28, fontSize: 15 }}>
            {allDone ? "No cards due right now." : `You reviewed ${batchSize} card${batchSize !== 1 ? "s" : ""} this session.`}
          </p>
          {totalSess > 0 && (
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 28 }}>
              <div style={{ background: "var(--green-lt)", borderRadius: 14, padding: "12px 20px" }}>
                <div style={{ fontWeight: 900, fontSize: 28, color: "var(--green-dk)" }}>{sessionStats.know}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--green-dk)" }}>Knew it</div>
              </div>
              <div style={{ background: "var(--red-lt)", borderRadius: 14, padding: "12px 20px" }}>
                <div style={{ fontWeight: 900, fontSize: 28, color: "var(--red-dk)" }}>{sessionStats.dontknow}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--red-dk)" }}>Didn&apos;t know</div>
              </div>
              {accuracyPct !== null && (
                <div style={{ background: "var(--purple-lt)", borderRadius: 14, padding: "12px 20px" }}>
                  <div style={{ fontWeight: 900, fontSize: 28, color: "var(--purple)" }}>{accuracyPct}%</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--purple)" }}>Accuracy</div>
                </div>
              )}
            </div>
          )}
          {!allDone && totalQueue > 0 && (
            <button className="btn btn-primary" style={{ width: "100%", fontSize: 16 }}
              onClick={() => { if (settings && session) { setSessionStats({ know: 0, dontknow: 0 }); startBatch(questions, cardStatesRef.current, settings, sessionRef.current!); } }}>
              Continue — next {Math.min(settings?.sessionSize ?? 10, totalQueue)} cards →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentQ) return null;
  const cardState = cardStates[currentQ.id];

  const skipItemStyle: CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 14px", background: "none", border: "none",
    cursor: "pointer", width: "calc(100% - 8px)", textAlign: "left",
    fontFamily: "var(--font-sans)", color: "var(--text)",
    borderRadius: 8, transition: "background 0.15s ease",
    margin: "0 4px",
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "20px 16px 80px", userSelect: "none" }}>

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--green-lt)", borderRadius: 20, padding: "5px 12px" }}>
            <CheckCircle2 size={13} style={{ color: "var(--green-dk)" }} />
            <span style={{ fontWeight: 900, color: "var(--green-dk)", fontSize: 14 }}>{sessionStats.know}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--red-lt)", borderRadius: 20, padding: "5px 12px" }}>
            <XCircle size={13} style={{ color: "var(--red-dk)" }} />
            <span style={{ fontWeight: 900, color: "var(--red-dk)", fontSize: 14 }}>{sessionStats.dontknow}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saving && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>Saving…</span>}
          <span className="timer">{timer.formatted}</span>
          <button className="btn btn-ghost" onClick={() => setQueueOpen(true)} style={{ padding: "6px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <List size={14} /><span style={{ background: "var(--purple)", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 900, padding: "1px 6px", marginLeft: 4 }}>{batchSize - batchIndex}</span>
          </button>
          <button className="btn btn-ghost" onClick={() => setInfoOpen(true)} style={{ padding: "6px 10px", fontSize: 14, fontWeight: 900, color: "var(--text-dim)", display: "inline-flex", alignItems: "center" }}>
            <Info size={14} />
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ marginBottom: 16 }}>
        <div className="progress-strip">
          <div className="progress-strip-fill" style={{ width: `${batchProgress}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>
          <span>{batchIndex} / {batchSize}</span>
          <span>{batchProgress}%</span>
        </div>
      </div>

      {/* ── Swipe labels — opacity driven imperatively via refs ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, height: 32, alignItems: "center", pointerEvents: "none" }}>
        <div ref={dontLabelRef} style={{
          background: "var(--red-lt)", color: "var(--red-dk)", borderRadius: 20, padding: "5px 16px",
          fontWeight: 900, fontSize: 12, border: "2px solid var(--red-dk)",
          opacity: 0,
        }}>← Don&apos;t Know</div>
        <div ref={knowLabelRef} style={{
          background: "var(--green-lt)", color: "var(--green-dk)", borderRadius: 20, padding: "5px 16px",
          fontWeight: 900, fontSize: 12, border: "2px solid var(--green-dk)",
          opacity: 0,
        }}>Know It →</div>
      </div>

      {/* ── Card drag wrapper ──
           Transform is applied imperatively in applyDragStyle() to avoid React
           re-renders on every pointermove. The CSS transition fires on release
           because we remove the inline style (falling back to transform: none). ── */}
      <div
        ref={cardWrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          if (isDraggingRef.current) { setIsDragging(false); resetDragStyle(); }
          isDraggingRef.current = false;
          dragStartX.current = null;
          dragStartY.current = null;
        }}
        style={{
          transformOrigin: "bottom center",
          transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          willChange: "transform",
          // pan-y: browser keeps native vertical scroll; we handle horizontal
          touchAction: "pan-y",
          position: "relative",
          cursor: isDragging ? "grabbing" : "default",
          // Extend hit area to capture drags starting anywhere on the card
          userSelect: "none",
        }}
      >
        {/* Swipe tint — always rendered; opacity driven by CSS vars set imperatively */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "var(--radius)", zIndex: 10, pointerEvents: "none",
          background: "transparent",
          // These are toggled imperatively: green tint for right, red for left
        }} id="swipe-tint-know" />
        <div style={{
          position: "absolute", inset: 0, borderRadius: "var(--radius)", zIndex: 10, pointerEvents: "none",
          background: "transparent",
        }} id="swipe-tint-dont" />

        {/* ── 3D flip shell — FIXED height ── */}
        <div style={{ perspective: "1400px" }}>
          <div style={{
            position: "relative",
            height: CARD_HEIGHT,  // fixed — never changes
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.4,0.2,0.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}>

            {/* ══ FRONT ══ */}
            <div className="card-surface" style={{
              position: "absolute", inset: 0,
              backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
              padding: "24px 24px 20px",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* header row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <DifficultyBadge difficulty={currentQ.difficulty} />
                  {cardState && <ProgressBadge state={cardState.progress} />}
                  {(cardState?.successStreak ?? 0) > 0 && (
                    <span style={{ background: "var(--yellow-lt)", color: "#c47c00", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <Flame size={12} />×{cardState!.successStreak}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>#{currentQ.id}</span>
              </div>

              <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, lineHeight: 1.25 }}>{currentQ.title}</h1>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                {currentQ.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
              </div>

              {/* Problem preview — click opens modal */}
              <div
                data-no-drag="true"
                onClick={e => { e.stopPropagation(); setModalOpen(true); }}
                style={{
                  flex: 1, background: "var(--bg)", borderRadius: 10, padding: "12px 14px",
                  cursor: "pointer", overflow: "hidden", position: "relative",
                  border: "2px solid transparent", transition: "border-color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--text-dim)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}
              >
                <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55, margin: 0 }}>
                  {currentQ.description.replace(/\n+/g, " ").slice(0, 160)}{currentQ.description.length > 160 ? "…" : ""}
                </p>
                {/* Fade + "read more" */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: 44,
                  background: "linear-gradient(transparent, var(--bg))",
                  display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
                  padding: "0 10px 8px",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--purple)" }}>View full →</span>
                </div>
              </div>
            </div>

            {/* ══ BACK ══ */}
            <div className="card-surface" style={{
              position: "absolute", inset: 0,
              backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              padding: "24px 24px 20px",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* back header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <DifficultyBadge difficulty={currentQ.difficulty} />
                  <span style={{ fontWeight: 900, fontSize: 14 }}>{currentQ.title}</span>
                </div>
                <button data-no-drag="true" className="btn btn-ghost"
                  onClick={e => { e.stopPropagation(); setFlipped(false); }}
                  style={{ padding: "4px 10px", fontSize: 11 }}>
                  ↩ Flip
                </button>
              </div>

              {/* AI error */}
              {aiError && (
                <div data-no-drag="true" style={{
                  background: "var(--red-lt)", border: "2px solid var(--red)", borderRadius: 8,
                  padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "var(--red-dk)",
                  fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>⚠️ {aiError}</span>
                  <button data-no-drag="true" onClick={() => setAiError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 900, color: "var(--red-dk)", padding: "0 4px" }}>✕</button>
                </div>
              )}

              {/* Notes — fills remaining space */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Notes
                  </label>
                  {hasAiKey && (
                    <button data-no-drag="true" onClick={e => { e.stopPropagation(); generateAI("notes"); }} disabled={aiLoadingNotes}
                      style={{
                        fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 11,
                        padding: "4px 10px", borderRadius: 20, cursor: "pointer",
                        border: "2px solid var(--purple)", background: "var(--purple-lt)", color: "var(--purple)",
                        opacity: aiLoadingNotes ? 0.6 : 1,
                      }}>
                      {aiLoadingNotes ? "…" : <><Sparkles size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />AI</>}
                    </button>
                  )}
                </div>
                <textarea
                  data-no-drag="true"
                  value={notes}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { setNotes(e.target.value); debouncedSave(e.target.value, codeRef.current); }}
                  placeholder={hasAiKey ? "Your notes, or click AI to generate…" : "Key insights, patterns, complexity…"}
                  style={{ flex: 1, width: "100%", padding: "9px 12px", fontSize: 12, lineHeight: 1.6, resize: "none", minHeight: 0 }}
                />
              </div>

              {/* AI nudge when no key */}
              {!hasAiKey && (
                <div data-no-drag="true" style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>
                  <a href="/settings" style={{ color: "var(--purple)", fontWeight: 800 }}>Add AI key in Settings</a> to auto-generate notes & code
                </div>
              )}
            </div>

          </div>{/* end flip inner */}
        </div>{/* end perspective */}
      </div>{/* end drag wrapper */}

      {/* ── Answer buttons — compact, always visible, like the screenshot ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, marginTop: 20 }}>
        {/* Don't know — red circle with × */}
        <button
          onClick={() => handleAnswer(false)}
          disabled={answering}
          style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "#fff", border: "2.5px solid var(--red)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 0 var(--red-dk)",
            transition: "transform 0.1s, box-shadow 0.1s",
            opacity: answering ? 0.5 : 1,
          }}
          onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 0 var(--red-dk)"; }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Card counter in the middle */}
        <span style={{ fontWeight: 900, fontSize: 16, color: "var(--text-dim)", minWidth: 48, textAlign: "center" }}>
          {batchIndex + 1}/{batchSize}
        </span>

        {/* Know it — teal/green circle with ✓ */}
        <button
          onClick={() => handleAnswer(true)}
          disabled={answering}
          style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "#fff", border: "2.5px solid #2ec4b6",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 0 #1a9e92",
            transition: "transform 0.1s, box-shadow 0.1s",
            opacity: answering ? 0.5 : 1,
          }}
          onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 0 #1a9e92"; }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10L8.5 14.5L16 6" stroke="#2ec4b6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Skip button + popover ── */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 10, position: "relative" }}>
        <button
          onClick={() => !answering && setSkipMenuOpen(p => !p)}
          disabled={answering}
          style={{
            background: "none", border: "none", cursor: answering ? "default" : "pointer",
            fontSize: 12, fontWeight: 700, color: skipMenuOpen ? "var(--text-dim)" : "var(--text-muted)",
            padding: "4px 12px", borderRadius: 20,
            opacity: answering ? 0.4 : 1,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => { if (!answering) (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; }}
          onMouseLeave={e => { if (!skipMenuOpen) (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >
          Skip ↑
        </button>

        {/* Popover — opens upward */}
        {skipMenuOpen && (
          <>
            {/* Click-away backdrop */}
            <div onClick={() => setSkipMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
            {/* Layer 1 — position only, no transform */}
            <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", zIndex: 201 }}>
              {/* Layer 2 — centering only, no animation */}
              <div style={{ transform: "translateX(-50%)" }}>
                {/* Layer 3 — animation only, no transform of its own */}
                <div style={{
                  background: "var(--bg-card)", border: "2px solid var(--border)", borderRadius: 14,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  minWidth: 230, overflow: "hidden",
                  animation: "popIn 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                }}>
                <div style={{ padding: "8px 4px 4px", display: "flex", flexDirection: "column" }}>

                  {/* Move to back — only if there are more cards */}
                  {batchQueue.length - batchIndex > 1 && (
                    <button
                      onClick={() => handleSkipOption("back")}
                      style={skipItemStyle}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <RotateCcw size={15} style={{ flexShrink: 0, color: "var(--text-dim)" }} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>Move to back</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>See it again later this session</div>
                      </div>
                    </button>
                  )}

                  {/* Hide indefinitely */}
                  <button
                    onClick={() => handleSkipOption("remove")}
                    style={skipItemStyle}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                  >
                    <X size={15} style={{ flexShrink: 0, color: "var(--text-dim)" }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>Hide indefinitely</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Won&apos;t appear unless re-added</div>
                    </div>
                  </button>

                  {/* Snooze divider */}
                  <div style={{ margin: "4px 12px", borderTop: "1.5px solid var(--border)" }} />
                  <div style={{ padding: "4px 14px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
                      <AlarmClock size={11} style={{ color: "var(--text-muted)" }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Snooze for…</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {([["1h", 1], ["4h", 4], ["1 day", 24], ["3 days", 72]] as [string, number][]).map(([label, hrs]) => (
                        <button
                          key={label}
                          onClick={() => handleSkipOption("snooze", hrs)}
                          style={{
                            fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 12,
                            padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                            border: "2px solid var(--border)",
                            background: "var(--bg)", color: "var(--text-dim)",
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--purple)"; (e.currentTarget as HTMLElement).style.color = "var(--purple)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
                </div>{/* Layer 3 — animation */}
              </div>{/* Layer 2 — centering */}
            </div>{/* Layer 1 — position */}
          </>
        )}
      </div>

      {/* ── Result flash ── */}
      {resultFlash && (
        <div className="result-overlay">
          <div className="result-pill" style={resultFlash === "know"
            ? { background: "var(--green-lt)", color: "var(--green-dk)", borderColor: "var(--green-dk)" }
            : { background: "var(--red-lt)", color: "var(--red-dk)", borderColor: "var(--red-dk)" }
          }>
            {resultFlash === "know" ? "Nice work!" : "Keep going!"}
          </div>
        </div>
      )}

      {/* ── Solution panel — slides in when flipped ── */}
      <div style={{
        marginTop: 24,
        // Use grid-template-rows trick: animates from 0fr → 1fr with no overflow clipping
        display: "grid",
        gridTemplateRows: flipped ? "1fr" : "0fr",
        opacity: flipped ? 1 : 0,
        transition: "grid-template-rows 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease",
      }}>
      {/* Inner div must have overflow:hidden for the grid row trick to work,
          but we put it HERE not on the outer, so box-shadow isn't clipped */}
      <div style={{ overflow: "hidden", paddingBottom: flipped ? 8 : 0, transition: "padding-bottom 0.4s" }}>
        <div className="card-surface" style={{ padding: "22px 24px" }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Solution
            </span>
            {hasAiKey && (
              <button data-no-drag="true" onClick={() => generateAI("code")} disabled={aiLoadingCode}
                style={{
                  fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 11,
                  padding: "4px 10px", borderRadius: 20, cursor: "pointer",
                  border: "2px solid var(--purple)", background: "var(--purple-lt)", color: "var(--purple)",
                  opacity: aiLoadingCode ? 0.6 : 1,
                }}>
                {aiLoadingCode ? "Generating…" : <><Sparkles size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />AI Generate</>}
              </button>
            )}
          </div>

          {/* Only mount CodeMirror after first flip — it's heavy and slows initial render */}
          {hasFlippedOnce && langModules ? (
            <div style={{ border: "2px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <CodeMirror
                value={code}
                onChange={val => { setCode(val); debouncedSave(notesRef.current, val); }}
                extensions={[langModules.python()]}
                theme={langModules.oneDark}
                basicSetup={{ lineNumbers: true, foldGutter: false }}
                placeholder="Write your solution here…"
                minHeight="120px"
                style={{ fontSize: 12 }}
              />
            </div>
          ) : (
            <textarea
              value={code}
              onChange={e => { setCode(e.target.value); debouncedSave(notesRef.current, e.target.value); }}
              placeholder={hasFlippedOnce ? "Write your solution…" : "Flip the card to write your solution"}
              style={{ width: "100%", minHeight: 120, padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono)", lineHeight: 1.6, resize: "vertical" }}
            />
          )}
        </div>
      </div>{/* end inner overflow */}
      </div>{/* end grid wrapper */}

      {/* ── Problem modal ── */}
      {modalOpen && (
        <>
          <div
            onClick={() => setModalOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(26,31,54,0.5)",
              backdropFilter: "blur(3px)", zIndex: 1100,
              animation: "fadeIn 0.15s ease",
            }}
          />
          {/* Centering shell — no animation on this element so it never jitters */}
          <div style={{
            position: "fixed", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1101, pointerEvents: "none",
          }}>
          {/* Animated inner — scale+fade only, no translate needed */}
          <div style={{
            pointerEvents: "auto",
            width: "min(640px, calc(100vw - 32px))",
            maxHeight: "80vh",
            background: "var(--bg-card)", borderRadius: 20,
            border: "2px solid var(--border)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            overflow: "hidden",
            display: "flex", flexDirection: "column",
            animation: "popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            {/* modal header */}
            <div style={{
              padding: "18px 22px 14px", borderBottom: "2px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DifficultyBadge difficulty={currentQ.difficulty} />
                <span style={{ fontWeight: 900, fontSize: 16 }}>{currentQ.title}</span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: "var(--bg-2)", border: "2px solid var(--border)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, color: "var(--text-dim)",
                }}>✕</button>
            </div>

            {/* modal body — scrollable */}
            <div style={{ overflow: "auto", padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* description */}
              <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px" }}>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7, margin: 0 }}>
                  {currentQ.description}
                </pre>
              </div>

              {/* examples */}
              {currentQ.examples.map((ex, i) => (
                <div key={i} style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Example {i + 1}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.8 }}>
                    <div><b style={{ color: "var(--text-muted)" }}>Input: </b>{ex.input}</div>
                    <div><b style={{ color: "var(--text-muted)" }}>Output: </b>{ex.output}</div>
                    {ex.explanation && <div style={{ color: "var(--text-muted)", marginTop: 3 }}>{ex.explanation}</div>}
                  </div>
                </div>
              ))}

              {/* constraints */}
              {currentQ.constraints.length > 0 && (
                <div style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Constraints</div>
                  {currentQ.constraints.map((c, i) => (
                    <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.9 }}>
                      <span style={{ color: "var(--purple)", marginRight: 8 }}>•</span>{c}
                    </div>
                  ))}
                </div>
              )}

              {currentQ.follow_up && (
                <div style={{ background: "var(--purple-lt)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--purple)", fontWeight: 600 }}>
                  Follow-up: {currentQ.follow_up}
                </div>
              )}
            </div>
          </div>
          </div>{/* end centering shell */}
        </>
      )}

      {/* ── Queue Drawer ── */}
      {queueOpen && settings && session && (
        <QueueDrawer
          queue={batchQueue.filter(q => q.id !== currentQ.id)}
          cardStates={cardStates}
          session={session}
          onClose={() => setQueueOpen(false)}
          onSelect={q => { setQueueOpen(false); if (sessionRef.current) injectCard(q, sessionRef.current); }}
        />
      )}

      {/* ── Info Modal ── */}
      {infoOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setInfoOpen(false)} />
          <div className="drawer" style={{ overflowY: "auto", paddingBottom: 40 }}>
            {/* Header */}
            <div style={{
              padding: "20px 20px 16px",
              borderBottom: "2px solid var(--border)",
              position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 2 }}>How Learning Works</h2>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Spaced repetition, sessions &amp; intervals</p>
                </div>
                <button onClick={() => setInfoOpen(false)} style={{
                  width: 36, height: 36, borderRadius: 18,
                  background: "var(--bg-2)", border: "2px solid var(--border)",
                  cursor: "pointer", fontSize: 16, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontWeight: 900, color: "var(--text-dim)",
                }}>✕</button>
              </div>
            </div>

            <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Sessions */}
              <section>
                <h3 style={{ fontWeight: 900, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "var(--purple-lt)", borderRadius: 8, padding: "4px 10px", color: "var(--purple)", fontSize: 13 }}><Layers size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />Sessions &amp; Queue</span>
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, fontWeight: 600 }}>
                  Your full card library is the <strong style={{ color: "var(--text)" }}>global queue</strong> — every card sorted by priority (due cards first, then new, then upcoming). Each session pulls the top <strong style={{ color: "var(--text)" }}>{settings?.sessionSize ?? 10} cards</strong> from that global queue into a <strong style={{ color: "var(--text)" }}>local session batch</strong>. You only see and review those cards.
                </p>
                <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, fontWeight: 600, marginTop: 8 }}>
                  When the batch is done, you get a summary screen. Hit <em>Continue</em> to pull the next batch from the global queue. Change your session size in <strong style={{ color: "var(--text)" }}>Settings</strong>.
                </p>
              </section>

              {/* Priority order */}
              <section>
                <h3 style={{ fontWeight: 900, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "var(--purple-lt)", borderRadius: 8, padding: "4px 10px", color: "var(--purple)", fontSize: 13 }}><Target size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />Card Priority Order</span>
                </h3>
                {[
                  { label: "Injected", desc: "Cards you pinned from the Search page go first." },
                  { label: "Due", desc: "Cards whose review interval has expired, oldest due first." },
                  { label: "New", desc: "Never-seen cards, in problem ID order." },
                  { label: "Upcoming", desc: "Cards not yet due, soonest expiring first." },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 900, fontSize: 12, minWidth: 90, color: "var(--purple)", marginTop: 2 }}>{label}</span>
                    <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 600, lineHeight: 1.5 }}>{desc}</span>
                  </div>
                ))}
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginTop: 4 }}>
                  Within each group, cards you saw in the last 5 reviews are pushed to the back to avoid immediate repeats.
                </p>
              </section>

              {/* Know It / Don't Know */}
              <section>
                <h3 style={{ fontWeight: 900, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "var(--purple-lt)", borderRadius: 8, padding: "4px 10px", color: "var(--purple)", fontSize: 13 }}><Timer size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />Next Review Intervals</span>
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, fontWeight: 600, marginBottom: 10 }}>
                  How long until a card comes back depends on your answer streak and how fast you answered.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, background: "var(--green-lt)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: "var(--green-dk)", marginBottom: 6 }}>Know It</div>
                    {[
                      ["1st in a row", "24 h"],
                      ["2nd in a row", "72 h"],
                      ["3rd in a row", "1 week"],
                      ["4th in a row", "3 weeks"],
                      ["5th+ in a row", "2 months"],
                    ].map(([streak, interval]) => (
                      <div key={streak} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--green-dk)", marginBottom: 3 }}>
                        <span>{streak}</span><span>{interval}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "var(--green-dk)", fontWeight: 700, marginTop: 6, opacity: 0.8 }}>
                      Fast answer (&lt;30 s) → ×1.4 &nbsp;|&nbsp; Slow (&gt;2 min) → ×0.9
                    </div>
                  </div>
                  <div style={{ flex: 1, background: "var(--red-lt)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: "var(--red-dk)", marginBottom: 6 }}>Don&apos;t Know</div>
                    {[
                      ["1st miss", "7 h"],
                      ["2nd miss", "24 h"],
                      ["3rd+ miss", "70 h"],
                    ].map(([streak, interval]) => (
                      <div key={streak} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--red-dk)", marginBottom: 3 }}>
                        <span>{streak}</span><span>{interval}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "var(--red-dk)", fontWeight: 700, marginTop: 6, opacity: 0.8 }}>
                      Resets your success streak to 0.
                    </div>
                  </div>
                </div>
              </section>

              {/* Progress states */}
              <section>
                <h3 style={{ fontWeight: 900, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "var(--purple-lt)", borderRadius: 8, padding: "4px 10px", color: "var(--purple)", fontSize: 13 }}><Award size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />Progress States</span>
                </h3>
                {[
                  { badge: "badge-new", label: "New", desc: "Never answered. Enters the queue in problem-ID order." },
                  { badge: "badge-learning", label: "Learning", desc: "Streak of 1, or reset after a wrong answer." },
                  { badge: "badge-review", label: "Review", desc: "Streak of 2–4. Gradually spacing out." },
                  { badge: "badge-mastered", label: "Mastered", desc: "Streak of 5+. Returns only every 2 months." },
                ].map(({ badge, label, desc }) => (
                  <div key={label} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <span className={badge} style={{ minWidth: 72, textAlign: "center", marginTop: 1 }}>{label.toUpperCase()}</span>
                    <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 600, lineHeight: 1.5 }}>{desc}</span>
                  </div>
                ))}
              </section>

              {/* Tips */}
              <section>
                <h3 style={{ fontWeight: 900, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "var(--purple-lt)", borderRadius: 8, padding: "4px 10px", color: "var(--purple)", fontSize: 13 }}><Lightbulb size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />Tips</span>
                </h3>
                {[
                  "Tap or click the card to flip it. Swipe right = Know It, left = Don't Know.",
                  "Use Search → Study to pin any card to the front of your queue.",
                  "The timer tracks how long you spend on each card and adjusts the next interval.",
                  "Your queue respects the Difficulty and Tag filters set in Settings.",
                ].map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12, color: "var(--purple)", fontWeight: 900, minWidth: 18 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 600, lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
              </section>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

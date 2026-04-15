import { ProgressState } from "@/lib/types";

const LABELS: Record<ProgressState, string> = {
  new: "NEW",
  learning: "LEARNING",
  review: "REVIEW",
  mastered: "MASTERED",
};

export default function ProgressBadge({ state }: { state: ProgressState }) {
  return <span className={`badge-${state}`}>{LABELS[state]}</span>;
}

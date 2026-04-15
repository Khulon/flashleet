import { Difficulty } from "@/lib/types";

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const cls =
    difficulty === "Easy"
      ? "badge-easy"
      : difficulty === "Medium"
      ? "badge-medium"
      : "badge-hard";
  return <span className={`badge ${cls}`}>{difficulty}</span>;
}

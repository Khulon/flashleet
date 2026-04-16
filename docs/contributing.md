# Contributing

## Fixing or adding questions

All problems live in [`data/questions.json`](../data/questions.json). Each entry follows this schema:

```json
{
  "id": 1,
  "title": "Two Sum",
  "difficulty": "Easy",
  "description": "Given an array of integers...",
  "examples": [
    {
      "input": "nums = [2,7,11,15], target = 9",
      "output": "[0,1]",
      "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."
    }
  ],
  "constraints": ["2 <= nums.length <= 10^4"],
  "follow_up": "Can you come up with an algorithm that is less than O(n²) time complexity?",
  "slug": "two-sum",
  "tags": ["Array", "Hash Table"],
  "link": "https://leetcode.com/problems/two-sum/description/"
}
```

**To correct a problem** — find the entry by `id`, fix the field, and open a PR with a short description of what was wrong.

**To add a missing premium problem** — add a new entry following the schema above. Use the problem's LeetCode number as `id`. The app picks it up automatically on next server start (the in-memory cache resets).

**Tips:**
- `follow_up`, `explanation` inside examples, and `link` are optional — omit if not applicable
- `tags` should match LeetCode's topic labels (e.g. `"Array"`, `"Dynamic Programming"`, `"Binary Search"`)
- Keep `difficulty` as `"Easy"`, `"Medium"`, or `"Hard"` exactly
- Problems are sorted by `id` in the file — please keep that order

## Code contributions

Open an issue before starting anything large. Good areas to contribute:

- Bug fixes
- Question corrections or additions
- Performance improvements
- UI/UX improvements

## Project structure

```
src/
├── app/
│   ├── api/               # Next.js API routes
│   │   ├── questions/     # GET  — serves questions.json
│   │   ├── card-states/   # GET + POST — per-card SR state
│   │   ├── settings/      # GET + POST — user settings
│   │   ├── session/       # GET + POST — learn session state
│   │   └── ai-generate/   # POST — proxies AI generation requests
│   ├── learn/             # /learn route
│   ├── stats/             # /stats route
│   ├── search/            # /search route
│   └── settings/          # /settings route
├── components/
│   ├── learn/              # Flashcard sub-components
│   │   ├── FlashCard.tsx   # 3D flip card (front + back)
│   │   ├── SolutionPanel.tsx # Sliding code editor panel
│   │   ├── AnswerButtons.tsx # Know it / Don't know buttons
│   │   ├── SkipMenu.tsx    # Skip popover
│   │   ├── ProblemModal.tsx # Full problem detail modal
│   │   ├── InfoDrawer.tsx  # "How Learning Works" drawer
│   │   ├── GlobalQueueDrawer.tsx # Global queue drawer
│   │   └── SessionDoneScreen.tsx # Session complete screen
│   ├── LearnTab.tsx        # Learn page coordinator (state + logic)
│   ├── Nav.tsx             # Bottom navigation bar
│   ├── PersistentLearn.tsx # Keeps LearnTab mounted across routes
│   └── QueueDrawer.tsx     # Local batch queue drawer
└── lib/
    ├── scheduler.ts        # SM-2 algorithm, isDue ← start here for SR changes
    ├── queue.ts            # buildQueue — global queue priority ordering
    ├── storage.ts          # Client-side fetch + in-memory cache
    ├── server-storage.ts   # Server-side file read/write
    ├── types.ts            # All TypeScript types
    ├── useTimer.ts         # Pause/resume timer hook
    └── useDebounce.ts      # Debounce hook for autosave
```

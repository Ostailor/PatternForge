import type { Pattern } from "@/lib/types";

export const patterns = [
  {
    id: "arrays-hashing",
    name: "Arrays & Hashing",
    category: "Core data structures",
    description:
      "Use arrays, sets, and maps when the hard part is remembering what has been seen, counted, grouped, or paired with a lookup key.",
    recognitionClues: [
      "Need constant-time lookup for a value, count, index, or complement",
      "Problem asks for duplicates, groups, frequencies, prefix counts, or membership",
      "A nested comparison can be replaced by keyed memory from earlier scans",
      "The key choice is more important than traversal order",
    ],
    templateSummary:
      "Define the lookup key, scan in the order required by the question, update a map/set deliberately, and answer from stored counts, indexes, or grouped buckets.",
    commonMistakes: [
      "Using nested loops after a direct lookup key is available",
      "Updating the map before checking when the current item must not match itself",
      "Choosing a key that is not stable across equivalent inputs",
      "Forgetting duplicate values, zero counts, or missing-key defaults",
    ],
    levelOrder: 1,
  },
  {
    id: "two-pointers",
    name: "Two Pointers",
    category: "Linear scanning",
    description:
      "Move two indexes through an ordered or partitionable collection to compare, merge, shrink, or classify without evaluating every pair.",
    recognitionClues: [
      "Input is sorted, can be sorted safely, or has meaningful ends",
      "Need a pair, mirror comparison, merge, in-place partition, or boundary choice",
      "A comparison determines which pointer can move without losing answers",
      "The answer depends on relative positions rather than all combinations",
    ],
    templateSummary:
      "Place pointers at meaningful boundaries, evaluate the current relationship, record or mutate as needed, then move only the pointer whose side can no longer improve the result.",
    commonMistakes: [
      "Moving both pointers when only one side is justified",
      "Skipping duplicate handling in pair-sum variants",
      "Using two pointers on data without a useful ordering signal",
      "Forgetting that sorting can change required output semantics",
    ],
    levelOrder: 2,
  },
  {
    id: "sliding-window",
    name: "Sliding Window",
    category: "Linear scanning",
    description:
      "Maintain a contiguous range whose edge updates are cheap, expanding and contracting around a validity condition such as length, sum, counts, or uniqueness.",
    recognitionClues: [
      "Question asks for longest, shortest, or count of contiguous subarrays or substrings",
      "A running count, sum, or frequency table can be updated at the edges",
      "There is a clear condition for when the window is invalid",
      "The left edge only needs to move forward",
    ],
    templateSummary:
      "Expand the right edge, update window state, shrink the left edge until the invariant is restored, and record the best or count contribution at the correct moment.",
    commonMistakes: [
      "Not defining the window invariant before coding",
      "Shrinking too early or too late",
      "Forgetting to remove left-edge state when contracting",
      "Using a window when negative values or nonmonotonic validity break the invariant",
    ],
    levelOrder: 3,
  },
  {
    id: "stack",
    name: "Stack",
    category: "State simulation",
    description:
      "Use last-in-first-out state when the most recent unresolved item should be matched, resolved, removed, or used as a boundary.",
    recognitionClues: [
      "Need to match opens with closes",
      "The latest unresolved item should be handled first",
      "A monotonic stack can remove dominated candidates",
      "Nested or rollback-like structure appears in the process",
    ],
    templateSummary:
      "Name what the stack stores, push unresolved items, pop while the current item resolves the top, and use indexes when distances or widths matter.",
    commonMistakes: [
      "Pushing raw values when indexes are needed",
      "Ignoring leftover unmatched stack entries",
      "Using a stack where a queue or heap is required",
      "Forgetting a final flush or sentinel in monotonic-stack problems",
    ],
    levelOrder: 4,
  },
  {
    id: "binary-search",
    name: "Binary Search",
    category: "Search",
    description:
      "Exploit sorted order, a rotated sorted structure, or a monotonic feasibility predicate to discard half of the search space at each step.",
    recognitionClues: [
      "Input is sorted or answer choices are monotonic",
      "Need first true, last false, minimum feasible, or maximum feasible",
      "A midpoint decision rules out one side",
      "Checking a candidate answer is easier than constructing it directly",
    ],
    templateSummary:
      "Define inclusive or exclusive bounds, write the predicate in words, evaluate mid, preserve the side that can still contain the boundary, and return the recorded feasible answer.",
    commonMistakes: [
      "Searching without proving monotonicity",
      "Off-by-one loops around inclusive and exclusive bounds",
      "Returning mid instead of the recorded boundary answer",
      "Choosing bounds that exclude a valid extreme answer",
    ],
    levelOrder: 5,
  },
  {
    id: "linked-list",
    name: "Linked List",
    category: "Pointer structures",
    description:
      "Manipulate node references directly with dummy heads, previous pointers, fast/slow runners, and deliberate rewiring when random access is unavailable.",
    recognitionClues: [
      "Input is a node chain rather than random-access array",
      "Need to reverse, merge, detect a cycle, or remove by position",
      "The operation depends on pointer rewiring",
      "Head changes or tail attachment are likely edge cases",
    ],
    templateSummary:
      "Use dummy nodes for head-sensitive changes, save next references before rewiring, maintain previous/current pointers, and advance each pointer for one clear reason.",
    commonMistakes: [
      "Losing the rest of the list during rewiring",
      "Forgetting null checks on fast pointers",
      "Handling head deletion as a special case instead of using a dummy node",
      "Creating cycles accidentally by not breaking old links",
    ],
    levelOrder: 6,
  },
  {
    id: "tree-dfs",
    name: "Tree DFS",
    category: "Trees",
    description:
      "Traverse depth-first with recursion or an explicit stack when a node's answer depends on subtree results, path state, or ancestor decisions.",
    recognitionClues: [
      "Need information from children before deciding at a node",
      "Question asks about depth, path, diameter, or subtree properties",
      "Recursive structure mirrors the tree definition",
      "A helper can return one value while updating another answer",
    ],
    templateSummary:
      "Write a helper with a precise return meaning, handle the null base case, combine child results, and update global or path state separately when needed.",
    commonMistakes: [
      "Mixing return values with global answer updates",
      "Missing the null-node base case",
      "Counting nodes versus edges inconsistently",
      "Returning a path shape that a parent cannot legally extend",
    ],
    levelOrder: 7,
  },
  {
    id: "tree-bfs",
    name: "Tree BFS",
    category: "Trees",
    description:
      "Traverse level by level with a queue when depth order, nearest layer, or per-level aggregation is the central requirement.",
    recognitionClues: [
      "Question asks for level order, right side view, or minimum depth",
      "Need to process all nodes at the same depth together",
      "A queue naturally preserves next-layer order",
      "The first valid node by depth can end the search",
    ],
    templateSummary:
      "Push the root, process exactly the current queue length as one level, collect or connect level data, then enqueue children for the next layer.",
    commonMistakes: [
      "Letting next-level nodes leak into the current level",
      "Using DFS when level grouping is required",
      "Forgetting empty-tree handling",
      "Continuing after the first shortest-depth answer is found",
    ],
    levelOrder: 8,
  },
  {
    id: "heap-priority-queue",
    name: "Heap / Priority Queue",
    category: "Ordering",
    description:
      "Maintain fast access to the current smallest, largest, median boundary, or top-k candidate when priorities change over time.",
    recognitionClues: [
      "Need kth largest, top k, or repeatedly best available item",
      "Sorting everything would do extra work",
      "A rolling boundary of candidates is enough",
      "Items arrive over time or become eligible later",
    ],
    templateSummary:
      "Choose min-heap or max-heap semantics, push eligible candidates, pop according to the priority rule, and keep heap size or eligibility constraints explicit.",
    commonMistakes: [
      "Using the wrong heap direction for top-k",
      "Keeping all values when only k are needed",
      "Forgetting that JavaScript has no built-in heap",
      "Pushing candidates before they are eligible",
    ],
    levelOrder: 9,
  },
  {
    id: "backtracking",
    name: "Backtracking",
    category: "Search",
    description:
      "Explore a decision tree of choices recursively, undoing state after each branch and pruning partial paths that cannot become valid.",
    recognitionClues: [
      "Need all combinations, subsets, permutations, or valid boards",
      "Each step chooses from remaining candidates",
      "The solution space is a decision tree",
      "The task asks for every valid arrangement rather than one greedy optimum",
    ],
    templateSummary:
      "Define the path and start state, choose a candidate, mark or append it, recurse, then undo exactly that choice before trying the next branch.",
    commonMistakes: [
      "Forgetting to copy the current path into results",
      "Not undoing mutable state after recursion",
      "Missing pruning or duplicate-skip rules",
      "Generating permutations when combinations are required",
    ],
    levelOrder: 10,
  },
  {
    id: "graph-bfs-dfs",
    name: "Graph BFS/DFS",
    category: "Graphs",
    description:
      "Traverse nodes, grid cells, or dependency edges with visited state to explore components, reachability, shortest unweighted paths, or topological structure.",
    recognitionClues: [
      "Input has adjacency, grids, islands, or connected components",
      "Need to avoid revisiting nodes",
      "Neighbors define the next valid moves",
      "Multiple starting points or disconnected components may exist",
    ],
    templateSummary:
      "Build or infer neighbors, mark visited before enqueueing or recursing, process every component or source, and choose BFS when distance by layers matters.",
    commonMistakes: [
      "Marking visited too late and duplicating work",
      "Mixing row and column bounds",
      "Only starting from one node when multiple components exist",
      "Reversing directed edges in prerequisite or reachability problems",
    ],
    levelOrder: 11,
  },
  {
    id: "dynamic-programming-1d",
    name: "Dynamic Programming 1D",
    category: "Dynamic programming",
    description:
      "Use a one-dimensional state when an answer for an index, prefix, amount, or capacity depends on earlier overlapping subproblems.",
    recognitionClues: [
      "Choices repeat over indexes, amounts, or steps",
      "The answer can be built from previous answers",
      "Brute force recursion recomputes the same states",
      "The state has a clear smaller version of the same question",
    ],
    templateSummary:
      "Define the exact meaning of dp[i], set base cases, derive transitions from smaller states, and iterate in the direction that matches item reuse rules.",
    commonMistakes: [
      "Starting with a dp array before defining state meaning",
      "Wrong iteration direction for reuse constraints",
      "Missing base cases for zero or first positions",
      "Confusing contiguous subarray state with subsequence or choice-state DP",
    ],
    levelOrder: 12,
  },
] satisfies Pattern[];

export function getPatternById(patternId: string) {
  return patterns.find((pattern) => pattern.id === patternId);
}

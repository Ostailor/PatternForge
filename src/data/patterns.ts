import type { Pattern } from "@/lib/types";

export const patterns = [
  {
    id: "arrays-hashing",
    name: "Arrays & Hashing",
    category: "Core data structures",
    description:
      "Use arrays, sets, and maps to track membership, counts, complements, and grouped state while scanning input.",
    recognitionClues: [
      "Need fast lookup for a value seen earlier",
      "Question asks for duplicates, counts, grouping, or complements",
      "A nested loop can be replaced by keyed memory",
    ],
    templateSummary:
      "Choose a key, update a map or set while scanning once, and answer from stored counts or prior positions.",
    commonMistakes: [
      "Using nested loops after a direct lookup key is obvious",
      "Updating the map before checking when order matters",
      "Forgetting edge cases with duplicate values",
    ],
    levelOrder: 1,
  },
  {
    id: "two-pointers",
    name: "Two Pointers",
    category: "Linear scanning",
    description:
      "Move two indexes through an ordered collection to compare, shrink, partition, or search without checking every pair.",
    recognitionClues: [
      "Input is sorted or can be sorted",
      "Need a pair, palindrome check, or partition",
      "Pointer movement is determined by a comparison",
    ],
    templateSummary:
      "Initialize left and right pointers, evaluate the current pair, then move the pointer that can still improve the answer.",
    commonMistakes: [
      "Moving both pointers when only one side is justified",
      "Skipping duplicate handling in pair-sum variants",
      "Using two pointers on data without a useful ordering signal",
    ],
    levelOrder: 2,
  },
  {
    id: "sliding-window",
    name: "Sliding Window",
    category: "Linear scanning",
    description:
      "Maintain a contiguous range while expanding and contracting around a constraint such as sum, length, or uniqueness.",
    recognitionClues: [
      "Question asks for longest, shortest, or count of contiguous ranges",
      "A running count, sum, or frequency table can be updated at the edges",
      "There is a clear condition for when the window is invalid",
    ],
    templateSummary:
      "Expand the right edge, update window state, shrink the left edge while invalid, then record the best valid window.",
    commonMistakes: [
      "Not defining the window invariant before coding",
      "Shrinking too early or too late",
      "Forgetting to remove left-edge state when contracting",
    ],
    levelOrder: 3,
  },
  {
    id: "stack",
    name: "Stack",
    category: "State simulation",
    description:
      "Use last-in-first-out state to match pairs, maintain monotonic candidates, or simulate nested operations.",
    recognitionClues: [
      "Need to match opens with closes",
      "The latest unresolved item should be handled first",
      "A monotonic stack can remove dominated candidates",
    ],
    templateSummary:
      "Push unresolved values, pop when the current value resolves the top, and keep stack meaning explicit.",
    commonMistakes: [
      "Pushing raw values when indexes are needed",
      "Ignoring leftover unmatched stack entries",
      "Using a stack where a queue or heap is required",
    ],
    levelOrder: 4,
  },
  {
    id: "binary-search",
    name: "Binary Search",
    category: "Search",
    description:
      "Exploit sorted order or monotonic feasibility to discard half of the search space each step.",
    recognitionClues: [
      "Input is sorted or answer choices are monotonic",
      "Need first true, last false, minimum feasible, or maximum feasible",
      "A midpoint decision rules out one side",
    ],
    templateSummary:
      "Define the search bounds and predicate, evaluate mid, then preserve the side that can still contain the answer.",
    commonMistakes: [
      "Searching without proving monotonicity",
      "Off-by-one loops around inclusive and exclusive bounds",
      "Returning mid instead of the recorded boundary answer",
    ],
    levelOrder: 5,
  },
  {
    id: "linked-list",
    name: "Linked List",
    category: "Pointer structures",
    description:
      "Manipulate node references directly using dummy heads, previous pointers, fast/slow runners, and careful rewiring.",
    recognitionClues: [
      "Input is a node chain rather than random-access array",
      "Need to reverse, merge, detect a cycle, or remove by position",
      "The operation depends on pointer rewiring",
    ],
    templateSummary:
      "Use dummy nodes for head changes, keep next references before rewiring, and advance pointers deliberately.",
    commonMistakes: [
      "Losing the rest of the list during rewiring",
      "Forgetting null checks on fast pointers",
      "Handling head deletion as a special case instead of using a dummy node",
    ],
    levelOrder: 6,
  },
  {
    id: "tree-dfs",
    name: "Tree DFS",
    category: "Trees",
    description:
      "Traverse depth-first with recursion or an explicit stack to compute path, subtree, or ancestor information.",
    recognitionClues: [
      "Need information from children before deciding at a node",
      "Question asks about depth, path, diameter, or subtree properties",
      "Recursive structure mirrors the tree definition",
    ],
    templateSummary:
      "Write a helper that defines what each node returns, combine left and right results, then update any global answer.",
    commonMistakes: [
      "Mixing return values with global answer updates",
      "Missing the null-node base case",
      "Counting nodes versus edges inconsistently",
    ],
    levelOrder: 7,
  },
  {
    id: "tree-bfs",
    name: "Tree BFS",
    category: "Trees",
    description:
      "Traverse level by level with a queue when order by depth or nearest layer matters.",
    recognitionClues: [
      "Question asks for level order, right side view, or minimum depth",
      "Need to process all nodes at the same depth together",
      "A queue naturally preserves next-layer order",
    ],
    templateSummary:
      "Push the root into a queue, process the current queue length as one level, then enqueue children for the next level.",
    commonMistakes: [
      "Letting next-level nodes leak into the current level",
      "Using DFS when level grouping is required",
      "Forgetting empty-tree handling",
    ],
    levelOrder: 8,
  },
  {
    id: "heap-priority-queue",
    name: "Heap / Priority Queue",
    category: "Ordering",
    description:
      "Maintain quick access to the current smallest, largest, or top-k candidate as values stream or priorities change.",
    recognitionClues: [
      "Need kth largest, top k, or repeatedly best available item",
      "Sorting everything would do extra work",
      "A rolling boundary of candidates is enough",
    ],
    templateSummary:
      "Choose min-heap or max-heap semantics, push candidates, and pop when the heap grows beyond the needed boundary.",
    commonMistakes: [
      "Using the wrong heap direction for top-k",
      "Keeping all values when only k are needed",
      "Forgetting that JavaScript has no built-in heap",
    ],
    levelOrder: 9,
  },
  {
    id: "backtracking",
    name: "Backtracking",
    category: "Search",
    description:
      "Explore choices recursively, undo state after each branch, and prune when a partial choice cannot lead to a valid result.",
    recognitionClues: [
      "Need all combinations, subsets, permutations, or valid boards",
      "Each step chooses from remaining candidates",
      "The solution space is a decision tree",
    ],
    templateSummary:
      "Define the current path, choose a candidate, recurse, then undo the choice before trying the next candidate.",
    commonMistakes: [
      "Forgetting to copy the current path into results",
      "Not undoing mutable state after recursion",
      "Missing pruning or duplicate-skip rules",
    ],
    levelOrder: 10,
  },
  {
    id: "graph-bfs-dfs",
    name: "Graph BFS/DFS",
    category: "Graphs",
    description:
      "Traverse nodes and edges with visited state to explore components, reachability, shortest unweighted paths, or flood fill.",
    recognitionClues: [
      "Input has adjacency, grids, islands, or connected components",
      "Need to avoid revisiting nodes",
      "Neighbors define the next valid moves",
    ],
    templateSummary:
      "Build or infer neighbors, mark visited before enqueueing or recursing, and traverse every component if needed.",
    commonMistakes: [
      "Marking visited too late and duplicating work",
      "Mixing row and column bounds",
      "Only starting from one node when multiple components exist",
    ],
    levelOrder: 11,
  },
  {
    id: "dynamic-programming-1d",
    name: "Dynamic Programming 1D",
    category: "Dynamic programming",
    description:
      "Use a one-dimensional state when the answer for position or amount depends on earlier overlapping subproblems.",
    recognitionClues: [
      "Choices repeat over indexes, amounts, or steps",
      "The answer can be built from previous answers",
      "Brute force recursion recomputes the same states",
    ],
    templateSummary:
      "Define dp[i], choose base cases, derive a transition from earlier states, and iterate in dependency order.",
    commonMistakes: [
      "Starting with a dp array before defining state meaning",
      "Wrong iteration direction for reuse constraints",
      "Missing base cases for zero or first positions",
    ],
    levelOrder: 12,
  },
] satisfies Pattern[];

export function getPatternById(patternId: string) {
  return patterns.find((pattern) => pattern.id === patternId);
}

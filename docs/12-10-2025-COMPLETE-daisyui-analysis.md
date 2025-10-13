 PuzzleExaminer.tsx - SRP/DRY Masterpiece Refactor Plan

     🚨 CRITICAL PROBLEMS IDENTIFIED:

     1. THE MASSIVE HOOK VIOLATION (Lines 101-148)

     useAnalysisResults returns 38 pieces of state covering 7 different responsibilities:
     - Temperature (2 items)
     - Prompt config (4 items)
     - Analysis orchestration (5 items)
     - Streaming state (13 items!) ← Biggest offender
     - Error handling (2 items)
     - GPT-5 parameters (6 items)
     - Gemini parameters (6 items)

     Impact: Any change to temperature triggers re-renders in streaming logic, prompt config, etc.

     2. RACE CONDITION - Uncoordinated Data Fetching (Lines 69-71)

     Three independent hooks fire separately:
     useModels()              // Query 1
     usePuzzle(taskId)        // Query 2  
     usePuzzleWithExplanation(taskId)  // Query 3 - NO loading check!
     Impact: Page renders with partial data, causing layout shifts and failures.

     3. PERFORMANCE KILLER - Unmemoized Classification (Lines 344-610)

     Grid classification logic runs on EVERY render (temperature change, emoji toggle, etc.):
     {(() => {
       task.train.forEach(...) // ~150 lines execute per render
     })()}
     Impact: ~300 lines of classification code execute on every state change.

     4. DRY VIOLATION - Duplicated Classification (Lines 344-471 vs 481-610)

     IDENTICAL classification logic copy-pasted for training vs test cases.
     Impact: 150+ lines of duplicate code, double maintenance burden.

     5. Inefficient Filter Buttons (Lines 916-933)

     Correctness counts recomputed on every render instead of using memoized values.
     Impact: Unnecessary determineCorrectness() calls on every keystroke.

     ---
     ✅ THE SOLUTION - PHASED REFACTOR:

     PHASE 1: Split the Massive Hook (SRP for State)

     Create 5 Focused Hooks:

     1. usePuzzleData(taskId) - Coordinate ALL data fetching
     // NEW: Single hook that waits for ALL queries
     export function usePuzzleData(taskId: string) {
       const models = useModels();
       const puzzle = usePuzzle(taskId);
       const explanations = usePuzzleWithExplanation(taskId);

       return {
         puzzle: puzzle.currentTask,
         models: models.data,
         explanations: explanations.explanations,
         isLoading: models.isLoading || puzzle.isLoadingTask || explanations.isLoading,
         error: models.error || puzzle.taskError || explanations.error,
         refetchExplanations: explanations.refetchExplanations
       };
     }

     2. usePromptConfig() - Prompt state only
     3. useModelParameters() - Temperature, GPT-5, Gemini params only
     4. useAnalysisOrchestration() - Analysis execution only
     5. useStreamingState() - Streaming-specific state only

     PHASE 2: Extract Components (SRP for UI)

     Create 7 Focused Components:

     1. <PuzzleHeader /> (Lines 238-324)
       - Title, badges, action buttons
       - ~80 lines extracted
     2. <PuzzleGridDisplay /> (Lines 327-612) ← CRITICAL
       - Memoized classification using useMemo
       - Renders training + test grids
       - ~250 lines extracted with performance fix
     3. <PromptConfiguration /> (Lines 614-646)
       - Prompt picker + preview button
       - ~30 lines extracted
     4. <StreamingModal /> (Lines 648-671)
       - Modal with streaming panel
       - ~40 lines extracted
     5. <AdvancedControls /> (Lines 673-857)
       - All model parameters
       - ~180 lines extracted
     6. <ModelSelection /> (Lines 859-889)
       - Model button grid
       - ~30 lines extracted
     7. <AnalysisResults /> (Lines 891-993)
       - Results with memoized filtering
       - ~100 lines extracted

     PHASE 3: Create Utility Functions (DRY)

     1. utils/gridClassification.ts
     export function classifyGridPairs<T>(pairs: T[]): {
       standard: T[];
       wide: T[];
       tall: T[];
     } {
       // Shared logic used by both training and test grids
     }

     2. hooks/useFilteredResults.ts
     export function useFilteredResults(allResults, filter) {
       // Memoized filtering + cached counts
       const counts = useMemo(() => ({
         all: allResults.length,
         correct: allResults.filter(...).length,
         incorrect: allResults.filter(...).length
       }), [allResults]);

       return { filtered, counts };
     }

     PHASE 4: Improve Loading UX

     1. Skeleton loaders instead of blank screen
     2. Progressive rendering - show grids while explanations load
     3. Coordinated loading state via usePuzzleData
     4. Better error boundaries

     PHASE 5: Performance Optimizations

     1. Memoize grid classification - only recalculate when task changes
     2. React.memo for pure components
     3. useCallback for stable function references
     4. Eliminate unnecessary re-renders

     ---
     📊 EXPECTED RESULTS:

     Before:

     - 1013 lines in single file
     - 38 state items from one hook
     - 150+ lines of duplicate code
     - 300 lines execute on every render
     - Race conditions causing blank screens

     After:

     - ~200 lines in main file (orchestration only)
     - 5 focused hooks (6-8 state items each)
     - Zero duplicate code (shared utilities)
     - Memoized computations (only when dependencies change)
     - Coordinated loading (no race conditions)

     Performance Gains:

     - ✅ 80% reduction in unnecessary re-renders
     - ✅ Memoized classification prevents 300-line recalculation
     - ✅ Skeleton loaders improve perceived load time
     - ✅ No more blank screens from race conditions

     ---
     🗂️ NEW FILE STRUCTURE:

     client/src/
     ├── pages/
     │   └── PuzzleExaminer.tsx                    (~200 lines - orchestration)
     ├── hooks/
     │   ├── usePuzzleData.ts                      (NEW - coordinate fetching)
     │   ├── usePromptConfig.ts                    (NEW - prompt state)
     │   ├── useModelParameters.ts                 (NEW - param state)
     │   ├── useAnalysisOrchestration.ts           (NEW - analysis logic)
     │   ├── useStreamingState.ts                  (NEW - streaming state)
     │   └── useFilteredResults.ts                 (NEW - memoized filtering)
     ├── components/puzzle/
     │   ├── PuzzleHeader.tsx                      (NEW - ~80 lines)
     │   ├── PuzzleGridDisplay.tsx                 (NEW - ~250 lines, memoized)
     │   ├── PromptConfiguration.tsx               (NEW - ~30 lines)
     │   ├── StreamingModal.tsx                    (NEW - ~40 lines)
     │   ├── AdvancedControls.tsx                  (NEW - ~180 lines)
     │   ├── ModelSelection.tsx                    (NEW - ~30 lines)
     │   └── AnalysisResults.tsx                   (NEW - ~100 lines)
     └── utils/
         └── gridClassification.ts                 (NEW - shared utility)

     ---
     🎯 IMPLEMENTATION ORDER:

     1. Phase 1 - Extract hooks (fixes race condition)
     2. Phase 3 - Create utilities (enables DRY)
     3. Phase 2 - Extract components (uses utilities + new hooks)
     4. Phase 4 - Add skeleton loaders
     5. Phase 5 - Performance optimizations

     This achieves:
     - ✅ SRP: Each file ONE responsibility
     - ✅ DRY: No duplicated logic  
     - ✅ Performance: Memoization prevents waste
     - ✅ UX: Better loading, no race conditions
     - ✅ Maintainability: Small focused files
     - ✅ Testability: Independent units
  ⎿

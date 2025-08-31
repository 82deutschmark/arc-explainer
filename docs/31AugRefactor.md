```markdown
# Actionable Tickets for AI Coding Assistant  
*DB renaming (Ticket 1.5) is deferred until the very end of the refactor.* And may not happen at all.

---

## Phase 1: Data Layer Separation Completed by Claude 4 Code

**Ticket 1.1:** Create `AccuracyRepository`  
- Move all puzzle correctness methods (`is_prediction_correct`, `multi_test_all_correct`) from `FeedbackRepository`.

**Ticket 1.2:** Create `TrustworthinessRepository`  
- Move AI confidence methods (`prediction_accuracy_score`)  
- Keep field name unchanged for now; handle renaming at the final step.

**Ticket 1.3:** Update `FeedbackRepository`  
- Keep only user feedback methods (explanation quality).  
- Remove unrelated logic.

**Ticket 1.4:** Create `MetricsRepository`  
- Aggregate analytics from `AccuracyRepository`, `TrustworthinessRepository`, `FeedbackRepository`.


---

## Phase 2: UI Component Decomposition  (Completed by Gemini 2.5 Pro)

**Ticket 2.1:** Split `AnalysisResultCard`  
- Create `AnalysisResultHeader` (model info, badges)  
- Create `AnalysisResultContent` (pattern, strategy, hints)  
- Create `AnalysisResultGrid` (puzzle grid & predictions)  
- Create `AnalysisResultMetrics` (processing time, cost, tokens)  
- Create `AnalysisResultActions` (feedback buttons)

**Ticket 2.2:** Refactor Page Components  (Completed by Gemini 2.5 Pro)
- `ModelExaminer` → extract config panel, results display, progress  
- `StatisticsCards` → split metrics into individual cards with hooks

---

## Phase 3: Service Layer Optimization  (Completed by Claude 4 Code)

**Ticket 3.1:** Slim `puzzleController`  
- Move all business logic to services  
- Keep only request/response handling

**Ticket 3.2:** Consolidate AI Services  
- Audit `BaseAIService` for missing abstractions  
- Move common parsing and error handling to base class  
- Implement provider-specific adapters

**Ticket 3.3:** Refactor Batch Analysis  
- `BatchSessionManager` → manage session lifecycle  
- `BatchProgressTracker` → compute progress/statistics  
- `BatchResultProcessor` → aggregate and store results

---

## Phase 4: State Management Consolidation (Completed by Claude 4 Code)

**Ticket 4.1:** Create Custom Hooks  
- `useAnalysisResult` → single analysis state  
- `useBatchSession` → batch analysis state  
- `useModelConfiguration` → model selection/settings

**Ticket 4.2:** Implement Context Providers  
- `AnalysisContext` → share analysis state  
- `ConfigurationContext` → global configuration state

---

## Phase 5: Configuration & Validation (Completed by Claude 4 Code)

**Ticket 5.1:** Split Model Configuration  
- `ModelDefinitions` → static metadata  
- `ModelCapabilities` → runtime capability detection  
- `ProviderAdapters` → provider-specific logic

**Ticket 5.2:** Move Validation Closer to Usage  
- API validation middleware for endpoints  
- Client-side validation for forms

---

### Execution Order
1.1 → 1.2 → 1.3 → 1.4 → 2 → 3 → 4 → 5 → **1.5 (final step)**
```

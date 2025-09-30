# React Hooks Reference

This document describes the custom React hooks used by external applications and internal components. All hooks use TanStack Query for data fetching, caching, and state management.

## Data Fetching Hooks

### useModelDatasetPerformance ✨ NEW!
Fetches model performance data on any ARC dataset dynamically. Completely flexible - no hardcoded datasets!

```typescript
import { useModelDatasetPerformance, useAvailableModels, useAvailableDatasets } from '@/hooks/useModelDatasetPerformance';

const ModelAnalysisComponent = () => {
  // Get available datasets dynamically from filesystem
  const { datasets, loading: loadingDatasets, error: datasetsError } = useAvailableDatasets();
  
  // Get available models from database
  const { models, loading: loadingModels, error: modelsError } = useAvailableModels();
  
  // Get performance for specific model + dataset combination
  const { 
    performance,      // ModelDatasetPerformance object
    loading,          // Loading state
    error            // Error state
  } = useModelDatasetPerformance(selectedModel, selectedDataset);
  
  // Performance object structure:
  // {
  //   modelName: string,
  //   dataset: string,
  //   solved: string[],        // Puzzle IDs where is_prediction_correct = true OR multi_test_all_correct = true
  //   failed: string[],        // Puzzle IDs attempted but incorrect
  //   notAttempted: string[],  // Puzzle IDs with no database entries
  //   summary: {
  //     solved: number,
  //     failed: number, 
  //     notAttempted: number,
  //     totalPuzzles: number
  //   }
  // }
  
  return <div>/* Render model performance analysis */</div>;
};
```

**API Endpoints Used:**
- `GET /api/model-dataset/datasets` (Dataset discovery)
- `GET /api/model-dataset/models` (Available models)
- `GET /api/model-dataset/performance/:modelName/:datasetName` (Performance data)

### useModelLeaderboards
```

**API Endpoints Used:**
- `GET /api/feedback/accuracy-stats` (5 min cache)
- `GET /api/puzzle/performance-stats` (5 min cache)  
- `GET /api/feedback/stats` (5 min cache)

### usePuzzle
Manages puzzle data loading and analysis operations.

```typescript
import { usePuzzle } from '@/hooks/usePuzzle';

const PuzzleViewer = ({ taskId }: { taskId: string }) => {
  const {
    puzzle,           // Puzzle data with input/output grids
    isLoading,        // Loading state
    error,           // Error state
    refetch,         // Refetch puzzle data
    
    // Analysis operations
    analyzePuzzle,    // Trigger AI analysis
    isAnalyzing,      // Analysis in progress
    analysisError     // Analysis error
  } = usePuzzle(taskId);
  
  const handleAnalyze = () => {
    analyzePuzzle({ 
      taskId, 
      modelName: 'gpt-4o',
      options: { /* analysis options */ }
    });
  };
  
  return <div>/* Render puzzle */</div>;
};
```

**API Endpoints Used:**
- `GET /api/puzzle/task/:taskId`
- `POST /api/puzzle/analyze/:taskId/:model`

### useExplanation
Manages AI-generated explanations for puzzles.

```typescript
import { useExplanation } from '@/hooks/useExplanation';

const ExplanationViewer = ({ puzzleId }: { puzzleId: string }) => {
  const {
    explanation,      // Current explanation data
    explanations,     // All explanations for puzzle
    isLoading,
    error,
    
    // Operations
    createExplanation,
    updateExplanation,
    deleteExplanation
  } = useExplanation(puzzleId);
  
  return <div>/* Render explanation */</div>;
};
```

**API Endpoints Used:**
- `GET /api/puzzle/:puzzleId/explanation`
- `GET /api/puzzle/:puzzleId/explanations`
- `POST /api/puzzle/save-explained/:puzzleId`

### useFeedback
Handles user feedback submission and retrieval.

```typescript
import { useFeedback } from '@/hooks/useFeedback';

const FeedbackSection = ({ explanationId }: { explanationId: string }) => {
  const {
    feedback,         // Existing feedback
    isLoading,
    error,
    
    // Operations  
    submitFeedback,   // Submit new feedback
    isSubmitting,     // Submission in progress
    submitError       // Submission error
  } = useFeedback(explanationId);
  
  const handleSubmit = () => {
    submitFeedback({
      explanationId,
      feedbackType: 'helpful',
      comment: 'This explanation was clear and accurate'
    });
  };
  
  return <div>/* Render feedback form */</div>;
};
```

**API Endpoints Used:**
- `GET /api/explanation/:explanationId/feedback`
- `POST /api/feedback`

### useModels
Manages available AI models and provider configuration.

```typescript
import { useModels } from '@/hooks/useModels';

const ModelSelector = () => {
  const {
    models,           // Available models array
    providers,        // Available providers
    isLoading,
    error,
    
    // Utilities
    getModelsByProvider,
    isModelAvailable
  } = useModels();
  
  return (
    <select>
      {models.map(model => (
        <option key={model.id} value={model.name}>
          {model.displayName}
        </option>
      ))}
    </select>
  );
};
```

**API Endpoints Used:**
- `GET /api/models`

## Analytics Hooks

### usePerformanceInsights
Advanced performance analysis and model comparisons.

```typescript
import { usePerformanceInsights } from '@/hooks/usePerformanceInsights';

const PerformanceAnalytics = () => {
  const {
    insights,         // Performance insights data
    trends,          // Performance trends over time
    comparisons,     // Model comparison data
    isLoading,
    error,
    
    // Filters
    setTimeRange,
    setModelFilter,
    setMetricFilter
  } = usePerformanceInsights();
  
  return <div>/* Render analytics dashboard */</div>;
};
```

### useModelComparisons
Detailed model comparison analysis.

```typescript
import { useModelComparisons } from '@/hooks/useModelComparisons';

const ModelComparison = () => {
  const {
    comparisons,      // Model comparison data
    metrics,         // Available metrics for comparison
    isLoading,
    error,
    
    // Operations
    addModel,        // Add model to comparison
    removeModel,     // Remove model from comparison
    updateMetrics    // Update metrics to compare
  } = useModelComparisons();
  
  return <div>/* Render comparison table */</div>;
};
```

## Specialized Hooks

### useAnalysisResult
Manages individual analysis results and their state.

```typescript
import { useAnalysisResult } from '@/hooks/useAnalysisResult';

const AnalysisResult = ({ analysisId }: { analysisId: string }) => {
  const {
    result,          // Analysis result data
    isLoading,
    error,
    
    // Operations
    retry,           // Retry failed analysis
    cancel,          // Cancel ongoing analysis
    export: exportResult  // Export analysis data
  } = useAnalysisResult(analysisId);
  
  return <div>/* Render analysis result */</div>;
};
```

### useAnalysisResults
Manages multiple analysis results with filtering and pagination. Supports debate mode for AI-vs-AI challenges.

```typescript
import { useAnalysisResults } from '@/hooks/useAnalysisResults';

const AnalysisHistory = () => {
  const {
    results,         // Paginated analysis results
    totalCount,      // Total number of results
    isLoading,
    error,

    // Pagination
    page,
    setPage,
    pageSize,
    setPageSize,

    // Filtering
    filters,
    setFilters,

    // Operations
    bulkDelete,
    bulkExport,

    // Debate Mode (v2.30.0+)
    analyzeAndSaveMutation  // Exposed mutation for debate challenges with async/await
  } = useAnalysisResults();

  // Example: Generate debate challenge
  const handleDebateChallenge = async () => {
    const result = await analyzeAndSaveMutation.mutateAsync({
      taskId: 'puzzle-123',
      modelKey: 'claude-3.5-sonnet',
      options: {
        originalExplanation: { /* parent explanation */ },
        customChallenge: 'Focus on edge cases',
        promptId: 'debate'
      }
    });
    console.log('Challenge generated:', result);
  };

  return <div>/* Render results table */</div>;
};
```

### useModelConfiguration
Manages AI model configuration and settings.

```typescript
import { useModelConfiguration } from '@/hooks/useModelConfiguration';

const ModelSettings = () => {
  const {
    config,          // Current model configuration
    isLoading,
    error,
    
    // Operations
    updateConfig,    // Update model settings
    resetToDefault,  // Reset to default configuration
    validateConfig   // Validate configuration
  } = useModelConfiguration();
  
  return <div>/* Render configuration form */</div>;
};
```

## Hook Patterns

### Error Handling Pattern
All hooks follow consistent error handling:

```typescript
const { data, isLoading, error } = useHookName();

if (error) {
  return <ErrorMessage error={error} />;
}

if (isLoading) {
  return <LoadingSpinner />;
}

return <DataComponent data={data} />;
```

### Caching Strategy
- **5-minute cache**: Analytics and leaderboard data
- **10-minute cache**: Model lists and configuration
- **1-minute cache**: Real-time analysis status
- **Infinite cache**: Static puzzle data (invalidated on updates)

### useDebateState ✨ NEW! (v2.30.0+)
Manages debate state for AI-vs-AI challenge mode. Internal hook used by ModelDebate components.

```typescript
import { useDebateState } from '@/hooks/useDebateState';

const DebateInterface = () => {
  const {
    messages,              // Debate message history
    addChallengeMessage,   // Add new challenge to debate
    clearMessages,         // Clear debate history
    isDebating            // Debate in progress
  } = useDebateState();

  const handleGenerateChallenge = (explanation) => {
    addChallengeMessage({
      modelName: 'claude-3.5-sonnet',
      explanation: explanation,
      timestamp: new Date()
    });
  };

  return <div>/* Render debate interface */</div>;
};
```

### useChallengeGeneration ✨ NEW! (v2.30.0+)
Generates debate challenge prompts with original explanation context. Internal hook used by debate components.

```typescript
import { useChallengeGeneration } from '@/hooks/useChallengeGeneration';

const ChallengeGenerator = ({ originalExplanation }) => {
  const {
    generateChallengePrompt,  // Generate prompt with original context
    previewPrompt            // Preview prompt before sending
  } = useChallengeGeneration();

  const prompt = generateChallengePrompt({
    original: originalExplanation,
    customChallenge: 'Focus on edge cases',
    taskData: puzzleData
  });

  return <div>/* Render challenge interface */</div>;
};
```

### Query Keys
Hooks use structured query keys for cache management:

```typescript
// Examples of query key patterns
['accuracy-leaderboard']
['trustworthiness-leaderboard']
['feedback-leaderboard']
['puzzle', taskId]
['explanation', puzzleId]
['models']
['analysis-result', analysisId]
['rebuttal-chain', explanationId]  // Debate chain query (v2.30.0+)
['original-explanation', rebuttalId]  // Parent explanation query (v2.30.0+)
```

## Integration Notes

### TanStack Query Setup
All hooks require TanStack Query provider:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes default
      retry: 3,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

### API Client Configuration
Hooks use a shared API client configured in `@/lib/queryClient`:

```typescript
import { apiRequest } from '@/lib/queryClient';

// Used internally by hooks
const response = await apiRequest('GET', '/api/endpoint');
```

### TypeScript Integration
All hooks are fully typed with shared interfaces from `@shared/types`:

```typescript
import type { PuzzleData, ExplanationResult } from '@shared/types';

// Types are automatically inferred
const { puzzle } = usePuzzle(taskId); // puzzle: PuzzleData | undefined
```
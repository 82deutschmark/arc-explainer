# MANUAL ROUTE ADDITION REQUIRED

## File: server/routes.ts

**Line 120** (after the datasets route)

Add this line:
```typescript
app.get("/api/model-dataset/metrics/:modelName/:datasetName", asyncHandler(modelDatasetController.getModelDatasetMetrics));
```

**Context:**
```typescript
  // Model Dataset Performance routes
  app.get("/api/model-dataset/performance/:modelName/:datasetName", asyncHandler(modelDatasetController.getModelPerformance));
  app.get("/api/model-dataset/models", asyncHandler(modelDatasetController.getAvailableModels));
  app.get("/api/model-dataset/datasets", asyncHandler(modelDatasetController.getAvailableDatasets));
  // ADD THE NEW LINE HERE:
  app.get("/api/model-dataset/metrics/:modelName/:datasetName", asyncHandler(modelDatasetController.getModelDatasetMetrics));
```

**Reason:**
Character encoding issue prevented automatic file edit. The route must be manually added for the metric badges feature to work.

**Test:**
After adding the route and restarting the server, metric badges should appear in Analytics Overview showing cost, time, and token data.

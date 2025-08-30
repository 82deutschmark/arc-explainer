# Model Debug Modal Implementation Plan

## Overview
Implementation of a debugging overlay modal that displays comprehensive database statistics for individual models when clicked from the Top Models lists on the PuzzleOverview page.

## User Requirements
- Click any model in the Top Models lists to open a large debugging overlay
- Show raw database statistics for that specific model
- Overlay appears over the overview screen (doesn't navigate away)
- Large canvas design for comprehensive debugging information
- Simple close functionality to return to overview

## Architecture

### Components Created
1. **ModelDebugModal.tsx** - Main modal component
   - Location: `client/src/components/ModelDebugModal.tsx`
   - Uses shadcn/ui Dialog component for overlay
   - Large modal size: 90vw x 85vh
   - Scrollable content area for extensive data

### Data Sources
The modal fetches data from multiple API endpoints:

1. **Accuracy Stats**: `/api/puzzle/accuracy-stats`
   - Provides model accuracy, confidence, and trustworthiness data
   - Filtered by modelName on frontend

2. **Feedback Stats**: `/api/feedback/stats`  
   - User feedback counts (helpful/not helpful)
   - Model-specific feedback breakdown

3. **Raw Stats**: `/api/puzzle/raw-stats`
   - Raw database statistics
   - Unfiltered data for debugging

4. **Performance Stats**: `/api/puzzle/performance-stats`
   - Real performance metrics based on prediction accuracy
   - Additional performance indicators

### Modal Content Structure

#### Header Section
- Model name and display information
- Provider badge (from MODELS constant)
- Database icon and debugging context

#### Content Sections

1. **Model Information Card**
   - Model key, provider, cost information
   - Data sourced from MODELS constant in `client/src/constants/models.ts`

2. **Accuracy Statistics Card**
   - Total attempts, correct predictions, accuracy percentage
   - Average confidence and trustworthiness scores
   - Success rates and prediction metrics
   - Data filtered from AccuracyStats interface

3. **Feedback Statistics Card**
   - Helpful vs not helpful vote counts
   - Total feedback volume
   - Calculated helpful percentage
   - Data filtered from FeedbackStats interface

4. **Raw Data Section**
   - Complete JSON dumps of all fetched data
   - Formatted with syntax highlighting
   - Scrollable code blocks for large datasets

## Implementation Details

### TypeScript Interfaces Used
- `AccuracyStats` from `@shared/types`
- `FeedbackStats` from `@shared/types`
- Model configuration from MODELS constant

### State Management
- Uses TanStack Query for data fetching
- Separate queries for each API endpoint
- Queries enabled only when modal is open for performance
- Loading states handled per query

### Styling Approach
- Tailwind CSS classes throughout
- Responsive grid layouts for data display
- Monospace font for numeric data and JSON
- Color coding: green for positive metrics, red for negative
- Provider-specific badge colors from MODELS config

## Integration Points

### StatisticsCards.tsx Modifications
- Add onClick handlers to all model items in Top Models columns
- Pass modelName to parent component via callback
- Add hover states and cursor-pointer styling
- Maintain existing visual styling

### PuzzleOverview.tsx Modifications
- Add modal state management (open/closed)
- Add selectedModel state
- Handle model selection callbacks
- Render ModelDebugModal component

## Files Modified/Created

### Created
- `client/src/components/ModelDebugModal.tsx` - Main modal component
- `docs/Model_Debug_Modal_Implementation.md` - This documentation

### To Be Modified
- `client/src/components/overview/StatisticsCards.tsx` - Add click handlers
- `client/src/pages/PuzzleOverview.tsx` - Add modal state and integration

## Performance Considerations
- Queries only execute when modal is open
- Separate queries allow for granular loading states
- Data filtering happens on frontend to avoid new API endpoints
- Modal content is scrollable to handle large datasets

## Error Handling
- Individual loading states for each data source
- Fallback messages when no data is available for specific models
- Graceful handling of missing model information

## Future Enhancements (Not Implemented)
- Export functionality for raw data
- Search/filter within JSON data sections
- Historical data tracking over time
- Comparison between multiple models

## Testing Considerations
- Test with models that have extensive data
- Test with models that have minimal/no data
- Verify responsive behavior on different screen sizes
- Test modal close behaviors (X button, outside click, escape key)
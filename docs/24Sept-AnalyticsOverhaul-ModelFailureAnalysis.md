# Analytics Overhaul: Model Failure Analysis Dashboard

**Author:** Claude Code using Sonnet 4
**Date:** 2025-09-24
**PURPOSE:** Complete redesign of PuzzleOverview.tsx to focus on MODEL performance failures rather than misleading efficiency metrics. This plan addresses fundamental poor assumptions in the current analytics approach and creates a reality-based model evaluation system.


### 🚨 Critical Poor Assumptions in Previous System:


1. **Overconfidence Detection**  THIS IS WHAT WE ARE ALL ABOUT!!!!
   - Models with high confidence (>80%) but low accuracy (<50%) are dangerous (this is most of them!!!)
   - These "overconfident failures" mislead users and waste resources!!!  This is what to highlight!!!!
   - Current system doesn't flag these critical failure patterns

2. **NEED TO EXCLUDE MODELS WITH LOW ATTEMPTS!**
   - Models with low numbers of attempts should be excluded from this page.
   - We want to be highlighting the models with at least 100 attempts.

3. **Attempts and waste**
   - Just returning a valid reply is an achievement for some models...
   - We want to be counting every attempt!!!  
   - Especially service errors!!! 
   - Especially if they fail to return valid json!
   - We expect models to get the answer wrong...  but being unreliable while getting the wrong answer is even worse!!
   - Models with high api processing times and invalid results should also be highlighted!!!
      

4. **"Cost Efficiency" is Fundamentally Flawed**
   - Models getting 90% wrong but being "cheap" are labeled "efficient"
   - Real efficiency = cost per CORRECT answer, not cost per attempt
   - Deprioritize displaying any cost info until we debug the cost calculations we are making


## Available Model Data Analysis

### From useModelLeaderboards:
- **accuracyStats**: Pure puzzle-solving correctness (but warns of trustworthiness filtering)
- **performanceStats**: Trustworthiness reliability, speed, cost data
- **feedbackStats**: User helpful/not helpful votes (reality check on model utility)

### From usePerformanceInsights:  WATCH OUT FOR FUNDAMENTAL MISUNDERSTANDINGS
- **confidenceStats**: IMPORTANT: Models rarely say they are not confident.  we want to highlight confidence between 1 and 60.  it is normal that a model says it is 85% confident and is wrong.  it is rare if they admit they do not know.
- **modelConfidenceAnalysis**: Confidence calibration gaps per model  (PROBLEMATIC - needs audit, you coded this and have no idea how this works, so this whole section is probably garbage)
- **performanceStats**: Speed/efficiency leaders (PROBLEMATIC - needs audit, you coded this and have no idea how this works, so this whole section is probably garbage)

### From ModelDebugModal:
- Detailed per-model breakdowns including costs, tokens, processing time
- Raw accuracy with warnings about data filtering issues
- Admin recovery tools and debugging capabilities

## New Analytics Architecture

### 1. Failure Analysis Dashboard (PRIMARY FOCUS)

**Purpose:** Immediately identify problematic models burning resources while failing

### 2. Overconfidence Detection System

**Purpose:** Flag models that mislead users with false confidence

**Sections:**
- **Dangerous AI Alert**: High confidence (>80%) + low accuracy (<50%)
- **Calibration Failures**: Largest confidence vs reality gaps
- **User Trust Violations**: High AI confidence + low user helpfulness ratings

**Key Metrics:**
- Confidence calibration gap
- Overconfidence frequency
- User trust vs AI confidence mismatches

### 3. Cost Waste Analysis

**Purpose:** Quantify real financial impact of poor models

**Sections:**
- **ROI Reality Check**: Dollars spent vs value delivered
- **Expensive Failures**: Models with highest cost per correct answer
- **Resource Allocation Audit**: Where money is being wasted

**Key Metrics:**
- Cost per correct answer
- Total waste (cost of wrong answers)
- ROI comparison across models

### 4. User Reality Integration

**Purpose:** Balance AI metrics with human feedback reality

**Sections:**
- **Community vs AI Disconnect**: Models AI thinks are good but users hate
- **Hidden Gems**: Models with lower AI confidence but high user satisfaction
- **Feedback Patterns**: What users actually find helpful vs model self-assessment

## Implementation Plan

### Phase 1: Data Foundation
- [ ] Audit usePerformanceInsights for misleading metrics
- [ ] Identify and remove "efficiency leaders" calculations
- [ ] Verify data sources aren't hiding poor performers through filtering
- [ ] Create new failure-focused data processing functions

### Phase 2: Core Analytics Sections
- [ ] Build Failure Analysis Dashboard component
- [ ] Implement Overconfidence Detection alerts
- [ ] Create Cost Waste Analysis visualizations
- [ ] Add User Reality Integration comparisons

### Phase 3: UI/UX Implementation
- [ ] Design clear visual hierarchy emphasizing problems first
- [ ] Add warning indicators for dangerous overconfident models
- [ ] Implement filtering to focus on different failure types
- [ ] Create actionable insights and recommendations

### Phase 4: Integration & Testing
- [ ] Remove fake efficiency metrics from existing displays
- [ ] Test all data flows with real model performance data
- [ ] Verify user feedback integration works correctly
- [ ] Validate cost calculations are accurate and meaningful

## Success Criteria

### User Experience Goals:
1. **Immediate Problem Identification**: Users can quickly spot problematic models
2. **Resource Protection**: Clear visibility into where money/time is wasted
3. **Trust Calibration**: Users understand which models to trust vs distrust
4. **Actionable Insights**: Clear next steps for model selection and improvement

### Technical Goals:
1. **Data Accuracy**: No filtered or misleading statistics
2. **Real Metrics**: Cost per correct answer, not cost per attempt
3. **User Integration**: Community feedback balanced with AI self-assessment
4. **Maintainable Code**: Follow SRP/DRY principles with reusable components


### Mitigation Strategies:

2. **Lazy Loading**: Load expensive calculations after basic data displays


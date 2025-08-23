# Database Integration Plan - August 23, 2025

**Status**: 🚨 URGENT - Repository code exists but unused  
**Priority**: HIGH - Performance and reliability critical

## Current State Assessment

### ✅ What Actually Exists
- **Repository Pattern Code**: Well-written repositories in `server/db/repositories/`
- **Connection Layer**: Production-ready connection with circuit breaker in `server/db/connection.ts`  
- **Schema Validation**: Zod schemas in `server/db/schemas.ts`
- **Service Factory**: Integration layer in `server/db/index.ts`
- **Saturn FK Fix**: Working saturn_log table and session management

### ❌ Critical Gap
- **Zero Integration**: Application still uses monolithic `dbService.ts`
- **Dead Code**: All new repository code is unused
- **Performance Issues**: Old slow queries still running
- **Production Risk**: Runtime `CREATE TABLE IF NOT EXISTS` still active

## Integration Strategy

### Phase 1: Switch to New Service (HIGH PRIORITY)
**Target**: Replace `dbService.ts` usage with new `server/db/index.ts`

1. **Update Server Initialization**
   - `server/index.ts`: Replace dbService.init() with initDatabaseService()
   - Test connectivity and Saturn session management

2. **Update Controller Imports**
   - `server/controllers/explanationController.ts`: Import from `server/db/index.js`
   - `server/controllers/feedbackController.ts`: Import from `server/db/index.js`
   - `server/controllers/saturnController.ts`: Import from `server/db/index.js`

3. **Legacy Compatibility Testing**
   - Verify all existing API endpoints work unchanged
   - Test Saturn solver integration
   - Validate feedback creation and retrieval

### Phase 2: Remove Runtime Migration Risk (CRITICAL)
**Target**: Eliminate dangerous `CREATE TABLE IF NOT EXISTS` calls

1. **Create Proper Migration File**
   - `migrations/001_base_schema.sql` with current table definitions
   - Remove all runtime table creation from `server/db/index.ts`

2. **Add Migration Runner**
   - Production-safe migration execution
   - Version tracking to prevent re-runs

### Phase 3: Performance Optimization (HIGH IMPACT)
**Target**: Enable optimized queries in repositories

1. **Query Replacement Verification**
   - Test new `getWithFeedbackCounts()` vs old correlated subqueries
   - Benchmark bulk status operations
   - Verify Saturn session queries

2. **Index Creation**
   - `explanations(puzzle_id, created_at DESC)`
   - `feedback(explanation_id)`
   - `saturn_events(saturn_log_id, timestamp)`

### Phase 4: Schema Improvements (MEDIUM PRIORITY)
**Target**: Optimize data storage and querying

1. **JSONB Migration**
   - `saturn_images`: TEXT → JSONB
   - `predicted_output_grid`: TEXT → JSONB
   - `provider_raw_response`: TEXT → JSONB

2. **Data Type Fixes**
   - `api_processing_time_ms`: INTEGER → BIGINT
   - `created_at`: TIMESTAMP → TIMESTAMPTZ

## Implementation Order

### Week 1 (Critical Path)
1. **Day 1**: Switch server to use new database service
2. **Day 2**: Remove runtime table creation risk
3. **Day 3**: Test full application with new service layer
4. **Day 4**: Add critical indexes for performance
5. **Day 5**: Benchmark and validate performance improvements

### Week 2 (Optimization)
1. **JSONB migration planning**
2. **Data type improvements**
3. **Additional performance monitoring**
4. **Documentation updates**

## Risk Mitigation

### High Risk Items
- **Service Switch**: Legacy compatibility layer provides safety net
- **Migration Removal**: Keep backup of current runtime creation logic
- **Performance**: New queries already tested in repository code

### Testing Strategy
- **Unit Tests**: Verify repository methods match old service behavior
- **Integration Tests**: Full application testing with new service
- **Performance Tests**: Query timing comparisons before/after
- **Saturn Testing**: Verify solver session tracking works

## Success Criteria

### Performance Targets
- Query response time: < 100ms (from current 5+ seconds)
- Eliminate runtime schema modifications
- Saturn session tracking maintains full fidelity
- Zero API breaking changes

### Code Quality
- Remove 1400+ line monolithic service
- Enable type-safe database operations
- Production-ready connection management
- Comprehensive error handling

## Files Modified

### High Impact Changes
- `server/index.ts` - Database service initialization
- `server/controllers/*Controller.ts` - Import updates
- `migrations/001_base_schema.sql` - New migration file

### Medium Impact Changes  
- `server/db/index.ts` - Remove table creation
- Performance monitoring integration
- Additional indexes

### Low Risk Changes
- Documentation updates
- Performance benchmarking
- Additional validation

---

**Next Steps**: Begin Phase 1 service integration immediately
**Estimated Timeline**: Critical path completion in 5 days
**Risk Level**: Medium (well-tested repository code provides safety)

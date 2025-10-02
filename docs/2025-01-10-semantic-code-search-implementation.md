# Semantic Code Search Implementation Plan

## Overview
Implement semantic code search for the GitHub repository using PostgreSQL pgvector, OpenAI embeddings, and intelligent code chunking.

## Architecture

### Database Schema (PostgreSQL + pgvector)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE code_chunks (
  id SERIAL PRIMARY KEY,
  repository_name VARCHAR(255) NOT NULL,
  repository_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  chunk_content TEXT NOT NULL,
  chunk_type VARCHAR(50), -- 'function', 'class', 'block', 'file'
  language VARCHAR(50),
  commit_hash VARCHAR(40),
  embedding vector(1536), -- OpenAI ada-002 dimensions
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX ON code_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_code_chunks_repo ON code_chunks(repository_name);
CREATE INDEX idx_code_chunks_file ON code_chunks(file_path);
CREATE INDEX idx_code_chunks_type ON code_chunks(chunk_type);
```

### Implementation Phases

#### Phase 1: Database Setup
1. Add pgvector extension to DatabaseSchema.ts
2. Create code_chunks table with HNSW index
3. Add CodeChunkRepository with CRUD operations
4. Update RepositoryService to include CodeChunkRepository

#### Phase 2: GitHub Repository Indexer
1. Create GitHubIndexerService
   - Clone/mirror repository to temp directory
   - Walk file tree and filter by extension
   - Extract file metadata (path, commit hash)
2. Create CodeChunkerService
   - Parse code files using AST (language-specific)
   - Split into semantic chunks (functions, classes, blocks)
   - Add 15% overlap between chunks
   - Handle large chunks with recursive splitting
   - Target 256-1024 tokens per chunk

#### Phase 3: Embedding Generation
1. Create EmbeddingService
   - Use OpenAI text-embedding-ada-002 (1536 dimensions)
   - Batch processing (up to 2048 chunks per request)
   - Normalize vectors to unit length
   - Handle rate limiting and retries
   - Store embeddings in code_chunks table

#### Phase 4: Search API
1. Create SearchController
   - POST /api/search/code - Semantic code search
     - Convert query to embedding
     - Find top-k similar chunks using cosine similarity
     - Filter by repository, language, file path
     - Apply similarity threshold (>0.85)
   - GET /api/search/repositories - List indexed repositories
   - POST /api/search/index - Trigger repository indexing
   - GET /api/search/status/:jobId - Check indexing progress

2. Create SearchRepository
   - Semantic similarity search using pgvector
   - Metadata filtering
   - Result ranking and scoring

#### Phase 5: Background Jobs
1. Create IndexingJobManager
   - Queue-based job processing
   - Progress tracking via WebSocket
   - Error handling and retry logic
   - Incremental updates (only changed files)
   - Store job status in database

#### Phase 6: Frontend UI
1. Create SemanticSearch page
   - Search input with natural language queries
   - Filter controls (repo, language, file type)
   - Results display with:
     - File path and line numbers
     - Syntax-highlighted code preview
     - Similarity score
     - "Open in Windsurf" button with deep link
   - Pagination for results

2. Create RepositoryManager page
   - List indexed repositories
   - Trigger re-indexing
   - View indexing status
   - Delete indexed data

## Code Chunking Strategy

### Language-Specific Parsers
- **TypeScript/JavaScript**: Use babel parser for AST
- **Python**: Use built-in ast module
- **Other languages**: Fall back to regex-based splitting

### Chunk Boundaries
1. **Primary**: Functions, methods, classes
2. **Secondary**: Logical blocks (imports, exports, config)
3. **Fallback**: Fixed-size with 15% overlap

### Chunk Size Limits
- Target: 256-1024 tokens
- Maximum: 8000 tokens (OpenAI limit)
- Recursive split for oversized chunks

## Search Algorithm

```typescript
interface SearchQuery {
  query: string;
  filters?: {
    repository?: string;
    language?: string;
    filePattern?: string;
  };
  limit?: number; // default 20
  threshold?: number; // default 0.85
}

async function searchCode(query: SearchQuery) {
  // 1. Generate embedding for query
  const queryEmbedding = await embeddingService.embed(query.query);
  
  // 2. Search similar chunks using pgvector
  const results = await db.query(`
    SELECT 
      id,
      repository_name,
      file_path,
      start_line,
      end_line,
      chunk_content,
      1 - (embedding <=> $1::vector) as similarity
    FROM code_chunks
    WHERE 1 - (embedding <=> $1::vector) > $2
      AND ($3::text IS NULL OR repository_name = $3)
      AND ($4::text IS NULL OR language = $4)
      AND ($5::text IS NULL OR file_path LIKE $5)
    ORDER BY embedding <=> $1::vector
    LIMIT $6
  `, [queryEmbedding, threshold, repo, lang, filePattern, limit]);
  
  // 3. Format results with Windsurf deep links
  return results.map(r => ({
    ...r,
    windsurfUrl: `windsurf://file/${r.file_path}:${r.start_line}`
  }));
}
```

## Integration Points

### Existing Services
- Use existing logger utility
- Use existing error handling middleware
- Use existing WebSocket service for progress updates
- Use repositoryService pattern for CodeChunkRepository

### New Dependencies
```json
{
  "dependencies": {
    "pgvector": "^0.2.0",
    "@babel/parser": "^7.23.0",
    "simple-git": "^3.22.0"
  }
}
```

## Performance Considerations

### Indexing
- Process files in parallel (worker pool)
- Batch embed requests (2048 chunks max)
- Store progress in database for resume capability
- Skip unchanged files (compare commit hashes)

### Search
- HNSW index provides sub-linear search time
- Cache frequent queries (5 min TTL)
- Limit results to top 100 initially
- Implement cursor-based pagination

## Security

### Rate Limiting
- 100 searches per hour per IP
- 10 indexing jobs per day per IP

### Access Control
- No authentication for search (public repo)
- Admin-only for indexing triggers
- Validate file paths to prevent traversal

## Testing Strategy

1. **Unit Tests**
   - CodeChunkerService with sample files
   - EmbeddingService with mock OpenAI
   - SearchRepository with test embeddings

2. **Integration Tests**
   - Index small test repository
   - Search with known queries
   - Verify result accuracy

3. **E2E Tests**
   - Complete indexing flow
   - Search and result display
   - Windsurf deep link generation

## Monitoring

### Metrics to Track
- Indexing throughput (files/min)
- Search latency (p50, p95, p99)
- Embedding API costs
- Index size and growth rate
- Search result relevance (manual sampling)

### Alerts
- Indexing job failures
- Search latency > 500ms
- OpenAI API errors
- Database disk usage > 80%

## Cost Estimation

### OpenAI Embeddings
- ~$0.0001 per 1K tokens
- Average 500 tokens per chunk
- 10,000 chunks ≈ $0.50
- Monthly cost depends on update frequency

### Database Storage
- Each embedding: ~6KB (1536 dimensions)
- 10,000 chunks ≈ 60MB
- Plus code content storage

## Migration Path

1. Deploy database schema changes
2. Add indexing endpoints (no-op initially)
3. Build and test chunking/embedding locally
4. Index development branch first
5. Gradually add more repositories
6. Launch search UI when results are quality

## Future Enhancements

1. **Hybrid Search**: Combine semantic + keyword search
2. **Code Context**: Include surrounding code in results
3. **Multi-modal**: Search by code + comments + docs
4. **Reranking**: Use cross-encoder for top results
5. **Feedback Loop**: Learn from clicked results
6. **IDE Integration**: Browser extension for Windsurf

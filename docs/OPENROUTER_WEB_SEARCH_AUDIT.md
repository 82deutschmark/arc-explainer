# OpenRouter Web Search Charge Audit ($0.02 per call)

**Date:** 2026-01-07
**Status:** UNRESOLVED - Bleeding $0.02 per request to SnakeBench/WormArena via OpenRouter
**Priority:** CRITICAL - Likely costing hundreds/thousands monthly
**Discoverer:** Claude Haiku 4.5

## Problem Statement

Every SnakeBench game request via OpenRouter is being charged an extra **$0.02** for web search plugin activation, even though:
- No web search functionality is being used
- No web search was intentionally requested
- The user reports they're "very upset" about these mystery charges appearing on their OpenRouter bill

**The Situation:**
- User noticed $0.02 "web search" line item appearing on every OpenRouter request
- This is ONLY happening via SnakeBench/WormArena (not the main ARC Explainer application)
- No `:online` model variants exist in the codebase, ruling out that trigger mechanism
- The charge must be coming from a `plugins` field being injected into the request payload

**The Economics:**
OpenRouter's web search uses the Exa engine at $4 per 1,000 results. With default `max_results=5`, this equals $0.02 per activation. At scale (dozens of games running), this adds up to hundreds/thousands per month in phantom costs.

**Official OpenRouter Docs:**
- https://openrouter.ai/docs/guides/features/plugins/web-search
- Web search is activated by EITHER:
  1. Appending `:online` to model name (not happening here)
  2. Including `"plugins": [{"id": "web"}]` in request payload (likely culprit)

## How Web Search Gets Triggered

According to OpenRouter's official docs (https://openrouter.ai/docs/guides/features/plugins/web-search):

**Method 1: Model Suffix**
```json
{
  "model": "openai/gpt-4o:online"
}
```

**Method 2: Plugins Parameter in Request**
```json
{
  "plugins": [
    {"id": "web"}
  ]
}
```

Either of these in the request payload will activate web search and incur the $0.02 charge.

## Everywhere I Looked (Audit Trail)

### ✅ Ruled Out:
1. **Model names with `:online` suffix**
   - Searched entire codebase for `:online` pattern - FOUND NOTHING
   - Grep: `grep -r ":online" D:\GitHub\arc-explainer\server` (no results)
   - Grep: `grep -r ":online" D:\GitHub\arc-explainer\external\SnakeBench` (no results)
   - Conclusion: Not this vector

2. **Main ARC Explainer server code**
   - `server/services/openai/payloadBuilder.ts` - checked for plugins field injection - CLEAN
   - `server/controllers/snakeBenchController.ts` - checked the `/api/snakebench/matches` endpoint - CLEAN
   - Grep for `plugins` in server directory - FOUND NOTHING suspicious
   - Conclusion: The issue is in SnakeBench backend, not TypeScript/Express code

### 🔍 Currently Investigating (Most Likely Culprits):

1. **`external/SnakeBench/backend/llm_providers.py`** - OpenRouterProvider class
   - **Lines 167-207:** OpenRouterProvider `__init__()` and setup
   - **Line 172:** `self.api_kwargs = self.extract_api_kwargs(config)` - THIS IS THE EXTRACTION POINT
   - **Lines 196-206:** Building `extra_body` with transforms - checked for plugins injection - NOT HERE YET
   - **Lines 188-254:** `get_response()` method - checked for plugins field being added - NOT EXPLICITLY HERE
   - **Key question:** What's in `request_kwargs` at line 189? We need to log this
   - **Key question:** Does `extra_body` manipulation accidentally include plugins?

2. **`external/SnakeBench/backend/llm_providers.py`** - extract_api_kwargs() method (Lines 138-165)
   - **THIS IS THE SMOKING GUN**
   - Lines 146-152: Define `known_fields` that are filtered OUT
   - Lines 155-163: **ANY field not in `known_fields` gets passed through to the API**
   - **Example problem scenario:**
     ```python
     api_kwargs = {}
     api_kwargs.update(config.get('kwargs', {}))  # Line 156

     for field_name, value in config.items():
         if field_name in known_fields or field_name.startswith("trueskill_"):
             continue
         api_kwargs[field_name] = value  # Line 163 - DANGEROUS!
     ```
   - **If config has a `plugins` field → it goes straight to OpenRouter**

3. **`external/SnakeBench/backend/data_access/repositories/model_repository.py`** - _row_to_model()
   - **Lines 439-472:** Converts database row to model dictionary
   - **What's returned:**
     - id, name, provider, model_slug, model_name
     - is_active, test_status, elo_rating
     - trueskill_mu, trueskill_sigma, trueskill_exposed
     - wins, losses, ties, apples_eaten, games_played
     - pricing_input, pricing_output, max_completion_tokens
     - last_played_at, discovered_at
     - rating (computed), pricing (nested dict)
   - **What's NOT explicitly returned but could be:**
     - Any extra columns from the models table (like `plugins` if it exists)
     - Any JSON fields in `metadata_json`
   - **Status:** Need to check what columns actually exist in the models table

4. **`external/SnakeBench/backend/cli/sync_openrouter_models.py`** - normalize_model_data()
   - **Lines 64-123:** Normalizes data from OpenRouter API before inserting into DB
   - **Lines 105-113:** Stores metadata as JSON:
     ```python
     metadata = {
         'canonical_slug': openrouter_model.get('canonical_slug'),
         'description': openrouter_model.get('description', ''),
         'architecture': openrouter_model.get('architecture', {}),
         'context_length': context_length,
         'supported_parameters': openrouter_model.get('supported_parameters', []),
         'created': openrouter_model.get('created'),
         'hugging_face_id': openrouter_model.get('hugging_face_id'),
     }
     ```
   - **Key question:** Does `openrouter_model` from the OpenRouter API include a `plugins` field?
   - **Status:** Unknown - would need to inspect live OpenRouter API response

5. **Database schema - the models table**
   - **Status:** NOT YET EXAMINED
   - Need to check:
     - What columns exist in `models` table?
     - Does it have a `plugins` column?
     - Does `metadata_json` contain plugins for any models?
     - Run: `SELECT * FROM models LIMIT 1 \G`

6. **Players initialization in main game loop**
   - **`external/SnakeBench/backend/players/llm_player.py`** Lines 14-25
     ```python
     def __init__(self, snake_id: str, player_config: Dict[str, Any]):
         super().__init__(snake_id)
         self.name = player_config['name']
         self.config = player_config
         self.move_history = []
         self.provider = create_llm_provider(player_config)
     ```
   - Player config comes from database via `get_model_by_name()`
   - Then passed to `create_llm_provider()` which routes to OpenRouterProvider
   - **Status:** Data flows correctly, but the config dictionary itself is the problem

### ❌ Not Checked Yet (Lower Priority):
- Direct database table structure and migration files
- Whether OpenRouter's own API documentation or catalog includes plugin configs
- Flask/Celery task configuration in `external/SnakeBench/backend/app.py`
- Whether any environment variables or config files set plugins globally

## Where to Look

**Critical:** The charge is SnakeBench-specific (not WormArena), so focus on:

1. **`external/SnakeBench/backend/llm_providers.py`** (OpenRouterProvider class)
   - Line 189: `request_kwargs = dict(self.api_kwargs)`
   - Check what `self.api_kwargs` contains after `extract_api_kwargs()` is called
   - Line 196-206: Look at `extra_body` and `transforms` manipulation
   - Does anything inject `plugins` here?

2. **Model Config Sources**
   - Database models table: Check if any `metadata_json` field contains `plugins`
   - `sync_openrouter_models.py`: Does it pull metadata from OpenRouter that includes plugin info?
   - The `_row_to_model()` conversion in ModelRepository (line 439-472) - does it leak extra fields?

3. **`LLMProviderInterface.extract_api_kwargs()`** (line 138-165)
   - This method extracts all non-internal fields from model config
   - If the database has a `plugins` column or `metadata_json` contains `plugins`, it passes through here
   - **This is the likely culprit** - any field not in `known_fields` gets passed to the API

## Debugging Steps (Prioritized)

### STEP 1: Confirm the charge is real and trace one request end-to-end (15 mins)
```bash
# 1. Run a single SnakeBench game with OpenRouter models
cd external/SnakeBench/backend
python main.py --models "openai/gpt-4o" "openai/gpt-4o-mini" --width 8 --height 8 --max-rounds 10

# 2. Check OpenRouter's usage dashboard for that exact timestamp
# Look for: model, input tokens, output tokens, web search charge

# 3. Confirm whether the $0.02 appears in the invoice for that request
```

### STEP 2: Add debug logging to capture the exact request payload (10 mins)
Edit `external/SnakeBench/backend/llm_providers.py` at line 250 (right before API call):

```python
def get_response(self, prompt: str) -> Dict[str, Any]:
    request_kwargs = dict(self.api_kwargs)
    if self.extra_headers:
        request_kwargs['extra_headers'] = self.extra_headers

    # ... existing code for extra_body, transforms, etc ...

    # ADD THIS DEBUG BLOCK:
    import json
    print(f"\n{'='*80}")
    print(f"[DEBUG] OpenRouter Request Payload:")
    print(f"Model: {self.model_name}")
    print(f"Full request_kwargs keys: {list(request_kwargs.keys())}")
    if 'plugins' in request_kwargs:
        print(f"⚠️  ALERT: plugins field found: {request_kwargs['plugins']}")
    if 'extra_body' in request_kwargs and isinstance(request_kwargs['extra_body'], dict):
        if 'plugins' in request_kwargs['extra_body']:
            print(f"⚠️  ALERT: plugins in extra_body: {request_kwargs['extra_body']['plugins']}")
    print(f"Request kwargs (JSON): {json.dumps(request_kwargs, indent=2, default=str)}")
    print(f"{'='*80}\n")

    response = self.client.responses.create(
        model=self.model_name,
        input=_build_responses_input(prompt),
        **request_kwargs,
    )
```

Run a single game again and look for `ALERT: plugins field found` in the logs.

### STEP 3: Examine the model configuration at load time (10 mins)
Edit `external/SnakeBench/backend/players/llm_player.py` at line 25 (right after provider init):

```python
def __init__(self, snake_id: str, player_config: Dict[str, Any]):
    super().__init__(snake_id)
    self.name = player_config['name']
    self.config = player_config
    self.move_history = []

    # ADD THIS DEBUG BLOCK:
    import json
    print(f"\n[DEBUG] Player {snake_id} config:")
    print(f"Keys in config: {list(player_config.keys())}")
    if 'plugins' in player_config:
        print(f"⚠️  ALERT: plugins in player_config: {player_config['plugins']}")
    if 'metadata_json' in player_config:
        print(f"metadata_json contents: {player_config['metadata_json']}")
    print(json.dumps(player_config, indent=2, default=str))
    print()

    self.provider = create_llm_provider(player_config)
```

Run a single game and check what's in player_config when it's loaded from the database.

### STEP 4: Check database directly (5 mins)
```sql
-- Connect to SnakeBench database (Railway Postgres)
-- Check if a plugins column exists and what it contains
SELECT id, name, model_slug FROM models WHERE is_active = TRUE LIMIT 5;

-- If plugins column exists:
SELECT id, name, plugins FROM models WHERE plugins IS NOT NULL LIMIT 5;

-- Check metadata_json for any plugins references:
SELECT id, name, metadata_json FROM models
WHERE metadata_json LIKE '%plugin%' LIMIT 5;
```

### STEP 5: Trace through extract_api_kwargs() (10 mins)
Edit `external/SnakeBench/backend/llm_providers.py` lines 138-165:

```python
@staticmethod
def extract_api_kwargs(config: Dict[str, Any]) -> Dict[str, Any]:
    """Extract fields for API kwargs with debug logging."""
    api_kwargs = {}
    known_fields = {
        'name', 'provider', 'pricing', 'kwargs', 'model_name', 'api_type',
        # ... rest of known_fields ...
    }

    # ADD DEBUG:
    print(f"\n[DEBUG] extract_api_kwargs called")
    print(f"Config keys: {list(config.keys())}")
    print(f"Known fields: {known_fields}")

    api_kwargs.update(config.get('kwargs', {}))

    for field_name, value in config.items():
        if field_name in known_fields or field_name.startswith("trueskill_"):
            continue
        print(f"  → Adding to api_kwargs: {field_name} = {value}")
        api_kwargs[field_name] = value

    print(f"Final api_kwargs keys: {list(api_kwargs.keys())}")
    if 'plugins' in api_kwargs:
        print(f"⚠️  ALERT: plugins in final api_kwargs: {api_kwargs['plugins']}")
    print()

    return api_kwargs
```

### STEP 6: Test with minimal config (5 mins)
Run this test script to isolate the issue:

```python
# test_openrouter_plugins.py
import os
from dotenv import load_dotenv
load_dotenv()

from llm_providers import create_llm_provider, OpenRouterProvider

# Test 1: Minimal config without plugins
test_config_clean = {
    'name': 'test-clean',
    'model_name': 'openai/gpt-4o',
    'provider': 'openrouter',
    'pricing': {'input': 1.0, 'output': 3.0}
}

print("[TEST 1] Minimal config without plugins:")
provider = OpenRouterProvider(os.getenv('OPENROUTER_API_KEY'), test_config_clean)
# Look at debug output above for extract_api_kwargs

# Test 2: Config with intentional plugins field
test_config_with_plugins = {
    'name': 'test-plugins',
    'model_name': 'openai/gpt-4o',
    'provider': 'openrouter',
    'plugins': [{'id': 'web'}],  # INTENTIONAL PROBLEM
    'pricing': {'input': 1.0, 'output': 3.0}
}

print("\n[TEST 2] Config with plugins field:")
provider2 = OpenRouterProvider(os.getenv('OPENROUTER_API_KEY'), test_config_with_plugins)
# Should see ALERT about plugins in api_kwargs
```

## Most Likely Root Cause

The `extract_api_kwargs()` method in `llm_providers.py` (lines 138-165) is **dangerously permissive**.

**The vulnerability:**
```python
for field_name, value in config.items():
    if field_name in known_fields or field_name.startswith("trueskill_"):
        continue
    api_kwargs[field_name] = value  # ← LINE 163: ANY field passes through!
```

**The attack vector:**
If the database models table has:
- A `plugins` column, OR
- `plugins` in `metadata_json`, OR
- Any other field with plugin configuration

...then the model config dictionary includes `plugins`, `extract_api_kwargs()` silently passes it through, and OpenRouter activates web search on every request.

**Why it's happening on EVERY request:**
The problem is systematic and baked into either the database schema or data flow. Every model loaded from the database carries the plugins contamination.

## Solution (Do NOT Implement Yet - Verify First)

Once root cause is confirmed:

1. **If it's in the database:** Run a migration to remove `plugins` from all models
2. **If it's in sync script:** Update `sync_openrouter_models.py` to exclude plugins from metadata
3. **Add safeguard in `extract_api_kwargs()`:**
   ```python
   # Explicitly block web search activation
   api_kwargs.pop('plugins', None)
   ```

4. **Add explicit validation before sending requests:**
   ```python
   if 'plugins' in request_kwargs:
       raise ValueError("Web search plugin detected - this is likely unintended and will cost $0.02 per request")
   ```

## What Was NOT Completed (and Why)

This audit was interrupted before confirming the root cause. Here's what remains:

1. **Database schema inspection** - Never got to run SQL queries against Railway Postgres to confirm if:
   - models table has a `plugins` column
   - `metadata_json` contains plugins for any models
   - This is THE KEY diagnostic step

2. **Live request logging** - Never added debug prints to see the actual request payload being sent to OpenRouter

3. **Minimal reproduction test** - Never ran the test script to isolate whether clean minimal configs work

4. **OpenRouter API catalog inspection** - Never checked if OpenRouter's `/models` endpoint returns plugin info that gets synced into `metadata_json`

## References

- [OpenRouter Web Search Docs](https://openrouter.ai/docs/guides/features/plugins/web-search)
- [OpenRouter Plugins Guide](https://openrouter.ai/docs/guides/features/plugins)
- SnakeBench Backend: `llm_providers.py` (lines 138-254), `data_access/repositories/model_repository.py` (lines 439-472)
- SnakeBench sync: `cli/sync_openrouter_models.py` (lines 64-123)
- Cost: $4 per 1,000 Exa search results = $0.02 at default 5 results

---

## Immediate Next Steps (DO THIS FIRST)

1. **Add debug logging to STEPS 2 and 3 above** (30 mins total)
   - Run a single SnakeBench game
   - Look for `[DEBUG] OpenRouter Request Payload:` in logs
   - Look for `⚠️  ALERT: plugins field found`
   - This will confirm whether plugins is in the payload

2. **Run the database queries from STEP 4** (5 mins)
   - Connect to Railway Postgres (SnakeBench database)
   - Execute the SQL queries above
   - Look for any models with plugins

3. **If plugins is found anywhere:** Implement the safeguard in extract_api_kwargs():
   ```python
   # Defensively strip plugins before sending to API
   api_kwargs.pop('plugins', None)
   ```

4. **Once safeguard is in place:** Run a test game and verify NO $0.02 charge appears

5. **Fix the root cause:** Remove plugins from database/sync script

---

## How to Hand Off This Work

- This document provides complete context for picking up exactly where the audit stopped
- The debugging steps are sequential and will identify the root cause
- All file paths and line numbers are explicit
- All code snippets for logging are ready to copy-paste
- Start with STEP 2 (add debug logging) - it will answer 90% of questions in 10 minutes

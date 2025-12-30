# ARC-AGI Token Cost Tracking Analysis
**Date:** 2025-11-27
**Author:** Cascade (Claude Sonnet 4)
**Purpose:** Compare token cost tracking methodologies between ARC-AGI benchmarking framework and Poetiq solver

---

## Executive Summary

The **ARC-AGI benchmarking framework** implements comprehensive, **programmatic token cost tracking** directly within its testing harness. Every API call captures token usage from provider responses and calculates costs using a centralized pricing configuration.

**Poetiq**, by contrast, **does NOT track token costs programmatically** in their open-source codebase. According to their team, they rely on **provider dashboards** for cost tracking, which raises questions about the verifiability of their cost claims in their "Pareto Frontier" analysis.

---

## ARC-AGI Benchmarking Framework Methodology

### 1. **Token Capture via API Responses**

The framework captures token usage directly from **every API response** through standardized provider adapters:

**Location:** `arc-agi-benchmarking/src/arc_agi_benchmarking/adapters/openai_base.py:292-353`

```python
def _get_usage(self, response: Any) -> Usage:
    """
    Get the usage from the response and convert to our Usage schema.
    Handles OpenAI ChatCompletion, Responses API, and already-converted Usage objects.
    """
    raw_usage = response.usage

    # Extract token counts based on API type
    if self.model_config.api_type == APIType.CHAT_COMPLETIONS:
        prompt_tokens = getattr(raw_usage, 'prompt_tokens', 0)
        completion_tokens = getattr(raw_usage, 'completion_tokens', 0)
        total_tokens = getattr(raw_usage, 'total_tokens', prompt_tokens + completion_tokens)

        # Extract reasoning tokens (for o1/o3 models)
        reasoning_tokens = 0
        if hasattr(raw_usage, 'completion_tokens_details'):
            reasoning_tokens = getattr(raw_usage.completion_tokens_details, 'reasoning_tokens', 0)

    elif self.model_config.api_type == APIType.RESPONSES:
        # Responses API uses input_tokens/output_tokens naming
        prompt_tokens = getattr(raw_usage, 'input_tokens', 0)
        completion_tokens = getattr(raw_usage, 'output_tokens', 0)
        total_tokens = getattr(raw_usage, 'total_tokens', prompt_tokens + completion_tokens)

        reasoning_tokens = 0
        if hasattr(raw_usage, 'output_tokens_details'):
            reasoning_tokens = getattr(raw_usage.output_tokens_details, 'reasoning_tokens', 0)

    # Infer reasoning tokens if not explicit
    if reasoning_tokens == 0 and total_tokens > (prompt_tokens + completion_tokens):
        reasoning_tokens = total_tokens - (prompt_tokens + completion_tokens)

    return Usage(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        completion_tokens_details=CompletionTokensDetails(
            reasoning_tokens=reasoning_tokens,
            accepted_prediction_tokens=completion_tokens,
            rejected_prediction_tokens=0
        )
    )
```

### 2. **Cost Calculation with Validation**

**Location:** `arc-agi-benchmarking/src/arc_agi_benchmarking/adapters/openai_base.py:403-464`

The framework calculates costs **immediately after every API call** using centralized pricing:

```python
def _calculate_cost(self, response: Any) -> Cost:
    """Calculate usage costs, validate token counts, and return a Cost object."""
    usage = self._get_usage(response)

    # Determine effective token counts for billing
    # Case A: Completion includes Reasoning (pt + ct == tt)
    if total_tokens == 0 or (prompt_tokens + completion_tokens == total_tokens):
        reasoning_tokens_for_cost = reasoning_tokens_explicit
        completion_tokens_for_cost = max(0, completion_tokens - reasoning_tokens_for_cost)

    # Case B: Reasoning is Separate (pt + ct < tt)
    else:
        reasoning_tokens_for_cost = reasoning_tokens_explicit or (total_tokens - (prompt_tokens + completion_tokens))
        completion_tokens_for_cost = completion_tokens

    # Calculate costs using per-million-token pricing
    input_cost_per_token = self.model_config.pricing.input / 1_000_000
    output_cost_per_token = self.model_config.pricing.output / 1_000_000

    prompt_cost = prompt_tokens_for_cost * input_cost_per_token
    completion_cost = completion_tokens_for_cost * output_cost_per_token
    reasoning_cost = reasoning_tokens_for_cost * output_cost_per_token
    total_cost = prompt_cost + completion_cost + reasoning_cost

    # VALIDATION: Ensure computed total matches provider's reported total
    if total_tokens and computed_total != total_tokens:
        raise TokenMismatchError(
            f"Token count mismatch: API reports {total_tokens}, "
            f"but computed P:{prompt_tokens_for_cost} + C:{completion_tokens_for_cost} + R:{reasoning_tokens_for_cost} = {computed_total}"
        )

    return Cost(
        prompt_cost=prompt_cost,
        completion_cost=completion_cost,
        reasoning_cost=reasoning_cost,
        total_cost=total_cost,
    )
```

**Key Features:**
- **Token mismatch detection** - raises errors if token counts don't add up
- **Reasoning token handling** - special logic for o1/o3/o4 models
- **Per-component costs** - separates prompt/completion/reasoning costs
- **Centralized pricing** - all pricing comes from `models.yml` configuration

### 3. **Structured Storage in Every Attempt**

**Location:** `arc-agi-benchmarking/src/arc_agi_benchmarking/schemas.py:106-130`

Every prediction attempt includes full cost metadata:

```python
class AttemptMetadata(BaseModel):
    model: str
    provider: str
    start_timestamp: datetime
    end_timestamp: datetime
    choices: List[Choice]
    reasoning_summary: Optional[str] = None
    kwargs: Dict[str, Any]
    usage: Usage                    # ← Token counts
    cost: Cost                      # ← Calculated costs
    task_id: Optional[str] = None
    pair_index: Optional[int] = 0
    test_id: Optional[str] = None
```

**Storage Format:** Each task result is saved as JSON:

```json
{
  "attempt_1": {
    "answer": [[1, 2], [3, 4]],
    "metadata": {
      "model": "gpt-5.1",
      "usage": {
        "prompt_tokens": 1500,
        "completion_tokens": 250,
        "total_tokens": 1750,
        "completion_tokens_details": {
          "reasoning_tokens": 0
        }
      },
      "cost": {
        "prompt_cost": 0.000525,
        "completion_cost": 0.000400,
        "reasoning_cost": 0.0,
        "total_cost": 0.000925
      },
      "start_timestamp": "2025-11-27T10:30:00Z",
      "end_timestamp": "2025-11-27T10:30:45Z"
    }
  }
}
```

### 4. **Centralized Pricing Configuration**

**Location:** `arc-agi-benchmarking/models.yml`

All model pricing is maintained in a single source of truth:

```yaml
gpt-5.1:
  model_name: "gpt-5.1"
  provider: "openai"
  api_type: "chat_completions"
  pricing:
    input: 0.35      # Per 1M tokens
    output: 1.40     # Per 1M tokens
  kwargs:
    temperature: 1.0
```

### 5. **Post-Processing Utilities**

**Location:** `arc-agi-benchmarking/src/arc_agi_benchmarking/utils/update_pricing.py`

The framework even includes utilities to **retroactively update costs** if pricing changes:

```python
def calculate_cost(usage: Dict[str, Any], pricing: Dict[str, Any]) -> Dict[str, float]:
    """
    Calculate usage costs based on token counts and pricing.
    This follows the logic from openai_base.py's _calculate_cost method.
    """
    prompt_tokens = usage.get('prompt_tokens', 0)
    completion_tokens = usage.get('completion_tokens', 0)
    reasoning_tokens = usage.get('completion_tokens_details', {}).get('reasoning_tokens', 0)

    input_cost_per_token = pricing['input'] / 1_000_000
    output_cost_per_token = pricing['output'] / 1_000_000

    prompt_cost = prompt_tokens * input_cost_per_token
    completion_cost = (completion_tokens - reasoning_tokens) * output_cost_per_token
    reasoning_cost = reasoning_tokens * output_cost_per_token
    total_cost = prompt_cost + completion_cost + reasoning_cost

    return {
        'prompt_cost': prompt_cost,
        'completion_cost': completion_cost,
        'reasoning_cost': reasoning_cost,
        'total_cost': total_cost
    }
```

---

## Poetiq Solver Methodology

### Token Tracking: **NONE**

After comprehensive analysis of the Poetiq codebase (`poetiq-solver/`), **no token counting or cost tracking exists**:

**File:** `poetiq-solver/arc_agi/llm.py:57-154`

```python
async def llm(
    model: str,
    message: str,
    temperature,
    request_timeout: int | None,
    max_remaining_time: float | None,
    max_remaining_timeouts: int | None,
    problem_id: str | None = None,
    retries: int = RETRIES,
    **kwargs,
) -> tuple[str, float, float | None, int | None]:
    # ... API call logic ...

    return (
        resp["choices"][0]["message"]["content"].strip(),  # Response text
        duration,                                          # Time elapsed
        max_remaining_time,                               # Time budget remaining
        max_remaining_timeouts,                           # Timeout budget remaining
    )
```

**What Poetiq DOES track:**
- ✅ API response content
- ✅ Execution duration (seconds)
- ✅ Remaining time budget
- ✅ Remaining timeout budget

**What Poetiq DOES NOT track:**
- ❌ Token counts (input/output/reasoning)
- ❌ Cost per API call
- ❌ Aggregate costs
- ❌ Token usage validation

### Cost Attribution: **Provider Dashboards**

According to the Poetiq team member you spoke with, they rely on **provider dashboards** (OpenAI, Google, Anthropic billing consoles) to track costs retrospectively.

**Implications:**
1. **No real-time cost visibility** during solver execution
2. **No per-puzzle cost attribution** in their data
3. **No programmatic verification** of cost claims
4. **Manual cost aggregation** required after runs complete

---

## Critical Differences for Auditing

| Aspect | ARC-AGI Framework | Poetiq Solver |
|--------|------------------|---------------|
| **Token Capture** | Every API response | None |
| **Cost Calculation** | Immediate, per-call | None (manual post-hoc) |
| **Storage** | Embedded in result JSON | None |
| **Validation** | Token mismatch detection | None |
| **Pricing Source** | Centralized config (`models.yml`) | None (dashboard billing) |
| **Retroactive Updates** | Built-in utility script | N/A |
| **Per-Puzzle Costs** | ✅ Fully attributed | ❌ Requires manual mapping |
| **Reasoning Token Tracking** | ✅ Explicit handling | ❌ Not tracked |

---

## Problems with Poetiq's Approach for Pareto Frontier Claims

The **Pareto Frontier** analysis in Poetiq's blog post claims to show optimal **cost-vs-performance** tradeoffs across different model configurations:

> "Poetiq's systems redraw the Pareto frontier for cost versus performance, delivering better results for lower cost at every level."

**However:**

### 1. **No Verifiable Per-Puzzle Costs**
- The blog claims **$0.90 per problem** for their solver using visual approach (from your earlier reading of `solver/README.md`)
- **Where does this number come from?** Not their code.
- Without programmatic cost tracking, these claims cannot be independently verified

### 2. **Dashboard Attribution is Ambiguous**
- Provider dashboards show **aggregate costs across all API usage**
- How do they attribute costs to specific puzzles?
- How do they separate costs from:
  - Multiple expert runs (NUM_EXPERTS = 1, 2, 4, 8)
  - Multiple iterations (max_iterations = 10)
  - Failed vs. successful attempts
  - Development/testing vs. final benchmark runs?

### 3. **No Reasoning Token Tracking**
- O1/O3/GPT-5 models have **separate reasoning token pricing**
- ARC-AGI framework handles this explicitly
- Poetiq's dashboard approach may **under-report costs** if reasoning tokens aren't properly accounted

### 4. **Comparison to Baselines is Questionable**
Their Pareto Frontier graph compares their costs to other approaches (Berman's GPT-5 Pro, Gemini Deep Think, etc.). Without knowing:
- How they measured their own costs
- Whether they used identical pricing assumptions
- Whether reasoning tokens were properly tracked

...these comparisons are **not reproducible** by independent auditors.

---

## Recommendations for Audit Report

### Critical Questions for Poetiq Team

1. **Cost Attribution Methodology:**
   - How do you map dashboard costs to individual puzzle runs?
   - What is your process for isolating benchmark costs from dev/test costs?

2. **Multi-Expert Cost Accounting:**
   - Your configs use 1-8 parallel experts. How do you aggregate costs across experts?
   - Do you sum all expert costs, or only the "winning" expert?

3. **Reasoning Token Pricing:**
   - Did you account for separate reasoning token pricing (o1/o3/GPT-5)?
   - How did you verify reasoning tokens were billed correctly by providers?

4. **Baseline Cost Calculations:**
   - How did you calculate costs for competing approaches (Berman, Gemini Deep Think)?
   - Did you use identical pricing assumptions?

5. **Reproducibility:**
   - Can you provide detailed cost breakdowns per puzzle?
   - Can you share raw provider billing statements?

### Proposed Audit Approach

**Option A: Implement Token Tracking in Poetiq Wrapper**

Since we're already wrapping Poetiq with `server/python/poetiq_wrapper.py`, we could:

1. **Capture `response.usage` from litellm responses**
2. **Calculate costs using our `costCalculator.ts` logic**
3. **Store token/cost data in our database**
4. **Generate independent cost reports** to compare against Poetiq's claims

**Option B: Request Detailed Billing Data**

Ask Poetiq team for:
- Raw provider API logs with token counts
- Billing statements with per-API-call breakdowns
- Mapping of API call IDs to puzzle IDs

**Option C: Re-run Representative Sample**

Run a statistically significant sample (e.g., 50 puzzles) through:
- Our instrumented wrapper (captures tokens)
- Poetiq's original solver (compare costs via dashboard)
- Document any discrepancies

---

## Conclusion

The ARC-AGI benchmarking framework represents **best practices** for LLM benchmarking cost tracking:

✅ **Programmatic capture** of token usage
✅ **Immediate cost calculation** with validation
✅ **Structured storage** in result files
✅ **Centralized pricing** configuration
✅ **Retroactive update** utilities

Poetiq's reliance on **provider dashboards** creates **verification gaps**:

❌ No per-puzzle cost attribution
❌ No programmatic validation
❌ Manual aggregation required
❌ Reasoning tokens may be mis-tracked

For an independent audit of Poetiq's **Pareto Frontier claims**, we recommend **Option A**: implementing token tracking in our wrapper to generate verifiable, per-puzzle cost data.

---

## References

- **ARC-AGI Benchmarking:** `arc-agi-benchmarking/src/arc_agi_benchmarking/adapters/openai_base.py`
- **Poetiq LLM Module:** `poetiq-solver/arc_agi/llm.py`
- **Our Cost Calculator:** `server/utils/costCalculator.ts`
- **Poetiq Blog Post:** https://poetiq.ai/posts/arcagi_announcement/

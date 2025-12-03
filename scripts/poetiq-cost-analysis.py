"""
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-27
 * PURPOSE: Analyze how Poetiq calculates their "$0.90 per problem" cost claim.
 *          This script estimates token usage based on prompt sizes and typical LLM pricing.
 * SRP and DRY check: Pass - Standalone analysis script for auditing purposes.
"""

# === TOKEN ESTIMATION ===
# Rough token estimates (1 token ≈ 4 chars for English text)

# Prompt sizes from prompts.py
SOLVER_PROMPT_1_CHARS = 4166
SOLVER_PROMPT_2_CHARS = 4858
SOLVER_PROMPT_3_CHARS = 5817  # This is the one used by default
FEEDBACK_PROMPT_CHARS = 498

# Convert to tokens (rough estimate)
solver_prompt_tokens = SOLVER_PROMPT_3_CHARS / 4  # ~1454 tokens

# ARC puzzle data tokens (grids are typically 3-30x3-30, with ~3 training examples)
# Example: 10x10 grid = 100 numbers, each formatted as "0 1 2 3..." = ~300 chars
avg_puzzle_tokens = 400

# Feedback per previous solution (code + evaluation + score)
feedback_per_solution = 200  # Conservative estimate

# Code generation response (transform function + explanation)
avg_response_tokens = 800

# === CONFIGURATION FROM config.py ===
MAX_ITERATIONS = 10  # Default max iterations per expert
MAX_SOLUTIONS_IN_FEEDBACK = 5  # max_solutions config parameter

# Expert configurations from blog post:
# - Gemini-3-a: NUM_EXPERTS = 1 (fastest, lowest cost)
# - Gemini-3-b: NUM_EXPERTS = 2 (default, good balance)  
# - Gemini-3-c: NUM_EXPERTS = 8 (best accuracy, slowest)

# === MODEL PRICING (as of late 2025) ===
# These prices are from OpenRouter and direct API sources
MODEL_PRICING = {
    "gemini-3-pro-preview": {"input": 1.25, "output": 5.00},  # $/1M tokens
    "gpt-5.1": {"input": 2.50, "output": 10.00},
    "grok-4-fast": {"input": 3.00, "output": 15.00},
    "gpt-oss-120b": {"input": 0.10, "output": 0.30},  # Open weights, very cheap
    "claude-sonnet-4-5": {"input": 3.00, "output": 15.00},
}

def estimate_cost(num_experts, avg_iterations, model="gemini-3-pro-preview"):
    """Calculate estimated cost per problem for given configuration."""
    
    pricing = MODEL_PRICING[model]
    
    # First iteration: just prompt + puzzle
    first_iter_input = solver_prompt_tokens + avg_puzzle_tokens
    
    # Later iterations: add feedback (grows up to max_solutions_in_feedback)
    # Average feedback size is half of max
    avg_feedback_tokens = (MAX_SOLUTIONS_IN_FEEDBACK / 2) * feedback_per_solution
    
    # Total input tokens across all iterations
    input_per_expert = (
        first_iter_input +  # first iteration (no feedback)
        (avg_iterations - 1) * (first_iter_input + avg_feedback_tokens)  # subsequent
    )
    
    # Output tokens
    output_per_expert = avg_iterations * avg_response_tokens
    
    # Scale by number of parallel experts
    total_input = input_per_expert * num_experts
    total_output = output_per_expert * num_experts
    
    # Calculate cost
    input_cost = total_input * pricing["input"] / 1_000_000
    output_cost = total_output * pricing["output"] / 1_000_000
    total_cost = input_cost + output_cost
    
    return {
        "input_tokens": total_input,
        "output_tokens": total_output,
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": total_cost,
    }


print("=" * 70)
print("POETIQ COST ESTIMATION ANALYSIS")
print("=" * 70)
print()
print("This analysis attempts to reverse-engineer how Poetiq calculates")
print("their cost claims. Their open-source code does NOT track tokens.")
print()
print("KEY FINDING: litellm returns response._hidden_params['response_cost']")
print("but Poetiq's llm.py ignores this data completely!")
print()
print("-" * 70)
print("TOKEN ESTIMATES")
print("-" * 70)
print(f"Solver prompt template: ~{solver_prompt_tokens:.0f} tokens")
print(f"Average puzzle data: ~{avg_puzzle_tokens} tokens")
print(f"Feedback per solution: ~{feedback_per_solution} tokens")
print(f"Average response: ~{avg_response_tokens} tokens")
print()

print("-" * 70)
print("COST BY CONFIGURATION (Gemini 3 Pro Preview)")
print("-" * 70)

configs = [
    ("Gemini-3-a (1 expert, fast)", 1, 3),  # Quick solve, fewer iterations
    ("Gemini-3-b (2 experts, balanced)", 2, 5),  # Default config
    ("Gemini-3-c (8 experts, thorough)", 8, 7),  # More iterations due to complexity
]

for name, experts, avg_iters in configs:
    result = estimate_cost(experts, avg_iters)
    print(f"\n{name}:")
    print(f"  Input tokens:  {result['input_tokens']:,.0f}")
    print(f"  Output tokens: {result['output_tokens']:,.0f}")
    print(f"  Input cost:    ${result['input_cost']:.4f}")
    print(f"  Output cost:   ${result['output_cost']:.4f}")
    print(f"  TOTAL COST:    ${result['total_cost']:.4f}")

print()
print("-" * 70)
print("COST ACROSS DIFFERENT MODELS (2 experts, 5 iterations avg)")
print("-" * 70)

for model, pricing in MODEL_PRICING.items():
    result = estimate_cost(num_experts=2, avg_iterations=5, model=model)
    print(f"\n{model}:")
    print(f"  Cost: ${result['total_cost']:.4f}")

print()
print("-" * 70)
print("CONCLUSION")
print("-" * 70)
print("""
The "$0.90 per problem" claim likely comes from:

1. EXTERNAL TRACKING: They probably tracked actual API costs via:
   - Provider dashboard (Google Cloud, OpenAI billing)
   - litellm's response._hidden_params['response_cost'] (in development)
   - Manual calculation after runs

2. NOT IN OPEN-SOURCE CODE: Their public repo deliberately omits:
   - Token counting
   - Cost tracking
   - Any usage analytics

3. ESTIMATED BREAKDOWN for Gemini-3-b config with Gemini 3:
   - If avg iterations = 6-8 with 2 experts
   - Input: ~30K tokens @ $1.25/1M = $0.04
   - Output: ~10K tokens @ $5.00/1M = $0.05
   - Subtotal per solve attempt = ~$0.09
   
   But their claim of "$0.90" suggests they're using:
   - More expensive models (GPT-5.1 at $2.50/$10.00)
   - More iterations (closer to max 10)
   - Or including retry/error overhead

4. THE GPT-OSS "LESS THAN 1 CENT" CLAIM:
   - GPT-OSS-120B at $0.10/$0.30 per 1M tokens
   - With 1 expert, 3 iterations: ~$0.001 (matches their claim!)

The cost tracking is done externally, not in their published solver code.
Their claims appear plausible but are NOT verifiable from the open-source repo.
""")

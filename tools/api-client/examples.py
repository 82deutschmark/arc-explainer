#!/usr/bin/env python3
"""
ARC Explainer API Client - Usage Examples

Simple examples showing how Python researchers can contribute
analyses to the ARC Explainer encyclopedia using one-line API calls.

These examples demonstrate the effortless integration for researchers
using current SOTA models (October 2025).
"""

import sys
import os

# Add the tools directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from tools.api_client.arc_client import (
    contribute_to_arc_explainer,
    contribute_grok4_analysis,
    contribute_gpt5_analysis,
    contribute_claude_analysis,
    contribute_batch_analyses,
    get_puzzle_data
)

def example_simple_contribution():
    """Example: Simple one-line contribution."""

    print("🚀 SIMPLE ARC EXPLAINER CONTRIBUTION")
    print("=" * 50)

    # Sample analysis result (normally from your AI model)
    analysis_result = {
        "pattern_analysis": "This puzzle involves 90-degree clockwise rotation of the input grid",
        "solution_approach": "Rotate the grid and apply symmetry transformation",
        "hints": [
            "Rotate input grid 90 degrees clockwise",
            "Apply horizontal flip to complete transformation",
            "Check boundary conditions carefully"
        ],
        "confidence_score": 0.85,
        "reasoning": "Training examples show consistent rotation pattern. Test input follows same rule.",
        "python_code": """
def solve_puzzle(grid):
    # Rotate 90 degrees clockwise
    rotated = [list(row) for row in zip(*grid[::-1])]
    # Apply horizontal flip
    return [row[::-1] for row in rotated]
""",
        "test_outputs": [
            [[1, 0, 1], [0, 1, 0], [1, 0, 1]]
        ],
        "execution_time_ms": 1500,
        "token_count": 1200,
        "estimated_cost": 0.02
    }

    print("📤 Contributing to ARC Explainer...")

    try:
        result = contribute_to_arc_explainer(
            puzzle_id="3a25b0d8",
            analysis_result=analysis_result,
            model_name="grok-4-2025-10-13",
            arc_explainer_url="https://arc-explainer-staging.up.railway.app",
            arc_explainer_key="arc-explainer-public-key-2025",
            contributor_name="Dr. ARC Researcher"
        )

        print(f"✅ Contribution successful: {result['message']}")
        print(f"📊 Contribution ID: {result.get('data', {}).get('id', 'N/A')}")

    except Exception as e:
        print(f"❌ Contribution failed: {e}")
        print("💡 Check your API key and network connection")

def example_current_model_names():
    """Example: Using current October 2025 model names."""

    print("\n🔄 CURRENT MODEL NAMES (OCTOBER 2025)")
    print("=" * 50)

    current_models = {
        "OpenAI": "gpt-5-turbo-2025-10-13",
        "xAI": "grok-4-2025-10-13",
        "Anthropic": "claude-3-5-sonnet-20241022"
    }

    for provider, model in current_models.items():
        print(f"✅ {provider}: {model}")

    print("\n❌ Deprecated models to avoid:")
    print("   - gpt-4 (deprecated)")
    print("   - claude-3-opus-20240229 (old version)")
    print("   - Any model without 2025-10-13 date")

def example_model_specific_contributions():
    """Example: Model-specific contribution functions."""

    print("\n🤖 MODEL-SPECIFIC CONTRIBUTIONS")
    print("=" * 50)

    analysis_result = {
        "pattern_analysis": "Grid rotation with symmetry preservation",
        "confidence_score": 0.88,
        "python_code": "def solve(grid): return rotate_grid(grid)"
    }

    print("📝 Contributing Grok-4 analysis...")
    try:
        grok_result = contribute_grok4_analysis(
            "3a25b0d8", analysis_result,
            "https://arc-explainer-staging.up.railway.app",
            "arc-explainer-public-key-2025"
        )
        print(f"✅ Grok-4: {grok_result['message']}")
    except Exception as e:
        print(f"❌ Grok-4 failed: {e}")

    print("📝 Contributing GPT-5 analysis...")
    try:
        gpt5_result = contribute_gpt5_analysis(
            "3a25b0d8", analysis_result,
            "https://arc-explainer-staging.up.railway.app",
            "arc-explainer-public-key-2025"
        )
        print(f"✅ GPT-5: {gpt5_result['message']}")
    except Exception as e:
        print(f"❌ GPT-5 failed: {e}")

    print("📝 Contributing Claude analysis...")
    try:
        claude_result = contribute_claude_analysis(
            "3a25b0d8", analysis_result,
            "https://arc-explainer-staging.up.railway.app",
            "arc-explainer-public-key-2025"
        )
        print(f"✅ Claude: {claude_result['message']}")
    except Exception as e:
        print(f"❌ Claude failed: {e}")

def example_batch_contributions():
    """Example: Contributing multiple analyses at once."""

    print("\n📦 BATCH CONTRIBUTIONS")
    print("=" * 50)

    # Multiple puzzle analyses
    batch_analyses = {
        "3a25b0d8": {
            "pattern_analysis": "Rotation puzzle analysis",
            "confidence_score": 0.85
        },
        "2013d3e2": {
            "pattern_analysis": "Pinwheel symmetry analysis",
            "confidence_score": 0.92
        },
        "264363fd": {
            "pattern_analysis": "Flagmaker pattern completion",
            "confidence_score": 0.78
        }
    }

    print(f"📤 Contributing {len(batch_analyses)} analyses...")

    try:
        batch_result = contribute_batch_analyses(
            batch_analyses,
            "grok-4-2025-10-13",
            "https://arc-explainer-staging.up.railway.app",
            "arc-explainer-public-key-2025"
        )

        print(f"✅ Batch result: {batch_result['message']}")
        print("\n📊 Per-puzzle results:")
        for puzzle_id, result in batch_result['results'].items():
            status = "✅" if result.get('success') else "❌"
            print(f"  {status} {puzzle_id}: {result.get('message', result.get('error', 'Unknown'))}")

    except Exception as e:
        print(f"❌ Batch contribution failed: {e}")

def example_researcher_workflow():
    """Example: Complete researcher workflow."""

    print("\n🔬 RESEARCHER WORKFLOW")
    print("=" * 50)

    print("Dr. Smith wants to contribute analysis of the famous Laser puzzle:")
    print()

    print("1️⃣ Gets puzzle data from ARC Explainer:")
    print("   puzzle_data = get_puzzle_data('3a25b0d8')")
    print()

    print("2️⃣ Runs analysis with local AI model:")
    print("   result = my_ai_model.analyze(puzzle_data)")
    print()

    print("3️⃣ ONE-LINE contribution to ARC Explainer:")
    print("   status = contribute_to_arc_explainer(")
    print("       '3a25b0d8', result, 'grok-4-2025-10-13', url, api_key")
    print("   )")
    print()

    print("4️⃣ Analysis appears in ARC Explainer encyclopedia!")
    print("   - Added to Laser puzzle historical record")
    print("   - Available for other researchers to study")
    print("   - Contributes to comprehensive puzzle library")

def demonstrate_api_integration():
    """Demonstrate the complete API integration."""

    print("\n📡 COMPLETE API INTEGRATION DEMO")
    print("=" * 50)

    print("🎯 What happens when you contribute:")
    print()
    print("1. Your analysis gets sent to ARC Explainer API")
    print("2. ARC Explainer validates and stores the analysis")
    print("3. Analysis appears on the puzzle's encyclopedia page")
    print("4. Other researchers can now study your contribution")
    print("5. Your name gets added to the contributor list")
    print()

    print("🌟 Benefits for researchers:")
    print("   ✅ Zero-friction contribution process")
    print("   ✅ No need to understand complex APIs")
    print("   ✅ Automatic integration with existing platform")
    print("   ✅ Your work becomes part of comprehensive library")

    print("\n🎯 Benefits for ARC community:")
    print("   ✅ Complete historical record of all analyses")
    print("   ✅ Current SOTA model testing")
    print("   ✅ Research collaboration around puzzles")
    print("   ✅ Living encyclopedia that grows with contributions")

if __name__ == "__main__":
    print("🚀 ARC EXPLAINER API CLIENT - USAGE EXAMPLES")
    print("=" * 60)
    print("Simple Python client for contributing analyses to ARC Explainer")
    print("One-line integration for any Python researcher!")
    print()

    try:
        example_current_model_names()
        example_simple_contribution()
        example_model_specific_contributions()
        example_batch_contributions()
        example_researcher_workflow()
        demonstrate_api_integration()

        print("\n✅ API client examples completed!")
        print("\n🎯 Key Takeaway: ONE-LINE contribution for any researcher!")
        print("   - Simple Python function calls")
        print("   - Uses existing ARC Explainer API")
        print("   - Supports current October 2025 model names")
        print("   - Zero friction for researchers")

    except Exception as e:
        print(f"\n❌ Example failed (expected without real API keys): {e}")
        print("💡 To run with real contributions:")
        print("   1. Set your ARC Explainer URL and API key")
        print("   2. Run the example functions with real data")

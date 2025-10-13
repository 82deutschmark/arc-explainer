"""
ARC Explainer API Client

Simple Python client for researchers to contribute analyses to the
ARC Explainer encyclopedia using the existing API endpoints.

This client provides effortless integration for Python researchers
to contribute their ARC puzzle analyses to the comprehensive encyclopedia.
"""

import requests
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

class ARCExplainerAPI:
    """Python client for ARC Explainer API."""

    def __init__(self, base_url: str = "https://arc-explainer-staging.up.railway.app", api_key: str = None):
        """
        Initialize ARC Explainer API client.

        Args:
            base_url: Base URL of ARC Explainer (default: staging deployment)
            api_key: API key for authentication (optional for read-only operations)
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()

        if api_key:
            self.session.headers.update({
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            })

    def get_puzzle(self, puzzle_id: str) -> Dict[str, Any]:
        """Get puzzle data from ARC Explainer."""
        response = self.session.get(f"{self.base_url}/api/puzzle/task/{puzzle_id}")
        response.raise_for_status()
        return response.json()

    def get_puzzle_explanations(self, puzzle_id: str) -> Dict[str, Any]:
        """Get all explanations for a puzzle."""
        response = self.session.get(f"{self.base_url}/api/puzzle/{puzzle_id}/explanations")
        response.raise_for_status()
        return response.json()

    def contribute_analysis(self, puzzle_id: str, analysis_result: Dict[str, Any],
                          model_name: str, contributor_name: str = "Python Researcher") -> Dict[str, Any]:
        """
        Contribute an analysis to ARC Explainer encyclopedia.

        Args:
            puzzle_id: ARC puzzle ID (e.g., "3a25b0d8")
            analysis_result: Analysis result from AI model
            model_name: Model name (e.g., "grok-4-2025-10-13")
            contributor_name: Name for attribution

        Returns:
            API response confirming contribution
        """
        # Format contribution data for ARC Explainer API
        contribution_data = {
            "puzzle_id": puzzle_id,
            "model_name": model_name,
            "contributor_name": contributor_name,
            "pattern_description": analysis_result.get("pattern_analysis", ""),
            "solving_strategy": analysis_result.get("solution_approach", ""),
            "hints": analysis_result.get("hints", []),
            "confidence": analysis_result.get("confidence_score", 0.0),
            "reasoning_log": analysis_result.get("reasoning", ""),
            "generated_code": analysis_result.get("python_code", ""),
            "predicted_output_grid": self._extract_predicted_output(analysis_result),
            "input_tokens": analysis_result.get("token_count", 0),
            "output_tokens": 0,  # Would need to calculate from response
            "total_tokens": analysis_result.get("token_count", 0),
            "estimated_cost": analysis_result.get("estimated_cost", 0.0),
            "api_processing_time_ms": analysis_result.get("execution_time_ms", 0)
        }

        response = self.session.post(
            f"{self.base_url}/api/puzzle/save-explained/{puzzle_id}",
            json=contribution_data
        )
        response.raise_for_status()
        return response.json()

    def _extract_predicted_output(self, analysis_result: Dict[str, Any]) -> List[List[int]]:
        """Extract predicted output grid from analysis result."""
        test_outputs = analysis_result.get("test_outputs", [])
        if test_outputs and len(test_outputs) > 0:
            return test_outputs[0]
        return []

# Convenience functions for one-line integration
def contribute_to_arc_explainer(puzzle_id: str, analysis_result: Dict[str, Any],
                              model_name: str, arc_explainer_url: str = "https://arc-explainer-staging.up.railway.app",
                              arc_explainer_key: str = None,
                              contributor_name: str = "Python Researcher") -> Dict[str, Any]:
    """
    One-line function to contribute analysis to ARC Explainer encyclopedia.

    Args:
        puzzle_id: ARC puzzle ID (e.g., "3a25b0d8")
        analysis_result: Analysis result from AI model
        model_name: Model name (e.g., "grok-4-2025-10-13")
        arc_explainer_url: ARC Explainer URL (default: staging)
        arc_explainer_key: API key for authentication
        contributor_name: Your name for attribution

    Returns:
        API response

    Example:
        >>> result = contribute_to_arc_explainer(
        ...     "3a25b0d8", analysis_result, "grok-4-2025-10-13",
        ...     "https://arc-explainer-staging.up.railway.app", "your-api-key"
        ... )
    """
    client = ARCExplainerAPI(arc_explainer_url, arc_explainer_key)
    return client.contribute_analysis(puzzle_id, analysis_result, model_name, contributor_name)

def get_puzzle_data(puzzle_id: str, arc_explainer_url: str = "https://arc-explainer-staging.up.railway.app",
                   arc_explainer_key: str = None) -> Dict[str, Any]:
    """Get puzzle data from ARC Explainer."""
    client = ARCExplainerAPI(arc_explainer_url, arc_explainer_key)
    return client.get_puzzle(puzzle_id)

# Model-specific convenience functions (October 2025 models)
def contribute_grok4_analysis(puzzle_id: str, analysis_result: Dict[str, Any],
                             arc_explainer_url: str = "https://arc-explainer-staging.up.railway.app",
                             arc_explainer_key: str = None,
                             contributor_name: str = "Grok-4 Researcher") -> Dict[str, Any]:
    """Contribute Grok-4 analysis using current model name."""
    model_name = "grok-4-2025-10-13"  # Current October 2025 model
    return contribute_to_arc_explainer(puzzle_id, analysis_result, model_name,
                                     arc_explainer_url, arc_explainer_key, contributor_name)

def contribute_gpt5_analysis(puzzle_id: str, analysis_result: Dict[str, Any],
                            arc_explainer_url: str = "https://arc-explainer-staging.up.railway.app",
                            arc_explainer_key: str = None,
                            contributor_name: str = "GPT-5 Researcher") -> Dict[str, Any]:
    """Contribute GPT-5 analysis using current model name."""
    model_name = "gpt-5-turbo-2025-10-13"  # Current October 2025 model
    return contribute_to_arc_explainer(puzzle_id, analysis_result, model_name,
                                     arc_explainer_url, arc_explainer_key, contributor_name)

def contribute_claude_analysis(puzzle_id: str, analysis_result: Dict[str, Any],
                              arc_explainer_url: str = "https://arc-explainer-staging.up.railway.app",
                              arc_explainer_key: str = None,
                              contributor_name: str = "Claude Researcher") -> Dict[str, Any]:
    """Contribute Claude analysis using current model name."""
    model_name = "claude-3-5-sonnet-20241022"  # Current October 2025 model
    return contribute_to_arc_explainer(puzzle_id, analysis_result, model_name,
                                     arc_explainer_url, arc_explainer_key, contributor_name)

# Batch processing for multiple puzzles
def contribute_batch_analyses(puzzle_analyses: Dict[str, Dict[str, Any]],
                             model_name: str,
                             arc_explainer_url: str = "https://arc-explainer-staging.up.railway.app",
                             arc_explainer_key: str = None,
                             contributor_name: str = "Batch Researcher") -> Dict[str, Any]:
    """
    Contribute analyses for multiple puzzles.

    Args:
        puzzle_analyses: Dict of {puzzle_id: analysis_result}
        model_name: Model name (e.g., "grok-4-2025-10-13")
        arc_explainer_url: ARC Explainer URL
        arc_explainer_key: API key
        contributor_name: Name for attribution

    Returns:
        Dict with results for each puzzle
    """
    results = {}

    for puzzle_id, analysis_result in puzzle_analyses.items():
        try:
            result = contribute_to_arc_explainer(
                puzzle_id, analysis_result, model_name,
                arc_explainer_url, arc_explainer_key, contributor_name
            )
            results[puzzle_id] = result
        except Exception as e:
            results[puzzle_id] = {"success": False, "error": str(e)}

    successful = sum(1 for r in results.values() if r.get("success", False))
    total = len(results)

    return {
        "status": "completed",
        "message": f"Contributed {successful}/{total} analyses to encyclopedia",
        "results": results
    }

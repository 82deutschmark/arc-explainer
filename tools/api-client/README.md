# ARC Explainer API Client

**Simple Python client for researchers to contribute analyses to the ARC Explainer encyclopedia.**

## 🎯 Overview

This API client enables Python researchers to effortlessly contribute their ARC puzzle analyses to the comprehensive ARC Explainer encyclopedia using the existing platform API.

**Key Features:**
- ✅ **One-line integration** for any Python researcher
- ✅ **Current model support** (October 2025 model names)
- ✅ **Existing API integration** (uses `POST /api/puzzle/save-explained/:puzzleId`)
- ✅ **Zero external dependencies** (only requires `requests`)
- ✅ **Batch processing** for multiple puzzles
- ✅ **Proper error handling** and validation

## 🚀 Quick Start

### One-Line Contribution
```python
from arc_client import contribute_to_arc_explainer

# Contribute analysis to encyclopedia
result = contribute_to_arc_explainer(
    "3a25b0d8",                    # Puzzle ID
    analysis_result,               # Your analysis data
    "grok-4-2025-10-13",          # Current model name
    "https://arc-explainer-staging.up.railway.app",  # Platform URL
    "your-api-key"                # Your API key
)

print(result["message"])  # "Analysis contributed successfully"
```

### Model-Specific Functions
```python
from arc_client import contribute_grok4_analysis, contribute_gpt5_analysis

# One-line for specific models (uses current Oct 2025 names)
grok_result = contribute_grok4_analysis("3a25b0d8", analysis, url, api_key)
gpt5_result = contribute_gpt5_analysis("3a25b0d8", analysis, url, api_key)
claude_result = contribute_claude_analysis("3a25b0d8", analysis, url, api_key)
```

## 🔐 Authentication

**API Key Required** for contributions (read-only endpoints are open).

### Available API Keys
- `arc-explainer-public-key-2025` - Public access for researchers
- `researcher-access-key-001` - Researcher access key
- `demo-api-key-for-researchers` - Demo key for testing

### Authentication Header
```python
import requests

# API key goes in Authorization header
headers = {
    "Authorization": "Bearer your-api-key-here",
    "Content-Type": "application/json"
}
```

## 📋 API Reference

### Core Functions

#### `contribute_to_arc_explainer(puzzle_id, analysis_result, model_name, arc_explainer_url, arc_explainer_key, contributor_name="Python Researcher")`
**Main contribution function.**

**Parameters:**
- `puzzle_id` (str): ARC puzzle ID (e.g., "3a25b0d8")
- `analysis_result` (dict): Analysis from AI model
- `model_name` (str): Model name (e.g., "grok-4-2025-10-13")
- `arc_explainer_url` (str): ARC Explainer URL
- `arc_explainer_key` (str): API key for authentication
- `contributor_name` (str): Your name for attribution

**Returns:** API response dict

#### `get_puzzle_data(puzzle_id, arc_explainer_url, arc_explainer_key=None)`
**Get puzzle data from ARC Explainer.**

### Model-Specific Functions

#### `contribute_grok4_analysis(puzzle_id, analysis_result, arc_explainer_url, arc_explainer_key, contributor_name="Grok-4 Researcher")`
**Contribute using current Grok-4 model name.**

#### `contribute_gpt5_analysis(puzzle_id, analysis_result, arc_explainer_url, arc_explainer_key, contributor_name="GPT-5 Researcher")`
**Contribute using current GPT-5 model name.**

#### `contribute_claude_analysis(puzzle_id, analysis_result, arc_explainer_url, arc_explainer_key, contributor_name="Claude Researcher")`
**Contribute using current Claude model name.**

### Batch Processing

#### `contribute_batch_analyses(puzzle_analyses, model_name, arc_explainer_url, arc_explainer_key, contributor_name="Batch Researcher")`
**Contribute multiple analyses at once.**

## 🔄 Current Model Names (October 2025)

| Provider | Model Name | Status |
|----------|------------|--------|
| OpenAI | `gpt-5-turbo-2025-10-13` | ✅ Current |
| OpenAI | `gpt-4-turbo-2025-10-13` | ✅ Current |
| OpenAI | `gpt-4o-2025-10-13` | ✅ Current |
| xAI | `grok-4-2025-10-13` | ✅ Current |
| xAI | `grok-4-fast-2025-10-13` | ✅ Current |
| xAI | `grok-3-2025-10-13` | ✅ Current |
| Anthropic | `claude-3-5-sonnet-20241022` | ✅ Current |
| Anthropic | `claude-3-5-haiku-20241022` | ✅ Current |
| Anthropic | `claude-3-opus-20241022` | ✅ Current |

## 📊 Data Format

### Required Analysis Fields
```python
analysis_result = {
    "pattern_analysis": "Description of the transformation pattern",
    "solution_approach": "How to approach solving this puzzle",
    "hints": ["hint1", "hint2", "hint3"],
    "confidence_score": 0.85,  # 0.0 to 1.0
    "reasoning": "Step-by-step reasoning process",
    "python_code": "def solve_grid(grid): return transformed_grid",
    "test_outputs": [[[output_grid]]]  # Predicted output grids
}
```

### Optional Fields
```python
analysis_result = {
    "execution_time_ms": 1500,      # Execution time in milliseconds
    "token_count": 1200,           # Token usage
    "estimated_cost": 0.02         # Estimated cost in USD
}
```

## 🎯 Usage Examples

### Individual Contribution
```python
from arc_client import contribute_to_arc_explainer

# Your analysis result
analysis = {
    "pattern_analysis": "90-degree clockwise rotation pattern",
    "confidence_score": 0.85,
    "python_code": "def solve(grid): return [row[::-1] for row in zip(*grid[::-1])]"
}

# One-line contribution
result = contribute_to_arc_explainer(
    "3a25b0d8", analysis, "grok-4-2025-10-13",
    "https://arc-explainer-staging.up.railway.app",
    "arc-explainer-public-key-2025"
)
```

### Batch Processing
```python
from arc_client import contribute_batch_analyses

# Multiple analyses
batch_analyses = {
    "3a25b0d8": laser_analysis,
    "2013d3e2": pinwheel_analysis,
    "264363fd": flagmaker_analysis
}

# Batch contribution
batch_result = contribute_batch_analyses(
    batch_analyses, "gpt-5-turbo-2025-10-13",
    "https://arc-explainer-staging.up.railway.app",
    "your-api-key"
)
```

### Integration with AI Frameworks
```python
class MyAIModel:
    def analyze_and_contribute(self, puzzle_id):
        # Run your analysis
        result = self.analyze_puzzle(puzzle_id)

        # One-line contribution
        return contribute_to_arc_explainer(
            puzzle_id, result, self.model_name,
            self.explainer_url, self.api_key
        )
```

## 🔧 Installation

### Option 1: Copy to Your Project
```bash
# Copy the client file
cp tools/api-client/arc_client.py your_project/
```

### Option 2: Install as Package
```bash
pip install requests  # Only dependency needed
```

## 🚨 Error Handling

### Common Errors

#### Authentication Errors
```python
# Error: Invalid API key
{
    "success": false,
    "error": "Invalid API key",
    "details": "API key not recognized"
}

# Fix: Use valid API key
result = contribute_to_arc_explainer(
    puzzle_id, analysis, model, url, "arc-explainer-public-key-2025"
)
```

#### Network Errors
```python
# Error: Connection failed
try:
    result = contribute_to_arc_explainer(...)
except requests.exceptions.RequestException as e:
    print(f"Network error: {e}")
```

#### Data Validation Errors
```python
# Error: Invalid data format
{
    "success": false,
    "error": "Validation failed",
    "details": "Missing required field: pattern_analysis"
}

# Fix: Ensure all required fields are present
analysis_result = {
    "pattern_analysis": "Your analysis...",
    "confidence_score": 0.85,
    # ... other required fields
}
```

## 📈 Best Practices

### For Individual Researchers
1. **Use current model names** (October 2025 versions)
2. **Include complete analysis** (pattern, approach, code, confidence)
3. **Test locally first** before contributing
4. **Use descriptive contributor names** for attribution

### For Research Teams
1. **Batch process** multiple puzzles efficiently
2. **Coordinate API key usage** to avoid conflicts
3. **Monitor contribution success** rates
4. **Document your research methodology**

### For Tool Developers
1. **Integrate seamlessly** into existing workflows
2. **Handle errors gracefully** with user feedback
3. **Cache puzzle data** to reduce API calls
4. **Support both authenticated and anonymous modes**

## 🔍 Troubleshooting

### "Invalid API key" Error
- Ensure you're using a valid API key from the list above
- Check that the key is correctly formatted in the Authorization header

### "Puzzle not found" Error
- Verify the puzzle ID is correct (e.g., "3a25b0d8")
- Check if the puzzle exists in the ARC dataset

### "Analysis failed validation" Error
- Ensure all required fields are present in `analysis_result`
- Check that confidence_score is between 0.0 and 1.0

### Network Connection Issues
- Verify the ARC Explainer URL is accessible
- Check your internet connection
- Try again with exponential backoff

## 📞 Support

### Getting Help
1. **Check this documentation** first
2. **Review the examples** in the project
3. **Test with demo API key** before using production keys

### Reporting Issues
- Document the exact error message
- Include your Python version and `requests` version
- Provide a minimal reproduction case

---

**🎯 One-Line Integration for Contributing to the ARC Puzzle Encyclopedia**

*Making research contribution effortless for Python researchers*

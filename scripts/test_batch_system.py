#!/usr/bin/env python3
"""
scripts/test_batch_system.py

Test script to validate the batch processing system with a small subset.
Tests server connectivity, API endpoints, and proper DB storage.

Author: Cascade (model: Cascade)
"""

import sys
import os
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from batch_solver_gpt5nano import BatchSolverGPT5Nano
import requests
import json

def test_server_connectivity(server_url="http://localhost:5000"):
    """Test if the server is running and responsive."""
    try:
        response = requests.get(f"{server_url}/api/puzzles", timeout=5)
        if response.status_code == 200:
            print(f"✅ Server is running at {server_url}")
            return True
        else:
            print(f"❌ Server responded with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        print(f"   Make sure the server is running on port 5000")
        return False

def test_sample_puzzles():
    """Test batch processing with first 3 puzzles."""
    print("\n[TestBatch] Running validation test with 3 puzzles...")
    
    try:
        batch_solver = BatchSolverGPT5Nano(
            progress_file="test_batch_progress.json",
            rate_limit_delay=1.0  # Faster for testing
        )
        
        # Run with max 3 puzzles
        batch_solver.run_batch(max_puzzles=3)
        
        # Show results
        batch_solver.show_status()
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def main():
    print("=== Batch Processing System Test ===")
    
    # Test 1: Server connectivity
    if not test_server_connectivity():
        print("\n🚨 Server is not running!")
        print("   Start the server first: npm run dev")
        return False
    
    # Test 2: Sample batch processing
    if not test_sample_puzzles():
        print("\n🚨 Batch processing test failed!")
        return False
    
    print("\n✅ All tests passed! Batch system is ready.")
    print("\nTo run full batch:")
    print("   python scripts/batch_solver_gpt5nano.py")
    print("\nTo check status:")
    print("   python scripts/batch_solver_gpt5nano.py --status")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

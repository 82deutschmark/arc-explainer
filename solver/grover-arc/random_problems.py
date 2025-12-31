#!/usr/bin/env python3

import os
import json
import random
import argparse
from typing import List, Set, Optional

def get_data_directories(dataset_type: Optional[str] = None) -> List[str]:
    """Get available ARC data directories."""
    base_path = "ARC-AGI-2/data"
    directories = []
    
    if dataset_type:
        full_path = os.path.join(base_path, dataset_type)
        if os.path.exists(full_path):
            directories.append(full_path)
    else:
        for subdir in ["training", "evaluation"]:
            full_path = os.path.join(base_path, subdir)
            if os.path.exists(full_path):
                directories.append(full_path)
    
    return directories

def extract_hash_from_filename(filename: str) -> str:
    """Extract hash from JSON filename."""
    return filename.replace('.json', '')

def get_all_problem_hashes(directories: List[str]) -> List[str]:
    """Get all problem hashes from given directories."""
    hashes = []
    
    for directory in directories:
        if not os.path.exists(directory):
            continue
            
        for filename in os.listdir(directory):
            if filename.endswith('.json'):
                problem_hash = extract_hash_from_filename(filename)
                hashes.append(problem_hash)
    
    return hashes

def filter_hashes(hashes: List[str], include: Optional[Set[str]], exclude: Optional[Set[str]]) -> List[str]:
    """Filter hashes based on include/exclude sets."""
    if include:
        hashes = [h for h in hashes if h in include]
    
    if exclude:
        hashes = [h for h in hashes if h not in exclude]
    
    return hashes

def find_problem_path(problem_hash: str) -> Optional[str]:
    """Find the full path for a problem hash."""
    directories = get_data_directories()
    
    for directory in directories:
        file_path = os.path.join(directory, f"{problem_hash}.json")
        if os.path.exists(file_path):
            return file_path
    
    return None

def select_random_problems(count: int, include_hashes: Optional[Set[str]] = None, 
                         exclude_hashes: Optional[Set[str]] = None,
                         dataset_type: Optional[str] = None) -> List[str]:
    """Select random problem file paths."""
    # Get all hashes from all datasets for include validation
    all_directories = get_data_directories()
    all_hashes_global = get_all_problem_hashes(all_directories)
    
    # Get hashes from specified dataset for random selection
    dataset_directories = get_data_directories(dataset_type)
    dataset_hashes = get_all_problem_hashes(dataset_directories)
    
    selected_hashes = []
    
    # Always include specified hashes first (search globally)
    if include_hashes:
        # Validate that included hashes exist anywhere
        valid_includes = [h for h in include_hashes if h in all_hashes_global]
        selected_hashes.extend(valid_includes)
        
        # If we need more problems, select randomly from dataset-specific hashes
        remaining_count = count - len(valid_includes)
        if remaining_count > 0:
            # Get dataset hashes excluding the ones we already selected and any excluded ones
            remaining_hashes = [h for h in dataset_hashes if h not in include_hashes]
            if exclude_hashes:
                remaining_hashes = [h for h in remaining_hashes if h not in exclude_hashes]
            
            if remaining_hashes:
                additional_count = min(remaining_count, len(remaining_hashes))
                additional_hashes = random.sample(remaining_hashes, additional_count)
                selected_hashes.extend(additional_hashes)
    else:
        # No includes specified, just filter and select randomly from dataset
        filtered_hashes = filter_hashes(dataset_hashes, include_hashes, exclude_hashes)
        if filtered_hashes:
            selected_count = min(count, len(filtered_hashes))
            selected_hashes = random.sample(filtered_hashes, selected_count)
    
    if not selected_hashes:
        return []
    
    paths = []
    for problem_hash in selected_hashes:
        path = find_problem_path(problem_hash)
        if path:
            paths.append(path)
    
    return paths

def parse_hash_list(hash_string: str) -> Set[str]:
    """Parse comma-separated hash string into set."""
    if not hash_string:
        return set()
    
    hashes = [h.strip() for h in hash_string.split(',')]
    return set(h for h in hashes if h)

def validate_hash(problem_hash: str) -> bool:
    """Validate that hash is 8 character hex string."""
    return (len(problem_hash) == 8 and 
            all(c in '0123456789abcdef' for c in problem_hash.lower()))

def main():
    parser = argparse.ArgumentParser(description='Generate random ARC problem file paths')
    parser.add_argument('count', type=int, help='Number of problems to select')
    parser.add_argument('--include', type=str, help='Comma-separated list of hashes to include')
    parser.add_argument('--exclude', type=str, help='Comma-separated list of hashes to exclude')
    parser.add_argument('--seed', type=int, help='Random seed for reproducible results')
    parser.add_argument('--dataset', choices=['training', 'evaluation'], 
                       help='Select only from training or evaluation dataset')
    
    args = parser.parse_args()
    
    if args.seed is not None:
        random.seed(args.seed)
    
    include_hashes = parse_hash_list(args.include) if args.include else None
    exclude_hashes = parse_hash_list(args.exclude) if args.exclude else None
    
    if include_hashes:
        invalid_includes = [h for h in include_hashes if not validate_hash(h)]
        if invalid_includes:
            print(f"Invalid include hashes: {', '.join(invalid_includes)}")
            return
    
    if exclude_hashes:
        invalid_excludes = [h for h in exclude_hashes if not validate_hash(h)]
        if invalid_excludes:
            print(f"Invalid exclude hashes: {', '.join(invalid_excludes)}")
            return
    
    selected_paths = select_random_problems(args.count, include_hashes, exclude_hashes, args.dataset)
    
    if not selected_paths:
        print("No problems found matching criteria")
        return
    
    for path in selected_paths:
        print(path)

if __name__ == "__main__":
    main()
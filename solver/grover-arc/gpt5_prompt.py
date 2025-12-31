#!/usr/bin/env python3
"""
Simple Grok prompt interface with reasoning levels
"""

import os
import base64
from typing import Optional, List
from xai_sdk import Client
from xai_sdk.chat import user, image as xai_image


def get_client() -> Client:
    """Initialize XAI client with API key."""
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY environment variable must be set")
    return Client(api_key=api_key, timeout=6000)


def encode_image(image_path: str) -> str:
    """Encode an image file to base64."""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')


def prompt_with_images(prompt: str, image_path1: str, image_path2: str, temperature: float) -> str:
    """
    Send a prompt with two images using low reasoning.

    Args:
        prompt: Text prompt to send
        image_path1: Path to first image
        image_path2: Path to second image
        temperature: Temperature for sampling

    Returns:
        Response text from Grok
    """
    client = get_client()

    # Create chat with Grok model
    chat = client.chat.create(model="grok-4-fast-reasoning") # , temperature=temperature)

    # Convert images to base64 data URLs
    img1_base64 = f"data:image/png;base64,{encode_image(image_path1)}"
    img2_base64 = f"data:image/png;base64,{encode_image(image_path2)}"

    # Append user message with prompt and images
    chat.append(
        user(
            prompt,
            xai_image(img1_base64),
            xai_image(img2_base64)
        )
    )

    # Get response
    response = chat.sample()
    return response.content


def prompt_with_reasoning(prompt: str, reasoning_level: str, temperature: float) -> str:
    """
    Send a text prompt with specified reasoning level.

    Args:
        prompt: Text prompt to send
        reasoning_level: Either "medium" or "high"
        temperature: Temperature for sampling

    Returns:
        Response text from Grok
    """
    if reasoning_level not in ["medium", "high"]:
        raise ValueError("reasoning_level must be 'medium' or 'high'")

    client = get_client()

    # Create chat with Grok model
    chat = client.chat.create(model="grok-4-fast-reasoning") # , temperature=temperature)

    # Append user message with prompt
    chat.append(user(prompt))

    # Get response
    response = chat.sample()
    return response.content


def prompt_with_multiple_images_and_reasoning(prompt: str, image_paths: List[str], reasoning_level: str, temperature: float) -> str:
    """
    Send a prompt with multiple images using specified reasoning level.

    Args:
        prompt: Text prompt to send
        image_paths: List of paths to images
        reasoning_level: Either "medium" or "high"
        temperature: Temperature for sampling

    Returns:
        Response text from Grok
    """
    if reasoning_level not in ["medium", "high"]:
        raise ValueError("reasoning_level must be 'medium' or 'high'")

    client = get_client()

    # Create chat with Grok model
    chat = client.chat.create(model="grok-4-fast-reasoning") # , temperature=temperature)

    # Convert images to base64 data URLs
    image_objects = []
    for image_path in image_paths:
        img_base64 = f"data:image/png;base64,{encode_image(image_path)}"
        image_objects.append(xai_image(img_base64))

    # Append user message with prompt and images
    chat.append(user(prompt, *image_objects))

    # Get response
    response = chat.sample()
    return response.content


def prompt_with_image_and_reasoning(prompt: str, image_path: str, reasoning_level: str, temperature: float) -> str:
    """
    Send a prompt with one image using specified reasoning level.

    Args:
        prompt: Text prompt to send
        image_path: Path to the image
        reasoning_level: Either "medium" or "high"
        temperature: Temperature for sampling

    Returns:
        Response text from Grok
    """
    if reasoning_level not in ["medium", "high"]:
        raise ValueError("reasoning_level must be 'medium' or 'high'")

    client = get_client()

    # Create chat with Grok model
    chat = client.chat.create(model="grok-4-fast-reasoning") # , temperature=temperature)

    # Convert image to base64 data URL
    img_base64 = f"data:image/png;base64,{encode_image(image_path)}"

    # Append user message with prompt and image
    chat.append(
        user(
            prompt,
            xai_image(img_base64)
        )
    )

    # Get response
    response = chat.sample()
    return response.content


def main():
    """Example usage of the APIs."""
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  Text prompt: python grok_prompt.py <prompt> [medium|high]")
        print("  Image prompt: python grok_prompt.py --images <image1> <image2> <prompt>")
        return

    if sys.argv[1] == "--images":
        if len(sys.argv) < 5:
            print("Error: --images requires two image paths and a prompt")
            return
        result = prompt_with_images(sys.argv[4], sys.argv[2], sys.argv[3])
    else:
        prompt = sys.argv[1]
        reasoning = sys.argv[2] if len(sys.argv) > 2 else "medium"
        result = prompt_with_reasoning(prompt, reasoning)

    print(result)


if __name__ == "__main__":
    main()
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("ARC3_API_KEY")
url = "https://three.arcprize.org/api/cmd/OPEN_SCORECARD"
headers = {
    "Content-Type": "application/json",
    "x-api-key": api_key
}
payload = {
    "tags": ["testing"],
    "opaque_metadata": {"test": "true"}
}

resp = requests.post(url, headers=headers, json=payload)
print(f"Status: {resp.status_code}")
print(f"Body: {resp.text}")

#!/usr/bin/env python
import requests
import json

api_key = 'sk_1fa574d07736f4b13cc861985064ff00509b4d3eacd04982'
headers = {'xi-api-key': api_key}

print("[*] Fetching available ElevenLabs voices...")
response = requests.get('https://api.elevenlabs.io/v1/voices', headers=headers)

if response.status_code != 200:
    print(f"Error: {response.status_code} - {response.text}")
    exit(1)

voices = response.json()
print(f"\nTotal voices available: {len(voices['voices'])}\n")
print("All Available Voices:")
print("-" * 70)

for voice in voices['voices']:
    print(f"Name: {voice['name']}")
    print(f"  Voice ID: {voice['voice_id']}")
    print(f"  Category: {voice.get('category', 'N/A')}")
    print(f"  Labels: {voice.get('labels', {})}")
    print()

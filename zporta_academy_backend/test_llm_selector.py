#!/usr/bin/env python
"""
Quick test to verify the LLM Model Selector is working correctly.
Run this in the Django shell.
"""

import json
from django.test import Client
from django.contrib.auth import get_user_model

# Create a test client
client = Client()

# Get admin user (or create one)
User = get_user_model()
admin_user = User.objects.filter(is_staff=True, is_superuser=True).first()

if not admin_user:
    print("❌ No admin user found. Create one first.")
    exit(1)

# Log in
print(f"🔐 Logging in as {admin_user.username}...")
client.login(username=admin_user.username, password='your_password')  # You'll need to replace this

# Test the AJAX endpoint
print("\n📡 Testing AJAX endpoint...")

providers = ['openai', 'gemini', 'claude', 'template']

for provider in providers:
    url = f'/admin/dailycast/usercategoryconfig/llm-models/?provider={provider}'
    print(f"\n  Testing: {url}")
    
    response = client.get(url)
    
    print(f"  Status: {response.status_code}")
    
    if response.status_code == 200:
        try:
            data = response.json()
            print(f"  ✅ Success! Got {len(data.get('models', []))} models:")
            for model in data.get('models', []):
                print(f"     - {model['value']}: {model['label']}")
        except json.JSONDecodeError as e:
            print(f"  ❌ Error parsing JSON: {e}")
            print(f"  Response: {response.content[:200]}")
    else:
        print(f"  ❌ Error: {response.status_code}")
        print(f"  Content: {response.content[:200]}")

print("\n✅ Test complete!")

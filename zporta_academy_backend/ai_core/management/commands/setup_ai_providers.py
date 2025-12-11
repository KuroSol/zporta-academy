"""
Management command to populate AI provider configurations.

Usage:
    python manage.py setup_ai_providers
"""

from django.core.management.base import BaseCommand
from ai_core.models import AiProviderConfig


class Command(BaseCommand):
    help = 'Set up initial AI provider configurations with cost and quality data'

    def handle(self, *args, **options):
        self.stdout.write('Setting up AI Provider Configurations...\n')
        
        providers = [
            # ===== OPENAI =====
            {
                'provider': 'openai',
                'model_name': 'gpt-4o-mini',
                'tier': 'cheap',
                'cost_per_million_tokens': 0.15,
                'avg_latency_ms': 800,
                'quality_score': 0.85,
                'is_active': True,
                'is_default': True,
                'max_tokens': 128000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh'],
                    'output_formats': ['text', 'json', 'structured']
                },
                'notes': 'Fast and cost-effective, great for most content'
            },
            {
                'provider': 'openai',
                'model_name': 'gpt-4o',
                'tier': 'normal',
                'cost_per_million_tokens': 2.50,
                'avg_latency_ms': 1200,
                'quality_score': 0.95,
                'is_active': True,
                'is_default': True,
                'max_tokens': 128000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh'],
                    'output_formats': ['text', 'json', 'structured', 'multimodal']
                },
                'notes': 'Balanced cost and quality for important content'
            },
            {
                'provider': 'openai',
                'model_name': 'gpt-4-turbo',
                'tier': 'premium',
                'cost_per_million_tokens': 10.00,
                'avg_latency_ms': 2000,
                'quality_score': 0.98,
                'is_active': True,
                'is_default': False,
                'max_tokens': 128000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh'],
                    'output_formats': ['text', 'json', 'structured', 'multimodal']
                },
                'notes': 'Premium quality for complex reasoning'
            },
            
            # ===== GOOGLE GEMINI =====
            {
                'provider': 'gemini',
                'model_name': 'gemini-1.5-flash',
                'tier': 'cheap',
                'cost_per_million_tokens': 0.075,
                'avg_latency_ms': 600,
                'quality_score': 0.82,
                'is_active': True,
                'is_default': False,
                'max_tokens': 1000000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh'],
                    'output_formats': ['text', 'json']
                },
                'notes': 'Cheapest option, very fast, good for simple content'
            },
            {
                'provider': 'gemini',
                'model_name': 'gemini-1.5-pro',
                'tier': 'normal',
                'cost_per_million_tokens': 1.25,
                'avg_latency_ms': 1000,
                'quality_score': 0.92,
                'is_active': True,
                'is_default': False,
                'max_tokens': 2000000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh'],
                    'output_formats': ['text', 'json', 'multimodal']
                },
                'notes': 'Great for multilingual and long context'
            },
            {
                'provider': 'gemini',
                'model_name': 'gemini-2.0-pro-exp',
                'tier': 'premium',
                'cost_per_million_tokens': 3.50,
                'avg_latency_ms': 1500,
                'quality_score': 0.96,
                'is_active': True,
                'is_default': False,
                'max_tokens': 2000000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh'],
                    'output_formats': ['text', 'json', 'structured', 'multimodal']
                },
                'notes': 'Latest Gemini, experimental, best quality'
            },
            
            # ===== ANTHROPIC CLAUDE =====
            {
                'provider': 'claude',
                'model_name': 'claude-3-haiku',
                'tier': 'cheap',
                'cost_per_million_tokens': 0.25,
                'avg_latency_ms': 700,
                'quality_score': 0.83,
                'is_active': True,
                'is_default': False,
                'max_tokens': 200000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt'],
                    'output_formats': ['text', 'json']
                },
                'notes': 'Fast Claude variant, good for simple tasks'
            },
            {
                'provider': 'claude',
                'model_name': 'claude-3-sonnet',
                'tier': 'normal',
                'cost_per_million_tokens': 3.00,
                'avg_latency_ms': 1500,
                'quality_score': 0.93,
                'is_active': True,
                'is_default': False,
                'max_tokens': 200000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt'],
                    'output_formats': ['text', 'json', 'structured']
                },
                'notes': 'Balanced Claude, great for analysis and writing'
            },
            {
                'provider': 'claude',
                'model_name': 'claude-3-5-sonnet',
                'tier': 'premium',
                'cost_per_million_tokens': 15.00,
                'avg_latency_ms': 2500,
                'quality_score': 0.99,
                'is_active': True,
                'is_default': True,
                'max_tokens': 200000,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt'],
                    'output_formats': ['text', 'json', 'structured', 'code']
                },
                'notes': 'Best for long-form content, complex reasoning, coding'
            },
            
            # ===== TTS PROVIDERS =====
            {
                'provider': 'elevenlabs',
                'model_name': 'eleven_multilingual_v2',
                'tier': 'normal',
                'cost_per_request': 0.0001,  # Per character cost converted to per request
                'avg_latency_ms': 1500,
                'quality_score': 0.97,
                'is_active': True,
                'is_default': True,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh'],
                    'output_formats': ['mp3']
                },
                'notes': 'Best TTS quality, natural voices'
            },
            {
                'provider': 'google_tts',
                'model_name': 'neural2',
                'tier': 'cheap',
                'cost_per_request': 0.00004,
                'avg_latency_ms': 800,
                'quality_score': 0.85,
                'is_active': True,
                'is_default': False,
                'capabilities': {
                    'languages': ['en', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ko', 'zh'],
                    'output_formats': ['mp3']
                },
                'notes': 'Cheap TTS, good quality for most use cases'
            },
        ]
        
        created = 0
        updated = 0
        
        for config_data in providers:
            config, created_flag = AiProviderConfig.objects.update_or_create(
                provider=config_data['provider'],
                model_name=config_data['model_name'],
                defaults=config_data
            )
            
            if created_flag:
                created += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created: {config}'))
            else:
                updated += 1
                self.stdout.write(f'  → Updated: {config}')
        
        self.stdout.write(self.style.SUCCESS(f'\n✅ Setup complete!'))
        self.stdout.write(f'  Created: {created} configurations')
        self.stdout.write(f'  Updated: {updated} configurations')
        self.stdout.write(f'  Total: {created + updated} AI providers configured\n')

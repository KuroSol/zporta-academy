"""
Comprehensive AI Usage Report - All Providers & Models
Shows detailed breakdown of Gemini, OpenAI, and ElevenLabs usage
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from dailycast.models import CachedAIInsight, CacheStatistics
from django.db.models import Sum, Count
from datetime import timedelta
from django.utils import timezone

print("\n" + "=" * 100)
print("🌍 COMPREHENSIVE AI USAGE REPORT - ALL TIME")
print("=" * 100)

# Get all cache entries (historical usage by model)
all_cached = CachedAIInsight.objects.all()
all_stats = CacheStatistics.objects.all()

print(f"\n📊 TOTAL OVERVIEW")
print("-" * 100)
print(f"  • Total AI requests made: {all_stats.aggregate(Sum('ai_insights_generated'))['ai_insights_generated__sum'] or 0}")
print(f"  • Total cache hits: {all_stats.aggregate(Sum('ai_insights_cached'))['ai_insights_cached__sum'] or 0}")
print(f"  • Total tokens used: {all_stats.aggregate(Sum('ai_tokens_used'))['ai_tokens_used__sum'] or 0:,}")
print(f"  • Total tokens saved: {all_stats.aggregate(Sum('ai_tokens_saved'))['ai_tokens_saved__sum'] or 0:,}")
print(f"  • Total cost: ${(all_stats.aggregate(Sum('cost_usd_cents'))['cost_usd_cents__sum'] or 0) / 100:.4f}")
print(f"  • Total saved: ${(all_stats.aggregate(Sum('cost_saved_cents'))['cost_saved_cents__sum'] or 0) / 100:.4f}")

# ============================================================================
# BREAKDOWN BY PROVIDER
# ============================================================================
print("\n" + "=" * 100)
print("🏢 USAGE BY PROVIDER")
print("=" * 100)

# Categorize models by provider
gemini_models = ['gemini-2.0-flash-exp', 'gemini-2.0-pro-exp', 'gemini-1.5-pro']
openai_models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']

gemini_requests = all_cached.filter(engine__in=gemini_models)
openai_requests = all_cached.filter(engine__in=openai_models)

gemini_tokens = sum(r.tokens_used for r in gemini_requests)
openai_tokens = sum(r.tokens_used for r in openai_requests)

# Calculate costs by provider
gemini_cost = 0
openai_cost = 0

for req in gemini_requests:
    gemini_cost += CacheStatistics.estimate_cost(req.tokens_used, req.engine)

for req in openai_requests:
    openai_cost += CacheStatistics.estimate_cost(req.tokens_used, req.engine)

print(f"\n1️⃣  GOOGLE GEMINI")
print(f"   • Total requests: {gemini_requests.count()}")
print(f"   • Total tokens: {gemini_tokens:,}")
print(f"   • Total cost: ${gemini_cost / 100:.4f}")
print(f"   • Cache hits: {sum(r.hits for r in gemini_requests)}")

print(f"\n2️⃣  OPENAI (GPT)")
print(f"   • Total requests: {openai_requests.count()}")
print(f"   • Total tokens: {openai_tokens:,}")
print(f"   • Total cost: ${openai_cost / 100:.4f}")
print(f"   • Cache hits: {sum(r.hits for r in openai_requests)}")

print(f"\n3️⃣  ELEVENLABS (Audio)")
print(f"   • Feature available but not yet tracked")
print(f"   • Will be added in future update")

# ============================================================================
# BREAKDOWN BY MODEL
# ============================================================================
print("\n" + "=" * 100)
print("🤖 USAGE BY AI MODEL")
print("=" * 100)

from django.db.models import Sum as DjangoSum
model_usage = all_cached.values('engine').annotate(
    total_requests=Count('id'),
    total_tokens=DjangoSum('tokens_used'),
    total_hits=DjangoSum('hits')
).order_by('-total_tokens')

if model_usage:
    print(f"\n{'Model':<30} {'Requests':<12} {'Tokens':<15} {'Cache Hits':<12} {'Est. Cost':<12}")
    print("-" * 100)
    
    for model in model_usage:
        tokens = model['total_tokens'] or 0
        cost_cents = CacheStatistics.estimate_cost(tokens, model['engine'])
        
        print(f"{model['engine']:<30} "
              f"{model['total_requests']:<12} "
              f"{tokens:>14,} "
              f"{model['total_hits']:<12} "
              f"${cost_cents/100:>10.4f}")
else:
    print("\n⚠️  No model usage data available yet")

# ============================================================================
# DAILY BREAKDOWN
# ============================================================================
print("\n" + "=" * 100)
print("📅 DAILY USAGE BREAKDOWN")
print("=" * 100)

daily_stats = CacheStatistics.objects.all().order_by('-date')

if daily_stats.exists():
    print(f"\n{'Date':<15} {'Requests':<10} {'Cache Hits':<12} {'Tokens Used':<15} {'Cost':<12} {'Saved':<12}")
    print("-" * 100)
    
    for stat in daily_stats:
        print(f"{stat.date.strftime('%Y-%m-%d'):<15} "
              f"{stat.ai_insights_generated:<10} "
              f"{stat.ai_insights_cached:<12} "
              f"{stat.ai_tokens_used:>14,} "
              f"${stat.cost_usd():>10.4f} "
              f"${stat.cost_saved_usd():>10.4f}")

# ============================================================================
# USER BREAKDOWN
# ============================================================================
print("\n" + "=" * 100)
print("👥 USAGE BY USER")
print("=" * 100)

from django.db.models import Count as DjangoCount
user_usage = all_cached.values('user__username', 'user__email').annotate(
    total_requests=DjangoCount('id'),
    total_tokens=DjangoSum('tokens_used'),
    total_hits=DjangoSum('hits')
).order_by('-total_tokens')

if user_usage:
    print(f"\n{'User':<25} {'Email':<30} {'Requests':<10} {'Tokens':<15} {'Cache Hits':<10}")
    print("-" * 100)
    
    for user in user_usage:
        print(f"{user['user__username']:<25} "
              f"{user['user__email']:<30} "
              f"{user['total_requests']:<10} "
              f"{user['total_tokens'] or 0:>14,} "
              f"{user['total_hits']:<10}")

# ============================================================================
# CACHE EFFICIENCY
# ============================================================================
print("\n" + "=" * 100)
print("⚡ CACHE EFFICIENCY ANALYSIS")
print("=" * 100)

total_generated = all_stats.aggregate(Sum('ai_insights_generated'))['ai_insights_generated__sum'] or 0
total_cached = all_stats.aggregate(Sum('ai_insights_cached'))['ai_insights_cached__sum'] or 0
total_requests = total_generated + total_cached

if total_requests > 0:
    cache_hit_rate = (total_cached / total_requests) * 100
    print(f"\n📊 Cache Performance:")
    print(f"   • Total requests: {total_requests}")
    print(f"   • Served from cache: {total_cached} ({cache_hit_rate:.1f}%)")
    print(f"   • New API calls: {total_generated} ({(total_generated/total_requests)*100:.1f}%)")
    
    total_cost = (all_stats.aggregate(Sum('cost_usd_cents'))['cost_usd_cents__sum'] or 0) / 100
    total_saved = (all_stats.aggregate(Sum('cost_saved_cents'))['cost_saved_cents__sum'] or 0) / 100
    potential_cost = total_cost + total_saved
    
    if potential_cost > 0:
        savings_percentage = (total_saved / potential_cost) * 100
        print(f"\n💰 Cost Savings:")
        print(f"   • Actual cost: ${total_cost:.4f}")
        print(f"   • Cost saved by caching: ${total_saved:.4f}")
        print(f"   • Without cache would cost: ${potential_cost:.4f}")
        print(f"   • Savings: {savings_percentage:.1f}%")

# ============================================================================
# RECENT ACTIVITY
# ============================================================================
print("\n" + "=" * 100)
print("🕐 RECENT ACTIVITY (Last 10 Requests)")
print("=" * 100)

recent = all_cached.order_by('-created_at')[:10]

if recent.exists():
    print(f"\n{'Date/Time':<20} {'User':<20} {'Model':<25} {'Subject':<15} {'Tokens':<10} {'Hits':<6}")
    print("-" * 100)
    
    for req in recent:
        print(f"{req.created_at.strftime('%Y-%m-%d %H:%M'):<20} "
              f"{req.user.username:<20} "
              f"{req.engine:<25} "
              f"{(req.subject or 'All'):<15} "
              f"{req.tokens_used:>9,} "
              f"{req.hits:>5}")

print("\n" + "=" * 100)
print("✅ REPORT COMPLETE")
print("=" * 100)
print("\n💡 TIP: This shows all AI usage across all providers.")
print("   For real-time costs, check: http://127.0.0.1:8000/administration-zporta-repersentiivie/dailycast/cachestatistics/")
print("\n")

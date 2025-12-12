"""
Calculate historical API costs from past 3 days of usage.
Shows what you would have paid if using paid tier.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from dailycast.models import CacheStatistics, CachedAIInsight
from django.db.models import Sum
from datetime import datetime, timedelta

print("=" * 80)
print("🔍 ANALYZING YOUR API USAGE (Last 7 Days)")
print("=" * 80)

# Get all cache statistics from the last 7 days
from django.utils import timezone
seven_days_ago = timezone.now().date() - timedelta(days=7)
stats = CacheStatistics.objects.filter(date__gte=seven_days_ago).order_by('date')

total_tokens_used = 0
total_tokens_saved = 0
total_cost_if_paid = 0
total_savings = 0

print("\n📊 DAILY BREAKDOWN:\n")
print(f"{'Date':<12} {'AI Calls':<10} {'Cache Hits':<12} {'Tokens Used':<15} {'Tokens Saved':<15} {'Est. Cost':<12}")
print("-" * 90)

for stat in stats:
    # Estimate cost assuming gpt-4o-mini (cheapest option)
    # $0.15 per 1M input + $0.60 per 1M output tokens
    # Assuming 60% input, 40% output
    tokens_used = stat.ai_tokens_used
    tokens_saved = stat.ai_tokens_saved
    
    if tokens_used > 0:
        input_tokens = tokens_used * 0.6
        output_tokens = tokens_used * 0.4
        cost = (input_tokens / 1_000_000 * 0.15) + (output_tokens / 1_000_000 * 0.60)
    else:
        cost = 0
    
    if tokens_saved > 0:
        input_saved = tokens_saved * 0.6
        output_saved = tokens_saved * 0.4
        savings = (input_saved / 1_000_000 * 0.15) + (output_saved / 1_000_000 * 0.60)
    else:
        savings = 0
    
    total_tokens_used += tokens_used
    total_tokens_saved += tokens_saved
    total_cost_if_paid += cost
    total_savings += savings
    
    print(f"{stat.date.strftime('%Y-%m-%d'):<12} "
          f"{stat.ai_insights_generated:<10} "
          f"{stat.ai_insights_cached:<12} "
          f"{tokens_used:>14,} "
          f"{tokens_saved:>14,} "
          f"${cost:>10.4f}")

print("-" * 90)
print(f"{'TOTAL':<12} "
      f"{stats.aggregate(Sum('ai_insights_generated'))['ai_insights_generated__sum'] or 0:<10} "
      f"{stats.aggregate(Sum('ai_insights_cached'))['ai_insights_cached__sum'] or 0:<12} "
      f"{total_tokens_used:>14,} "
      f"{total_tokens_saved:>14,} "
      f"${total_cost_if_paid:>10.4f}")

print("\n" + "=" * 80)
print("💰 COST ANALYSIS (IF YOU WERE PAYING)")
print("=" * 80)

print(f"\n📈 Total API Calls Made: {stats.aggregate(Sum('ai_insights_generated'))['ai_insights_generated__sum'] or 0}")
print(f"♻️  Cache Hits: {stats.aggregate(Sum('ai_insights_cached'))['ai_insights_cached__sum'] or 0}")
print(f"🔢 Total Tokens Used: {total_tokens_used:,}")
print(f"💾 Total Tokens Saved by Cache: {total_tokens_saved:,}")

print(f"\n💵 COST ESTIMATES:")
print(f"   • With gpt-4o-mini (cheapest):     ${total_cost_if_paid:.4f}")
print(f"   • With gpt-4o (best quality):      ${total_cost_if_paid * 16.67:.4f}")  # 16.67x more expensive
print(f"   • With gemini-2.0-flash (fastest): ${total_cost_if_paid * 0.5:.4f}")  # ~2x cheaper

print(f"\n💚 SAVINGS FROM CACHING:")
print(f"   • Saved: ${total_savings:.4f} ({total_tokens_saved:,} tokens)")
print(f"   • Without cache would cost: ${total_cost_if_paid + total_savings:.4f}")
print(f"   • Cache reduced costs by: {(total_savings/(total_cost_if_paid + total_savings)*100) if (total_cost_if_paid + total_savings) > 0 else 0:.1f}%")

# Show individual cached requests
print("\n" + "=" * 80)
print("📝 INDIVIDUAL CACHE ENTRIES (What's currently cached)")
print("=" * 80)

cached_insights = CachedAIInsight.objects.filter(expires_at__gte=timezone.now()).order_by('-created_at')[:20]

if cached_insights.exists():
    print(f"\n{'User':<20} {'Subject':<15} {'Model':<25} {'Tokens':<10} {'Hits':<6} {'Created':<20}")
    print("-" * 110)
    for cache in cached_insights:
        print(f"{cache.user.username:<20} "
              f"{(cache.subject or 'All'):<15} "
              f"{cache.engine:<25} "
              f"{cache.tokens_used:>9,} "
              f"{cache.hits:>5} "
              f"{cache.created_at.strftime('%Y-%m-%d %H:%M'):<20}")
else:
    print("\n⚠️  No active cache entries found")

print("\n" + "=" * 80)
print("✅ REPORT COMPLETE")
print("=" * 80)
print("\n💡 TIP: Your free Gemini tier is exhausted, but you can:")
print("   1. Switch to OpenAI models (already configured)")
print("   2. Upgrade Gemini to paid tier at: https://ai.google.dev/pricing")
print("   3. Use gpt-4o-mini - only $0.15/$0.60 per 1M tokens (very cheap!)")
print("\n")

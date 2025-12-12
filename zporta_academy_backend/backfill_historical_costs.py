"""
Backfill historical cost data for existing cache statistics.
Calculates costs based on tokens already tracked.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zporta.settings')
django.setup()

from dailycast.models import CacheStatistics, CachedAIInsight
from django.db.models import Q

print("=" * 80)
print("🔄 BACKFILLING HISTORICAL COSTS")
print("=" * 80)

# Get all statistics records with tokens but no cost calculated
stats_to_update = CacheStatistics.objects.filter(
    Q(ai_tokens_used__gt=0) | Q(ai_tokens_saved__gt=0)
).order_by('date')

print(f"\n📊 Found {stats_to_update.count()} records with token usage\n")

updated_count = 0
for stat in stats_to_update:
    print(f"Processing: {stat.date}")
    
    # Get all cached insights from this day to determine which models were used
    cached_on_date = CachedAIInsight.objects.filter(
        created_at__date=stat.date
    )
    
    # Determine average model used (default to gpt-4o-mini if unknown)
    if cached_on_date.exists():
        # Use the most common model from that day
        models_used = [c.engine for c in cached_on_date]
        most_common = max(set(models_used), key=models_used.count) if models_used else 'gpt-4o-mini'
        print(f"  └─ Models used: {', '.join(set(models_used))}")
        print(f"  └─ Using '{most_common}' for cost calculation")
    else:
        most_common = 'gpt-4o-mini'  # Default to cheapest
        print(f"  └─ No model info, defaulting to gpt-4o-mini")
    
    # Calculate costs for tokens used
    if stat.ai_tokens_used > 0 and stat.cost_usd_cents == 0:
        cost_cents = CacheStatistics.estimate_cost(stat.ai_tokens_used, most_common)
        stat.cost_usd_cents = cost_cents
        print(f"  └─ Tokens used: {stat.ai_tokens_used:,} → Cost: ${cost_cents/100:.4f}")
    
    # Calculate costs saved by caching
    if stat.ai_tokens_saved > 0 and stat.cost_saved_cents == 0:
        saved_cents = CacheStatistics.estimate_cost(stat.ai_tokens_saved, most_common)
        stat.cost_saved_cents = saved_cents
        print(f"  └─ Tokens saved: {stat.ai_tokens_saved:,} → Saved: ${saved_cents/100:.4f}")
    
    stat.save(update_fields=['cost_usd_cents', 'cost_saved_cents'])
    updated_count += 1
    print(f"  ✅ Updated!\n")

print("=" * 80)
print(f"✅ COMPLETE: Updated {updated_count} records")
print("=" * 80)
print("\n🎯 Now check your Django admin - historical costs are filled in!")
print("   URL: http://127.0.0.1:8000/administration-zporta-repersentiivie/dailycast/cachestatistics/\n")

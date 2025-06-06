# analytics/tasks.py
from celery import shared_task
from django.utils import timezone
import logging

from .models import MemoryStat
from .utils import generate_question_performance_report # Import the new utility

logger = logging.getLogger(__name__)

@shared_task(name="analytics.update_daily_memory_stats_retention_decay")
def update_all_memory_stats_retention_decay_task():
    """
    Celery task to update the current_retention_estimate for all relevant MemoryStat objects
    using the method defined on the MemoryStat model.
    This should be scheduled to run daily.
    """
    start_time = timezone.now()
    logger.info(f"Starting daily task: update_all_memory_stats_retention_decay_task at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    stats_to_process = MemoryStat.objects.filter(last_reviewed_at__isnull=False)
    updated_count = 0
    errors_count = 0
    total_processed = stats_to_process.count() # Get count before iteration for more accurate logging

    for stat in stats_to_process.iterator(): # Use iterator for large querysets
        try:
            if stat.update_daily_retention_decay(): # Call the model method
                updated_count += 1
        except Exception as e:
            errors_count +=1
            logger.error(f"Error updating retention for MemoryStat ID {stat.id} (User: {stat.user_id}, Item: {stat.content_type_id}-{stat.object_id}): {e}", exc_info=True)
    
    end_time = timezone.now()
    duration = (end_time - start_time).total_seconds()
    logger.info(
        f"Daily retention decay update complete. Duration: {duration:.2f}s. "
        f"Total Processed: {total_processed}. Successfully updated: {updated_count}. Errors: {errors_count}."
    )
    return f"Updated retention for {updated_count} of {total_processed} memory stats. Encountered {errors_count} errors. Duration: {duration:.2f}s."


@shared_task(name="analytics.generate_periodic_performance_reports")
def generate_periodic_performance_reports_task(days_history=7):
    """
    Celery task to periodically generate and log question performance reports.
    Uses Pandas and Numpy via the utility function.
    """
    start_time = timezone.now()
    logger.info(f"Starting periodic task: generate_periodic_performance_reports_task for last {days_history} days at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    report_data_dict_list = None # Initialize
    try:
        report_data_dict_list = generate_question_performance_report(days_history=days_history)
        
        if isinstance(report_data_dict_list, list):
            logger.info(f"Successfully generated performance report. Number of question entries: {len(report_data_dict_list)}")
            # The report generation utility already logs an event with the summary.
            # You could add further processing here, like saving to a specific analytics model or file.
            result_message = f"Generated performance report analyzing {len(report_data_dict_list)} questions."
        elif isinstance(report_data_dict_list, str): # If utility returned a message like "No data"
            logger.info(f"Performance report generation: {report_data_dict_list}")
            result_message = report_data_dict_list
        else:
            logger.warning("Performance report generation did not yield expected list or message.")
            result_message = "Performance report generation completed with unexpected result."

    except Exception as e:
        logger.error(f"Error in generate_periodic_performance_reports_task: {e}", exc_info=True)
        result_message = f"Error during performance report generation: {e}"

    end_time = timezone.now()
    duration = (end_time - start_time).total_seconds()
    logger.info(f"Periodic performance report task complete. Duration: {duration:.2f}s. Result: {result_message}")
    return result_message

# --- To schedule these tasks with Celery Beat ---
# Add to your Django settings.py (e.g., zporta/settings/base.py or local.py):
#
# from celery.schedules import crontab
#
# CELERY_BEAT_SCHEDULE = {
#     'update-daily-retention': {
#         'task': 'analytics.update_daily_memory_stats_retention_decay_task',
#         'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
#     },
#     'generate-weekly-performance-report': {
#         'task': 'analytics.generate_periodic_performance_reports_task',
#         'schedule': crontab(day_of_week='sunday', hour=5, minute=0), # Weekly on Sunday at 5 AM
#         'kwargs': {'days_history': 7}, # Example: report for the last 7 days
#     },
# }
#
# Remember to have your Celery worker and Celery Beat services running.
# Worker: celery -A zporta worker -l info
# Beat:   celery -A zporta beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler

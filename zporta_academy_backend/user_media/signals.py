import os, time, subprocess
from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import UserMedia
import logging

logger = logging.getLogger(__name__)

@receiver(post_delete, sender=UserMedia)
def delete_file_on_disk(sender, instance, **kwargs):
    if instance.file:
        try:
            # Get the file path (try direct, then fallback to storage API)
            try:
                file_path = instance.file.path
            except Exception:
                file_path = instance.file.storage.path(instance.file.name)
            file_path = str(file_path)  # Force conversion to string
            logger.info("Deleting file at %s (type: %s)", file_path, type(file_path))
            
            # For wav files on Windows, use the force delete command.
            if file_path.lower().endswith('.wav'):
                try:
                    # Using Windows command 'del /F' to force deletion
                    subprocess.run(f'del /F "{file_path}"', shell=True, check=True)
                    logger.info("Forced deletion of wav file at %s", file_path)
                except Exception as e:
                    logger.error("Failed to force delete wav file %s: %s", file_path, e)
            else:
                # For non-wav files, try deleting with retries.
                for attempt in range(3):
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                            logger.info("Deleted file at %s", file_path)
                            break  # Success, exit loop.
                        except PermissionError as e:
                            logger.warning("Attempt %d: PermissionError deleting file %s: %s", attempt + 1, file_path, e)
                            time.sleep(1)
                    else:
                        logger.info("File %s does not exist", file_path)
                        break
        except Exception as e:
            logger.error("Error deleting file %s: %s", instance.file.name, e)

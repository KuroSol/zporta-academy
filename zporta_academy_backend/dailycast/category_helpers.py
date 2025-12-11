"""
Helper functions for working with user categories and their configurations.
This makes it easy to get the right settings for each user based on their category.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def get_user_category(user):
    """
    Get the primary category for a user.
    Users can be in multiple categories; this returns the first active one.
    
    Args:
        user: Django User instance
    
    Returns:
        UserCategory instance or None if user has no category
    """
    try:
        if not user or not user.is_authenticated:
            return None
        
        category = user.podcast_categories.filter(
            is_active=True
        ).first()
        
        return category
    except Exception as e:
        logger.error(f"Error getting user category: {e}")
        return None


def get_category_config(user):
    """
    Get the configuration for a user's category.
    Falls back to global TeacherContentConfig if user has no category.
    
    Args:
        user: Django User instance
    
    Returns:
        UserCategoryConfig or TeacherContentConfig instance
    """
    from dailycast.models import UserCategoryConfig, TeacherContentConfig
    
    try:
        # Check if user has an active category with config
        category = get_user_category(user)
        if category and hasattr(category, 'config') and category.config:
            if category.config.enabled:
                logger.info(f"Using category config for user {user.username}: {category.name}")
                return category.config
    except Exception as e:
        logger.warning(f"Error fetching category config: {e}")
    
    # Fallback to global config
    logger.info(f"Using global config for user {user.username}")
    return TeacherContentConfig.get_config()


def get_tts_provider_for_user(user) -> str:
    """Get TTS provider for user's category."""
    config = get_category_config(user)
    return config.default_tts_provider if config else "elevenlabs"


def get_llm_provider_for_user(user) -> str:
    """Get LLM provider for user's category."""
    config = get_category_config(user)
    return config.default_llm_provider if config else "template"


def get_language_for_user(user) -> str:
    """Get default language for user's category."""
    config = get_category_config(user)
    return config.default_language if config else "en"


def get_output_format_for_user(user) -> str:
    """Get default output format for user's category."""
    config = get_category_config(user)
    return config.default_output_format if config else "both"


def get_word_limit_for_user(user) -> int:
    """Get script word limit for user's category."""
    config = get_category_config(user)
    if hasattr(config, 'script_word_limit'):
        return config.script_word_limit
    return 700


def get_cooldown_hours_for_user(user) -> int:
    """Get cooldown hours for user's category."""
    config = get_category_config(user)
    if hasattr(config, 'cooldown_hours'):
        return config.cooldown_hours
    return 24


def get_max_generations_per_day_for_user(user) -> int:
    """Get max generations per day for user's category."""
    config = get_category_config(user)
    if hasattr(config, 'max_generations_per_day'):
        return config.max_generations_per_day
    return 5


def get_cost_per_generation_for_user(user) -> float:
    """Get cost per generation for user's category."""
    config = get_category_config(user)
    if hasattr(config, 'cost_per_generation'):
        return float(config.cost_per_generation)
    return 0.50


def is_generation_enabled_for_user(user) -> bool:
    """Check if content generation is enabled for user's category."""
    config = get_category_config(user)
    if hasattr(config, 'enabled'):
        return config.enabled
    return True


def get_user_categories_for_display(user):
    """
    Get all categories for a user (for display purposes).
    
    Returns:
        List of category names
    """
    try:
        categories = user.podcast_categories.filter(is_active=True).values_list('name', flat=True)
        return list(categories)
    except Exception:
        return []


def get_all_active_categories():
    """Get all active user categories."""
    from dailycast.models import UserCategory
    try:
        return UserCategory.objects.filter(is_active=True).prefetch_related('config')
    except Exception as e:
        logger.error(f"Error fetching active categories: {e}")
        return []


def add_user_to_category(user, category_name: str) -> bool:
    """
    Add a user to a category.
    
    Args:
        user: Django User instance
        category_name: Name of the category
    
    Returns:
        True if successful, False otherwise
    """
    from dailycast.models import UserCategory
    
    try:
        category = UserCategory.objects.get(name=category_name, is_active=True)
        category.users.add(user)
        logger.info(f"Added user {user.username} to category {category_name}")
        return True
    except Exception as e:
        logger.error(f"Error adding user to category: {e}")
        return False


def remove_user_from_category(user, category_name: str) -> bool:
    """
    Remove a user from a category.
    
    Args:
        user: Django User instance
        category_name: Name of the category
    
    Returns:
        True if successful, False otherwise
    """
    from dailycast.models import UserCategory
    
    try:
        category = UserCategory.objects.get(name=category_name)
        category.users.remove(user)
        logger.info(f"Removed user {user.username} from category {category_name}")
        return True
    except Exception as e:
        logger.error(f"Error removing user from category: {e}")
        return False


def create_category(name: str, description: str = "", users=None) -> Optional[object]:
    """
    Create a new user category.
    
    Args:
        name: Category name
        description: Category description
        users: List of users to add to category
    
    Returns:
        UserCategory instance or None on error
    """
    from dailycast.models import UserCategory
    
    try:
        category = UserCategory.objects.create(
            name=name,
            description=description,
            is_active=True
        )
        
        if users:
            category.users.add(*users)
        
        logger.info(f"Created category: {name}")
        return category
    except Exception as e:
        logger.error(f"Error creating category: {e}")
        return None


def create_category_config(category, **config_fields) -> Optional[object]:
    """
    Create configuration for a category.
    
    Args:
        category: UserCategory instance
        **config_fields: Configuration field values
    
    Returns:
        UserCategoryConfig instance or None on error
    """
    from dailycast.models import UserCategoryConfig
    
    try:
        config = UserCategoryConfig.objects.create(
            category=category,
            **config_fields
        )
        logger.info(f"Created config for category: {category.name}")
        return config
    except Exception as e:
        logger.error(f"Error creating category config: {e}")
        return None


def get_users_by_category(category_name: str):
    """Get all users in a specific category."""
    from dailycast.models import UserCategory
    
    try:
        category = UserCategory.objects.get(name=category_name)
        return category.users.all()
    except Exception as e:
        logger.error(f"Error fetching users for category: {e}")
        return []


def get_category_stats(category):
    """Get statistics for a category."""
    return {
        "name": category.name,
        "user_count": category.users.count(),
        "is_active": category.is_active,
        "has_config": hasattr(category, 'config') and category.config is not None,
        "config_enabled": category.config.enabled if hasattr(category, 'config') and category.config else False,
    }

"""
Validation utilities for provider JSON sections.

This module provides helpers to validate and resolve asset references
in provider JSON configurations.
"""
import json
import uuid
from typing import Dict, List, Any, Optional, Tuple


def validate_asset_reference(asset_id: str) -> Tuple[bool, Optional[str]]:
    """
    Validate an asset ID exists and return the asset if valid.
    
    Args:
        asset_id: UUID string to validate
    
    Returns:
        Tuple of (is_valid, asset_or_error_message)
    """
    try:
        # Import here to avoid circular imports
        from .models import Asset
        
        asset_uuid = uuid.UUID(asset_id)
        asset = Asset.objects.get(id=asset_uuid)
        return True, asset
    except (ValueError, TypeError):
        return False, f"Invalid UUID format: {asset_id}"
    except Exception as e:
        return False, f"Asset not found: {asset_id} ({str(e)})"


def validate_asset_kind(asset_id: str, expected_kind: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that an asset exists and matches the expected kind.
    
    Args:
        asset_id: UUID string
        expected_kind: Expected kind ('image' or 'audio')
    
    Returns:
        Tuple of (is_valid, error_message_if_invalid)
    """
    is_valid, result = validate_asset_reference(asset_id)
    
    if not is_valid:
        return False, result
    
    asset = result
    if asset.kind != expected_kind:
        return False, f"Asset {asset_id} is {asset.kind}, expected {expected_kind}"
    
    return True, None


def resolve_asset_ids(asset_ids: List[str]) -> Dict[str, Any]:
    """
    Resolve a list of asset IDs to their full details.
    
    Args:
        asset_ids: List of UUID strings
    
    Returns:
        Dict with 'assets' and 'missing_ids' keys
    """
    from .models import Asset
    
    assets = Asset.objects.filter(id__in=asset_ids)
    found = {str(a.id): a for a in assets}
    missing = [id_ for id_ in asset_ids if id_ not in found]
    
    return {
        'assets': {str(a.id): {
            'url': a.get_url(),
            'path': a.get_path(),
            'kind': a.kind,
            'suggested_name': a.suggested_name,
        } for a in assets},
        'missing_ids': missing
    }


def extract_asset_ids_from_provider(provider_json: Dict[str, Any]) -> List[str]:
    """
    Extract asset IDs from a provider JSON configuration.
    
    Looks for keys ending with '_asset_id' and collects their UUIDs.
    
    Args:
        provider_json: Dict containing provider configuration
    
    Returns:
        List of found asset ID strings
    """
    asset_ids = []
    
    for key, value in provider_json.items():
        if isinstance(key, str) and key.endswith('_asset_id') and value:
            # Value could be a string UUID or already parsed
            asset_ids.append(str(value))
    
    return asset_ids


def validate_provider_json(provider_json: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate a provider JSON configuration for asset references.
    
    Args:
        provider_json: Dict with potential asset references
    
    Returns:
        Tuple of (is_valid, list_of_error_messages)
    """
    errors = []
    
    asset_ids = extract_asset_ids_from_provider(provider_json)
    
    for asset_id in asset_ids:
        is_valid, error_msg = validate_asset_reference(asset_id)
        if not is_valid:
            errors.append(error_msg)
    
    return len(errors) == 0, errors


def merge_asset_urls_into_provider(
    provider_json: Dict[str, Any],
    asset_ids: Optional[Dict[str, str]] = None
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Merge resolved asset URLs into a provider JSON config.
    
    For each key ending with '_asset_id', creates a corresponding '_url' key
    with the resolved URL.
    
    Args:
        provider_json: Provider configuration dict
        asset_ids: Optional pre-resolved asset_id -> url mapping
    
    Returns:
        Tuple of (updated_json, list_of_errors)
    """
    errors = []
    result = provider_json.copy()
    
    found_ids = extract_asset_ids_from_provider(provider_json)
    
    if not found_ids:
        return result, []
    
    # Resolve IDs if not provided
    if asset_ids is None:
        resolved = resolve_asset_ids(found_ids)
        asset_ids = {
            id_: data['url'] 
            for id_, data in resolved['assets'].items()
        }
        errors.extend(resolved.get('missing_ids', []))
    
    # Add URLs alongside asset IDs
    for key, value in provider_json.items():
        if isinstance(key, str) and key.endswith('_asset_id') and value:
            asset_id = str(value)
            url_key = key.replace('_asset_id', '_url')
            
            if asset_id in asset_ids:
                result[url_key] = asset_ids[asset_id]
            else:
                errors.append(f"Could not resolve {asset_id}")
    
    return result, errors


def is_backwards_compatible(provider_json: Dict[str, Any]) -> bool:
    """
    Check if provider JSON uses raw URLs (backwards compatible).
    
    Returns True if JSON has _url keys but no _asset_id keys.
    """
    has_urls = any(k.endswith('_url') for k in provider_json.keys())
    has_asset_ids = any(k.endswith('_asset_id') for k in provider_json.keys())
    
    return has_urls and not has_asset_ids

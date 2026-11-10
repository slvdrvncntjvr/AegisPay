"""Pure bounded error projection for a future separately authorized request.

No network, environment, credentials, file writes, or retry execution. Pass only an
already-bounded provider error body in memory before discarding it. Never persist
the input or exception text. Output strings come from fixed local constants only.
"""
import json
import re

MAX_ERROR_BYTES = 16 * 1024
MAX_MESSAGE_CHARS = 4096


def classify_error(http_status, body):
    """Return fixed classifications without retaining provider strings or codes.

    Classification describes the observed error body only; unknown stays unknown.
    All outputs stop automation, including field-validation errors and HTTP4xx.
    This cannot infer or repair the discarded original HTTP400 message.
    """
    status = http_status if type(http_status) is int and 100 <= http_status <= 599 else None
    result = {
        'http_status': status,
        'classification_code': 'PROVIDER_ERROR_CAUSE_UNKNOWN',
        'classification_source': 'local fixed allowlisted rules; not a provider error code',
        'matched_signals': [],
        'provider_message_present': False,
        'provider_error_code_present': False,
        'provider_error_code_retained': False,
        'raw_body_retained': False,
        'stop_required': True,
        'automatic_retry_allowed': False,
        'coordinator_review_required': True,
    }
    if not isinstance(body, bytes) or len(body) > MAX_ERROR_BYTES:
        result['classification_code'] = 'ERROR_BODY_UNAVAILABLE_OR_OVER_LIMIT'
        return result
    try:
        data = json.loads(body)
    except (ValueError, UnicodeDecodeError, RecursionError):
        result['classification_code'] = 'ERROR_BODY_NOT_SUPPORTED_JSON'
        return result
    if not isinstance(data, dict):
        result['classification_code'] = 'ERROR_BODY_NOT_SUPPORTED_JSON'
        return result
    # Inspect only shallow documented-style message locations. Never serialize the
    # entire response into a string and accidentally classify unrelated properties.
    values = []
    for container in [data, data.get('error') if isinstance(data.get('error'), dict) else {}]:
        code = container.get('code')
        result['provider_error_code_present'] |= isinstance(code, (str, int)) and not isinstance(code, bool)
        for field in ['message', 'error']:
            value = container.get(field)
            if isinstance(value, str) and value:
                result['provider_message_present'] = True
                if len(value) > MAX_MESSAGE_CHARS:
                    result['classification_code'] = 'ERROR_MESSAGE_OVER_LIMIT'
                    return result
                values.append(value.lower())
    message = '\n'.join(values)
    patterns = {
        'billing_or_payment_method': r'credit[ -]?card|payment[ _-]?method|\bbilling\b',
        'account_or_identity_verification': r'\bverification\b|verif\w*[^\n]{0,40}\b(account|identity)\b|\b(account|identity)\b[^\n]{0,40}verif\w*',
        'free_capacity_or_region_unavailable': r'\bcapacity\b|\bregion\b[^\n]{0,60}(unavailable|not available|not supported)|(?:unavailable|not available)[^\n]{0,60}\bregion\b',
        'free_quota_or_slot': r'\bfree\b[^\n]{0,80}(limit|already|only one)|only one[^\n]{0,40}\bfree\b|\bquota\b',
        'free_custom_disk_size': r'\bfree\b[^\n]{0,80}(?:does not|not|cannot|can.t)[^\n]{0,60}\b(?:custom )?(?:disk|storage)(?: size)?\b',
        'storage_configuration': r'\bdisksizegb\b|\bdisk[ _-]?size\b|\bstorage\b',
        'permission_or_authorization': r'\bpermission\b|\bforbidden\b|not authori[sz]ed',
    }
    signals = [name for name, pattern in patterns.items() if re.search(pattern, message)]
    if status in [401, 403]:
        signals.append('http_authentication_or_authorization_status')
    if status == 429:
        signals.append('http_api_rate_limit_status')
    result['matched_signals'] = signals
    for names, code in [
        ({'billing_or_payment_method', 'account_or_identity_verification'}, 'PROVIDER_BILLING_OR_VERIFICATION_REQUIRED'),
        ({'free_capacity_or_region_unavailable'}, 'PROVIDER_CAPACITY_OR_REGION_REJECTED'),
        ({'free_quota_or_slot'}, 'PROVIDER_FREE_QUOTA_REJECTED'),
        ({'free_custom_disk_size'}, 'PROVIDER_FREE_CUSTOM_DISK_REJECTED'),
        ({'storage_configuration'}, 'PROVIDER_STORAGE_CONFIGURATION_REJECTED'),
        ({'permission_or_authorization', 'http_authentication_or_authorization_status'}, 'PROVIDER_ACCESS_REJECTED'),
        ({'http_api_rate_limit_status'}, 'PROVIDER_API_RATE_LIMIT_REJECTED'),
    ]:
        if names.intersection(signals):
            result['classification_code'] = code
            break
    return result

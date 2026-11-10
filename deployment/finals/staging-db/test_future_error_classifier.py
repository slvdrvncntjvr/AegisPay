"""Offline synthetic classifier checks only; never provider or provisioning evidence."""
import json
import unittest
from future_error_classifier import classify_error, MAX_ERROR_BYTES


class ClassifierTests(unittest.TestCase):
    def test_free_positive_disk_message_is_preserved_as_fixed_diagnosis(self):
        result = classify_error(400, json.dumps({'message': 'Free plan does not support custom disk size'}).encode())
        self.assertEqual(result['classification_code'], 'PROVIDER_FREE_CUSTOM_DISK_REJECTED')
        self.assertIn('free_custom_disk_size', result['matched_signals'])

    def test_billing_wins_over_disk_and_disallows_retry(self):
        result = classify_error(400, b'{"message":"Add a credit card before configuring disk size"}')
        self.assertEqual(result['classification_code'], 'PROVIDER_BILLING_OR_VERIFICATION_REQUIRED')
        self.assertTrue(result['stop_required'])
        self.assertFalse(result['automatic_retry_allowed'])

    def test_account_verification_is_a_stop(self):
        result = classify_error(400, b'{"error":{"message":"Please verify your account"}}')
        self.assertEqual(result['classification_code'], 'PROVIDER_BILLING_OR_VERIFICATION_REQUIRED')

    def test_capacity_and_slot_are_distinct(self):
        capacity = classify_error(400, b'{"message":"Singapore region is unavailable"}')
        slot = classify_error(400, b'{"message":"Only one free database is allowed"}')
        self.assertEqual(capacity['classification_code'], 'PROVIDER_CAPACITY_OR_REGION_REJECTED')
        self.assertEqual(slot['classification_code'], 'PROVIDER_FREE_QUOTA_REJECTED')

    def test_discarded_original_reason_stays_unknown(self):
        self.assertEqual(classify_error(400, b'{}')['classification_code'], 'PROVIDER_ERROR_CAUSE_UNKNOWN')

    def test_raw_messages_codes_and_urls_cannot_leak(self):
        sentinel = 'SYNTHETIC_CLASSIFIER_SECRET_DO_NOT_EXPORT'
        body = json.dumps({'message': 'disk size ' + sentinel, 'code': sentinel, 'externalConnectionString': sentinel}).encode()
        result = classify_error(400, body)
        self.assertNotIn(sentinel, json.dumps(result))
        self.assertTrue(result['provider_error_code_present'])
        self.assertFalse(result['provider_error_code_retained'])

    def test_unrelated_response_properties_do_not_classify(self):
        result = classify_error(400, b'{"password":"credit card","unrelated":"custom disk size"}')
        self.assertEqual(result['classification_code'], 'PROVIDER_ERROR_CAUSE_UNKNOWN')

    def test_bad_or_oversize_bodies_and_codes_are_bounded(self):
        for body in [None, b'x' * (MAX_ERROR_BYTES + 1), b'not json', b'[]', b'\xff']:
            result = classify_error(400, body)
            self.assertTrue(result['stop_required'])
            self.assertFalse(result['automatic_retry_allowed'])
        result = classify_error('not a number', b'{}')
        self.assertIsNone(result['http_status'])


if __name__ == '__main__':
    unittest.main()

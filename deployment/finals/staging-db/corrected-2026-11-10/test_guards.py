"""Offline synthetic corrected-request guards; no provider or DB calls."""
import hashlib
import unittest
from unittest.mock import MagicMock, patch
import provision_corrected as subject


class CorrectedGuards(unittest.TestCase):
    def setUp(self):
        self.owner = 'tea-' + 'synthetic-owner'
        self.owner_hash = hashlib.sha256(self.owner.encode()).hexdigest()
        self.payload = {**subject.EXPECTED, 'ownerId': self.owner}
        self.manifest_patch = patch.dict(subject.MANIFEST, {'selected_workspace_id_sha256': self.owner_hash})
        self.manifest_patch.start()
        self.addCleanup(self.manifest_patch.stop)
        self.dispatch_patch = patch.object(subject, 'DISPATCHED', False)
        self.dispatch_patch.start()
        self.addCleanup(self.dispatch_patch.stop)

    def test_exact_minimal_Free_body_passes(self):
        subject.check_request(self.payload, self.owner)

    def test_every_forbidden_extra_field_is_rejected(self):
        for name, value in [('diskSizeGB', 1), ('enableHighAvailability', False), ('enableDiskAutoscaling', False), ('connectionPool', 'none'), ('readReplicas', []), ('datadogAPIKey', 'unrelated')]:
            with self.subTest(field=name), self.assertRaises(subject.Stop):
                subject.check_request({**self.payload, name: value}, self.owner)

    def test_paid_other_region_version_or_workspace_is_rejected(self):
        for name, value in [('plan', 'starter'), ('region', 'oregon'), ('version', '18'), ('ownerId', 'changed')]:
            with self.subTest(field=name), self.assertRaises(subject.Stop):
                subject.check_request({**self.payload, name: value}, self.owner)

    def test_second_POST_is_refused_before_transport(self):
        report = {'requests': []}
        with patch.object(subject, 'DISPATCHED', True), patch.object(subject.OPENER, 'open') as transport:
            with self.assertRaisesRegex(subject.Stop, 'POST_NOT_AUTHORIZED_OR_ALREADY_DISPATCHED'):
                subject.request('/postgres', report, method='POST', payload=self.payload)
            transport.assert_not_called()

    def test_persisted_operation_receipt_fences_restart(self):
        with patch.object(subject, 'RECEIPT') as receipt, patch.object(subject.subprocess, 'run') as process:
            receipt.exists.return_value = True
            with self.assertRaisesRegex(subject.Stop, 'CORRECTED_ATTEMPT_ALREADY_FENCED_NO_RETRY'):
                subject.local_guards()
            process.assert_not_called()

    def test_HTTP_error_is_classified_and_cannot_retry(self):
        response = MagicMock()
        response.code = 400
        response.headers = {}
        response.read.return_value = b'{"message":"Free plan does not support custom disk size"}'
        report = {'requests': []}
        with patch.object(subject, 'RECEIPT') as receipt, patch.object(subject.OPENER, 'open', return_value=response) as transport:
            receipt.is_file.return_value = True
            with self.assertRaisesRegex(subject.Stop, 'PROVIDER_FREE_CUSTOM_DISK_REJECTED'):
                subject.request('/postgres', report, method='POST', payload=self.payload)
            self.assertEqual(report['POST_attempts_this_operation'], 1)
            self.assertEqual(report['requests'][0]['error_classification']['classification_code'], 'PROVIDER_FREE_CUSTOM_DISK_REJECTED')
            with self.assertRaisesRegex(subject.Stop, 'POST_NOT_AUTHORIZED_OR_ALREADY_DISPATCHED'):
                subject.request('/postgres', report, method='POST', payload=self.payload)
            self.assertEqual(transport.call_count, 1)

    def test_transport_unknown_has_no_retry_or_raw_error(self):
        report = {'requests': []}
        with patch.object(subject, 'RECEIPT') as receipt, patch.object(subject.OPENER, 'open', side_effect=TimeoutError('SYNTHETIC_PRIVATE_ERROR')) as transport:
            receipt.is_file.return_value = True
            with self.assertRaisesRegex(subject.Stop, '^POST_OUTCOME_UNKNOWN_NO_RETRY$'):
                subject.request('/postgres', report, method='POST', payload=self.payload)
            self.assertTrue(subject.DISPATCHED)
            self.assertNotIn('SYNTHETIC_PRIVATE_ERROR', str(report))
            self.assertEqual(transport.call_count, 1)

    def test_recorded_timestamp_serialization_roundtrip(self):
        self.assertTrue(subject.same_provider_timestamp('2026-11-10T11:55:40.452332725Z', '2026-11-10T11:55:40.452333Z'))
        self.assertTrue(subject.same_provider_timestamp('2026-12-10T11:55:40.452332725Z', '2026-12-10T11:55:40.452333Z'))

    def test_timestamp_guard_rejects_real_time_changes(self):
        self.assertFalse(subject.same_provider_timestamp('2026-11-10T11:55:40.452332725Z', '2026-11-10T11:55:40.452334Z'))
        self.assertFalse(subject.same_provider_timestamp('2026-11-10T11:55:40.452332725Z', '2026-11-10T11:55:41.452333Z'))
        self.assertFalse(subject.same_provider_timestamp('2026-11-10T11:55:40.452332725Z', '2026-12-10T11:55:40.452333Z'))


if __name__ == '__main__':
    unittest.main()

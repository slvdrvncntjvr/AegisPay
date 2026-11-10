"""Offline synthetic custody, GET cap and exclusive-publication checks only."""
import hashlib
import unittest
from unittest.mock import MagicMock, patch
import observe_connect as target


class ReadAndConnectGuards(unittest.TestCase):
    def database(self):
        identity = 'dpg-' + 'synthetic-db-a'
        owner = 'tea-' + 'synthetic-owner'
        return {'id': identity, 'name': 'aegispay-finals-staging', 'owner': {'id': owner}, 'plan': 'free', 'version': '17', 'region': 'singapore', 'highAvailabilityEnabled': False, 'diskAutoscalingEnabled': False, 'connectionPool': 'none', 'readReplicas': [], 'diskSizeGB': None, 'createdAt': '2026-11-10T11:55:40.452333Z', 'expiresAt': '2026-12-10T11:55:40.452333Z'}, owner

    def test_exact_identity_and_lifecycle_are_required(self):
        db, owner = self.database()
        with patch.dict(target.MANIFEST, {'database_id_sha256': hashlib.sha256(db['id'].encode()).hexdigest()}):
            target.verify_resource(db, owner)
            with self.assertRaisesRegex(target.Stop, 'EXACT_DATABASE_IDENTITY_HASH_MISMATCH'):
                target.verify_resource({**db, 'id': db['id'] + 'x'}, owner)
            with self.assertRaisesRegex(target.Stop, 'EXACT_DATABASE_LIFECYCLE_MISMATCH'):
                target.verify_resource({**db, 'expiresAt': '2026-12-11T11:55:40.452333Z'}, owner)

    def test_plan_region_and_disabled_features_are_enforced(self):
        db, owner = self.database()
        with patch.dict(target.MANIFEST, {'database_id_sha256': hashlib.sha256(db['id'].encode()).hexdigest()}):
            for name, value in [('plan', 'starter'), ('region', 'oregon'), ('version', '18'), ('highAvailabilityEnabled', True), ('diskAutoscalingEnabled', True), ('connectionPool', 'pgbouncer'), ('readReplicas', [{}])]:
                with self.subTest(field=name), self.assertRaises(target.corrected.prior.Stop):
                    target.verify_resource({**db, name: value}, owner)

    def test_one_direct_GET_then_stop_without_transport_retry(self):
        report = {'requests': []}
        transport = target.ReadTransport('SYNTHETIC_KEY', report)
        path = '/postgres/SYNTHETIC'
        transport.allowed[path] = 'exact-resource-status'
        response = MagicMock()
        response.code = 200
        response.read.return_value = b'{}'
        with patch.object(transport.opener, 'open', return_value=response) as request:
            self.assertEqual(transport.get(path), {})
            self.assertEqual(request.call_args.args[0].get_method(), 'GET')
            with self.assertRaisesRegex(target.Stop, 'DIRECT_STATUS_GET_LIMIT_ALREADY_CONSUMED'):
                transport.get(path)
            self.assertEqual(request.call_count, 1)

    def test_connection_info_is_not_implicitly_allowed(self):
        transport = target.ReadTransport('SYNTHETIC_KEY', {'requests': []})
        with patch.object(transport.opener, 'open') as request:
            with self.assertRaisesRegex(target.Stop, 'READ_TARGET_NOT_EXPLICITLY_ALLOWED'):
                transport.get('/postgres/SYNTHETIC/connection-info')
            request.assert_not_called()

    def test_atomic_destination_collision_cannot_overwrite(self):
        with patch.object(target.os, 'link', side_effect=FileExistsError), patch.object(target, 'acl_verify') as verify:
            with self.assertRaisesRegex(target.Stop, 'ATOMIC_DESTINATION_EXISTS_NO_OVERWRITE'):
                target.atomic_publish(target.SECRET_TEMP, target.SECRET_FILE)
            verify.assert_not_called()

    def test_consumed_permit_fences_restart_before_processes_or_network(self):
        with patch.object(target, 'PERMIT') as permit, patch.object(target.subprocess, 'run') as process:
            permit.exists.return_value = True
            with self.assertRaisesRegex(target.Stop, 'OBSERVATION_PERMIT_ALREADY_CONSUMED_NO_RETRY'):
                target.local_preflight()
            process.assert_not_called()


if __name__ == '__main__':
    unittest.main()

"""Assess the saved corrected result only. No account, env, DB or network access."""
import datetime as dt
import json
from provision_corrected import OUT, preserve_prior, same_provider_timestamp, write_public


def main():
    source = OUT / 'observation-20261110T115540233366Z.json'
    report = json.loads(source.read_text(encoding='utf-8'))
    posts = [v for v in report['requests'] if v['method'] == 'POST']
    created, latest = report['created_database'], report['created_database_latest']
    assert len(posts) == 1 and posts[0]['http_status'] == 201
    assert report['immediate_status_reads_after_HTTP201'] == 1
    assert created['status'] == latest['status'] == 'creating'
    assert created['id_redacted'] == latest['id_redacted']
    assert report['db_connections_attempted'] == 0
    for snapshot in [created, latest]:
        assert snapshot['name'] == 'aegispay-finals-staging'
        assert snapshot['plan'] == 'free' and snapshot['version'] == '17' and snapshot['region'] == 'singapore'
        assert snapshot['highAvailabilityEnabled'] is False
        assert snapshot['diskAutoscalingEnabled'] is False
        assert snapshot['connectionPool'] == 'none' and snapshot['read_replica_count'] == 0
    assert same_provider_timestamp(created['createdAt'], latest['createdAt'])
    assert same_provider_timestamp(created['expiresAt'], latest['expiresAt'])
    assessed = {
        'assessed_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
        'scope': 'offline assessment of preserved actual HTTP201 and one immediate GET; no fresh observation',
        'outcome': 'created_pending_provider_readiness',
        'source_observation': source.name,
        'original_command_outcome_preserved': report['outcome'],
        'original_command_safe_code_preserved': report['safe_code'],
        'command_guard_issue': 'literal lifecycle string comparison rejected POST nanosecond versus GET rounded-microsecond serialization',
        'offline_timestamp_rounding_checks_passed': True,
        'provider_snapshot_used': 'one immediate GET at 2026-11-10T11:55:39.633182+00:00; not current readiness',
        'database': latest,
        'POST_response_lifecycle_values_preserved': {'createdAt': created['createdAt'], 'expiresAt': created['expiresAt']},
        'created_resource_identity_sha256': report['created_resource_identity_sha256'],
        'corrected_operation_POST_count': 1,
        'provider_calls_during_assessment': 0,
        'db_connections_or_SQL': 0,
        'connection_info_retrieved': False,
        'staging_credentials_saved': False,
        'requires_separate_authorization_for_later_observation': True,
        'prior_artifacts_byte_identical': preserve_prior(),
        'complete_TASK018_or_TASK012_claim': False,
    }
    write_public(OUT / 'result-assessment.json', assessed)
    print(json.dumps({'outcome': assessed['outcome'], 'assessment': 'result-assessment.json', 'provider_calls': 0}))


if __name__ == '__main__':
    main()

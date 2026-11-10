import type { Store } from '../../../../src/server/db/connection.ts';
import type { ReceiptHashFactory } from '../../../../src/server/domain/evidence.ts';
import { claimJob, finishJob } from './queue.ts';
import { paymentSnapshot, processPayment, type PaymentAdapter } from './payment.ts';

// Process-local exclusion is only an efficiency measure. PostgreSQL leases and
// the attempt marker remain authoritative across processes and restarts.
export function paymentConsumer(input: { store: Store; adapter: () => Promise<PaymentAdapter>; key: Buffer; receiptHash: ReceiptHashFactory }) {
  let active: Promise<void> | undefined;
  async function drain() {
    for (let count = 0; count < 20; count++) {
      const job = await claimJob(input.store);
      if (!job) return;
      let done = false;
      try {
        await processPayment(input.store, job.entityId, await input.adapter(), input.key, input.receiptHash);
        const { attempt } = await paymentSnapshot(input.store, job.entityId);
        done = ['authorized', 'refused', 'expired', 'failed'].includes(attempt.status) || attempt.status === 'manual_review' && !attempt.handoffCommittedAt;
      } finally { await finishJob(input.store, job, done); }
    }
  }
  return {
    idle: () => active ?? Promise.resolve(),
    wake(): Promise<void> {
      active ??= drain().finally(() => { active = undefined; });
      return active;
    },
  };
}

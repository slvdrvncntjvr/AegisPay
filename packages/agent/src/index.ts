import type { ToolIntent } from '@aegispay/shared';

export const RUN_LIMITS = Object.freeze({ modelTurns: 8, toolSteps: 12, activeMs: 90000 });

// Pure bounds/intent guard. It cannot grant evidence, change policy or make payments.
// The real model round trip and durable checkpoint/resume remain TASK-007.
export class BoundedIntentGuard {
  private turns = 0;
  private steps = 0;
  private unresolvedQuote: string | undefined;
  private readonly started: number;
  constructor(private readonly clock: () => number = () => performance.now()) { this.started = clock(); }
  private assertTime() {
    if (this.clock() - this.started >= RUN_LIMITS.activeMs) throw new Error('ACTIVE_TIME_LIMIT');
  }
  nextTurn() {
    this.assertTime();
    if (this.turns >= RUN_LIMITS.modelTurns) throw new Error('MODEL_TURN_LIMIT');
    this.turns++;
  }
  accept(intent: ToolIntent) {
    this.assertTime();
    if (this.steps >= RUN_LIMITS.toolSteps) throw new Error('TOOL_STEP_LIMIT');
    if (intent.tool === 'purchase_quote') {
      if (this.unresolvedQuote) throw new Error('PAYMENT_UNRESOLVED');
      this.unresolvedQuote = intent.quoteId;
    }
    if (intent.tool === 'read_purchase' && intent.quoteId !== this.unresolvedQuote) throw new Error('PURCHASE_IDENTITY_MISMATCH');
    this.steps++;
  }
}

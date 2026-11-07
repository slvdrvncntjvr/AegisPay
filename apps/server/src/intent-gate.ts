import { BoundedIntentGuard } from '@aegispay/agent';
import { toolIntentSchema } from '@aegispay/shared';

export function createIntentGate(clock: () => number = () => performance.now()) {
  const guard = new BoundedIntentGuard(clock);
  return {
    nextTurn: () => guard.nextTurn(),
    accept(input: unknown) {
      const intent = toolIntentSchema.parse(input);
      guard.accept(intent);
      return intent;
    },
  };
}

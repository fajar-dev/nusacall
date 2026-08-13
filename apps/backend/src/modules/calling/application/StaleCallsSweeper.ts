import type { CallRepositoryPort } from '../domain/ports/CallRepositoryPort';
import type { GraphApiClientPort } from '../../meta/domain/ports/GraphApiClientPort';
import type { ClockPort } from '../../../shared/ports/ClockPort';
import { ulid } from 'ulid';

export class StaleCallsSweeper {
  private static readonly DEFAULT_TIMEOUT_SECONDS = 30;

  constructor(
    private readonly callRepo: CallRepositoryPort,
    private readonly graphApiClient: GraphApiClientPort,
    private readonly clock: ClockPort
  ) {}

  async sweep(timeoutSeconds: number = StaleCallsSweeper.DEFAULT_TIMEOUT_SECONDS): Promise<number> {
    const now = this.clock.now();
    const thresholdDate = new Date(now.getTime() - timeoutSeconds * 1000);

    const staleCalls = await this.callRepo.findStaleCalls(thresholdDate);
    let sweptCount = 0;

    for (const call of staleCalls) {
      if (call.state === 'QUEUED' || call.state === 'RINGING') {
        if (call.wacid) {
          try {
            await this.graphApiClient.rejectCall({
              phoneNumberId: call.waPhoneNumberId,
              callId: call.wacid,
            });
          } catch {
            // Continue even if Meta reject fails
          }
        }

        call.transitionTo('STALE');
        call.setEndReason('STALE_TIMED_OUT');
        call.appendEvent(
          ulid(),
          'STALE_SWEEPER_TIMEOUT',
          'SYSTEM',
          undefined,
          { timeoutSeconds },
          now
        );

        await this.callRepo.save(call);
        sweptCount++;
      }
    }

    return sweptCount;
  }
}

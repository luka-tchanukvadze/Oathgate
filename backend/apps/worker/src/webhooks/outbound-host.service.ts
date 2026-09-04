import { Injectable } from '@nestjs/common';
import { assertPublicHost } from '@app/shared';

// A class around one function, so a test can replace it
// The sender used to import the check directly, which meant a test endpoint on
// 127.0.0.1 was refused before the fetch and the retry tests measured nothing
// Injecting it keeps the production path unconditional: there is no environment
// variable that turns this off
@Injectable()
export class OutboundHostService {
  async assertAllowed(url: string): Promise<void> {
    await assertPublicHost(new URL(url).hostname);
  }
}

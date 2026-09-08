import type { LookupFunction } from 'node:net';
import { Injectable } from '@nestjs/common';
import { assertPublicHost, publicLookup } from '@app/shared';

// A class around the outbound address policy, so a test can replace it
// The sender used to import the check directly, which meant a test endpoint on
// 127.0.0.1 was refused before the fetch and the retry tests measured nothing
// Injecting it keeps the production path unconditional: there is no environment
// variable that turns this off
@Injectable()
export class OutboundHostService {
  // An address written into the url is settled here, since there is nothing to
  // resolve and the lookup below has no part to play in it
  async assertAllowed(url: string): Promise<void> {
    await assertPublicHost(new URL(url).hostname);
  }

  // A name is settled inside the socket's own resolution, so the answer cannot
  // change between being judged and being connected to
  readonly lookup: LookupFunction = publicLookup;
}

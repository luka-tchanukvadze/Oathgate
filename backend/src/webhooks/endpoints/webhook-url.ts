import { BadRequestException } from '@nestjs/common';
import { KeyMode } from '../../generated/prisma/client';

// Anything that would make my server reach back into its own network. A
// merchant who registers http://169.254.169.254 is asking me to fetch cloud
// credentials on their behalf, and a payment gateway making arbitrary internal
// requests is a hole worth closing at the door
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
]);

const PRIVATE_IPV4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function assertDeliverableUrl(raw: string, mode: KeyMode): URL {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('url is not a valid absolute URL');
  }

  // http is allowed in test so a developer can point at a tunnel, but live
  // webhooks carry payment data and go over the open internet
  const allowed = mode === KeyMode.LIVE ? ['https:'] : ['https:', 'http:'];

  if (!allowed.includes(url.protocol)) {
    throw new BadRequestException(
      `url must use ${allowed.join(' or ')} in ${mode} mode`,
    );
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host) || PRIVATE_IPV4.test(host)) {
    throw new BadRequestException('url must not point at a private address');
  }

  return url;
}

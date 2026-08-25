import { BadRequestException } from '@nestjs/common';
import { KeyMode } from '@app/shared';

// Anything that would make my server reach back into its own network
// http://169.254.169.254 would fetch cloud credentials on their behalf
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::', '::1']);

const PRIVATE_IPV4 =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

// The v6 versions of everything above
// fc00::/7 is private, fe80::/10 is link local
// ::ffff:7f00:1 is 127.0.0.1 in v6 clothing, so the prefix is refused
const PRIVATE_IPV6 = /^(::1?$|::ffff:|f[cd]|fe[89ab])/;

export function assertDeliverableUrl(raw: string, mode: KeyMode): URL {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('url is not a valid absolute URL');
  }

  // http is allowed in test so a developer can point at a tunnel
  // Live webhooks carry payment data over the open internet
  const allowed = mode === KeyMode.LIVE ? ['https:'] : ['https:', 'http:'];

  if (!allowed.includes(url.protocol)) {
    throw new BadRequestException(
      `url must use ${allowed.join(' or ')} in ${mode} mode`,
    );
  }

  // url.hostname keeps the brackets, so it is [::1] and never ::1
  // That bit me once
  // It is also how I tell v6 from a host starting fc, like fcbank.com
  const hostname = url.hostname.toLowerCase();
  const isIpv6 = hostname.startsWith('[') && hostname.endsWith(']');
  const host = isIpv6 ? hostname.slice(1, -1) : hostname;

  const isPrivate =
    BLOCKED_HOSTNAMES.has(host) ||
    (isIpv6 ? PRIVATE_IPV6.test(host) : PRIVATE_IPV4.test(host));

  if (isPrivate) {
    throw new BadRequestException('url must not point at a private address');
  }

  return url;
}

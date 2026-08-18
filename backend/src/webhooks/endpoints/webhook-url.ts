import { BadRequestException } from '@nestjs/common';
import { KeyMode } from '../../generated/prisma/client';

// Anything that would make my server reach back into its own network. A
// merchant who registers http://169.254.169.254 is asking me to fetch cloud
// credentials on their behalf, and a payment gateway making arbitrary internal
// requests is a hole worth closing at the door
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::', '::1']);

const PRIVATE_IPV4 =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

// fc00::/7 is the IPv6 private range and fe80::/10 is link local, which covers
// the v6 equivalent of everything above. ::ffff: is an IPv4 address wearing an
// IPv6 hat, and the whole prefix is refused rather than unwrapped and rechecked
const PRIVATE_IPV6 = /^(::1?$|::ffff:|f[cd]|fe[89ab])/;

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

  // A v6 literal keeps its brackets in hostname, so ::1 in a plain list of
  // strings would never have matched anything. The brackets also make this the
  // only reliable way to tell a v6 address from a hostname that starts "fc"
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

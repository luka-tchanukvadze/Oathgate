import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

// Anything that would make my server reach back into its own network
// http://169.254.169.254 would fetch cloud credentials on their behalf
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::', '::1']);

const PRIVATE_IPV4 =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

// The v6 versions of everything above
// fc00::/7 is private, fe80::/10 is link local
// ::ffff:7f00:1 is 127.0.0.1 in v6 clothing, so the prefix is refused
const PRIVATE_IPV6 = /^(::1?$|::ffff:|f[cd]|fe[89ab])/;

// Its own type, so the caller can tell it apart from a network failure
export class PrivateAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrivateAddressError';
  }
}

// url.hostname keeps the brackets, so it is [::1] and never ::1
// That is also how I tell a v6 literal from a host starting fc, like fcbank.com
export function unwrapHost(hostname: string): {
  host: string;
  isIpv6: boolean;
} {
  const lower = hostname.toLowerCase();
  const isIpv6 = lower.startsWith('[') && lower.endsWith(']');

  return { host: isIpv6 ? lower.slice(1, -1) : lower, isIpv6 };
}

export function isPrivateAddress(host: string, isIpv6: boolean): boolean {
  return (
    BLOCKED_HOSTNAMES.has(host) ||
    (isIpv6 ? PRIVATE_IPV6.test(host) : PRIVATE_IPV4.test(host))
  );
}

// A name resolves to whatever its owner points it at, and they can repoint it
// long after I accepted the url, so the answer has to be checked here too
// dns.lookup and not dns.resolve, because lookup is what the http client will
// use, and it reads the same host file and search domains
export async function assertPublicHost(hostname: string): Promise<void> {
  const { host, isIpv6 } = unwrapHost(hostname);

  if (isPrivateAddress(host, isIpv6)) {
    throw new PrivateAddressError(`${host} is a private address`);
  }

  // An address needs no lookup, and asking would only hand it back
  if (isIpv6 || isIP(host)) {
    return;
  }

  const answers = await dns.lookup(host, { all: true, verbatim: true });

  // Every answer, not the first
  // A name can hand back a public address and a private one together, and the
  // client is free to try either
  for (const { address, family } of answers) {
    if (isPrivateAddress(address.toLowerCase(), family === 6)) {
      throw new PrivateAddressError(`${host} resolves to a private address`);
    }
  }
}

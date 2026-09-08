import { promises as dns, lookup as dnsLookup } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';

// Anything that would make my server reach back into its own network
// http://169.254.169.254 would fetch cloud credentials on their behalf
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::', '::1']);

// Every v4 block the public internet does not route to a stranger, as a network
// address and the number of leading bits that define it
// Numbers rather than the text of an address, because a range compared as two
// integers is either right or obviously wrong, where a pattern over digits can
// be off by a character and still look correct
const PRIVATE_IPV4: [string, number][] = [
  ['0.0.0.0', 8], // this network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // shared address space
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link local, and the cloud metadata address
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // reserved for protocol use
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and the broadcast address with it
];

// Inside the one v6 range the internet routes, but still not a stranger's
// server
const RESERVED_IPV6 = [
  /^2001:0*:/, // teredo, a v4 address tunnelled inside a v6 one
  /^2001:0*db8:/, // documentation
  /^2002:/, // 6to4, another v4 address wrapped in a v6 one
];

// Its own type, so the caller can tell it apart from a network failure
export class PrivateAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrivateAddressError';
  }
}

// An address as a single number, so a range test is two comparisons
// Null means it was never an address, which is how a name falls through to the
// resolver instead of being judged here
function toNumber(address: string): number | null {
  const parts = address.split('.');

  if (parts.length !== 4) {
    return null;
  }

  let value = 0;

  for (const part of parts) {
    // Number would accept 010 and 1e2 and an empty string
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const octet = Number(part);

    if (octet > 255) {
      return null;
    }

    value = value * 256 + octet;
  }

  return value;
}

const PRIVATE_IPV4_RANGES = PRIVATE_IPV4.map(([network, bits]) => ({
  // A /10 fixes the top 10 bits, so the block holds the 22 bits below them
  first: toNumber(network) as number,
  size: 2 ** (32 - bits),
}));

function isPrivateIpv4(host: string): boolean {
  const address = toNumber(host);

  if (address === null) {
    return false;
  }

  return PRIVATE_IPV4_RANGES.some(
    ({ first, size }) => address >= first && address < first + size,
  );
}

// 2000::/3 is the only v6 range the internet carries between strangers, so I
// allow that and refuse everything else rather than listing what to refuse
// One line then covers ::1, fe80::, fc00::, ff00:: and every shape that hides a
// v4 address inside a v6 one, like ::ffff:127.0.0.1 or ::7f00:1
function isPrivateIpv6(host: string): boolean {
  if (!/^[23]/.test(host)) {
    return true;
  }

  return RESERVED_IPV6.some((range) => range.test(host));
}

export function isPrivateAddress(host: string, isIpv6: boolean): boolean {
  return (
    BLOCKED_HOSTNAMES.has(host) ||
    (isIpv6 ? isPrivateIpv6(host) : isPrivateIpv4(host))
  );
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

// The resolver a socket is given, so the addresses I checked are the addresses
// it connects to
// Checking a name and then handing the name to an http client resolves it
// twice, and a name whose owner answers differently the second time gets a
// connection I already approved
// There is only one answer here and it is the one that was judged
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, '', 0);

      return;
    }

    const refused = addresses.find(({ address, family }) =>
      isPrivateAddress(address.toLowerCase(), family === 6),
    );

    if (refused) {
      callback(
        new PrivateAddressError(`${hostname} resolves to a private address`),
        '',
        0,
      );

      return;
    }

    const [first] = addresses;

    if (!first) {
      callback(new Error(`${hostname} resolved to nothing`), '', 0);

      return;
    }

    // Happy eyeballs asks for every answer and races them, so it gets the
    // whole list back, and anything else gets one address and its family
    if (options.all === true) {
      callback(null, addresses);

      return;
    }

    callback(null, first.address, first.family);
  });
};

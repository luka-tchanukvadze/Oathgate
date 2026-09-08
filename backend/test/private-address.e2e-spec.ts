import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createServer, request, type Server } from 'node:http';
import {
  assertPublicHost,
  isPrivateAddress,
  publicLookup,
  unwrapHost,
} from '@app/shared';

// No database and nothing that leaves this machine
// Every case is a literal, or localhost, or a name that never reaches a
// resolver, so this suite cannot go red because somebody else's dns went down
describe('where a webhook is allowed to point', () => {
  describe('unwrapHost', () => {
    it('takes the brackets off a v6 literal', () => {
      expect(unwrapHost('[::1]')).toEqual({ host: '::1', isIpv6: true });
    });

    it('leaves a name alone and lowercases it', () => {
      expect(unwrapHost('Shop.Example.COM')).toEqual({
        host: 'shop.example.com',
        isIpv6: false,
      });
    });
  });

  describe('isPrivateAddress', () => {
    // The brackets are what tell a v6 literal from a name starting fc, like
    // fcbank.com, so anything without them is checked as v4 or as a name
    const refused = [
      'localhost',
      '0.0.0.0',
      '127.0.0.1',
      '10.0.0.5',
      '192.168.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.169.254',
      '0.1.2.3',
      // 100.64.0.0/10 is shared address space, which a text pattern over the
      // digits is easy to get wrong and a numeric range is not
      '100.64.0.1',
      '100.100.100.100',
      '100.127.255.255',
      '192.0.0.1',
      '192.0.2.1',
      '198.18.0.1',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '255.255.255.255',
    ];

    for (const host of refused) {
      it(`refuses ${host}`, () => {
        expect(isPrivateAddress(host, false)).toBe(true);
      });
    }

    const refusedIpv6 = [
      '::1',
      '::',
      '::ffff:127.0.0.1',
      // The deprecated way of writing a v4 address as a v6 one, and this is
      // 127.0.0.1 wearing it
      '::7f00:1',
      '64:ff9b::7f00:1',
      '2002:7f00:1::',
      '2001::1',
      '2001:db8::1',
      'fc00::1',
      'fe80::1',
      'ff02::1',
    ];

    for (const host of refusedIpv6) {
      it(`refuses ${host}`, () => {
        expect(isPrivateAddress(host, true)).toBe(true);
      });
    }

    // 172.32 is outside the private block, which starts at 172.16 and stops at
    // 172.31, and getting that boundary wrong in either direction is the easy
    // mistake
    // 100.63 and 100.128 are the same boundary on 100.64.0.0/10
    const allowed = [
      '1.1.1.1',
      '8.8.8.8',
      '172.32.0.1',
      '172.15.0.1',
      '100.63.255.255',
      '100.128.0.0',
      '99.64.0.1',
    ];

    for (const host of allowed) {
      it(`allows ${host}`, () => {
        expect(isPrivateAddress(host, false)).toBe(false);
      });
    }

    it('allows a public v6 address', () => {
      expect(isPrivateAddress('2606:4700:4700::1111', true)).toBe(false);
    });

    it('allows a name that merely starts with fc', () => {
      expect(isPrivateAddress('fcbank.com', false)).toBe(false);
    });

    // Anything that is not four plain octets is a name, and a name is the
    // resolver's business rather than this function's
    it('does not mistake a name for an address', () => {
      expect(isPrivateAddress('10.0.0.5.example.com', false)).toBe(false);
    });

    // Only four plain octets are read as an address here, and the odd spellings
    // of 127.0.0.1 never arrive in one piece: URL rewrites them on the way in,
    // so 0177.0.0.1 and 2130706433 are both 127.0.0.1 by the time I look
    // This is the check that says so, because the day URL stops doing that is
    // the day a loopback address walks through
    const spellings = ['0177.0.0.1', '2130706433', '0x7f.1'];

    for (const spelling of spellings) {
      it(`refuses http://${spelling}`, () => {
        const { hostname } = new URL(`http://${spelling}/hook`);

        expect(hostname).toBe('127.0.0.1');
        expect(isPrivateAddress(hostname, false)).toBe(true);
      });
    }
  });

  describe('assertPublicHost', () => {
    it('refuses a private literal without looking anything up', async () => {
      await expect(assertPublicHost('169.254.169.254')).rejects.toThrow(
        'is a private address',
      );
    });

    it('refuses a bracketed v6 loopback', async () => {
      await expect(assertPublicHost('[::1]')).rejects.toThrow(
        'is a private address',
      );
    });

    it('allows a public literal', async () => {
      await expect(assertPublicHost('1.1.1.1')).resolves.toBeUndefined();
    });
  });

  // The check used to run on its own and the http client then resolved the name
  // a second time, so what was judged and what was connected to were two
  // different answers to the same question
  // Here the check is the resolver, and these two tests are the difference:
  // the same request, the same server, refused only when the socket resolves
  // through the policy
  describe('publicLookup as the socket resolver', () => {
    let server: Server;
    let port: number;

    const get = (lookup?: typeof publicLookup): Promise<number | string> =>
      new Promise((resolve) => {
        const call = request(
          `http://localhost:${port}/`,
          { lookup, agent: false },
          (response) => {
            response.resume();
            resolve(response.statusCode ?? 0);
          },
        );

        call.on('error', (error) => resolve(String(error)));
        call.end();
      });

    beforeAll(async () => {
      server = createServer((_request, response) =>
        response.writeHead(200).end(),
      );

      await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));

      const address = server.address();

      if (address === null || typeof address === 'string') {
        throw new Error('the test server did not take a port');
      }

      port = address.port;
    });

    afterAll(async () => {
      await new Promise<void>((closed) => server.close(() => closed()));
    });

    it('lets the connection happen with the default resolver', async () => {
      await expect(get()).resolves.toBe(200);
    });

    it('refuses the same connection when it does the resolving', async () => {
      await expect(get(publicLookup)).resolves.toContain(
        'resolves to a private address',
      );
    });
  });
});

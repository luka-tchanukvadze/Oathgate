import { describe, expect, it } from '@jest/globals';
import { assertPublicHost, isPrivateAddress, unwrapHost } from '@app/shared';

// No database and no network in here
// Every case is either a literal or a name that never reaches a resolver, so
// this suite cannot go red because somebody else's dns went down
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
    ];

    for (const host of refused) {
      it(`refuses ${host}`, () => {
        expect(isPrivateAddress(host, false)).toBe(true);
      });
    }

    const refusedIpv6 = ['::1', '::', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1'];

    for (const host of refusedIpv6) {
      it(`refuses ${host}`, () => {
        expect(isPrivateAddress(host, true)).toBe(true);
      });
    }

    // 172.32 is outside the private block, which starts at 172.16 and stops at
    // 172.31, and getting that boundary wrong in either direction is the easy
    // mistake
    const allowed = ['1.1.1.1', '8.8.8.8', '172.32.0.1', '172.15.0.1'];

    for (const host of allowed) {
      it(`allows ${host}`, () => {
        expect(isPrivateAddress(host, false)).toBe(false);
      });
    }

    it('allows a name that merely starts with fc', () => {
      expect(isPrivateAddress('fcbank.com', false)).toBe(false);
    });
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
});

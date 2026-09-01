import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bech32 } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { KeyMode } from '@app/shared';

// The four bytes an extended key starts with, which say what it is
// tpub is the generic testnet one, vpub is testnet native segwit
// A wallet exports whichever it feels like and the key material is the same
const TESTNET_VERSIONS = { private: 0x04358394, public: 0x043587cf };
const TESTNET_SEGWIT_VERSIONS = { private: 0x045f18bc, public: 0x045f1cf6 };
const MAINNET_VERSIONS = { private: 0x0488ade4, public: 0x0488b21e };
const MAINNET_SEGWIT_VERSIONS = { private: 0x04b2430c, public: 0x04b24746 };

// The human readable part of a bech32 address, and the thing that makes a
// testnet address impossible to confuse with a real one at a glance
const HRP: Record<KeyMode, string> = {
  [KeyMode.TEST]: 'tb',
  [KeyMode.LIVE]: 'bc',
};

const ENV_KEY: Record<KeyMode, string> = {
  [KeyMode.TEST]: 'BTC_XPUB_TEST',
  [KeyMode.LIVE]: 'BTC_XPUB_LIVE',
};

// The wallet exports the key at m/84'/1'/0', so what is left is chain and index
// 0 is the receive chain, 1 would be the wallet's own change
const RECEIVE_CHAIN = 0;

@Injectable()
export class AddressService {
  // Parsed once
  // Decoding base58 and checking the checksum on every payment is waste
  private readonly keys = new Map<KeyMode, HDKey>();

  constructor(private readonly config: ConfigService) {
    for (const mode of [KeyMode.TEST, KeyMode.LIVE]) {
      const raw = this.config.get<string>(ENV_KEY[mode]);

      if (raw) {
        this.keys.set(mode, this.parse(raw.trim(), mode));
      }
    }
  }

  // Same index always gives the same address, so this never needs storing
  // The row keeps derivationIndex and the address is rebuildable from the xpub
  derive(mode: KeyMode, index: number): string {
    const account = this.keys.get(mode);

    // A live payment against an unset live xpub has to stop here
    // Deriving a testnet address for real money sends it somewhere it can
    // never arrive, and nothing bounces it back
    if (!account) {
      throw new Error(`${ENV_KEY[mode]} is not set, cannot derive an address`);
    }

    const child = account.deriveChild(RECEIVE_CHAIN).deriveChild(index);

    if (!child.publicKey) {
      throw new Error(`no public key at index ${index}`);
    }

    // An address is a hash of a public key, not the key itself
    // RIPEMD160 of SHA256 gives the 20 bytes bitcoin calls hash160
    const program = ripemd160(sha256(child.publicKey));

    // Witness version 0 in front, then the program as five bit groups
    // bech32 works in groups of five bits and a byte is eight, hence toWords
    return bech32.encode(HRP[mode], [0, ...bech32.toWords(program)]);
  }

  // The version bytes say which network a key belongs to, so a testnet key
  // presented as the live one is refused rather than quietly derived from
  private parse(raw: string, mode: KeyMode): HDKey {
    const allowed =
      mode === KeyMode.TEST
        ? [TESTNET_SEGWIT_VERSIONS, TESTNET_VERSIONS]
        : [MAINNET_SEGWIT_VERSIONS, MAINNET_VERSIONS];

    for (const versions of allowed) {
      try {
        return HDKey.fromExtendedKey(raw, versions);
      } catch {
        continue;
      }
    }

    const prefix = raw.slice(0, 4);

    throw new Error(
      `${ENV_KEY[mode]} starts with ${prefix} and is not a ${mode} key`,
    );
  }
}

import { BadRequestException } from '@nestjs/common';
import { isPrivateAddress, KeyMode, unwrapHost } from '@app/shared';

// What the merchant typed, checked before it is stored
// The address it resolves to is checked again at send time, because a name can
// be repointed after this passes
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

  const { host, isIpv6 } = unwrapHost(url.hostname);

  if (isPrivateAddress(host, isIpv6)) {
    throw new BadRequestException('url must not point at a private address');
  }

  return url;
}

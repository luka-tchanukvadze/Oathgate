import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  KeyMode,
  Prisma,
  PrismaService,
  SecretCipher,
  type WebhookEndpoint,
} from '@app/shared';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { assertDeliverableUrl } from './webhook-url';

// Long enough that guessing it is not a strategy
const SECRET_BYTES = 24;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
  ) {}

  // A sandbox is handed to anyone who clicks a button on the landing page, so
  // its endpoint is https only, in test mode as well as live
  // Every tunnel and inspector worth pointing one at hands out an https url,
  // so this costs a visitor nothing
  private async assertSandboxUrl(merchantId: string, url: URL): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { isDemo: true },
    });

    if (merchant?.isDemo && url.protocol !== 'https:') {
      throw new BadRequestException(
        'a sandbox endpoint must use https, in test mode as well',
      );
    }
  }

  // The plain secret is returned here and never again, like an API key
  // What goes in the row is the encrypted form
  async create(
    merchantId: string,
    dto: CreateEndpointDto,
  ): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
    const url = assertDeliverableUrl(dto.url, dto.mode);

    await this.assertSandboxUrl(merchantId, url);
    const secret = `whsec_${randomBytes(SECRET_BYTES).toString('base64url')}`;

    try {
      const endpoint = await this.prisma.webhookEndpoint.create({
        data: {
          merchantId,
          mode: dto.mode,
          url: url.toString(),
          secretCiphertext: this.cipher.encrypt(secret),
          secretPrefix: secret.slice(0, 16),
          events: dto.events ?? [],
        },
      });

      return { endpoint, secret };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'that url is already registered for this mode',
        );
      }

      throw error;
    }
  }

  async list(merchantId: string, mode: KeyMode): Promise<WebhookEndpoint[]> {
    return this.prisma.webhookEndpoint.findMany({
      where: { merchantId, mode },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Disabled, never deleted
  // The delivery history points here, and last Tuesday still needs an answer
  async disable(merchantId: string, id: string): Promise<WebhookEndpoint> {
    const { count } = await this.prisma.webhookEndpoint.updateMany({
      where: { id, merchantId, disabledAt: null },
      data: { disabledAt: new Date() },
    });

    if (count === 0) {
      throw new NotFoundException('endpoint not found');
    }

    return this.prisma.webhookEndpoint.findUniqueOrThrow({ where: { id } });
  }

  // Read back only when something is about to sign with it
  // Nothing that answers an HTTP request calls this
  async signingSecret(endpointId: string): Promise<string> {
    const endpoint = await this.prisma.webhookEndpoint.findUniqueOrThrow({
      where: { id: endpointId },
      select: { secretCiphertext: true },
    });

    return this.cipher.decrypt(endpoint.secretCiphertext);
  }
}

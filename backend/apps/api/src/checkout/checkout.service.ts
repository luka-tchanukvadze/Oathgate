import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/shared';

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  // The one query in this codebase that looks a payment up by id alone
  //
  // Every other one carries merchantId, because every other caller claims to be
  // somebody. A customer claims nothing, so the id is the capability: it is a
  // v7 uuid, unguessable, and holding it is what a payment link means
  async get(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { chainTxs: true, merchant: { select: { name: true } } },
    });

    if (!payment) {
      throw new NotFoundException('payment not found');
    }

    return payment;
  }
}

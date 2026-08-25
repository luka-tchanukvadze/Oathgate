import { Injectable } from '@nestjs/common';
import {
  type Account,
  type KeyMode,
  type LedgerEntry,
  type Page,
  PrismaService,
} from '@app/shared';
import { DEFAULT_LIMIT, ListEntriesDto } from './dto/list-entries.dto';

@Injectable()
export class LedgerQueryService {
  constructor(private readonly prisma: PrismaService) {}

  // Only the merchant's own rows
  // House accounts have no merchantId, so this excludes them for free
  async balances(merchantId: string, mode: KeyMode): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { merchantId, mode },
      orderBy: [{ currency: 'asc' }, { kind: 'asc' }],
    });
  }

  async entries(
    merchantId: string,
    query: ListEntriesDto,
  ): Promise<Page<LedgerEntry>> {
    const limit = query.limit ?? DEFAULT_LIMIT;

    // An entry has no merchant of its own, it has an account
    // So ownership is checked through the relation, not a column here
    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        account: { merchantId, mode: query.mode },
        ...(query.paymentId ? { paymentId: query.paymentId } : {}),
        ...(query.startingAfter ? { id: { lt: query.startingAfter } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });

    return { data: rows.slice(0, limit), hasMore: rows.length > limit };
  }
}

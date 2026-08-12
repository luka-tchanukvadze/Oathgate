import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { QuoteQueryDto } from './dto/quote-query.dto';
import { QuoteService } from './quote.service';

@Controller('v1/quote')
@UseGuards(ApiKeyGuard)
export class QuoteController {
  constructor(private readonly quotes: QuoteService) {}

  @Get()
  async get(@Query() query: QuoteQueryDto) {
    const quote = await this.quotes.quote(
      BigInt(query.fiatAmount),
      query.fiatCurrency,
      query.cryptoCurrency,
    );

    // Every amount leaves as a string. A JSON number is a double once it lands,
    // and satoshis will outgrow what a double holds exactly
    return {
      fiatAmount: quote.fiatAmount.toString(),
      fiatCurrency: quote.fiatCurrency,
      cryptoAmount: quote.cryptoAmount.toString(),
      cryptoCurrency: quote.cryptoCurrency,
      rate: quote.rate.toString(),
      expiresAt: quote.expiresAt.toISOString(),
    };
  }
}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { RatesService } from './rates.service';

@Module({
  imports: [AuthModule],
  controllers: [QuoteController],
  providers: [RatesService, QuoteService],
  exports: [QuoteService],
})
export class RatesModule {}

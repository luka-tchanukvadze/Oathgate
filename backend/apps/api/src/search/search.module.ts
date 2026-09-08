import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiAvailabilityService } from './ai-availability.service';
import { GroqClient } from './groq.client';
import { PaymentSearchService } from './payment-search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [AuthModule],
  controllers: [SearchController],
  providers: [GroqClient, AiAvailabilityService, PaymentSearchService],
  // The status screen reports whether the model is reachable, and reads the
  // same breaker the search itself does rather than asking again
  exports: [AiAvailabilityService],
})
export class SearchModule {}

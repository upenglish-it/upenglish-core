import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

/**
 * AI Module — provides a server-side proxy for all AI API calls.
 * Mirrors the functionality of api_handler.php:
 *  - Google Gemini (chat, audio, vision, TTS, image generation)
 *  - OpenRouter (chat)
 *  - Google Translate TTS (free scrape proxy)
 *
 * Uses Node.js built-in https module for outbound HTTP calls.
 * No MongoDB schema needed — this module is purely a pass-through proxy.
 */
@Module({
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}


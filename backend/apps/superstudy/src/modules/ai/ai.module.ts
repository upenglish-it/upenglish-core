import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AppConfigModule } from '../app-config/app-config.module';

/**
 * AI Module — provides a server-side proxy for all AI API calls.
 * Mirrors the functionality of aiProxy.js (Firebase Cloud Function):
 *  - Google Gemini (chat, file_chat, audio, vision, TTS/PCM→WAV, image generation)
 *  - OpenRouter (chat, vision, TTS, image generation)
 *  - Google Translate TTS (free scrape proxy)
 *  - Hugging Face (image generation)
 *
 * Imports AppConfigModule to get runtime AI model config from MongoDB
 * (mirrors the original Firestore app_config/ai_models document).
 * No Firestore or Firebase dependency.
 */
@Module({
  imports: [AppConfigModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

import { Controller, Get, Patch, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';

@ApiTags('AppConfig')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  // ─────────────────────────────────────────────
  // AI Model Config — mirrors Firestore app_config/ai_models
  // ─────────────────────────────────────────────

  @ApiOperation({
    summary: 'Get current AI model config (merged: env > DB > defaults)',
    description:
      'Returns the merged AI model routing config. Equivalent to Firestore app_config/ai_models document. ' +
      'Shows dbConfig (stored in MongoDB), defaults (hardcoded), and merged (final resolved values).',
  })
  @Get('ai-models')
  getAiModels() {
    return this.appConfigService.getAiModelConfigRaw();
  }

  @ApiOperation({
    summary: 'Update AI model config keys (admin)',
    description:
      'Patch one or more model config keys. Keys match the original Firestore doc fields: ' +
      'FREE_MODEL_PRIMARY, STANDARD_MODEL_PRIMARY, PREMIUM_MODEL_BACKUP, FREE_MEDIA_ENABLED, etc. ' +
      'Changes take effect within 5 minutes (cache TTL). Env vars always take highest priority.',
  })
  @Patch('ai-models')
  @HttpCode(HttpStatus.OK)
  updateAiModels(@Body() body: Record<string, string>) {
    return this.appConfigService.setAiModelConfig(body);
  }

  // ─────────────────────────────────────────────
  // Generic config CRUD (for other config documents)
  // ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Get a generic app_config document by ID' })
  @Get(':docId')
  getConfig(@Param('docId') docId: string) {
    return this.appConfigService.getConfig(docId);
  }

  @ApiOperation({ summary: 'Set (replace) a generic app_config document' })
  @Patch(':docId')
  @HttpCode(HttpStatus.OK)
  setConfig(
    @Param('docId') docId: string,
    @Body() body: { data: Record<string, any>; description?: string },
  ) {
    return this.appConfigService.setConfig(docId, body.data, body.description);
  }
}

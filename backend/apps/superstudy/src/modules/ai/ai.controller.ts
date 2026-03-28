import {
  Controller, Post, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('AI')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // ──────────────────────────────────────────
  // Unified proxy — mirrors aiProxy.js processRequest()
  // Single entry point supporting all actions/modes
  // ──────────────────────────────────────────

  @ApiOperation({
    summary: 'Unified AI proxy — mirrors original Cloud Function aiProxy endpoint',
    description:
      'Accepts the same input shape as the original Firebase Cloud Function: action, modelProfile, mode, ' +
      'systemPrompt, userContent, image, audio, fileData, images[], thinkingLevel, mediaResolution, ' +
      'speechConfig, courseConfig, responseFormat. Routes internally to the correct provider/mode.',
  })
  @Post('proxy')
  @HttpCode(HttpStatus.OK)
  proxy(@Body() body: {
    action?: string;
    modelProfile?: string;
    mode?: string;
    systemPrompt?: string;
    userContent?: string;
    responseFormat?: string;
    image?: string;
    mimeType?: string;
    audio?: string;
    fileData?: string;
    fileMimeType?: string;
    images?: Array<{ data: string; mimeType: string }>;
    thinkingLevel?: string;
    mediaResolution?: string;
    speechConfig?: Record<string, any>;
    courseConfig?: Record<string, any>;
    text?: string;
    lang?: string;
    prompt?: string;
    model?: string;
  }) {
    return this.aiService.proxy(body);
  }

  // ──────────────────────────────────────────
  // Individual feature endpoints
  // ──────────────────────────────────────────

  @ApiOperation({ summary: 'Text chat completion (routes to Gemini or OpenRouter based on modelProfile)' })
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() body: {
    modelProfile?: string;
    systemPrompt?: string;
    userContent: string;
    responseFormat?: string;
    thinkingLevel?: string;
    images?: Array<{ data: string; mimeType: string }>;
    mediaResolution?: string;
  }) {
    return this.aiService.chat(body);
  }

  @ApiOperation({
    summary: 'File/PDF chat — send a PDF or document to Gemini for Q&A',
    description: 'Mirrors file_chat mode. fileData must be base64-encoded. mimeType defaults to application/pdf.',
  })
  @Post('file-chat')
  @HttpCode(HttpStatus.OK)
  fileChat(@Body() body: {
    modelProfile?: string;
    systemPrompt?: string;
    userContent: string;
    fileData: string;
    fileMimeType?: string;
    responseFormat?: string;
    thinkingLevel?: string;
  }) {
    return this.aiService.proxy({
      mode: 'file_chat',
      modelProfile: body.modelProfile,
      systemPrompt: body.systemPrompt,
      userContent: body.userContent,
      fileData: body.fileData,
      fileMimeType: body.fileMimeType,
      responseFormat: body.responseFormat,
      thinkingLevel: body.thinkingLevel,
    });
  }

  @ApiOperation({
    summary: 'Hugging Face image generation (uses HF_API_TOKEN)',
    description: 'Mirrors hf_image action from original aiProxy.js. Requires HF_API_TOKEN env var.',
  })
  @Post('hf-image')
  @HttpCode(HttpStatus.OK)
  hfImage(@Body() body: {
    prompt: string;
    model?: string;
  }) {
    return this.aiService.hfImageGenerate(body);
  }

  @ApiOperation({ summary: 'Audio evaluation — pronunciation or speaking grading (Gemini audio mode)' })
  @Post('audio-eval')
  @HttpCode(HttpStatus.OK)
  audioEval(@Body() body: {
    modelProfile?: string;
    systemPrompt: string;
    userContent: string;
    audio: string;
    mimeType?: string;
    responseFormat?: string;
  }) {
    return this.aiService.audioEval(body);
  }

  @ApiOperation({ summary: 'Google Translate TTS proxy — returns base64 audio blob' })
  @Post('tts')
  @HttpCode(HttpStatus.OK)
  tts(@Body() body: { text: string; lang?: string }) {
    return this.aiService.gtts(body.text, body.lang);
  }

  @ApiOperation({ summary: 'Gemini TTS — returns base64 audio blob (WAV or MP3)' })
  @Post('tts/gemini')
  @HttpCode(HttpStatus.OK)
  geminiTts(@Body() body: {
    modelProfile?: string;
    text: string;
    courseConfig?: { instructions?: string; speed?: number };
    speechConfig?: Record<string, any>;
  }) {
    return this.aiService.geminiTts(body);
  }

  @ApiOperation({ summary: 'Image generation via Google Imagen' })
  @Post('image-generate')
  @HttpCode(HttpStatus.OK)
  imageGenerate(@Body() body: {
    modelProfile?: string;
    prompt: string;
  }) {
    return this.aiService.imageGenerate(body);
  }

  // ──────────────────────────────────────────
  // Grammar AI endpoints (mirror aiGrammarService.js)
  // ──────────────────────────────────────────

  @ApiOperation({ summary: 'Generate 4 grammar question variations + improved original' })
  @Post('grammar/generate-variations')
  @HttpCode(HttpStatus.OK)
  generateVariations(@Body() body: {
    originalQuestion: Record<string, any>;
    purpose: string;
    type: string;
    settings?: Record<string, any>;
  }) {
    return this.aiService.generateGrammarVariations(body);
  }

  @ApiOperation({ summary: 'Generate 1 single new grammar question variation' })
  @Post('grammar/generate-single-variation')
  @HttpCode(HttpStatus.OK)
  generateSingleVariation(@Body() body: {
    originalQuestion: Record<string, any>;
    purpose: string;
    type: string;
    settings?: Record<string, any>;
  }) {
    return this.aiService.generateSingleGrammarVariation(body);
  }

  @ApiOperation({ summary: 'Grade a student\'s written/typed grammar answer with AI' })
  @Post('grammar/grade')
  @HttpCode(HttpStatus.OK)
  gradeGrammar(@Body() body: {
    question: Record<string, any>;
    studentAnswer: any;
    purpose: string;
    type: string;
    specialRequirement?: string;
    context?: string;
    teacherTitle?: string;
    studentTitle?: string;
    questionIndex?: number;
    totalQuestions?: number;
    cefrLevel?: string;
    maxPoints?: number;
    useDefaultCriteria?: boolean;
  }) {
    return this.aiService.gradeGrammarSubmission(body);
  }

  @ApiOperation({ summary: 'AI-grade fill-in-blank typing blanks (lightweight — returns boolean[])' })
  @Post('grammar/grade-fill-in-blank')
  @HttpCode(HttpStatus.OK)
  gradeFillInBlank(@Body() body: {
    questionText: string;
    blanks: Array<{ idx: number; expected: string; studentAnswer: string; exactMatch: boolean }>;
    context?: string;
  }) {
    return this.aiService.gradeFillInBlankBlanks(body);
  }

  @ApiOperation({ summary: 'Classify error category for a grammar question' })
  @Post('grammar/classify-error')
  @HttpCode(HttpStatus.OK)
  classifyError(@Body() body: {
    targetSkill: string;
    type: string;
    purpose: string;
    questionText: string;
    options?: string[];
  }) {
    return this.aiService.classifyErrorCategory(body);
  }

  @ApiOperation({ summary: 'Grade audio answer for exam/grammar questions' })
  @Post('audio-grade')
  @HttpCode(HttpStatus.OK)
  gradeAudio(@Body() body: {
    audio: string;
    mimeType?: string;
    questionText: string;
    purpose: string;
    specialRequirement?: string;
    maxPoints?: number;
    context?: string;
    teacherTitle?: string;
    studentTitle?: string;
    questionIndex?: number;
    totalQuestions?: number;
    cefrLevel?: string;
    useDefaultCriteria?: boolean;
  }) {
    return this.aiService.gradeAudioAnswer(body);
  }

  @ApiOperation({ summary: 'Evaluate pronunciation from audio (returns score, transcript, feedback)' })
  @Post('pronunciation-eval')
  @HttpCode(HttpStatus.OK)
  evaluatePronunciation(@Body() body: {
    audio: string;
    mimeType?: string;
    targetWord: string;
    targetIpa?: string;
  }) {
    return this.aiService.evaluatePronunciation(body);
  }
}

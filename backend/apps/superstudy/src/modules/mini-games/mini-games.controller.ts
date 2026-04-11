import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MiniGamesService } from './mini-games.service';

@ApiTags('Mini Games')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('mini-games')
export class MiniGamesController {
  constructor(private readonly service: MiniGamesService) {}

  @ApiOperation({ summary: 'Get all mini games' })
  @Get()
  getAll() {
    return this.service.getAll();
  }

  @ApiOperation({ summary: 'Get my games' })
  @Get('me')
  getMyGames(@Query('userId') userId: string) {
    return this.service.getMyGames(userId);
  }

  @ApiOperation({ summary: 'Get approved games' })
  @Get('approved/list')
  getApprovedGames() {
    return this.service.getApprovedGames();
  }

  @ApiOperation({ summary: 'Get pending games' })
  @Get('pending/list')
  getPendingGames() {
    return this.service.getPendingGames();
  }

  @ApiOperation({ summary: 'Get pending games count' })
  @Get('pending/count')
  getPendingGamesCount() {
    return this.service.getPendingGamesCount();
  }

  @ApiOperation({ summary: 'Upload a single HTML mini game build' })
  @Post(':id/assets/single')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  uploadSingleHtmlAsset(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.service.uploadSingleHtmlAsset(id, file, this.service.buildPublicBaseUrl(req));
  }

  @ApiOperation({ summary: 'Upload a bundle asset file for a mini game dist build' })
  @Post(':id/assets/bundle')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        path: { type: 'string' },
        bundleVersion: { type: 'string' },
      },
      required: ['file', 'path', 'bundleVersion'],
    },
  })
  uploadBundleAsset(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('path') assetPath: string,
    @Body('bundleVersion') bundleVersion: string,
  ) {
    return this.service.uploadBundleAsset(id, bundleVersion, assetPath, file);
  }

  @ApiOperation({ summary: 'Upload a mini game thumbnail' })
  @Post(':id/assets/thumbnail')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.service.uploadThumbnail(id, file, this.service.buildPublicBaseUrl(req));
  }

  @ApiOperation({ summary: 'Serve a mini game thumbnail' })
  @Get(':id/assets/thumbnail')
  async serveThumbnail(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.service.serveThumbnail(id, res);
  }

  @ApiOperation({ summary: 'Serve a single-file mini game asset' })
  @Get(':id/assets/single/index.html')
  async serveSingleHtml(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.service.serveSingleHtml(id, res);
  }

  @ApiOperation({ summary: 'Serve a bundled mini game asset' })
  @Get(':id/assets/bundles/:bundleVersion/:entryPath(*)')
  async serveBundleAsset(
    @Param('id') id: string,
    @Param('bundleVersion') bundleVersion: string,
    @Param('entryPath') entryPath: string,
    @Res() res: Response,
  ) {
    return this.service.serveBundleAsset(id, bundleVersion, entryPath, res);
  }

  @ApiOperation({ summary: 'Get game by id' })
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @ApiOperation({ summary: 'Create new game' })
  @Post()
  createGame(@Body() body: Record<string, any>) {
    return this.service.createGame(body);
  }

  @ApiOperation({ summary: 'Update game' })
  @Patch(':id')
  updateGame(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateGame(id, body);
  }

  @ApiOperation({ summary: 'Delete game' })
  @Delete(':id')
  deleteGame(@Param('id') id: string) {
    return this.service.deleteGame(id);
  }

  @ApiOperation({ summary: 'Submit for review' })
  @Patch(':id/submit')
  submitForReview(@Param('id') id: string, @Body('userId') userId: string) {
    return this.service.submitForReview(id, userId);
  }

  @ApiOperation({ summary: 'Approve game' })
  @Patch(':id/approve')
  approveGame(@Param('id') id: string, @Body('adminId') adminId: string) {
    return this.service.approveGame(id, adminId);
  }

  @ApiOperation({ summary: 'Reject game' })
  @Patch(':id/reject')
  rejectGame(@Param('id') id: string, @Body() body: { adminId: string, note?: string }) {
    return this.service.rejectGame(id, body.adminId, body.note);
  }
}

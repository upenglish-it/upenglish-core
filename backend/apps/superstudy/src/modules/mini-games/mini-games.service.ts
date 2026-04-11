import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { promises as fs } from 'fs';
import { contentType as getContentType } from 'mime-types';
import * as nodePath from 'path';
import type { Request, Response } from 'express';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { SSTMiniGames } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class MiniGamesService {
  private readonly storageRoot = nodePath.resolve(process.cwd(), 'storage', 'mini-games');

  constructor(
    @InjectModel(SSTMiniGames)
    private readonly model: ReturnModelType<typeof SSTMiniGames>,
  ) {}

  buildPublicBaseUrl(req: Request) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const requestPath = req.originalUrl || '';
    const miniGamesPrefix = requestPath.includes('/mini-games/')
      ? `${requestPath.split('/mini-games/')[0]}/mini-games`
      : '/api/v1/mini-games';
    return `${origin}${miniGamesPrefix}`;
  }

  private normalizeStoragePath(...segments: string[]) {
    return nodePath.join(this.storageRoot, ...segments);
  }

  private sanitizeRelativePath(input: string, fallback = 'index.html') {
    const normalized = String(input || fallback)
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/');

    const parts = normalized
      .split('/')
      .map(part => part.trim())
      .filter(Boolean);

    if (!parts.length || parts.some(part => part === '.' || part === '..')) {
      throw new BadRequestException('Invalid asset path');
    }

    return parts.join('/');
  }

  private async ensureDir(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  private async writeAssetFile(filePath: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing file upload');
    }

    await this.ensureDir(nodePath.dirname(filePath));
    await fs.writeFile(filePath, file.buffer);
  }

  private async sendAssetFile(filePath: string, res: Response) {
    try {
      const buffer = await fs.readFile(filePath);
      const detectedType = getContentType(nodePath.basename(filePath)) || 'application/octet-stream';
      // Mini game assets are intentionally launched inside the frontend iframe on localhost:5173.
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Content-Type', detectedType);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(buffer);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new NotFoundException('Mini game asset not found');
      }
      throw error;
    }
  }

  private async removeThumbnailVariants(gameId: string) {
    const gameDir = this.normalizeStoragePath(gameId);

    try {
      const entries = await fs.readdir(gameDir);
      await Promise.all(
        entries
          .filter(entry => entry.startsWith('thumbnail.'))
          .map(entry => fs.unlink(nodePath.join(gameDir, entry))),
      );
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  private getSingleHtmlFilePath(gameId: string) {
    return this.normalizeStoragePath(gameId, 'single', 'index.html');
  }

  private getBundleAssetFilePath(gameId: string, bundleVersion: string, assetPath: string) {
    return this.normalizeStoragePath(gameId, 'bundles', bundleVersion, ...assetPath.split('/'));
  }

  private getSingleHtmlLaunchUrl(baseUrl: string, gameId: string) {
    return `${baseUrl}/${encodeURIComponent(gameId)}/assets/single/index.html`;
  }

  private getBundleLaunchUrl(baseUrl: string, gameId: string, bundleVersion: string, entryPath = 'index.html') {
    const encodedEntryPath = this.sanitizeRelativePath(entryPath)
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');

    return `${baseUrl}/${encodeURIComponent(gameId)}/assets/bundles/${encodeURIComponent(bundleVersion)}/${encodedEntryPath}`;
  }

  private mapDoc(doc: any) {
    if (!doc) return null;
    return {
      id: doc._id,
      ...doc,
      createdAt: doc.createdAt
        ? { seconds: Math.floor(new Date(doc.createdAt).getTime() / 1000) }
        : null,
    };
  }

  async uploadSingleHtmlAsset(id: string, file: Express.Multer.File, baseUrl: string) {
    const isHtmlFile = /\.(html?)$/i.test(file?.originalname || '');
    if (!isHtmlFile) {
      throw new BadRequestException('Mini game HTML upload must be a .html or .htm file');
    }

    const filePath = this.getSingleHtmlFilePath(id);
    await this.writeAssetFile(filePath, file);

    const launchUrl = this.getSingleHtmlLaunchUrl(baseUrl, id);

    return {
      deliveryMode: 'single_html',
      gameUrl: launchUrl,
      launchUrl,
      entryPath: 'index.html',
      storagePrefix: `mini-games/${id}/single`,
      bundleVersion: null,
      fileName: file.originalname || 'index.html',
    };
  }

  async uploadBundleAsset(
    id: string,
    bundleVersion: string,
    assetPath: string,
    file: Express.Multer.File,
  ) {
    const safeBundleVersion = String(bundleVersion || '').trim();
    if (!safeBundleVersion) {
      throw new BadRequestException('Missing bundle version');
    }

    const safeAssetPath = this.sanitizeRelativePath(assetPath);
    const filePath = this.getBundleAssetFilePath(id, safeBundleVersion, safeAssetPath);
    await this.writeAssetFile(filePath, file);

    return {
      success: true,
      path: safeAssetPath,
    };
  }

  async uploadThumbnail(id: string, file: Express.Multer.File, baseUrl: string) {
    const extension = nodePath.extname(file?.originalname || '').toLowerCase();
    if (!extension || !['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
      throw new BadRequestException('Thumbnail must be a PNG, JPG, WEBP, GIF or SVG image');
    }

    await this.removeThumbnailVariants(id);
    const filePath = this.normalizeStoragePath(id, `thumbnail${extension}`);
    await this.writeAssetFile(filePath, file);

    return {
      url: `${baseUrl}/${encodeURIComponent(id)}/assets/thumbnail?v=${Date.now()}`,
    };
  }

  async serveThumbnail(id: string, res: Response) {
    const gameDir = this.normalizeStoragePath(id);
    try {
      const entries = await fs.readdir(gameDir);
      const thumbnailFile = entries.find(entry => entry.startsWith('thumbnail.'));
      if (!thumbnailFile) {
        throw new NotFoundException('Mini game thumbnail not found');
      }
      return this.sendAssetFile(nodePath.join(gameDir, thumbnailFile), res);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw new NotFoundException('Mini game thumbnail not found');
      }
      throw error;
    }
  }

  async serveSingleHtml(id: string, res: Response) {
    return this.sendAssetFile(this.getSingleHtmlFilePath(id), res);
  }

  async serveBundleAsset(id: string, bundleVersion: string, entryPath: string, res: Response) {
    const safeAssetPath = this.sanitizeRelativePath(entryPath);
    return this.sendAssetFile(this.getBundleAssetFilePath(id, bundleVersion, safeAssetPath), res);
  }

  async getAll() {
    const docs = await this.model.find().sort({ createdAt: -1 }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async getMyGames(userId: string) {
    const docs = await this.model.find({ createdBy: userId }).sort({ createdAt: -1 }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async getApprovedGames() {
    const docs = await this.model.find({ status: 'approved', isActive: true }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async getPendingGames() {
    const docs = await this.model.find({ status: 'pending_review' }).sort({ submittedAt: -1 }).lean();
    return docs.map(d => this.mapDoc(d));
  }

  async getPendingGamesCount() {
    const count = await this.model.countDocuments({ status: 'pending_review' });
    return { count };
  }

  async getById(id: string) {
    const doc = await this.model.findById(id).lean();
    return this.mapDoc(doc);
  }

  async createGame(data: Record<string, any>) {
    const newId = SYSTEM_ID();
    const payload = {
      _id: newId,
      ...data,
      minWords: data.minWords ?? data.minItems ?? 0,
      maxWords: data.maxWords ?? data.maxItems ?? 0,
      status: 'draft',
      isActive: false,
      properties: '',
      propertiesBranches: '',
      changeLog: [{
        action: 'created',
        at: new Date().toISOString(),
        by: data.createdBy,
      }],
    };
    await this.model.create(payload);
    return this.mapDoc(payload);
  }

  async updateGame(id: string, data: Record<string, any>) {
    const {
      _id, createdAt, createdBy, status, changeLog, ...updateData
    } = data;

    if (updateData.minItems !== undefined && updateData.minWords === undefined) {
      updateData.minWords = updateData.minItems;
    }
    if (updateData.maxItems !== undefined && updateData.maxWords === undefined) {
      updateData.maxWords = updateData.maxItems;
    }

    const updated = await this.model.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
    if (!updated) throw new NotFoundException('Game not found');
    return this.mapDoc(updated);
  }

  async deleteGame(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Game not found');
    return { success: true };
  }

  async submitForReview(id: string, userId: string) {
    const logEntry = { action: 'submitted', at: new Date().toISOString(), by: userId };
    const updated = await this.model.findByIdAndUpdate(id, {
      $set: { status: 'pending_review', submittedAt: new Date() },
      $push: { changeLog: logEntry },
    }, { new: true }).lean();
    return this.mapDoc(updated);
  }

  async approveGame(id: string, adminId: string) {
    const logEntry = { action: 'approved', at: new Date().toISOString(), by: adminId };
    const updated = await this.model.findByIdAndUpdate(id, {
      $set: {
        status: 'approved',
        isActive: true,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: '',
      },
      $push: { changeLog: logEntry },
    }, { new: true }).lean();
    return this.mapDoc(updated);
  }

  async rejectGame(id: string, adminId: string, note = '') {
    const logEntry = {
      action: 'rejected',
      at: new Date().toISOString(),
      by: adminId,
      note,
    };
    const updated = await this.model.findByIdAndUpdate(id, {
      $set: {
        status: 'rejected',
        isActive: false,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
      $push: { changeLog: logEntry },
    }, { new: true }).lean();
    return this.mapDoc(updated);
  }
}

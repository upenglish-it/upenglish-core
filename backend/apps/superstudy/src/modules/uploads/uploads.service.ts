import { BadRequestException, Injectable } from '@nestjs/common';
import { AWSS3Service } from 'apps/common';

@Injectable()
export class UploadsService {
  constructor(private readonly awsS3Service: AWSS3Service) {}

  private normalizeUploadedRoot() {
    return String(process.env.AWS_S3_UPLOADED_FILES || '')
      .trim()
      .replace(/^\/+|\/+$/g, '');
  }

  private sanitizeFolder(folder: string) {
    const normalized = String(folder || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '');

    if (!normalized) {
      throw new BadRequestException('folder is required');
    }

    if (!/^[a-zA-Z0-9/_-]+$/.test(normalized)) {
      throw new BadRequestException('folder contains invalid characters');
    }

    return normalized;
  }

  private inferExtension(file: Express.Multer.File) {
    const originalExt = String(file.originalname || '').split('.').pop()?.toLowerCase();
    if (originalExt) return originalExt;

    const mimeExt = String(file.mimetype || '').split('/').pop()?.toLowerCase();
    return mimeExt || 'bin';
  }

  async uploadPublic(file: Express.Multer.File | undefined, folder: string) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }

    const sanitizedFolder = this.sanitizeFolder(folder);
    const uploadedRoot = this.normalizeUploadedRoot();
    const pathName = [uploadedRoot, sanitizedFolder].filter(Boolean).join('/');
    const extension = this.inferExtension(file);
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const uploaded = await this.awsS3Service.uploadPublicFile(
      file.buffer,
      file.mimetype,
      pathName,
      fileName,
    );

    return {
      url: uploaded.data && 'cdn' in uploaded.data ? uploaded.data.cdn : '',
      fileName,
      folder: sanitizedFolder,
    };
  }

  async deletePublic(url: string) {
    if (!url) {
      throw new BadRequestException('url is required');
    }

    const uploadedRoot = this.normalizeUploadedRoot();
    const parsedUrl = new URL(url);
    const normalizedPath = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));

    if (uploadedRoot && !normalizedPath.includes(`/${uploadedRoot}/`) && !normalizedPath.startsWith(`${uploadedRoot}/`)) {
      return { deleted: false, skipped: true };
    }

    await this.awsS3Service.deletePublicFileByUrl(url);
    return { deleted: true };
  }
}

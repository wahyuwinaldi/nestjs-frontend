import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { errorCode, errorMessage } from '../common/error-message';

function normalizeBaseUrl(base = ''): string {
  return base.replace(/\/$/, '');
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      );
    }),
  ]);
}

function contentTypeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.webp':
      return 'image/webp';
    case '.webm':
      return 'video/webm';
    case '.mp4':
      return 'video/mp4';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Client;
  readonly bucket: string;
  readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const endPoint = this.config.get<string>('MINIO_ENDPOINT', '127.0.0.1');
    const port = Number(this.config.get<string>('MINIO_PORT', '9000'));
    const useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin');
    const region = this.config.get<string>('MINIO_REGION') || undefined;

    this.bucket = this.config.get<string>('MINIO_BUCKET', 'template-uploads');
    this.publicUrl = normalizeBaseUrl(
      this.config.get<string>('MINIO_PUBLIC_URL') ||
        `${useSSL ? 'https' : 'http'}://${endPoint}${port === 443 || port === 80 ? '' : `:${port}`}`,
    );

    this.client = new Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
      region,
    });

    this.logger.log(
      `MinIO client initialized (endPoint=${endPoint}:${port}, ssl=${useSSL}, bucket=${this.bucket}, publicUrl=${this.publicUrl})`,
    );
  }

  async onModuleInit(): Promise<void> {
    const skip = this.config.get<string>('MINIO_SKIP_STARTUP_CHECK') === 'true';
    if (skip) {
      this.logger.warn(
        'MinIO bucket check skipped (MINIO_SKIP_STARTUP_CHECK=true)',
      );
      return;
    }

    const timeout = Number(
      this.config.get<string>('MINIO_STARTUP_TIMEOUT', '8000'),
    );
    try {
      const ready = await withTimeout(
        this.ensureBucket(),
        timeout,
        'MinIO bucket check',
      );
      if (ready) {
        this.logger.log(`MinIO bucket "${this.bucket}" ready`);
      } else {
        this.logger.warn(
          `MinIO bucket "${this.bucket}" not accessible; uploads will fail until MinIO is reachable`,
        );
      }
    } catch (err: unknown) {
      this.logger.warn(errorMessage(err));
      this.logger.warn(
        'Set MINIO_SKIP_STARTUP_CHECK=true for local development without MinIO',
      );
    }
  }

  async ensureBucket(): Promise<boolean> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        const region = this.config.get<string>('MINIO_REGION') || undefined;
        await this.client.makeBucket(this.bucket, region);
        this.logger.log(`Created MinIO bucket "${this.bucket}"`);
      }
      return true;
    } catch (error: unknown) {
      this.logger.error(`ensureBucket failed: ${errorMessage(error)}`);
      if (errorCode(error) === 'NoSuchBucket') {
        try {
          const region = this.config.get<string>('MINIO_REGION') || undefined;
          await this.client.makeBucket(this.bucket, region);
          return true;
        } catch (makeErr: unknown) {
          this.logger.error(`makeBucket failed: ${errorMessage(makeErr)}`);
          return false;
        }
      }
      return false;
    }
  }

  /** Object key pattern aligned with mess: `{folder}/{YYYY-MM-DD}/{uuid}{ext}` */
  buildObjectKey(filename: string, folder = 'uploads'): string {
    const ext = path.extname(filename || '').toLowerCase() || '';
    const uuid = randomUUID().replaceAll('-', '');
    const dateSegment = new Date().toISOString().split('T')[0];
    const prefix = String(folder || '').replace(/^\/+|\/+$/g, '');
    return prefix
      ? `${prefix}/${dateSegment}/${uuid}${ext}`
      : `${dateSegment}/${uuid}${ext}`;
  }

  getPublicUrl(objectKey: string | null | undefined): string | null {
    if (!objectKey) return null;
    if (/^https?:\/\//i.test(objectKey)) return objectKey;
    return `${this.publicUrl}/${this.bucket}/${String(objectKey).replace(/^\//, '')}`.replace(
      /([^:]\/)\/+/g,
      '$1',
    );
  }

  async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    meta: Record<string, string> = {},
  ): Promise<string> {
    const start = Date.now();
    try {
      await this.client.putObject(
        this.bucket,
        objectKey,
        buffer,
        buffer.length,
        meta,
      );
      this.logger.log(
        `Uploaded ${objectKey} (${buffer.length} bytes) to ${this.bucket} in ${Date.now() - start}ms`,
      );
      return objectKey;
    } catch (error: unknown) {
      this.logger.error(
        `uploadBuffer failed for ${objectKey}: ${errorMessage(error)}`,
      );
      throw new Error(
        `Gagal mengunggah file ke MinIO: ${errorMessage(error)}. Pastikan MinIO server dapat diakses.`,
      );
    }
  }

  /**
   * Upload a final media buffer and return the public proxy URL
   * e.g. https://storage.example.com/template-uploads/uploads/....webp
   */
  async uploadFinalMedia(
    buffer: Buffer,
    filename: string,
    folder = 'uploads',
  ): Promise<{
    objectKey: string;
    publicUrl: string;
  }> {
    const objectKey = this.buildObjectKey(filename, folder);
    const ext = path.extname(filename || '').toLowerCase();
    await this.uploadBuffer(buffer, objectKey, {
      'Content-Type': contentTypeForExt(ext),
    });
    const publicUrl = this.getPublicUrl(objectKey);
    if (!publicUrl) {
      throw new Error('Gagal membangun URL publik MinIO');
    }
    return { objectKey, publicUrl };
  }

  /**
   * Upload dengan object key tetap (overwrite), e.g. settings/{kode} seperti MESS.
   * Extensi diabaikan di key agar URL publik `/assets/{kode}` tetap stabil.
   */
  async uploadFixedKey(
    buffer: Buffer,
    objectKey: string,
    filenameOrExt = '',
  ): Promise<{ objectKey: string; publicUrl: string }> {
    const key = String(objectKey || '')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/');
    if (!key) {
      throw new Error('Object key tidak boleh kosong');
    }
    const ext = path.extname(filenameOrExt || '').toLowerCase();
    await this.uploadBuffer(buffer, key, {
      'Content-Type': contentTypeForExt(ext),
    });
    const publicUrl = this.getPublicUrl(key);
    if (!publicUrl) {
      throw new Error('Gagal membangun URL publik MinIO');
    }
    return { objectKey: key, publicUrl };
  }

  /** Object key branding settings: settings/{kode} */
  buildSettingsObjectKey(kode: string): string {
    const trimmed = String(kode || '').trim();
    if (!trimmed) {
      throw new Error('Kode settings tidak boleh kosong');
    }
    return `settings/${trimmed}`;
  }

  async deleteObject(objectKey: string): Promise<boolean> {
    if (!objectKey) return false;

    let key = objectKey;
    if (/^https?:\/\//i.test(objectKey)) {
      const extracted = this.objectKeyFromPublicUrl(objectKey);
      if (!extracted) return false;
      key = extracted;
    }

    try {
      await this.client.removeObject(this.bucket, key);
      this.logger.log(`Deleted MinIO object ${key} from ${this.bucket}`);
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `deleteObject failed for ${key}: ${errorMessage(error)}`,
      );
      return false;
    }
  }

  /** Hapus hanya jika value adalah URL publik bucket ini (hindari menghapus file lokal legacy). */
  async deleteObjectIfOwned(
    value: string | null | undefined,
  ): Promise<boolean> {
    if (!value || !/^https?:\/\//i.test(value)) return false;
    if (!value.includes(`/${this.bucket}/`)) return false;
    return this.deleteObject(value);
  }

  objectKeyFromPublicUrl(value: string): string | null {
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) return value.replace(/^\//, '');
    const marker = `/${this.bucket}/`;
    const idx = value.indexOf(marker);
    if (idx === -1) return null;
    return value.slice(idx + marker.length);
  }
}

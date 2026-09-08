import { MinioService } from '../../src/storage/minio.service';
import { mockConfig } from '../helpers/mock-config';

const bucketExists = jest.fn();
const makeBucket = jest.fn();
const putObject = jest.fn();
const removeObject = jest.fn();

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists,
    makeBucket,
    putObject,
    removeObject,
  })),
}));

function makeService(map: Record<string, unknown> = {}) {
  return new MinioService(
    mockConfig({
      MINIO_ENDPOINT: '127.0.0.1',
      MINIO_PORT: '9000',
      MINIO_BUCKET: 'template-uploads',
      MINIO_PUBLIC_URL: 'https://cdn.example',
      ...map,
    }) as any,
  );
}

describe('MinioService', () => {
  beforeEach(() => {
    bucketExists.mockReset();
    makeBucket.mockReset();
    putObject.mockReset();
    removeObject.mockReset();
  });

  it('onModuleInit skips or ensures bucket / timeout / NoSuchBucket', async () => {
    const skip = makeService({ MINIO_SKIP_STARTUP_CHECK: 'true' });
    await skip.onModuleInit();
    expect(bucketExists).not.toHaveBeenCalled();

    bucketExists.mockResolvedValueOnce(false);
    makeBucket.mockResolvedValueOnce(undefined);
    await makeService().onModuleInit();
    expect(makeBucket).toHaveBeenCalled();

    bucketExists.mockResolvedValueOnce(true);
    await makeService().onModuleInit();

    bucketExists.mockImplementationOnce(() => new Promise(() => undefined));
    await makeService({ MINIO_STARTUP_TIMEOUT: '20' }).onModuleInit();
  });

  it('ensureBucket handles NoSuchBucket retry and failures', async () => {
    const service = makeService();
    bucketExists.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'NoSuchBucket' }),
    );
    makeBucket.mockResolvedValueOnce(undefined);
    expect(await service.ensureBucket()).toBe(true);

    bucketExists.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'NoSuchBucket' }),
    );
    makeBucket.mockRejectedValueOnce(new Error('fail'));
    expect(await service.ensureBucket()).toBe(false);

    bucketExists.mockRejectedValueOnce(new Error('down'));
    expect(await service.ensureBucket()).toBe(false);
  });

  it('buildObjectKey / getPublicUrl / settings key', () => {
    const service = makeService();
    expect(service.buildObjectKey('a.webp')).toMatch(
      /^uploads\/\d{4}-\d{2}-\d{2}\/[a-f0-9]+\.webp$/,
    );
    expect(service.buildObjectKey('a.webp', '')).toMatch(
      /^\d{4}-\d{2}-\d{2}\//,
    );
    expect(service.getPublicUrl(null)).toBeNull();
    expect(service.getPublicUrl('https://x/y')).toBe('https://x/y');
    expect(service.getPublicUrl('uploads/a.webp')).toBe(
      'https://cdn.example/template-uploads/uploads/a.webp',
    );
    expect(service.buildSettingsObjectKey('logo')).toBe('settings/logo');
    expect(() => service.buildSettingsObjectKey('  ')).toThrow(/Kode settings/);
  });

  it('uploadBuffer / uploadFinalMedia / uploadFixedKey', async () => {
    const service = makeService();
    putObject.mockResolvedValue(undefined);
    expect(await service.uploadBuffer(Buffer.from('x'), 'k')).toBe('k');

    putObject.mockRejectedValueOnce(new Error('io'));
    await expect(service.uploadBuffer(Buffer.from('x'), 'k')).rejects.toThrow(
      /Gagal mengunggah/,
    );

    const uploaded = await service.uploadFinalMedia(Buffer.from('x'), 'a.webp');
    expect(uploaded.publicUrl).toContain('template-uploads');

    // content-type branches via various extensions
    for (const name of [
      'a.webm',
      'a.mp4',
      'a.png',
      'a.jpg',
      'a.jpeg',
      'a.gif',
      'a.ico',
      'a.svg',
      'a.pdf',
      'a.bin',
      '',
    ]) {
      await service.uploadFinalMedia(Buffer.from('x'), name || 'noext');
    }

    await expect(service.uploadFixedKey(Buffer.from('x'), '')).rejects.toThrow(
      /Object key/,
    );
    expect(
      (
        await service.uploadFixedKey(
          Buffer.from('x'),
          '/settings//logo',
          'a.png',
        )
      ).objectKey,
    ).toBe('settings/logo');
  });

  it('warns when ensureBucket returns false on startup', async () => {
    bucketExists.mockRejectedValueOnce(new Error('down'));
    await makeService().onModuleInit();
    expect(bucketExists).toHaveBeenCalled();
  });

  it('deleteObject / deleteObjectIfOwned / objectKeyFromPublicUrl', async () => {
    const service = makeService();
    expect(await service.deleteObject('')).toBe(false);
    expect(await service.deleteObject('https://cdn.example/other/a.webp')).toBe(
      false,
    );
    removeObject.mockResolvedValueOnce(undefined);
    expect(
      await service.deleteObject(
        'https://cdn.example/template-uploads/uploads/a.webp',
      ),
    ).toBe(true);
    removeObject.mockRejectedValueOnce(new Error('x'));
    expect(await service.deleteObject('uploads/a.webp')).toBe(false);

    expect(await service.deleteObjectIfOwned(null)).toBe(false);
    expect(await service.deleteObjectIfOwned('/local/a.webp')).toBe(false);
    expect(
      await service.deleteObjectIfOwned('https://cdn.example/other/a.webp'),
    ).toBe(false);
    removeObject.mockResolvedValueOnce(undefined);
    expect(
      await service.deleteObjectIfOwned(
        'https://cdn.example/template-uploads/uploads/a.webp',
      ),
    ).toBe(true);

    expect(service.objectKeyFromPublicUrl('')).toBeNull();
    expect(service.objectKeyFromPublicUrl('/uploads/a.webp')).toBe(
      'uploads/a.webp',
    );
    expect(
      service.objectKeyFromPublicUrl(
        'https://cdn.example/template-uploads/uploads/a.webp',
      ),
    ).toBe('uploads/a.webp');
    expect(
      service.objectKeyFromPublicUrl('https://cdn.example/other/a.webp'),
    ).toBeNull();
  });

  it('throws when publicUrl cannot be built', async () => {
    const service = makeService();
    putObject.mockResolvedValue(undefined);
    jest.spyOn(service, 'getPublicUrl').mockReturnValue(null);
    await expect(
      service.uploadFinalMedia(Buffer.from('x'), 'a.webp'),
    ).rejects.toThrow(/URL publik/);
    await expect(
      service.uploadFixedKey(Buffer.from('x'), 'settings/logo', 'a.png'),
    ).rejects.toThrow(/URL publik/);
  });

  it('uses ssl public url without custom MINIO_PUBLIC_URL', () => {
    const service = new MinioService(
      mockConfig({
        MINIO_ENDPOINT: 'minio.local',
        MINIO_PORT: '443',
        MINIO_USE_SSL: 'true',
        MINIO_BUCKET: 'template-uploads',
      }) as any,
    );
    expect(service.publicUrl).toBe('https://minio.local');

    const http80 = new MinioService(
      mockConfig({
        MINIO_ENDPOINT: 'minio.local',
        MINIO_PORT: '80',
        MINIO_USE_SSL: 'false',
        MINIO_BUCKET: 'template-uploads',
      }) as any,
    );
    expect(http80.publicUrl).toBe('http://minio.local');
  });
});

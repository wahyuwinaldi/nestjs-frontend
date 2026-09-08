import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../src/database/database.service';
import { MinioService } from '../../../src/storage/minio.service';
import { SettingsService } from '../../../src/system/settings/settings.service';
import { createDbMock, DbMock } from '../../helpers/mock-db';

describe('SettingsService', () => {
  let service: SettingsService;
  let db: DbMock;
  let minio: {
    deleteObjectIfOwned: jest.Mock;
    buildSettingsObjectKey: jest.Mock;
    uploadFixedKey: jest.Mock;
  };

  const row = {
    id_settings: 'ST001',
    nm_settings: 'Logo',
    kode: 'logo',
    value: 'https://cdn/template-uploads/settings/logo',
  };

  beforeEach(async () => {
    db = createDbMock();
    minio = {
      deleteObjectIfOwned: jest.fn().mockResolvedValue(true),
      buildSettingsObjectKey: jest.fn().mockReturnValue('settings/logo'),
      uploadFixedKey: jest.fn().mockResolvedValue({
        publicUrl: 'https://cdn/x',
        objectKey: 'settings/logo',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: DatabaseService, useValue: db },
        { provide: MinioService, useValue: minio },
      ],
    }).compile();
    service = module.get(SettingsService);
  });

  it('findAll / findById', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] });
    expect(await service.findAll()).toEqual([row]);
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(service.findById('ST001')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    db.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    expect(await service.findById('ST001')).toEqual(row);
  });

  it('create validates and generates ids', async () => {
    await expect(
      service.create({ nm_settings: '', kode: 'k', value: 'v' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ nm_settings: 'n', kode: '', value: 'v' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ nm_settings: 'n', kode: 'k', value: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ ...row, id_settings: 'ST001' }],
        rowCount: 1,
      });
    expect(
      (await service.create({ nm_settings: 'Logo', kode: 'logo', value: 'v' }))
        .id_settings,
    ).toBe('ST001');

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id_settings: 'ST009' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ ...row, id_settings: 'ST010' }],
        rowCount: 1,
      });
    expect(
      (await service.create({ nm_settings: 'X', kode: 'x', value: 'v' }))
        .id_settings,
    ).toBe('ST010');
  });

  it('create rejects duplicate kode', async () => {
    db.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    await expect(
      service.create({ nm_settings: 'n', kode: 'logo', value: 'v' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update / remove / upload', async () => {
    await expect(
      service.update({ id_settings: '', nm_settings: 'n', kode: 'k' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update({ id_settings: 'ST001', nm_settings: '', kode: 'k' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update({ id_settings: 'ST001', nm_settings: 'n', kode: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    db.query
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ ...row, kode: 'logo2' }],
        rowCount: 1,
      });
    await service.update({
      id_settings: 'ST001',
      nm_settings: 'Logo',
      kode: 'logo2',
      value: 'new',
    });
    expect(minio.deleteObjectIfOwned).toHaveBeenCalledWith(row.value);

    await expect(service.remove('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    db.query
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    expect(await service.remove('ST001')).toEqual({ id_settings: 'ST001' });
    expect(minio.deleteObjectIfOwned).toHaveBeenCalled();

    expect(
      await service.uploadSettingsFile(Buffer.from('x'), 'logo', 'a.png'),
    ).toBe('https://cdn/x');
  });

  it('getTheme / upsertTheme / reserved kode', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await service.getTheme()).toEqual({
      primary: 'emerald',
      surface: null,
      preset: 'Aura',
      menuMode: 'static',
    });

    db.query.mockResolvedValueOnce({
      rows: [
        {
          id_settings: 'ST009',
          nm_settings: 'UI Theme',
          kode: 'ui-theme',
          value:
            '{"primary":"blue","surface":"slate","preset":"Lara","menuMode":"overlay"}',
        },
      ],
      rowCount: 1,
    });
    expect(await service.getTheme()).toEqual({
      primary: 'blue',
      surface: 'slate',
      preset: 'Lara',
      menuMode: 'overlay',
    });

    await expect(
      service.upsertTheme({
        primary: 'nope',
        surface: null,
        preset: 'Aura',
        menuMode: 'static',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    expect(
      await service.upsertTheme({
        primary: 'blue',
        surface: 'slate',
        preset: 'Lara',
        menuMode: 'overlay',
      }),
    ).toEqual({
      primary: 'blue',
      surface: 'slate',
      preset: 'Lara',
      menuMode: 'overlay',
    });

    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id_settings: 'ST009',
            nm_settings: 'UI Theme',
            kode: 'ui-theme',
            value:
              '{"primary":"emerald","surface":null,"preset":"Aura","menuMode":"static"}',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    expect(
      await service.upsertTheme({
        primary: 'rose',
        surface: null,
        preset: 'Nora',
        menuMode: 'static',
      }),
    ).toEqual({
      primary: 'rose',
      surface: null,
      preset: 'Nora',
      menuMode: 'static',
    });

    await expect(
      service.create({
        nm_settings: 'X',
        kode: 'ui-theme',
        value: 'https://cdn/x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    db.query.mockResolvedValueOnce({
      rows: [
        {
          id_settings: 'ST009',
          nm_settings: 'UI Theme',
          kode: 'ui-theme',
          value: '{}',
        },
      ],
      rowCount: 1,
    });
    await expect(service.remove('ST009')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(service.parseThemeValue('not-json')).toEqual({
      primary: 'emerald',
      surface: null,
      preset: 'Aura',
      menuMode: 'static',
    });
  });

  it('normalizeTheme rejects invalid surface/preset/menuMode and clears empty surface', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    expect(
      await service.upsertTheme({
        primary: 'blue',
        surface: '   ',
        preset: 'Aura',
        menuMode: 'static',
      }),
    ).toEqual({
      primary: 'blue',
      surface: null,
      preset: 'Aura',
      menuMode: 'static',
    });

    await expect(
      service.upsertTheme({
        primary: 'blue',
        surface: 'not-a-surface',
        preset: 'Aura',
        menuMode: 'static',
      }),
    ).rejects.toThrow(/Surface theme/);

    await expect(
      service.upsertTheme({
        primary: 'blue',
        surface: null,
        preset: 'Nope',
        menuMode: 'static',
      }),
    ).rejects.toThrow(/Preset/);

    await expect(
      service.upsertTheme({
        primary: 'blue',
        surface: null,
        preset: 'Aura',
        menuMode: 'weird',
      }),
    ).rejects.toThrow(/Menu mode/);
  });

  it('update keeps existing value when new value omitted or blank', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    await service.update({
      id_settings: 'ST001',
      nm_settings: 'Logo',
      kode: 'logo',
      value: '   ',
    });
    const updateCall = db.query.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE'),
    );
    expect(updateCall?.[1]?.[3]).toBe(row.value);

    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await service.findByKode('missing')).toBeNull();

    expect(service.parseThemeValue(null)).toEqual(service.getDefaultTheme());
    expect(service.parseThemeValue(undefined)).toEqual(
      service.getDefaultTheme(),
    );
  });

  it('update rejects ui-theme kode on existing or target', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id_settings: 'ST009',
          nm_settings: 'UI Theme',
          kode: 'ui-theme',
          value: '{}',
        },
      ],
      rowCount: 1,
    });
    await expect(
      service.update({
        id_settings: 'ST009',
        nm_settings: 'UI Theme',
        kode: 'ui-theme',
      }),
    ).rejects.toThrow(/ui-theme/);

    db.query.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
    await expect(
      service.update({
        id_settings: 'ST001',
        nm_settings: 'Logo',
        kode: 'ui-theme',
      }),
    ).rejects.toThrow(/ui-theme/);
  });
});

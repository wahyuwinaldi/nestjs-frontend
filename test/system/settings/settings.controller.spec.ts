import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SettingsController } from '../../../src/system/settings/settings.controller';
import { SettingsService } from '../../../src/system/settings/settings.service';

async function* partsOf(items: any[]) {
  for (const item of items) yield item;
}

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([{ id_settings: 'ST001' }]),
      findById: jest.fn().mockResolvedValue({ id_settings: 'ST001' }),
      uploadSettingsFile: jest.fn().mockResolvedValue('https://cdn/x'),
      create: jest.fn().mockResolvedValue({ id_settings: 'ST002' }),
      update: jest
        .fn()
        .mockResolvedValue({ id_settings: 'ST001', kode: 'logo' }),
      remove: jest.fn().mockResolvedValue({ id_settings: 'ST001' }),
      upsertTheme: jest.fn().mockResolvedValue({
        primary: 'blue',
        surface: 'slate',
        preset: 'Lara',
        menuMode: 'overlay',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: service }],
    }).compile();
    controller = module.get(SettingsController);
  });

  it('findAll / findOne / remove / upsertTheme', async () => {
    expect((await controller.findAll()).data[0].id_settings).toBe('ST001');
    expect((await controller.findOne('ST001')).data.id_settings).toBe('ST001');
    expect((await controller.remove({ id_settings: 'ST001' })).data).toEqual({
      id_settings: 'ST001',
    });
    expect(
      (
        await controller.upsertTheme({
          primary: 'blue',
          surface: 'slate',
          preset: 'Lara',
          menuMode: 'overlay',
        })
      ).data.preset,
    ).toBe('Lara');
  });

  it('create/update require multipart and fields', async () => {
    await expect(
      controller.create({ headers: {} } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    const noFile = {
      headers: { 'content-type': 'multipart/form-data' },
      parts: () =>
        partsOf([{ type: 'field', fieldname: 'kode', value: 'logo' }]),
    };
    await expect(controller.create(noFile as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const noKode = {
      headers: { 'content-type': 'multipart/form-data' },
      parts: () =>
        partsOf([
          {
            type: 'file',
            fieldname: 'value',
            filename: 'a.png',
            toBuffer: async () => Buffer.from('x'),
          },
        ]),
    };
    await expect(controller.create(noKode as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const okCreate = {
      headers: { 'content-type': 'multipart/form-data' },
      parts: () =>
        partsOf([
          { type: 'field', fieldname: 'nm_settings', value: 'Logo' },
          { type: 'field', fieldname: 'kode', value: 'logo' },
          { type: 'field', fieldname: 'value', value: 'ignored' },
          {
            type: 'file',
            fieldname: 'value',
            filename: 'a.png',
            toBuffer: async () => Buffer.from('x'),
          },
        ]),
    };
    expect((await controller.create(okCreate as any)).data.id_settings).toBe(
      'ST002',
    );

    await expect(
      controller.update({ headers: {} } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    const noId = {
      headers: { 'content-type': 'multipart/form-data' },
      parts: () =>
        partsOf([{ type: 'field', fieldname: 'kode', value: 'logo' }]),
    };
    await expect(controller.update(noId as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const noKodeUpdate = {
      headers: { 'content-type': 'multipart/form-data' },
      parts: () =>
        partsOf([{ type: 'field', fieldname: 'id_settings', value: 'ST001' }]),
    };
    await expect(controller.update(noKodeUpdate as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const updateNoFile = {
      headers: { 'content-type': 'multipart/form-data' },
      parts: () =>
        partsOf([
          { type: 'field', fieldname: 'id_settings', value: 'ST001' },
          { type: 'field', fieldname: 'nm_settings', value: 'Logo' },
          { type: 'field', fieldname: 'kode', value: 'logo' },
        ]),
    };
    await controller.update(updateNoFile as any);
    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ value: undefined }),
    );

    const updateWithFile = {
      headers: { 'content-type': 'multipart/form-data' },
      parts: () =>
        partsOf([
          { type: 'field', fieldname: 'id_settings', value: 'ST001' },
          { type: 'field', fieldname: 'kode', value: 'logo' },
          {
            type: 'file',
            fieldname: 'value',
            filename: 'b.png',
            toBuffer: async () => Buffer.from('y'),
          },
        ]),
    };
    await controller.update(updateWithFile as any);
    expect(service.uploadSettingsFile).toHaveBeenCalled();
  });
});

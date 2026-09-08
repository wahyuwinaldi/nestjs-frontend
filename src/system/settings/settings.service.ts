import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MinioService } from '../../storage/minio.service';

export interface SettingsItem {
  id_settings: string;
  nm_settings: string;
  kode: string;
  value: string | null;
}

export interface UiThemeConfig {
  primary: string;
  surface: string | null;
  preset: 'Aura' | 'Lara' | 'Nora';
  menuMode: 'static' | 'overlay';
}

export const UI_THEME_KODE = 'ui-theme';
export const UI_THEME_NAME = 'UI Theme';

export const DEFAULT_UI_THEME: UiThemeConfig = {
  primary: 'emerald',
  surface: null,
  preset: 'Aura',
  menuMode: 'static',
};

const PRIMARY_NAMES = new Set([
  'noir',
  'emerald',
  'green',
  'lime',
  'orange',
  'amber',
  'yellow',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
]);

const SURFACE_NAMES = new Set([
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'soho',
  'viva',
  'ocean',
]);

const PRESETS = new Set(['Aura', 'Lara', 'Nora']);
const MENU_MODES = new Set(['static', 'overlay']);

@Injectable()
export class SettingsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly minio: MinioService,
  ) {}

  async findAll(): Promise<SettingsItem[]> {
    const result = await this.db.query<SettingsItem>(
      `SELECT id_settings, nm_settings, kode, value
       FROM ${this.db.withSchema('md_settings')}
       WHERE is_deleted = FALSE
       ORDER BY id_settings ASC`,
    );
    return result.rows;
  }

  async findById(id: string): Promise<SettingsItem> {
    const result = await this.db.query<SettingsItem>(
      `SELECT id_settings, nm_settings, kode, value
       FROM ${this.db.withSchema('md_settings')}
       WHERE id_settings = $1 AND is_deleted = FALSE`,
      [id],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('Settings tidak ditemukan');
    }
    return result.rows[0];
  }

  async findByKode(kode: string): Promise<SettingsItem | null> {
    const result = await this.db.query<SettingsItem>(
      `SELECT id_settings, nm_settings, kode, value
       FROM ${this.db.withSchema('md_settings')}
       WHERE kode = $1 AND is_deleted = FALSE
       LIMIT 1`,
      [kode],
    );
    return result.rows[0] ?? null;
  }

  getDefaultTheme(): UiThemeConfig {
    return { ...DEFAULT_UI_THEME };
  }

  parseThemeValue(raw: string | null | undefined): UiThemeConfig {
    if (!raw) return this.getDefaultTheme();
    try {
      const parsed = JSON.parse(raw) as Partial<UiThemeConfig>;
      return this.normalizeTheme(parsed);
    } catch {
      return this.getDefaultTheme();
    }
  }

  async getTheme(): Promise<UiThemeConfig> {
    const row = await this.findByKode(UI_THEME_KODE);
    return this.parseThemeValue(row?.value);
  }

  async upsertTheme(input: Partial<UiThemeConfig>): Promise<UiThemeConfig> {
    const theme = this.normalizeTheme(input);
    const value = JSON.stringify(theme);
    const existing = await this.findByKode(UI_THEME_KODE);

    if (existing) {
      await this.db.query(
        `UPDATE ${this.db.withSchema('md_settings')}
         SET nm_settings = $2, value = $3
         WHERE id_settings = $1 AND is_deleted = FALSE`,
        [existing.id_settings, UI_THEME_NAME, value],
      );
    } else {
      const id = await this.nextId();
      await this.db.query(
        `INSERT INTO ${this.db.withSchema('md_settings')}
           (id_settings, nm_settings, kode, value, is_deleted, tgl_insert)
         VALUES ($1, $2, $3, $4, FALSE, NOW())`,
        [id, UI_THEME_NAME, UI_THEME_KODE, value],
      );
    }

    return theme;
  }

  private normalizeTheme(input: Partial<UiThemeConfig>): UiThemeConfig {
    const primary = String(input.primary || '').trim();
    if (!PRIMARY_NAMES.has(primary)) {
      throw new BadRequestException(`Primary theme "${primary}" tidak valid.`);
    }

    let surface: string | null = null;
    if (input.surface !== undefined && input.surface !== null) {
      const s = String(input.surface).trim();
      if (s === '') {
        surface = null;
      } else if (!SURFACE_NAMES.has(s)) {
        throw new BadRequestException(`Surface theme "${s}" tidak valid.`);
      } else {
        surface = s;
      }
    }

    const preset = String(input.preset || '').trim();
    if (!PRESETS.has(preset)) {
      throw new BadRequestException(`Preset "${preset}" tidak valid.`);
    }

    const menuMode = String(input.menuMode || '').trim();
    if (!MENU_MODES.has(menuMode)) {
      throw new BadRequestException(`Menu mode "${menuMode}" tidak valid.`);
    }

    return {
      primary,
      surface,
      preset: preset as UiThemeConfig['preset'],
      menuMode: menuMode as UiThemeConfig['menuMode'],
    };
  }

  private assertNotReservedKode(kode: string): void {
    if (String(kode || '').trim() === UI_THEME_KODE) {
      throw new BadRequestException(
        `Kode settings "${UI_THEME_KODE}" khusus untuk tema UI dan tidak dapat diubah lewat CRUD file.`,
      );
    }
  }

  private async nextId(): Promise<string> {
    const result = await this.db.query<{ id_settings: string }>(
      `SELECT id_settings
       FROM ${this.db.withSchema('md_settings')}
       WHERE id_settings ~ '^ST[0-9]+$'
       ORDER BY NULLIF(regexp_replace(id_settings, '\\D', '', 'g'), '')::int DESC
       LIMIT 1`,
    );
    if (result.rowCount === 0) {
      return 'ST001';
    }
    const last = result.rows[0].id_settings;
    const num = Number.parseInt(last.replace(/\D/g, ''), 10) || 0;
    return `ST${String(num + 1).padStart(3, '0')}`;
  }

  private async assertKodeUnique(
    kode: string,
    excludeId?: string,
  ): Promise<void> {
    const result = await this.db.query(
      `SELECT 1 FROM ${this.db.withSchema('md_settings')}
       WHERE kode = $1 AND is_deleted = FALSE
         AND ($2::text IS NULL OR id_settings <> $2)`,
      [kode, excludeId ?? null],
    );
    if ((result.rowCount ?? 0) > 0) {
      throw new BadRequestException(`Kode settings "${kode}" sudah dipakai`);
    }
  }

  async create(input: {
    nm_settings: string;
    kode: string;
    value: string;
  }): Promise<SettingsItem> {
    const nm = String(input.nm_settings || '').trim();
    const kode = String(input.kode || '').trim();
    const value = String(input.value || '').trim();
    if (!nm) throw new BadRequestException('Nama Settings tidak boleh kosong.');
    if (!kode)
      throw new BadRequestException('Kode Settings tidak boleh kosong.');
    if (!value)
      throw new BadRequestException('File Settings tidak boleh kosong.');

    this.assertNotReservedKode(kode);
    await this.assertKodeUnique(kode);
    const id = await this.nextId();

    await this.db.query(
      `INSERT INTO ${this.db.withSchema('md_settings')}
         (id_settings, nm_settings, kode, value, is_deleted, tgl_insert)
       VALUES ($1, $2, $3, $4, FALSE, NOW())`,
      [id, nm, kode, value],
    );

    return this.findById(id);
  }

  async update(input: {
    id_settings: string;
    nm_settings: string;
    kode: string;
    value?: string | null;
  }): Promise<SettingsItem> {
    const id = String(input.id_settings || '').trim();
    const nm = String(input.nm_settings || '').trim();
    const kode = String(input.kode || '').trim();
    if (!id) throw new BadRequestException('ID Settings tidak boleh kosong.');
    if (!nm) throw new BadRequestException('Nama Settings tidak boleh kosong.');
    if (!kode)
      throw new BadRequestException('Kode Settings tidak boleh kosong.');

    const existing = await this.findById(id);
    if (existing.kode === UI_THEME_KODE || kode === UI_THEME_KODE) {
      throw new BadRequestException(
        `Kode settings "${UI_THEME_KODE}" khusus untuk tema UI dan tidak dapat diubah lewat CRUD file.`,
      );
    }
    this.assertNotReservedKode(kode);
    await this.assertKodeUnique(kode, id);

    const value =
      input.value !== undefined &&
      input.value !== null &&
      String(input.value).trim() !== ''
        ? String(input.value).trim()
        : existing.value;

    // Jika kode berubah dan ada file lama di bucket, hapus object lama.
    if (existing.kode !== kode && existing.value) {
      await this.minio.deleteObjectIfOwned(existing.value);
    }

    await this.db.query(
      `UPDATE ${this.db.withSchema('md_settings')}
       SET nm_settings = $2, kode = $3, value = $4
       WHERE id_settings = $1 AND is_deleted = FALSE`,
      [id, nm, kode, value],
    );

    return this.findById(id);
  }

  async remove(id_settings: string): Promise<{ id_settings: string }> {
    const id = String(id_settings || '').trim();
    if (!id) throw new BadRequestException('ID Settings tidak boleh kosong.');

    const existing = await this.findById(id);
    if (existing.kode === UI_THEME_KODE) {
      throw new BadRequestException(
        `Kode settings "${UI_THEME_KODE}" khusus untuk tema UI dan tidak dapat dihapus lewat CRUD file.`,
      );
    }

    await this.db.query(
      `UPDATE ${this.db.withSchema('md_settings')}
       SET is_deleted = TRUE
       WHERE id_settings = $1`,
      [id],
    );

    if (existing.value) {
      await this.minio.deleteObjectIfOwned(existing.value);
    }

    return { id_settings: id };
  }

  async uploadSettingsFile(
    buffer: Buffer,
    kode: string,
    filename: string,
  ): Promise<string> {
    this.assertNotReservedKode(kode);
    const objectKey = this.minio.buildSettingsObjectKey(kode);
    const { publicUrl } = await this.minio.uploadFixedKey(
      buffer,
      objectKey,
      filename,
    );
    return publicUrl;
  }
}

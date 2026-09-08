import { Pool } from 'pg';
import { DatabaseService } from '../../src/database/database.service';
import { mockConfig } from '../helpers/mock-config';

const query = jest.fn();
const connect = jest.fn();
const end = jest.fn();
const on = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ query, connect, end, on })),
}));

describe('DatabaseService', () => {
  beforeEach(() => {
    query.mockReset();
    connect.mockReset();
    end.mockReset();
    on.mockReset();
    (Pool as unknown as jest.Mock).mockClear();
  });

  it('builds pool with config + schema helpers and query', async () => {
    const config = mockConfig({
      DB_SCHEMA: 'public',
      DB_HOST: 'db.local',
      DB_PORT: 5433,
      DB_USER: 'app',
      DB_PASSWORD: 'secret',
      DB_NAME: 'base_project',
    });
    const db = new DatabaseService(config as any);

    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'db.local',
        port: 5433,
        user: 'app',
        password: 'secret',
        database: 'base_project',
        options: '-c search_path=public,public',
        max: 10,
        idleTimeoutMillis: 30000,
      }),
    );
    expect(db.getSchema()).toBe('public');
    expect(db.withSchema('md_user')).toBe('public.md_user');

    query.mockResolvedValueOnce({ rows: [1] });
    expect(await db.query('SELECT 1', [1])).toEqual({ rows: [1] });
    expect(query).toHaveBeenCalledWith('SELECT 1', [1]);

    // default params = []
    query.mockResolvedValueOnce({ rows: [] });
    await db.query('SELECT 2');
    expect(query).toHaveBeenCalledWith('SELECT 2', []);

    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
    const idleErr = new Error('idle');
    idleErr.stack = 'stack-trace';
    on.mock.calls[0][1](idleErr);
  });

  it('uses default config values when env keys are missing', () => {
    const db = new DatabaseService(mockConfig({}) as any);
    expect(db.getSchema()).toBe('public');
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '',
        database: 'template',
        options: '-c search_path=public,public',
      }),
    );
  });

  it('onModuleInit ping success and failure', async () => {
    const db = new DatabaseService(mockConfig({}) as any);
    query.mockResolvedValueOnce({ rows: [1] });
    await db.onModuleInit();
    expect(query).toHaveBeenCalledWith('SELECT 1');

    query.mockRejectedValueOnce(new Error('down'));
    await expect(db.onModuleInit()).resolves.toBeUndefined();
  });

  it('onModuleDestroy ends pool', async () => {
    const db = new DatabaseService(mockConfig({}) as any);
    end.mockResolvedValueOnce(undefined);
    await db.onModuleDestroy();
    expect(end).toHaveBeenCalled();
  });

  it('withTransaction commits and rolls back', async () => {
    const db = new DatabaseService(mockConfig({}) as any);
    const client = {
      query: jest.fn().mockResolvedValue({}),
      release: jest.fn(),
    };
    connect.mockResolvedValue(client);

    await expect(
      db.withTransaction(async (c) => {
        expect(c).toBe(client);
        return 42;
      }),
    ).resolves.toBe(42);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();

    client.query.mockReset();
    client.query.mockResolvedValue({});
    client.release.mockClear();
    await expect(
      db.withTransaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('getClient connects', async () => {
    const db = new DatabaseService(mockConfig({}) as any);
    const fake = { query: jest.fn() };
    connect.mockResolvedValueOnce(fake);
    await expect(db.getClient()).resolves.toBe(fake);
    expect(connect).toHaveBeenCalled();
  });
});

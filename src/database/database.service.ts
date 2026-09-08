import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  private readonly schema: string;

  constructor(private readonly config: ConfigService) {
    this.schema = this.config.get<string>('DB_SCHEMA', 'public');
    this.pool = new Pool({
      host: this.config.get<string>('DB_HOST', 'localhost'),
      port: this.config.get<number>('DB_PORT', 5432),
      user: this.config.get<string>('DB_USER', 'postgres'),
      password: this.config.get<string>('DB_PASSWORD', ''),
      database: this.config.get<string>('DB_NAME', 'template'),
      options: `-c search_path=${this.schema},public`,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    this.pool.on('error', (err) => {
      this.logger.error(
        `Unexpected error on idle Postgres client: ${err.message}`,
        err.stack,
      );
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
      this.logger.log(`Connected to Postgres (schema="${this.schema}")`);
    } catch (err) {
      this.logger.error(
        `Failed to connect to Postgres: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  getSchema(): string {
    return this.schema;
  }

  /** Prefix a bare table/view/function name with the configured schema. */
  withSchema(name: string): string {
    return `${this.schema}.${name}`;
  }

  async query<T extends QueryResultRow = any>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params as any[]);
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

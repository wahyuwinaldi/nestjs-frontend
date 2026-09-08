export type QueryResult<T = unknown> = { rows: T[]; rowCount?: number };

export function createDbMock() {
  const query = jest.fn();
  const getClient = jest.fn();
  const txClient = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
  };
  const withTransaction = jest.fn(
    async (fn: (client: { query: jest.Mock }) => unknown) => fn(txClient),
  );

  return {
    query,
    getClient,
    txClient,
    withTransaction,
    withSchema: (name: string) => `template.${name}`,
    getSchema: () => 'public',
  };
}

export type DbMock = ReturnType<typeof createDbMock>;

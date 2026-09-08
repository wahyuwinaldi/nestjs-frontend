export function mockConfig(map: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback,
    ),
  };
}

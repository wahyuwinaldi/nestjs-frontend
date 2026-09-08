import type { ActorIdentity } from '../../src/common/role-hierarchy.util';

export function createActor(overrides: ActorIdentity = {}): ActorIdentity {
  return {
    sub: '00000000-0000-0000-0000-000000000001',
    role: 'RS001',
    ...overrides,
  };
}

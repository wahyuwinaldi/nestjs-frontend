import { ForbiddenException } from '@nestjs/common';
import {
  actorFromRequest,
  actorRoleFromRequest,
  assertCanManageRole,
  canSeeRole,
  isHigherRole,
} from '../../src/common/role-hierarchy.util';

describe('role-hierarchy.util', () => {
  describe('canSeeRole', () => {
    it('allows equal or lower privilege (lexicographic >=)', () => {
      expect(canSeeRole('RS001', 'RS001')).toBe(true);
      expect(canSeeRole('RS001', 'RS003')).toBe(true);
      expect(canSeeRole('RS003', 'RS001')).toBe(false);
    });

    it('returns false when actor or target is empty', () => {
      expect(canSeeRole('', 'RS001')).toBe(false);
      expect(canSeeRole('RS001', '')).toBe(false);
      expect(canSeeRole(undefined as any, 'RS001')).toBe(false);
    });
  });

  describe('isHigherRole', () => {
    it('is the inverse of canSeeRole', () => {
      expect(isHigherRole('RS003', 'RS001')).toBe(true);
      expect(isHigherRole('RS001', 'RS003')).toBe(false);
    });
  });

  describe('assertCanManageRole', () => {
    it('does not throw when allowed', () => {
      expect(() => assertCanManageRole('RS001', 'RS002')).not.toThrow();
    });

    it('throws ForbiddenException when target is higher', () => {
      expect(() => assertCanManageRole('RS003', 'RS001', 'user')).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('actorFromRequest / actorRoleFromRequest', () => {
    it('extracts sub and role', () => {
      expect(actorFromRequest({ sub: 'u1', role: 'RS001' })).toEqual({
        sub: 'u1',
        role: 'RS001',
      });
    });

    it('handles missing user', () => {
      expect(actorFromRequest(null)).toEqual({
        sub: undefined,
        role: undefined,
      });
      expect(actorFromRequest({})).toEqual({ sub: undefined, role: undefined });
    });

    it('returns role string or empty', () => {
      expect(actorRoleFromRequest({ role: 'RS002' })).toBe('RS002');
      expect(actorRoleFromRequest(null)).toBe('');
      expect(actorRoleFromRequest({})).toBe('');
    });
  });
});

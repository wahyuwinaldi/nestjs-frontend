import { ForbiddenException } from '@nestjs/common';

/**
 * Hierarki role Live: kode lebih kecil = privilege lebih tinggi
 * (RS001 Super Admin > RS002 Admin > RS003 User).
 * Perbandingan leksikografis pada kd_role.
 */

/** True jika target privilege ≤ actor (target boleh dilihat/dikelola actor). */
export function canSeeRole(actorKdRole: string, targetKdRole: string): boolean {
  const actor = String(actorKdRole || '');
  const target = String(targetKdRole || '');
  if (!actor || !target) return false;
  return target >= actor;
}

/** True jika target privilege lebih tinggi dari actor (tidak boleh dilihat). */
export function isHigherRole(
  actorKdRole: string,
  targetKdRole: string,
): boolean {
  return !canSeeRole(actorKdRole, targetKdRole);
}

export function assertCanManageRole(
  actorKdRole: string,
  targetKdRole: string,
  label = 'role',
): void {
  if (!canSeeRole(actorKdRole, targetKdRole)) {
    throw new ForbiddenException(
      `Tidak diizinkan mengakses ${label} "${targetKdRole}" (privilege lebih tinggi dari ${actorKdRole})`,
    );
  }
}

export interface ActorIdentity {
  sub?: string;
  role?: string;
}

/** Ambil sub + role dari JWT Passport (`req.user`). */
export function actorFromRequest(user?: ActorIdentity | null): ActorIdentity {
  return {
    sub: user?.sub ? String(user.sub) : undefined,
    role: user?.role ? String(user.role) : undefined,
  };
}

/** @deprecated gunakan actorFromRequest; tetap ada untuk kompatibilitas singkat. */
export function actorRoleFromRequest(user?: { role?: string } | null): string {
  return String(user?.role || '');
}

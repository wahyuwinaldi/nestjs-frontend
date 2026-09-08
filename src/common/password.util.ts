import { BadRequestException } from '@nestjs/common';

const SYMBOL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/**
 * Enforce password policy used across auth change-password and user admin
 * create/update.
 */
export function assertPasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new BadRequestException('Password minimal 8 karakter');
  }
  if (!/[A-Z]/.test(password)) {
    throw new BadRequestException('Password harus mengandung huruf besar');
  }
  if (!/[a-z]/.test(password)) {
    throw new BadRequestException('Password harus mengandung huruf kecil');
  }
  if (!/\d/.test(password)) {
    throw new BadRequestException('Password harus mengandung angka');
  }
  if (!SYMBOL_RE.test(password)) {
    throw new BadRequestException('Password harus mengandung simbol');
  }
}

import { BadRequestException } from '@nestjs/common';
import { assertPasswordStrength } from '../../src/common/password.util';

describe('assertPasswordStrength', () => {
  it('accepts a strong password', () => {
    expect(() => assertPasswordStrength('Admin123!')).not.toThrow();
  });

  it('rejects short passwords', () => {
    expect(() => assertPasswordStrength('Ad1!')).toThrow(BadRequestException);
  });

  it('rejects missing uppercase', () => {
    expect(() => assertPasswordStrength('admin123!')).toThrow(
      BadRequestException,
    );
  });

  it('rejects missing lowercase', () => {
    expect(() => assertPasswordStrength('ADMIN123!')).toThrow(
      BadRequestException,
    );
  });

  it('rejects missing digit', () => {
    expect(() => assertPasswordStrength('Admin!!!!')).toThrow(
      BadRequestException,
    );
  });

  it('rejects missing symbol', () => {
    expect(() => assertPasswordStrength('Admin1234')).toThrow(
      BadRequestException,
    );
  });
});

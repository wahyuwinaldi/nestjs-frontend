import { HttpException, HttpStatus } from '@nestjs/common';

export const PASSWORD_EXPIRED_CODE = 'PASSWORD_EXPIRED';

export class PasswordExpiredException extends HttpException {
  constructor(changeToken: string) {
    super(
      {
        message:
          'Password telah kedaluwarsa. Silakan buat password baru untuk melanjutkan.',
        data: {
          code: PASSWORD_EXPIRED_CODE,
          change_token: changeToken,
        },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

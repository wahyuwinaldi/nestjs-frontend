import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route (or an entire controller) as publicly accessible, bypassing
 * the global JwtAuthGuard / ApiKeyGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, ok } from '../response.util';

/** Wraps every successful controller response in the `{ success, error, data }` envelope. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Already wrapped upstream (e.g. controller returned an ApiResponse itself).
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as object) &&
          'data' in (data as object)
        ) {
          return data as unknown as ApiResponse<T>;
        }
        return ok(data);
      }),
    );
  }
}

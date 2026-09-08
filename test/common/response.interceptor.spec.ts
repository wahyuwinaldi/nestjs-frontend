import { of, lastValueFrom } from 'rxjs';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();
  const ctx = {} as any;

  it('wraps raw payloads with ok()', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(ctx, { handle: () => of({ a: 1 }) }),
    );
    expect(result).toEqual({ success: true, error: null, data: { a: 1 } });
  });

  it('passes through already wrapped envelopes', async () => {
    const wrapped = { success: true, error: null, data: { a: 1 } };
    const result = await lastValueFrom(
      interceptor.intercept(ctx, { handle: () => of(wrapped) }),
    );
    expect(result).toBe(wrapped);
  });

  it('wraps null/primitive values', async () => {
    expect(
      await lastValueFrom(
        interceptor.intercept(ctx, { handle: () => of(null) }),
      ),
    ).toEqual({
      success: true,
      error: null,
      data: null,
    });
    expect(
      await lastValueFrom(
        interceptor.intercept(ctx, { handle: () => of('ok') }),
      ),
    ).toEqual({
      success: true,
      error: null,
      data: 'ok',
    });
  });
});

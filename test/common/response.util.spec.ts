import { fail, ok } from '../../src/common/response.util';

describe('response.util', () => {
  it('wraps success payload', () => {
    expect(ok({ a: 1 })).toEqual({
      success: true,
      error: null,
      data: { a: 1 },
    });
  });

  it('wraps failure message', () => {
    expect(fail('boom')).toEqual({ success: false, error: 'boom', data: null });
  });
});

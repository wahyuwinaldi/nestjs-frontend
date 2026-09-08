import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

function makeHost(reply: { status: jest.Mock; send: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getResponse: () => reply,
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function catchWith(exception: unknown) {
    const reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    filter.catch(exception, makeHost(reply));
    return reply;
  }

  it('handles string HttpException', () => {
    const reply = catchWith(new HttpException('nope', HttpStatus.FORBIDDEN));
    expect(reply.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: 'nope',
      data: null,
    });
  });

  it('joins validation message arrays', () => {
    const reply = catchWith(new BadRequestException(['a', 'b']));
    expect(reply.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(reply.send.mock.calls[0][0].error).toBe('a, b');
  });

  it('uses object message string', () => {
    const reply = catchWith(new BadRequestException('single'));
    expect(reply.send.mock.calls[0][0].error).toBe('single');
  });

  it('handles generic Error as 500', () => {
    const reply = catchWith(new Error('boom'));
    expect(reply.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(reply.send.mock.calls[0][0].error).toBe('boom');
  });

  it('includes data from HttpException response body', () => {
    const reply = catchWith(
      new HttpException(
        {
          message: 'Password expired',
          data: { code: 'PASSWORD_EXPIRED', change_token: 'tok' },
        },
        HttpStatus.FORBIDDEN,
      ),
    );
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: 'Password expired',
      data: { code: 'PASSWORD_EXPIRED', change_token: 'tok' },
    });
  });

  it('handles object response without message and nullish message', () => {
    const reply = catchWith(
      new HttpException({ data: { x: 1 } }, HttpStatus.BAD_REQUEST),
    );
    expect(reply.send.mock.calls[0][0].error).toBe('Internal server error');
    expect(reply.send.mock.calls[0][0].data).toEqual({ x: 1 });

    const replyNullMsg = catchWith(
      new HttpException(
        { message: null, data: { a: 1 } },
        HttpStatus.BAD_REQUEST,
      ),
    );
    expect(replyNullMsg.send.mock.calls[0][0].error).toBe(
      'Internal server error',
    );
    expect(replyNullMsg.send.mock.calls[0][0].data).toEqual({ a: 1 });
  });

  it('handles object response with empty object (no message/data keys)', () => {
    const reply = catchWith(new HttpException({}, HttpStatus.BAD_REQUEST));
    expect(reply.send.mock.calls[0][0].error).toBe('Internal server error');
    expect(reply.send.mock.calls[0][0].data).toBeNull();
  });
});

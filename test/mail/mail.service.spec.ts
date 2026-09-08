import { MailService } from '../../src/mail/mail.service';
import { mockConfig } from '../helpers/mock-config';

const sendMail = jest.fn().mockResolvedValue({});
const createTransport = jest.fn().mockReturnValue({ sendMail });

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => createTransport(...args),
}));

describe('MailService', () => {
  it('isConfigured requires host + from', () => {
    expect(new MailService(mockConfig({}) as any).isConfigured()).toBe(false);
    expect(
      new MailService(
        mockConfig({ SMTP_HOST: 'smtp.x', SMTP_FROM: 'a@b.c' }) as any,
      ).isConfigured(),
    ).toBe(true);
  });

  it('send no-ops when not configured', async () => {
    await new MailService(mockConfig({}) as any).send({
      to: 'a@b.c',
      subject: 's',
    });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('send uses transporter with and without auth; reuses instance', async () => {
    const service = new MailService(
      mockConfig({
        SMTP_HOST: 'smtp.x',
        SMTP_FROM: 'a@b.c',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
      }) as any,
    );
    await service.send({
      to: ['a@b.c'],
      subject: 'Hi',
      html: '<b>x</b>',
      text: 'x',
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.x',
        port: 465,
        secure: true,
        auth: { user: 'u', pass: 'p' },
      }),
    );
    await service.send({ to: 'a@b.c', subject: 'Hi2' });
    expect(createTransport).toHaveBeenCalledTimes(1);

    const noAuth = new MailService(
      mockConfig({ SMTP_HOST: 'smtp.x', SMTP_FROM: 'a@b.c' }) as any,
    );
    await noAuth.send({ to: 'a@b.c', subject: 'z' });
    expect(createTransport.mock.calls.at(-1)[0].auth).toBeUndefined();
  });
});

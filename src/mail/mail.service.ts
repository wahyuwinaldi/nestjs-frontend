import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const host = this.config.get<string>('SMTP_HOST', '').trim();
    const from = this.config.get<string>('SMTP_FROM', '').trim();
    return Boolean(host && from);
  }

  async send(payload: MailPayload): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'SMTP belum dikonfigurasi (SMTP_HOST / SMTP_FROM kosong), email tidak dikirim',
      );
      return;
    }

    const transporter = this.getTransporter();
    const from = this.config.get<string>('SMTP_FROM', '').trim();

    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get<string>('SMTP_HOST', '').trim();
    const port = Number(this.config.get<string>('SMTP_PORT', '587'));
    const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';
    const user = this.config.get<string>('SMTP_USER', '').trim();
    const pass = this.config.get<string>('SMTP_PASS', '');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });

    return this.transporter;
  }
}

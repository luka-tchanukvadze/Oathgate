import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');

    this.from = config.get<string>('MAIL_FROM') ?? user ?? 'oathgate@localhost';

    // With no SMTP credentials I log the message instead of sending it
    // A fresh clone still demos, and nothing piles up waiting on a password
    if (!host || !user || !password) {
      this.transport = null;
      this.logger.warn('no SMTP configured, emails will be logged not sent');

      return;
    }

    this.transport = createTransport({
      host,
      port: Number(config.get<string>('SMTP_PORT') ?? 465),
      // Port 465 is encrypted from the first byte
      // Port 587 starts in the clear and upgrades, so secure has to be false
      secure: Number(config.get<string>('SMTP_PORT') ?? 465) === 465,
      auth: { user, pass: password },
    });
  }

  // I let this throw
  // The caller counts the attempt and leaves the row for the next sweep
  async send(email: OutgoingEmail): Promise<void> {
    if (!this.transport) {
      this.logger.log(
        `[not sent] to=${email.to} subject=${email.subject}\n${email.text}`,
      );

      return;
    }

    await this.transport.sendMail({
      from: this.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
    });

    this.logger.log(`sent "${email.subject}" to ${email.to}`);
  }
}

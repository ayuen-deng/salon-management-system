export interface SmsMessage {
  recipientE164: string;
  body: string;
}

export interface SmsProvider {
  name: string;
  sendSms(message: SmsMessage): Promise<{ success: boolean; messageId?: string }>;
}

export class NoopSmsProvider implements SmsProvider {
  name = 'noop';
  async sendSms(message: SmsMessage) {
    // In V1 prototype, SMS writes as skipped/noop
    return { success: true, messageId: `NOOP-SMS-${Date.now()}` };
  }
}

export function getSmsProvider(): SmsProvider {
  return new NoopSmsProvider();
}

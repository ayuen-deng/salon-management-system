export interface PaymentRequest {
  visitId: string;
  amountUgx: number;
  phoneE164: string;
}

export interface PaymentStatus {
  status: 'pending' | 'successful' | 'failed';
  providerReference?: string;
  message?: string;
}

export interface PaymentProvider {
  name: string;
  requestPayment(req: PaymentRequest): Promise<PaymentStatus>;
  checkStatus(providerReference: string): Promise<PaymentStatus>;
  parseWebhook(payload: Record<string, unknown>): PaymentStatus;
}

export class ManualPaymentProvider implements PaymentProvider {
  name = 'manual';

  async requestPayment(req: PaymentRequest): Promise<PaymentStatus> {
    // In V1, customer pays salon till directly and reference is keyed by receptionist
    return {
      status: 'pending',
      providerReference: `MANUAL-${Date.now()}`,
      message: 'Awaiting manual reference entry by receptionist',
    };
  }

  async checkStatus(providerReference: string): Promise<PaymentStatus> {
    return {
      status: 'successful',
      providerReference,
    };
  }

  parseWebhook(payload: Record<string, unknown>): PaymentStatus {
    return {
      status: 'successful',
      providerReference: String(payload.reference || ''),
    };
  }
}

export class MtnMomoProvider implements PaymentProvider {
  name = 'mtn_momo';
  async requestPayment(): Promise<PaymentStatus> {
    throw new Error('MTN MoMo: verify production credentials and sandbox with MTN Uganda.');
  }
  async checkStatus(): Promise<PaymentStatus> {
    throw new Error('MTN MoMo: verify production credentials.');
  }
  parseWebhook(): PaymentStatus {
    throw new Error('MTN MoMo: verify webhook parsing.');
  }
}

export class AirtelMoneyProvider implements PaymentProvider {
  name = 'airtel_money';
  async requestPayment(): Promise<PaymentStatus> {
    throw new Error('Airtel Money: verify partner integration agreement.');
  }
  async checkStatus(): Promise<PaymentStatus> {
    throw new Error('Airtel Money: verify partner integration.');
  }
  parseWebhook(): PaymentStatus {
    throw new Error('Airtel Money: verify webhook parsing.');
  }
}

export function getPaymentProvider(): PaymentProvider {
  const providerType = process.env.PAYMENT_PROVIDER || 'manual';
  switch (providerType) {
    case 'mtn_momo':
      return new MtnMomoProvider();
    case 'airtel_money':
      return new AirtelMoneyProvider();
    case 'manual':
    default:
      return new ManualPaymentProvider();
  }
}

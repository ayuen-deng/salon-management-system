'use server';

import { CustomerRepository, CustomerProfile } from '../models/customer.repository';
import { generateCustomerProfilePdf } from '../models/customer-pdf.service';
import { Result } from '@/shared/models/result';
import { getAuthUser } from '@/modules/auth';

class CustomerController {
  private repo = new CustomerRepository();

  async searchPhone(phone: string): Promise<Result<CustomerProfile[]>> {
    return this.repo.lookupByPhone(phone);
  }

  async registerCustomer(phone: string, firstName: string): Promise<Result<CustomerProfile>> {
    return this.repo.createCustomer({ phone, first_name: firstName });
  }
}

export async function lookupCustomerByPhoneAction(phone: string): Promise<Result<CustomerProfile[]>> {
  const controller = new CustomerController();
  return controller.searchPhone(phone);
}

export async function createCustomerAction(phone: string, firstName: string): Promise<Result<CustomerProfile>> {
  const controller = new CustomerController();
  return controller.registerCustomer(phone, firstName);
}

export async function exportCustomerProfilePdfAction(customerId: string): Promise<Result<{ pdfBase64: string; filename: string }>> {
  const user = await getAuthUser();
  return generateCustomerProfilePdf(customerId, user?.id, user?.role || 'receptionist');
}




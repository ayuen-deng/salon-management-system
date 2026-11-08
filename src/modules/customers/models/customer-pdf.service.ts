import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getServiceRoleClient } from '@/shared/lib/supabase';
import { formatUgPhoneDisplay } from '@/shared/models/phone';
import { formatUGX } from '@/shared/models/money';
import { Result, ok, fail } from '@/shared/models/result';

export async function generateCustomerProfilePdf(
  customerId: string,
  actorUserId?: string,
  actorRole: string = 'receptionist'
): Promise<Result<{ pdfBase64: string; filename: string }>> {
  try {
    const client = getServiceRoleClient();

    // 1. Fetch customer details
    const { data: customer, error: cErr } = await client
      .from('customer')
      .select('id, first_name, phone_e164, created_at')
      .eq('id', customerId)
      .single();

    if (cErr || !customer) {
      return fail({ code: 'NOT_FOUND', message: 'Customer record not found.' });
    }

    // 2. Fetch all visits with services and payments
    const { data: visits, error: vErr } = await client
      .from('visit')
      .select(`
        id,
        ticket_code,
        status,
        total_list_ugx,
        total_discount_ugx,
        total_final_ugx,
        created_at,
        visit_service (
          id,
          sequence_no,
          status,
          list_price_ugx,
          discount_ugx,
          final_price_ugx,
          staff_user:app_user!visit_service_staff_user_id_fkey ( full_name, display_name ),
          service_variant ( name, service ( name ) )
        ),
        payment (
          id,
          method,
          amount_ugx,
          status,
          created_at,
          provider_reference
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (vErr) {
      return fail({ code: 'INTERNAL_ERROR', message: vErr.message });
    }

    const visitList = visits || [];
    const totalSpent = visitList.reduce((acc, v) => acc + (Number(v.total_final_ugx) || 0), 0);

    // 3. Create PDF Document
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait: 595 x 842 points
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const margin = 40;
    let y = height - margin;

    // Header strip
    page.drawText('MZURI UNISEX SALON', {
      x: margin,
      y,
      size: 16,
      font: fontBold,
      color: rgb(0.04, 0.05, 0.08), // #0A0E14
    });

    const nowKampala = new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Kampala',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    page.drawText(`Generated: ${nowKampala} (EAT)`, {
      x: width - margin - 200,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.34, 0.38, 0.45), // #566174
    });

    y -= 16;
    page.drawText('Mbarara, Uganda · Client Account & Service History Statement', {
      x: margin,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.12, 0.31, 0.85), // #1F4FD8
    });

    y -= 12;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.89, 0.91, 0.94), // #E2E7EF
    });

    // Customer Overview Box
    y -= 20;
    const clientSince = customer.created_at
      ? new Date(customer.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala' })
      : 'Unknown';

    page.drawRectangle({
      x: margin,
      y: y - 55,
      width: width - margin * 2,
      height: 65,
      color: rgb(0.96, 0.97, 0.98), // #F6F8FB
      borderColor: rgb(0.89, 0.91, 0.94),
      borderWidth: 1,
    });

    page.drawText(`Client: ${customer.first_name || 'Valued Customer'}`, {
      x: margin + 14,
      y: y - 6,
      size: 13,
      font: fontBold,
      color: rgb(0.04, 0.05, 0.08),
    });

    page.drawText(`Phone: ${formatUgPhoneDisplay(customer.phone_e164)}`, {
      x: margin + 14,
      y: y - 24,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.32),
    });

    page.drawText(`Member Since: ${clientSince}`, {
      x: margin + 14,
      y: y - 40,
      size: 9,
      font: fontRegular,
      color: rgb(0.34, 0.38, 0.45),
    });

    // Summary stats on right
    page.drawText(`Total Recorded Visits: ${visitList.length}`, {
      x: width - margin - 200,
      y: y - 10,
      size: 10,
      font: fontBold,
      color: rgb(0.04, 0.05, 0.08),
    });

    page.drawText(`Total Lifetime Spend: ${formatUGX(totalSpent)}`, {
      x: width - margin - 200,
      y: y - 30,
      size: 10,
      font: fontBold,
      color: rgb(0.12, 0.31, 0.85),
    });

    y -= 80;

    // Visit History Section Title
    page.drawText('VISIT & SERVICE RECORD', {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.04, 0.05, 0.08),
    });

    y -= 14;

    // Table Header
    page.drawRectangle({
      x: margin,
      y: y - 6,
      width: width - margin * 2,
      height: 20,
      color: rgb(0.92, 0.94, 0.96),
    });

    page.drawText('Date / Ticket', { x: margin + 8, y, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.32) });
    page.drawText('Services & Stylists', { x: margin + 120, y, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.32) });
    page.drawText('Status', { x: width - margin - 150, y, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.32) });
    page.drawText('Amount (UGX)', { x: width - margin - 75, y, size: 9, font: fontBold, color: rgb(0.2, 0.25, 0.32) });

    y -= 22;

    if (visitList.length === 0) {
      page.drawText('No recorded salon visits found for this client.', {
        x: margin + 10,
        y,
        size: 9,
        font: fontOblique,
        color: rgb(0.5, 0.5, 0.5),
      });
      y -= 30;
    } else {
      for (const v of visitList) {
        // Page overflow check
        if (y < margin + 80) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - margin - 20;
        }

        const dateStr = v.created_at
          ? new Date(v.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala' })
          : '-';

        page.drawText(`${dateStr}`, { x: margin + 8, y, size: 9, font: fontBold, color: rgb(0.04, 0.05, 0.08) });
        page.drawText(`Ticket: ${v.ticket_code || '-'}`, { x: margin + 8, y: y - 11, size: 8, font: fontRegular, color: rgb(0.34, 0.38, 0.45) });

        // Service lines summary
        const lines = (v.visit_service as any[]) || [];
        let lineSummary = lines
          .map((l) => `${l.service_variant?.name || 'Service'} (${l.staff_user?.full_name?.split(' ')[0] || 'Unassigned'})`)
          .join(', ');
        if (!lineSummary) lineSummary = 'General Salon Service';

        // Truncate line summary if too long
        if (lineSummary.length > 45) {
          lineSummary = lineSummary.slice(0, 42) + '...';
        }

        page.drawText(lineSummary, { x: margin + 120, y, size: 9, font: fontRegular, color: rgb(0.04, 0.05, 0.08) });

        // Payment info under service summary
        const payments = (v.payment as any[]) || [];
        const paySummary = payments.map((p) => `${p.method === 'mobile_money' ? 'MoMo' : 'Cash'} (${p.status})`).join(' · ');
        page.drawText(paySummary || 'Pre-paid', { x: margin + 120, y: y - 11, size: 8, font: fontRegular, color: rgb(0.34, 0.38, 0.45) });

        // Status badge
        page.drawText(v.status.toUpperCase(), {
          x: width - margin - 150,
          y,
          size: 8,
          font: fontBold,
          color: v.status === 'paid' ? rgb(0.08, 0.55, 0.28) : rgb(0.34, 0.38, 0.45),
        });

        // Amount
        const amtStr = formatUGX(Number(v.total_final_ugx) || 0);
        page.drawText(amtStr, {
          x: width - margin - 75,
          y,
          size: 9,
          font: fontBold,
          color: rgb(0.04, 0.05, 0.08),
        });

        // Row separator line
        y -= 22;
        page.drawLine({
          start: { x: margin, y },
          end: { x: width - margin, y },
          thickness: 0.5,
          color: rgb(0.9, 0.92, 0.94),
        });
        y -= 10;
      }
    }

    // Confidentiality Notice & Page Footer
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      p.drawLine({
        start: { x: margin, y: margin + 20 },
        end: { x: width - margin, y: margin + 20 },
        thickness: 0.5,
        color: rgb(0.89, 0.91, 0.94),
      });

      p.drawText(
        'CONFIDENTIAL & PROPRIETARY · MZURI UNISEX SALON · CLIENT PROFILE EXPORT',
        {
          x: margin,
          y: margin + 8,
          size: 7,
          font: fontRegular,
          color: rgb(0.5, 0.55, 0.6),
        }
      );

      p.drawText(`Page ${i + 1} of ${pages.length}`, {
        x: width - margin - 50,
        y: margin + 8,
        size: 7,
        font: fontRegular,
        color: rgb(0.5, 0.55, 0.6),
      });
    }

    // 4. Audit Log
    if (actorUserId) {
      await client.from('audit_log').insert({
        actor_id: actorUserId,
        actor_role: actorRole,
        action: 'CUSTOMER_PROFILE_PDF_EXPORTED',
        entity_type: 'customer',
        entity_id: customerId,
        category: 'customer',
        reason: 'Customer profile & visit history PDF export generated',
        after: {
          customer_name: customer.first_name,
          phone: customer.phone_e164,
          visits_count: visitList.length,
          total_spend: totalSpent,
        },
      });
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    const safeName = (customer.first_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '');
    const dateFormatted = new Date().toISOString().split('T')[0];
    const filename = `client-profile-${safeName}-${dateFormatted}.pdf`;

    return ok({ pdfBase64, filename });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF';
    return fail({ code: 'INTERNAL_ERROR', message });
  }
}

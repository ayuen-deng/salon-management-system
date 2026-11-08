import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function testPdf() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: customer } = await supabase.from('customer').select('*').eq('id', '1bdb3b7a-4b07-43f2-8edb-f45f4c06f1cb').single();
  console.log('Customer:', customer);

  const { data: visits } = await supabase
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
    .eq('customer_id', '1bdb3b7a-4b07-43f2-8edb-f45f4c06f1cb');

  console.log('Visits found:', visits?.length);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('MZURI UNISEX SALON', {
    x: 40,
    y: 800,
    size: 16,
    font: fontBold,
    color: rgb(0.04, 0.05, 0.08),
  });

  page.drawText(`Client: ${customer.first_name} (${customer.phone_e164})`, {
    x: 40,
    y: 770,
    size: 12,
    font: fontBold,
  });

  const pdfBytes = await pdfDoc.save();
  const outPath = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0/client-profile-Ayuen-test.pdf';
  fs.writeFileSync(outPath, pdfBytes);
  console.log('Wrote PDF to:', outPath);
}

testPdf();

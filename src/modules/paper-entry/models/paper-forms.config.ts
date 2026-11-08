export interface PaperFormField {
  key: string;
  label: string;
  type: 'text' | 'phone' | 'number' | 'time' | 'checkbox' | 'select' | 'currency';
  required?: boolean;
  notes?: string;
}

export interface PaperFormSection {
  title: string;
  description?: string;
  fields: PaperFormField[];
}

export interface PaperFormDefinition {
  id: 'visit_sheet' | 'queue_sheet' | 'manager_sheet' | 'cash_count';
  title: string;
  subtitle: string;
  roleRestriction?: 'manager';
  pageSize: 'A4';
  sheetsPerPage: 1 | 2;
  printPath: string;
  layout: string;
  sections: PaperFormSection[];
}

export const PAPER_FORMS_CONFIG: Record<string, PaperFormDefinition> = {
  visit_sheet: {
    id: 'visit_sheet',
    title: 'Customer Visit Sheet',
    subtitle: 'Standard clipboard form for walk-ins and offline customer reception (2 per page)',
    pageSize: 'A4',
    sheetsPerPage: 2,
    printPath: '/print/forms/visit-sheet',
    layout: '2-up per page (A4 with cut line)',
    sections: [
      {
        title: 'Header & Metadata',
        fields: [
          { key: 'serial_no', label: 'Serial No', type: 'text', required: true },
          { key: 'date', label: 'Date', type: 'text', required: true },
          { key: 'paper_ticket_code', label: 'Paper Ticket Code', type: 'text', required: true },
          { key: 'time_arrived', label: 'Time Arrived', type: 'time', required: true },
        ],
      },
      {
        title: 'Customer Identification',
        fields: [
          { key: 'first_name', label: 'Customer First Name', type: 'text', required: true },
          { key: 'phone', label: 'Customer Phone', type: 'phone', required: true },
          { key: 'phone_verified', label: 'Read-back verified', type: 'checkbox', required: true },
          { key: 'is_appointment', label: 'Booked Appointment?', type: 'checkbox' },
          { key: 'booked_time', label: 'Booked Time', type: 'time' },
        ],
      },
      {
        title: 'Services Requested (Max 5)',
        fields: [
          { key: 'service_name', label: 'Service & Variant', type: 'text', required: true },
          { key: 'list_price_ugx', label: 'List Price UGX', type: 'currency', required: true },
          { key: 'stylist_name', label: 'Stylist Requested/Assigned', type: 'text' },
          { key: 'preferred_requested', label: 'Customer Requested Stylist (Strict)', type: 'checkbox' },
        ],
      },
      {
        title: 'Totals and Discounts',
        fields: [
          { key: 'subtotal_ugx', label: 'Subtotal UGX', type: 'currency', required: true },
          { key: 'discount_ugx', label: 'Discount Amount UGX', type: 'currency' },
          { key: 'discount_reason', label: 'Discount Reason', type: 'text' },
          { key: 'approved_by_initials', label: 'Approved By (Manager Initials)', type: 'text' },
          { key: 'total_final_ugx', label: 'Total To Pay UGX', type: 'currency', required: true },
        ],
      },
      {
        title: 'Payment Details (Taken Before Service)',
        fields: [
          { key: 'payment_method', label: 'Payment Method (Cash / Mobile Money)', type: 'select', required: true },
          { key: 'momo_reference', label: 'Mobile Money Reference (Tx ID)', type: 'text' },
          { key: 'amount_received_ugx', label: 'Amount Received UGX', type: 'currency', required: true },
          { key: 'time_paid', label: 'Time Paid', type: 'time', required: true },
          { key: 'received_by_initials', label: 'Received By (Staff Initials)', type: 'text', required: true },
        ],
      },
      {
        title: 'Service Times (Reported by Staff)',
        fields: [
          { key: 'service_start_time', label: 'Start Time', type: 'time' },
          { key: 'service_end_time', label: 'End Time', type: 'time' },
          { key: 'staff_first_name', label: 'Staff First Name', type: 'text' },
        ],
      },
      {
        title: 'System Entry Audit',
        fields: [
          { key: 'entered_by_name', label: 'Entered in System By', type: 'text' },
          { key: 'entered_at_datetime', label: 'Entered On (Date & Time)', type: 'text' },
        ],
      },
    ],
  },
  queue_sheet: {
    id: 'queue_sheet',
    title: 'Reception Queue & Walk-in Tally Sheet',
    subtitle: 'Daily offline sequence sheet for queue monitoring during system outages',
    pageSize: 'A4',
    sheetsPerPage: 1,
    printPath: '/print/forms/queue-sheet',
    layout: '1-page A4 (24 rows)',
    sections: [
      {
        title: 'Queue Sequence',
        fields: [
          { key: 'code', label: 'Paper Code', type: 'text' },
          { key: 'time_paid', label: 'Time Paid', type: 'time' },
          { key: 'first_name', label: 'Customer First Name', type: 'text' },
          { key: 'services', label: 'Services', type: 'text' },
          { key: 'stylist', label: 'Stylist', type: 'text' },
          { key: 'called_at', label: 'Called At', type: 'time' },
          { key: 'done_at', label: 'Done At', type: 'time' },
        ],
      },
    ],
  },
  manager_sheet: {
    id: 'manager_sheet',
    title: "Manager's Day Summary Sheet",
    subtitle: 'Operational log for roster attendance, manager exceptions, and statement matching',
    roleRestriction: 'manager',
    pageSize: 'A4',
    sheetsPerPage: 1,
    printPath: '/print/forms/manager-sheet',
    layout: '1-page A4 (Manager Only)',
    sections: [
      {
        title: 'Staff Attendance Roster',
        fields: [
          { key: 'staff_name', label: 'Staff Name', type: 'text' },
          { key: 'in_time', label: 'In', type: 'time' },
          { key: 'out_time', label: 'Out', type: 'time' },
          { key: 'breaks', label: 'Breaks', type: 'text' },
          { key: 'is_late', label: 'Late?', type: 'checkbox' },
        ],
      },
      {
        title: 'Exceptions & Approvals Log',
        fields: [
          { key: 'time', label: 'Time', type: 'time' },
          { key: 'ref_code', label: 'Ticket / Serial', type: 'text' },
          { key: 'action_type', label: 'Exception Type (Void, Refund, Discount, Comp, Correction)', type: 'text' },
          { key: 'amount_ugx', label: 'Amount UGX', type: 'currency' },
          { key: 'reason', label: 'Reason', type: 'text' },
          { key: 'approved_by', label: 'Approved By', type: 'text' },
        ],
      },
      {
        title: 'Mobile Money Received Log',
        fields: [
          { key: 'time', label: 'Time', type: 'time' },
          { key: 'momo_ref', label: 'Reference Code', type: 'text' },
          { key: 'amount_ugx', label: 'Amount UGX', type: 'currency' },
          { key: 'visit_serial', label: 'Visit Serial', type: 'text' },
        ],
      },
    ],
  },
  cash_count: {
    id: 'cash_count',
    title: 'Cash Drawer Handover & Counting Sheet',
    subtitle: 'Physical reconciliation form for morning floats, shift handovers, and evening cash counts',
    pageSize: 'A4',
    sheetsPerPage: 1,
    printPath: '/print/forms/cash-count',
    layout: '1-page A4 (Denominations & Reconciliation)',
    sections: [
      {
        title: 'Denominations',
        fields: [
          { key: 'denomination', label: 'Denomination', type: 'text' },
          { key: 'count', label: 'Count', type: 'number' },
          { key: 'line_total', label: 'Line Total UGX', type: 'currency' },
        ],
      },
    ],
  },
};

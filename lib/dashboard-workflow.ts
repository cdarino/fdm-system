export const DASHBOARD_WORKFLOW = [
  { step: '01', title: 'Client records', href: '/dashboard/clients', permission: 'clients.read', description: 'Verify identity and contacts, complete documents, then assign a lot.' },
  { step: '02', title: 'Property inventory', href: '/dashboard/properties/map', permission: 'properties.read', description: 'Locate the lot, check availability, and review its client assignment.' },
  { step: '03', title: 'Title releases', href: '/dashboard/legal', permission: 'legal.read', description: 'Start with a billing-cleared account and follow the release stages.' },
] as const;

export const TITLE_WORKFLOW = [
  { value: 'intake', label: 'Billing cleared', description: 'Billing confirms full settlement and reconciles the payment history before Legal intake.' },
  { value: 'preparation', label: 'Prepare documents', description: 'Legal staff prepare the client folder, clearance, cashier SOA, deed when required, and title copy; contact the client to resolve missing requirements.' },
  { value: 'review', label: 'Legal verification', description: 'The Legal Head checks all documents. Complete files proceed to Management; incomplete files return to preparation with a reason.' },
  { value: 'signature', label: 'Management signature', description: 'Management reviews and signs the verified release packet before the 30-day clearance begins.' },
  { value: 'clearance', label: '30-day clearance', description: 'Monitor the clearance period after Management approval.' },
  { value: 'ready', label: 'Ready for claim', description: 'Contact the client, issue a claim notice, and record delivery and follow-ups.' },
  { value: 'released', label: 'Released', description: 'Review the release date, receiver, and scanned proof of handover.' },
] as const;

// Fixed pick-lists: one spelling per value, so filters and totals add up.

export const CHANNELS = [
  'Worker Hotline',
  'WhatsApp',
  'WhatsApp Chatbot',
  'Welfare Internal',
  'Site visit',
  'Email',
  'Phone',
]

export const CATEGORIES = [
  'Employment Practice',
  'Off-Boarding',
  'On-Boarding',
  'Accommodation',
  'Food',
  'Transportation',
  'Other',
]

export const ISSUES = [
  'Salary not received',
  'Final salary',
  'Overtime not paid',
  'End of service benefits',
  'Illegal deductions',
  'Informal worker / No Ajeer',
  'Recruitment fees',
  'Passport withheld',
  'Harassment / bullying',
  'Accommodation standards',
  'Fire fighting system',
  'Food provision',
  'Transportation',
  'Other',
]

export const PRIORITIES: { value: number; label: string }[] = [
  { value: 1, label: 'Critical' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Low' },
]

export const SEVERITIES = ['Not Acceptable', 'Critical', 'Need Improvement']

export const priorityLabel = (p: number) => PRIORITIES.find((x) => x.value === p)?.label ?? ''

/** Prefix every ticket number starts with. */
export const TICKET_PREFIX = 'WWCMPL'

/** A ticket number is valid when it has more than the bare prefix. */
export const validTicketNo = (no: string) => {
  const n = no.trim().toUpperCase()
  return n.length > TICKET_PREFIX.length && n.startsWith(TICKET_PREFIX)
}

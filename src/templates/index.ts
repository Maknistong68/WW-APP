import type { InspectionTemplate } from '../types'

// ---------------------------------------------------------------------------
// PLACEHOLDER CHECKLISTS
// These sections/items are generic worker-welfare content so the app is
// usable end-to-end today. They will be replaced 1:1 with the official
// checklists (and the export layout matched 100% to the official template)
// once those documents are provided.
// ---------------------------------------------------------------------------

const accommodation: InspectionTemplate = {
  id: 'accommodation',
  name: 'Accommodation Inspection',
  shortName: 'Accommodation',
  description: 'Physical inspection of workers’ accommodation (camp) conditions.',
  exports: ['excel', 'word'],
  sections: [
    {
      id: 'acc-general',
      title: 'General & Documentation',
      items: [
        { id: 'acc-general-1', text: 'Accommodation approval/permit available and valid' },
        { id: 'acc-general-2', text: 'Camp rules and emergency contacts displayed in workers’ languages' },
        { id: 'acc-general-3', text: 'Occupancy register up to date and matches actual occupancy' },
        { id: 'acc-general-4', text: 'Camp management / welfare officer present and reachable' },
      ],
    },
    {
      id: 'acc-rooms',
      title: 'Sleeping Rooms',
      items: [
        { id: 'acc-rooms-1', text: 'Minimum space per occupant met; rooms not overcrowded' },
        { id: 'acc-rooms-2', text: 'One bed per worker; no hot-bedding; beds in good condition' },
        { id: 'acc-rooms-3', text: 'Lockable storage provided for each worker' },
        { id: 'acc-rooms-4', text: 'Ventilation and air conditioning working; temperature adequate' },
        { id: 'acc-rooms-5', text: 'Lighting adequate; electrical fittings safe (no loose wiring)' },
        { id: 'acc-rooms-6', text: 'Rooms clean, dry and free of pests' },
      ],
    },
    {
      id: 'acc-sanitary',
      title: 'Sanitary Facilities',
      items: [
        { id: 'acc-sanitary-1', text: 'Toilet and shower ratios meet the required standard' },
        { id: 'acc-sanitary-2', text: 'Hot and cold running water available' },
        { id: 'acc-sanitary-3', text: 'Facilities clean, ventilated and in working order' },
        { id: 'acc-sanitary-4', text: 'Drainage working; no standing water or bad odours' },
      ],
    },
    {
      id: 'acc-kitchen',
      title: 'Kitchen & Dining',
      items: [
        { id: 'acc-kitchen-1', text: 'Food preparation areas clean and hygienic' },
        { id: 'acc-kitchen-2', text: 'Food stored at correct temperatures; raw/cooked separated' },
        { id: 'acc-kitchen-3', text: 'Gas cylinders/stoves safely installed and maintained' },
        { id: 'acc-kitchen-4', text: 'Dining area adequate, clean and furnished' },
        { id: 'acc-kitchen-5', text: 'Pest control programme in place with records' },
      ],
    },
    {
      id: 'acc-fire',
      title: 'Fire & Emergency Safety',
      items: [
        { id: 'acc-fire-1', text: 'Fire extinguishers available, accessible and in service date' },
        { id: 'acc-fire-2', text: 'Smoke detectors / fire alarm system working' },
        { id: 'acc-fire-3', text: 'Emergency exits unobstructed and clearly marked' },
        { id: 'acc-fire-4', text: 'Evacuation plan displayed; drills conducted and recorded' },
        { id: 'acc-fire-5', text: 'Assembly point designated and signed' },
      ],
    },
    {
      id: 'acc-health',
      title: 'Health & Hygiene',
      items: [
        { id: 'acc-health-1', text: 'Safe drinking water freely available' },
        { id: 'acc-health-2', text: 'First aid kits stocked; trained first aider available' },
        { id: 'acc-health-3', text: 'Waste collected and disposed of regularly; bins covered' },
        { id: 'acc-health-4', text: 'Sick room / access to medical care arranged' },
      ],
    },
    {
      id: 'acc-welfare',
      title: 'Welfare Facilities',
      items: [
        { id: 'acc-welfare-1', text: 'Laundry facilities available and working' },
        { id: 'acc-welfare-2', text: 'Recreation area/facilities provided' },
        { id: 'acc-welfare-3', text: 'Internet/communication access available to workers' },
        { id: 'acc-welfare-4', text: 'Transport to/from site safe and adequate' },
      ],
    },
  ],
}

const welfareAudit: InspectionTemplate = {
  id: 'welfare_audit',
  name: 'Workers’ Welfare Audit',
  shortName: 'Welfare Audit',
  description: 'Audit of contractor compliance with workers’ welfare requirements.',
  exports: ['excel', 'word'],
  sections: [
    {
      id: 'wa-recruitment',
      title: 'Recruitment & Employment',
      items: [
        { id: 'wa-recruitment-1', text: 'Workers hold signed contracts in a language they understand' },
        { id: 'wa-recruitment-2', text: 'No recruitment fees charged to workers (or fees reimbursed)' },
        { id: 'wa-recruitment-3', text: 'Passports/personal documents retained by workers (not withheld)' },
        { id: 'wa-recruitment-4', text: 'Contract terms match what was promised at recruitment' },
      ],
    },
    {
      id: 'wa-wages',
      title: 'Wages & Working Hours',
      items: [
        { id: 'wa-wages-1', text: 'Wages paid on time and in full through a verifiable system' },
        { id: 'wa-wages-2', text: 'Payslips issued and understood by workers' },
        { id: 'wa-wages-3', text: 'No unlawful or unexplained deductions' },
        { id: 'wa-wages-4', text: 'Working hours and overtime within legal limits and compensated' },
        { id: 'wa-wages-5', text: 'Weekly rest day and leave entitlements respected' },
      ],
    },
    {
      id: 'wa-grievance',
      title: 'Grievance & Worker Voice',
      items: [
        { id: 'wa-grievance-1', text: 'Grievance mechanism in place, known to workers, and used' },
        { id: 'wa-grievance-2', text: 'Grievances logged, investigated and closed out' },
        { id: 'wa-grievance-3', text: 'Welfare officer(s) appointed with defined responsibilities' },
        { id: 'wa-grievance-4', text: 'No evidence of retaliation against complainants' },
      ],
    },
    {
      id: 'wa-hs',
      title: 'Health & Safety',
      items: [
        { id: 'wa-hs-1', text: 'Workers received induction and job-specific safety training' },
        { id: 'wa-hs-2', text: 'PPE provided free of charge and used' },
        { id: 'wa-hs-3', text: 'Heat stress controls in place (rest breaks, water, shade)' },
        { id: 'wa-hs-4', text: 'Access to medical care and valid health insurance' },
        { id: 'wa-hs-5', text: 'Incidents recorded, investigated and reported' },
      ],
    },
    {
      id: 'wa-accom',
      title: 'Accommodation & Food',
      items: [
        { id: 'wa-accom-1', text: 'Accommodation meets required welfare standards' },
        { id: 'wa-accom-2', text: 'Food provided is adequate, safe and culturally appropriate' },
        { id: 'wa-accom-3', text: 'Transport between camp and site is safe' },
      ],
    },
    {
      id: 'wa-records',
      title: 'Documentation & Records',
      items: [
        { id: 'wa-records-1', text: 'Worker files complete (contracts, IDs, visas/permits)' },
        { id: 'wa-records-2', text: 'Wage and time records available and consistent' },
        { id: 'wa-records-3', text: 'Previous audit findings closed out with evidence' },
      ],
    },
  ],
}

export const TEMPLATES: InspectionTemplate[] = [accommodation, welfareAudit]

export const getTemplate = (id: string): InspectionTemplate | undefined =>
  TEMPLATES.find((t) => t.id === id)

export const countItems = (t: InspectionTemplate): number =>
  t.sections.reduce((n, s) => n + s.items.length, 0)

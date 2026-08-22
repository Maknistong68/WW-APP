import type { InspectionTemplate } from '../types'

// PLACEHOLDER — this checklist will be replaced 1:1 with the official
// Workers' Welfare Audit questionnaire once that document is provided.
// It reuses the same structure (lettered sections, coded questions) so the
// whole app and both exports already work for it.
export const welfareAudit: InspectionTemplate = {
  id: 'welfare_audit',
  name: 'Workers’ Welfare Audit',
  shortName: 'Welfare Audit',
  description: 'Audit of contractor compliance with workers’ welfare requirements. (Placeholder checklist.)',
  questionnaireTitle: 'Workers’ Welfare Audit',
  sections: [
    {
      letter: 'A',
      title: 'Recruitment & Employment',
      questions: [
        { code: 'A1', text: 'Workers hold signed contracts in a language they understand.' },
        { code: 'A2', text: 'No recruitment fees charged to workers (or fees reimbursed).' },
        { code: 'A3', text: 'Passports/personal documents retained by workers (not withheld).' },
        { code: 'A4', text: 'Contract terms match what was promised at recruitment.' },
      ],
    },
    {
      letter: 'B',
      title: 'Wages & Working Hours',
      questions: [
        { code: 'B1', text: 'Wages paid on time and in full through a verifiable system.' },
        { code: 'B2', text: 'Payslips issued and understood by workers.' },
        { code: 'B3', text: 'No unlawful or unexplained deductions.' },
        { code: 'B4', text: 'Working hours and overtime within legal limits and compensated.' },
        { code: 'B5', text: 'Weekly rest day and leave entitlements respected.' },
      ],
    },
    {
      letter: 'C',
      title: 'Grievance & Worker Voice',
      questions: [
        { code: 'C1', text: 'Grievance mechanism in place, known to workers, and used.' },
        { code: 'C2', text: 'Grievances logged, investigated and closed out.' },
        { code: 'C3', text: 'Welfare officer(s) appointed with defined responsibilities.' },
        { code: 'C4', text: 'No evidence of retaliation against complainants.' },
      ],
    },
    {
      letter: 'D',
      title: 'Health & Safety',
      questions: [
        { code: 'D1', text: 'Workers received induction and job-specific safety training.' },
        { code: 'D2', text: 'PPE provided free of charge and used.' },
        { code: 'D3', text: 'Heat stress controls in place (rest breaks, water, shade).' },
        { code: 'D4', text: 'Access to medical care and valid health insurance.' },
        { code: 'D5', text: 'Incidents recorded, investigated and reported.' },
      ],
    },
    {
      letter: 'E',
      title: 'Documentation & Records',
      questions: [
        { code: 'E1', text: 'Worker files complete (contracts, IDs, visas/permits).' },
        { code: 'E2', text: 'Wage and time records available and consistent.' },
        { code: 'E3', text: 'Previous audit findings closed out with evidence.' },
      ],
    },
  ],
}

// Ready findings for the Worker Welfare audit, written for each question: what an
// auditor typically finds when the requirement is not met (No, 3) or only partly
// met (Partial, 2). Each names the gap and the evidence seen or missing (a
// document, payslips, timesheets, worker interviews, the site), in plain audit
// wording, 15–25 words, with no praise. Researched against the Saudi labour rules
// the questions rest on (hours, overtime, the midday summer ban, employer-paid
// recruitment, WPS and Qiwa, deductions, leave and end of service) and fair
// recruitment practice; they describe evidence rather than cite article numbers.
// Shown first in the app; the client's own short comments (welfareComments.ts)
// follow them. Checked by welfareFindings.test.ts.

export interface Findings {
  /** The requirement is not met. */
  no: string[]
  /** The requirement is partly met. */
  partial: string[]
}

export const WELFARE_FINDINGS: Record<string, Findings> = {
  // ---- A · Employment practice ------------------------------------------------
  A1: {
    no: [
      "The contractor could not produce a worker welfare policy, manual or plan; no document sets out how workers are to be treated fairly.",
      "HR policies shown were generic head-office documents that do not cover worker welfare, recruitment, grievances or accommodation for this project.",
      "No documented procedures exist for recruitment, wages, grievances or discipline; managers said practices are agreed verbally case by case.",
    ],
    partial: [
      "A worker welfare plan exists but is in draft, unsigned and undated, and has not been issued to site managers or supervisors.",
      "Policies cover direct employees only; subcontractor and supplier workers on the project are not covered by the welfare plan or procedures.",
    ],
  },
  A2: {
    no: [
      "No review of the recruitment agencies' policies was done, and the contractor holds no audit reports on any agency in its supply chain.",
      "The contractor could not name the agencies that recruited its current workforce, so ethical recruitment in the supply chain cannot be verified.",
      "No recruitment audit plan, checklist or schedule exists; the contractor relies on the agencies' own statements that their recruitment is ethical.",
    ],
    partial: [
      "One agency was audited last year, but agencies supplying the most recent worker batches have not been reviewed or audited at all.",
      "Agency policies were collected on file, but no audit or worker interviews were done to confirm the policies are followed in practice.",
    ],
  },
  A3: {
    no: [
      "Age records could not be shown for sampled workers; the contractor holds no copies of passports or IDs showing dates of birth.",
      "One sampled worker file shows a date of birth that made the worker under 18 when hired on the project.",
      "No age check is done at hiring or mobilisation, and subcontractor workers are admitted to site without any age verification.",
    ],
    partial: [
      "Ages are checked for direct hires, but subcontractor and labour supplier workers have no age verification records in the files sampled.",
      "Age is taken from the visa page only; no hiring step or sign-off confirms that every worker is 18 or over.",
    ],
  },
  A4: {
    no: [
      "No welfare inspections of subcontractors have been done; the contractor holds no inspection reports, checklists or findings for any subcontractor.",
      "The contractor has no schedule or procedure for checking subcontractor welfare compliance and could not list the subcontractors currently on site.",
      "Subcontractor workers are housed and paid without any checks by the contractor; welfare issues with them surface only through complaints.",
    ],
    partial: [
      "Inspections were done for some subcontractors only; newer subcontractors mobilised this quarter have never been inspected for welfare compliance.",
      "Subcontractor inspections were done, but findings were not followed up; the same issues reappear in later reports without closure evidence.",
    ],
  },
  A5: {
    no: [
      "The contractor could not show a valid Ministry licence for the recruitment agency used; its name was not on the licensed-agency list.",
      "The agency licence shown had expired before the latest batch of workers was recruited, and no renewed licence was on file.",
      "Subcontractor workers were recruited through an agency whose Ministry registration the contractor never checked or kept on file.",
    ],
    partial: [
      "Licences are on file for the main agency only; agencies used by subcontractors have no registration evidence in the contractor's records.",
      "An agency licence was shown, but no register links each worker batch to the licensed agency that actually recruited it.",
    ],
  },
  A6: {
    no: [
      "The agreement with the recruitment agency has no clause banning recruitment fees, deposits, security payments or loans charged to workers.",
      "No written contract exists with the recruitment agency; recruitment was arranged by email and phone without agreed terms on worker fees.",
      "The agency contract lets the agency recover visa, ticket or medical costs from workers, which shifts recruitment costs onto them.",
    ],
    partial: [
      "The agency contract bans recruitment fees but says nothing about deposits, security payments or loans taken by workers to secure the job.",
      "A no-fee clause appears in the newest agency contract only; contracts with agencies that supplied current workers have no such clause.",
    ],
  },
  A7: {
    no: [
      "Workers interviewed said they paid recruitment or processing fees to the agency in their home country before travelling to the project.",
      "The contractor has no process to check whether agencies abroad charge candidates; no worker surveys, declarations or agency audits are held.",
      "Workers reported paying deposits or security money to sub-agents in their home towns, and the contractor was unaware of these payments.",
    ],
    partial: [
      "Workers signed no-fee declarations, but interviews show some still paid sub-agents or medical centres in their home country before departure.",
      "Fee checks were done for direct hires only; workers supplied by labour subcontractors were never asked about fees paid before arrival.",
    ],
  },
  A8: {
    no: [
      "Sampled iqamas show some workers sponsored by individuals or companies not engaged on the project, rather than by the contractor or subcontractor.",
      "The contractor could not show sponsorship records for its site workforce; worker ID details do not match the employing company's records.",
      "Freelance workers paying their own sponsorship were found on site through a labour supplier, without being employed by any project company.",
    ],
    partial: [
      "Direct workers are sponsored by the contractor, but some labour supplier workers' iqamas list sponsors that are not declared on the project.",
      "Sponsorship was checked at mobilisation only; nothing confirms that workers' sponsors stay correct after transfers or renewals.",
    ],
  },
  A9: {
    no: [
      "Workers reported paying recruitment fees, but the contractor sent no written declaration of these cases to the client's Worker Welfare team.",
      "The contractor has no procedure to record and report fee payments by workers, so no declarations have ever been prepared.",
      "Fee cases found in the contractor's own interviews were handled internally and were not declared to the client as required.",
    ],
    partial: [
      "A declaration was sent for some workers, but it does not list amounts paid, agencies involved or planned reimbursement dates.",
      "Declarations were sent late, months after the fee cases were found, and only after the client raised the issue.",
    ],
  },
  A10: {
    no: [
      "Workers who showed receipts for recruitment fees have not been repaid; the contractor holds no reimbursement records or payment proof.",
      "The contractor refuses reimbursement unless the worker brings an agency receipt, which most workers cannot obtain from agencies abroad.",
      "No reimbursement procedure, budget or timeline exists; fee cases raised by workers remain open with no decision recorded on them.",
    ],
    partial: [
      "Some workers were repaid, but amounts were partial and no record shows how the repaid sum was calculated against fees claimed.",
      "Reimbursements were made in cash without signed receipts or WPS records, so payment to the right worker cannot be verified.",
    ],
  },
  A11: {
    no: [
      "No pre-mobilisation medical reports were found in sampled worker files; workers started site work without a recorded fitness assessment.",
      "Medical certificates on file are home-country visa medicals only, with no check of fitness against the role assigned on site.",
      "The contractor has no medical clearance step before mobilisation; supervisors assign roles without any record of the workers' fitness for duty.",
    ],
    partial: [
      "Baseline medicals were done for direct hires, but subcontractor workers were mobilised without any medical record held by the contractor.",
      "Medical reports exist but are over a year old or lack the doctor's fitness conclusion for the specific role assigned.",
    ],
  },
  A12: {
    no: [
      "No annual medical screening has taken place for workers employed more than a year; no provider contract or results are on file.",
      "Workers interviewed said they paid for their own annual medical check, or the cost was deducted from their wages.",
      "Annual checks are done by the site first-aider, not a licensed third-party provider, and no clinic reports are held.",
    ],
    partial: [
      "Annual screenings covered part of the workforce only; the screening log shows many workers overdue by several months.",
      "Screenings were done by a licensed clinic, but results were not followed up and workers with findings had no further review.",
    ],
  },
  A13: {
    no: [
      "Workers at height, in confined spaces or on hazardous tasks had no specialised medical screening; only general medicals are on file.",
      "The contractor has not identified which roles need specialised medicals, so no role-based screening list or schedule exists.",
      "Riggers and scaffolders sampled started work at height without a fitness-for-height assessment or a doctor's clearance for the role.",
    ],
    partial: [
      "Specialised medicals were done for some high-risk roles, but crane operators or welders sampled had no role-specific screening records.",
      "Role-based screenings were done once at hiring and not repeated, although the contractor's own plan requires yearly renewal.",
    ],
  },
  A14: {
    no: [
      "No training records show that employees were inducted on employment practices or the client's code of conduct; attendance sheets are missing.",
      "Site induction covers safety only; employment rights, conduct rules and worker welfare standards are not part of any training given.",
      "Workers interviewed could not describe the code of conduct or their employment rights, and recall no session on these topics.",
    ],
    partial: [
      "Induction records exist for staff and supervisors only; manual and subcontractor workers have no record of code of conduct training.",
      "Training was given in English only, without translation, so many workers could not follow the employment practice content.",
    ],
  },

  // ---- B · Employment offer ---------------------------------------------------
  B1: {
    no: [
      "Workers interviewed said they first saw an offer letter after arriving in Saudi Arabia, not before leaving their home country.",
      "Sampled files hold no signed original offer letter; only the Saudi contract is on file, signed after the worker arrived.",
      "Offer letters on file are in English or Arabic only, which the sampled workers said they cannot read.",
    ],
    partial: [
      "Signed offers exist on file, but workers said they were not given their own copy to keep before travelling.",
      "Offers were signed before departure, but some are unsigned by the employer or undated, so their timing cannot be confirmed.",
    ],
  },
  B2: {
    no: [
      "Offer letters sampled do not state the full legal name or Commercial Registration number of the company issuing the work permit.",
      "The company named on the offer differs from the sponsor on the workers' iqamas, and no explanation or transfer record exists.",
      "Offers were issued on an agency letterhead with no employer details, so workers did not know which company would employ them.",
    ],
    partial: [
      "The company name appears on offer letters, but the Commercial Registration number is missing or does not match the current CR.",
      "Recent offers include the company name and CR, but offers for earlier worker batches still on the project do not.",
    ],
  },
  B3: {
    no: [
      "Offer letters sampled give a job title only, with no description of duties, basic wage or the allowances to be paid.",
      "The offer states one total monthly amount without splitting basic wage and allowances, so entitlements based on basic wage are unclear.",
      "Wage amounts in the offers differ from what payslips show, and the offers list no allowances that workers now receive.",
    ],
    partial: [
      "Basic wage is stated, but housing, food and transport allowances are missing or described as 'per company policy' without amounts.",
      "Role and wage are clear, but duties are not described, so workers cannot tell whether later tasks fall within the offer.",
    ],
  },
  B4: {
    no: [
      "Offer letters do not mention a probation period or its length, nor any skills test the worker must pass on arrival.",
      "Workers were put on probation and tested after arrival, although their offers said nothing about probation or a skills assessment.",
      "The probation in the contract is longer than allowed and was not mentioned in the original offer the worker accepted.",
    ],
    partial: [
      "Probation length is stated, but the skills assessment, and what happens if a worker fails it, are not explained.",
      "Probation appears in recent offers only; offers for workers recruited earlier on the project do not mention it at all.",
    ],
  },
  B5: {
    no: [
      "Offer letters do not state the pay date or how salary is paid; workers said pay day changes from month to month.",
      "The offer says salary is paid 'monthly' without a fixed day, and payroll records show payment dates spread across the month.",
      "Salary is paid in cash although the offer gives no payment method, and no bank or WPS payment is recorded.",
    ],
    partial: [
      "A fixed pay date is stated, but the offer does not say pay moves a day earlier when it falls on a weekend or holiday.",
      "Pay date and bank transfer are stated, but payroll shows several months in which wages were paid after that date.",
    ],
  },
  B6: {
    no: [
      "Offer letters sampled do not state basic daily or weekly working hours, so workers had no agreed limit before arrival.",
      "The offer states working hours 'as per site requirements', with no number of hours per day or per week.",
      "Hours in the offer exceed eight a day or forty-eight a week before any overtime is counted.",
    ],
    partial: [
      "Daily hours are stated, but weekly hours, rest days and how Ramadan hours apply are not given in the offer.",
      "Hours are stated in the contract signed on arrival, but the original offer accepted abroad gives no working hours.",
    ],
  },
  B7: {
    no: [
      "Workers travel over an hour each way between camp and site, but the offer does not count travel time in working hours.",
      "Offers say nothing about travel time, and timesheets start at arrival on site, not at bus pick-up from the camp.",
      "Long daily commutes were observed, yet neither the offers nor payroll treat travel over one hour as paid working time.",
    ],
    partial: [
      "The offer mentions travel time but does not say travel over one hour counts within basic hours, leaving it open to interpretation.",
      "Travel time is counted for some crews only; workers housed in the farther camp are not paid for their longer commute.",
    ],
  },
  B8: {
    no: [
      "Offer letters do not mention overtime hours, the daily limit, or whether overtime is voluntary for the worker.",
      "The offer states 'overtime as required' with no limit, which conflicts with the two-hour daily overtime limit in the standard.",
      "Overtime hours are not in the offer, yet timesheets show workers routinely working overtime from their first week on site.",
    ],
    partial: [
      "Overtime is mentioned, but the maximum hours per day and per week are not stated in the offer.",
      "Overtime terms appear in the Saudi contract only; the original offer accepted abroad does not mention overtime at all.",
    ],
  },
  B9: {
    no: [
      "Offer letters do not state any overtime rate, so workers could not know they are owed basic hourly wage plus fifty percent.",
      "The offer sets a fixed overtime rate per hour that is below the basic hourly wage plus fifty percent.",
      "Holiday and rest-day overtime rates are missing from offers, and payslips show one rate for normal and holiday overtime.",
    ],
    partial: [
      "The normal overtime rate is stated, but the higher rate for rest days and public holidays is not given in the offer.",
      "Overtime rates are stated as 'per labour law' without figures, so workers cannot check their overtime pay against the offer.",
    ],
  },
  B10: {
    no: [
      "Offers do not state that housing, food and transport are provided, and some workers pay for food from their own wages.",
      "The offer lists a small food allowance only and says nothing about free accommodation or transport to and from site.",
      "Workers said they were told abroad that housing was free, but the written offer includes none of these entitlements.",
    ],
    partial: [
      "Housing and transport are stated, but food is missing; workers receive a fixed food allowance the offer does not mention.",
      "Entitlements are stated in the offers of direct hires, but subcontractor workers' offers leave out housing, food and transport.",
    ],
  },
  B11: {
    no: [
      "Offer letters do not state annual leave, rest days, sick leave pay or return airfare to the worker's nearest international airport.",
      "The offer requires workers to leave a surety bond or deposit before taking annual leave, which the standard does not allow.",
      "Annual leave is offered without airfare, or airfare is capped at a fixed cash amount that does not cover the ticket home.",
    ],
    partial: [
      "Annual leave and airfare are stated, but rest days, sick leave and how sick leave is paid are not described.",
      "Leave entitlements are listed, but the offer adds penalties for late return that the welfare standard does not allow.",
    ],
  },
  B12: {
    no: [
      "Employment letters are in English or Arabic only; workers interviewed could not read them and no translation was provided.",
      "No record shows the employment letter was explained to workers in their own language before they signed it.",
      "Workers signed their employment letters at the agency without being told the terms; several could not state their basic wage.",
    ],
    partial: [
      "Translations exist for the main nationalities only; workers from smaller groups received letters in a language they do not read.",
      "Letters were translated, but workers signed only the English copy, so it is unclear which version they actually understood.",
    ],
  },
  B13: {
    no: [
      "Workers said they paid for their own flight, visa or medical tests to relocate, and were not repaid by the contractor.",
      "The contractor's policy or agency agreement makes workers bear relocation costs, including air tickets and visa fees, before arrival.",
      "No records show the contractor paid relocation costs for sampled workers; payment proof for tickets and visas could not be produced.",
    ],
    partial: [
      "The contractor pays visas and tickets, but workers paid for their own pre-departure medical tests and document attestation.",
      "Relocation costs were covered for direct hires, but subcontractor workers said they paid part of their travel and visa costs.",
    ],
  },

  // ---- C · Worker onboarding --------------------------------------------------
  C1: {
    no: [
      "Workers are moved between camp and site in open trucks or overcrowded buses carrying more passengers than seats.",
      "Buses observed had no working air conditioning, and workers waited in the sun for transport at the end of shifts.",
      "No transport is provided for some crews, who walk to site or pay for their own taxis each day.",
    ],
    partial: [
      "Buses are provided, but several were overcrowded or in poor repair, with broken seats and windows during the visit.",
      "Morning transport runs on schedule, but return trips are delayed and workers wait for long periods without shade.",
    ],
  },
  C2: {
    no: [
      "Sampled workers who arrived more than 30 days ago still have no iqama, bank account or completed medical check.",
      "Workers without bank accounts are paid in cash months after arrival, and the contractor tracks no onboarding deadlines.",
      "The contractor has no onboarding tracker showing ID, bank account and medical dates, so the 30-day target cannot be checked.",
    ],
    partial: [
      "Iqamas were issued within 30 days, but bank accounts for several sampled workers were opened two or three months after arrival.",
      "Onboarding is tracked for direct hires only; subcontractor workers' ID and bank account dates are not recorded by the contractor.",
    ],
  },
  C3: {
    no: [
      "No induction records exist for the newly hired workers sampled; they started site work without any recorded induction session.",
      "Induction covers site safety only; company policies, legal dos and don'ts and cultural sensitivity are not part of the content.",
      "Induction was given in a language most new workers do not understand, with no interpreter or translated material.",
    ],
    partial: [
      "Induction records exist, but attendance sheets are unsigned or list fewer workers than were hired in the same month.",
      "Induction covers most topics, but cultural sensitivity and local legal dos and don'ts are missing from the slides and handouts.",
    ],
  },
  C4: {
    no: [
      "Subcontractors working on site are missing from the weekly and monthly reports sent to the client's Worker Welfare team.",
      "Labour suppliers providing workers on site were never declared to the client; the contractor's reports list direct employees only.",
      "The contractor does not submit weekly or monthly subcontractor declarations, and no submission records could be shown.",
    ],
    partial: [
      "Subcontractors appear in monthly reports, but new ones are added weeks late and are missing from the weekly reports.",
      "Declared headcounts for subcontractors differ from the workers seen on site and from gate records for the same week.",
    ],
  },
  C5: {
    no: [
      "No briefing records show that workers were told how to raise grievances or that they are protected from retaliation.",
      "Workers interviewed did not know the client's Worker Hotline or the Worker Welfare App and raise issues with their supervisor only.",
      "Hotline posters and grievance information are not displayed at the camp or site in languages the workers can read.",
    ],
    partial: [
      "Briefings cover the internal grievance route, but not the right to escalate to the client's Worker Welfare team or hotline.",
      "Briefing records exist, but workers interviewed were unsure whether raising a complaint could affect their job or overtime.",
    ],
  },
  C6: {
    no: [
      "Workers were seen without the PPE required for their tasks, and the contractor holds no PPE issue records for them.",
      "Workers said they pay for replacement boots, gloves or coveralls, or the cost is deducted from their wages.",
      "No winter jackets or weatherproof clothing were issued, although workers work outdoors through the cold and wet months.",
    ],
    partial: [
      "PPE was issued at mobilisation, but worn items are not replaced; several workers wore damaged boots and torn coveralls.",
      "Basic PPE is provided, but task-specific items such as respirators or harnesses were missing for some of the roles observed.",
    ],
  },
  C7: {
    no: [
      "Workers interviewed did not know the Ministry's contact number or app for labour complaints and had not been given it.",
      "No Ministry contact details are displayed at the camp or site, and none appear in the induction material.",
      "Workers said they were told to raise every issue with the company only, never with the Ministry of Labor.",
    ],
    partial: [
      "Ministry contact details are posted at the camp, but only in Arabic and English, which many workers cannot read.",
      "The Ministry number is in the induction slides, but workers interviewed could not recall it or where to find it.",
    ],
  },

  // ---- D · Employment contract ------------------------------------------------
  D1: {
    no: [
      "Sampled employment contracts are not signed by the worker, or the signature is missing from the pages with wage terms.",
      "Workers interviewed said they never received a copy of their employment contract, and no acknowledgement of receipt is held.",
      "Contract copies are kept by the company only, and workers were told to ask their supervisor if they ever need one.",
    ],
    partial: [
      "Contracts are signed, but copies were given to some workers only; others said they were never handed one.",
      "Workers received copies, but only the signature page is signed and the wage pages are unsigned and unnumbered.",
    ],
  },
  D2: {
    no: [
      "Sampled workers have no documented contract on Qiwa, although they started work on the project more than 30 days ago.",
      "The contractor could not show Qiwa contract records or dates, so the 30-day documentation requirement cannot be verified.",
      "Qiwa contracts were registered months after the start date, and the contractor has no tracker for pending registrations.",
    ],
    partial: [
      "Most direct hires have Qiwa contracts within 30 days, but several recent joiners and transfers were still pending at the visit.",
      "Qiwa contracts exist, but the wage recorded differs from the signed contract and from the amount paid through WPS.",
    ],
  },
  D3: {
    no: [
      "Sampled contracts lack terms required by the labour law and welfare standards, such as leave, end-of-service and termination rights.",
      "Workers' medical insurance has a network limited to another city, with no clinics or hospitals covered in the project region.",
      "Some sampled workers had no valid medical insurance at the time of the audit, and no renewal was in progress.",
    ],
    partial: [
      "Contracts follow the labour law template, but the welfare standard terms on recruitment fees and grievances are not included.",
      "Insurance is valid, but the approved network covers one hospital far from site, with no clinic near the camp.",
    ],
  },
  D4: {
    no: [
      "Wages in the Saudi contract are lower than in the original offer letter the worker accepted before travelling.",
      "Contract terms were changed after arrival, including hours and allowances, without signed consent from the workers affected.",
      "Workers said they were asked to sign new contracts on arrival and were told their original offer no longer applied.",
    ],
    partial: [
      "Basic wage matches the offer, but allowances or overtime terms in the contract are less favourable than those promised.",
      "Consent forms exist for contract changes, but they are in English only and workers could not explain what they agreed to.",
    ],
  },
  D5: {
    no: [
      "Workers hired as general helpers were seen doing skilled or high-risk tasks such as welding or rigging without training records.",
      "Workers said they are moved between trades as needed, doing jobs different from the role in their contract.",
      "Job titles on contracts do not match the work observed on site, and no change of role was agreed in writing.",
    ],
    partial: [
      "Most workers do their contracted role, but some were assigned driving or cleaning duties outside their contract without agreement.",
      "Role changes are recorded, but training for the new role was not completed before workers started the new tasks.",
    ],
  },
  D6: {
    no: [
      "Some workers on site are employed by individuals rather than a registered company, and no project company holds their contracts.",
      "Workers are paid a daily or piece rate through a labour supplier instead of a monthly salary.",
      "The company employing part of the workforce is not registered or declared with the client, and no declaration was shown.",
    ],
    partial: [
      "All workers are employed by companies, but one labour supplier was declared to the client only after its workers were mobilised.",
      "Workers have monthly contracts, but payroll shows daily-rate payments for some groups during their first months on site.",
    ],
  },

  // ---- E · Employment conditions ----------------------------------------------
  E1: {
    no: [
      "The contractor's HR policy has no equal opportunity statement; hiring, pay and promotion rules are not written down anywhere.",
      "Pay scales differ by nationality for the same job title, and the contractor could not explain the basis in writing.",
      "Job adverts or offer terms show preferences by nationality, age or religion that are not linked to the job's requirements.",
    ],
    partial: [
      "An equal opportunity policy exists, but it is not communicated to supervisors or workers, and no one is responsible for it.",
      "The policy covers hiring only; pay, promotion, accommodation and overtime allocation are not covered by equal treatment rules.",
    ],
  },
  E2: {
    no: [
      "Payslips show fines deducted for lateness, absence or lost tools, which are financial penalties the standard does not allow.",
      "The HR policy lists fines for misconduct without any limit or appeal, and supervisors apply them directly from wages.",
      "Workers said they lose a full day's pay for being a few minutes late, with no written record of the decision.",
    ],
    partial: [
      "The policy bans fines, but payroll shows unexplained 'other deductions' for some workers that look like penalties.",
      "Fines stopped this year, but money deducted earlier as penalties has not been returned to the workers concerned.",
    ],
  },
  E3: {
    no: [
      "The HR policy does not ban violence, bullying, harassment or threats, and there is no procedure for reporting such behaviour.",
      "Workers interviewed described supervisors shouting at them and threatening deportation or loss of overtime if they complain.",
      "A reported case of a supervisor striking a worker was not investigated, and no disciplinary record exists for it.",
    ],
    partial: [
      "An anti-harassment policy exists, but it is in English only and has not been explained to workers or supervisors.",
      "Complaints of verbal abuse were recorded, but no investigation outcome or action against the supervisor is on file.",
    ],
  },
  E4: {
    no: [
      "The HR policy has no disciplinary rules for managers or staff who breach welfare standards, and no cases are recorded.",
      "Welfare breaches found in earlier audits were closed without any action against the managers responsible for them.",
      "The disciplinary procedure covers workers only; supervisors and managers are not subject to it for welfare violations.",
    ],
    partial: [
      "A disciplinary procedure covers welfare breaches, but cases are not logged and outcomes cannot be traced for past incidents.",
      "Action was taken against workers for breaches, but none against supervisors, although several complaints named supervisors directly.",
    ],
  },
  E5: {
    no: [
      "Workers said they cannot leave the camp on rest days without a supervisor's permission and must return by a fixed curfew.",
      "Camp gates are locked at night with no staff on duty, so workers could not leave in an emergency.",
      "Workers' iqamas or passports are held by the camp office, which stops them moving freely outside the accommodation.",
    ],
    partial: [
      "Workers may leave the camp, but must sign out and give reasons, which the welfare standard does not require.",
      "Movement is free on rest days, but no transport is provided, so workers at remote camps cannot leave in practice.",
    ],
  },
  E6: {
    no: [
      "Employment contracts do not say that workers are paid during sick leave after an accident or injury at work.",
      "Workers injured at work were paid nothing for their days off, according to payroll and timesheets for the same months.",
      "The contract states sick leave is unpaid, which conflicts with the worker's right to pay after a work injury.",
    ],
    partial: [
      "The contract mentions sick leave, but does not say how an absence from a work injury is paid or for how long.",
      "Sick pay is in the contract, but payroll shows injured workers received basic wage only, without their usual allowances.",
    ],
  },
  E7: {
    no: [
      "No record shows that injured workers received medical treatment; the first-aid log ends without any referral or follow-up.",
      "Workers injured on site were sent to the camp to rest without seeing a doctor, according to incident and clinic records.",
      "Injured workers unable to work had their wages stopped until they returned, which conflicts with the Saudi Labor Law.",
    ],
    partial: [
      "Treatment was given, but the work injury was not reported to the social insurance authority, so no benefits were claimed.",
      "Wages continued after injuries, but treatment costs not covered by insurance were paid by the workers themselves.",
    ],
  },
  E8: {
    no: [
      "Workers said they paid for prescribed medicines and tests that insurance did not cover, and the contractor did not repay them.",
      "The contractor has no process to pay medical costs outside the insurance policy, and none have been paid this year.",
      "The insurance plan has high co-payments or excludes chronic medicines, and workers bear these costs from their own wages.",
    ],
    partial: [
      "The contractor repays uncovered medical costs, but only after long delays and without clear receipts or records of payment.",
      "Consultations are covered, but prescribed medicines and lab tests outside the policy are left for workers to pay.",
    ],
  },
  E9: {
    no: [
      "Employment contracts do not mention leave for the birth of a child or a death or serious injury in the family.",
      "Workers who asked for leave after a death in the family were refused or told to use their annual leave.",
      "No compassionate leave policy exists, and the HR team could not say how many days a worker may take.",
    ],
    partial: [
      "Compassionate leave is in the HR policy but not in the contract, and the number of days is not stated.",
      "Leave is allowed for a death in the family, but not for a childbirth or a family member's serious injury.",
    ],
  },
  E10: {
    no: [
      "Several sampled workers have expired iqamas or work permits, and the contractor has no renewal tracker or plan for them.",
      "Contracts do not state that the employer renews and pays for work permits, and some workers paid renewal fees themselves.",
      "Workers with expired permits continue working on site, exposing them to fines and detention if stopped by the authorities.",
    ],
    partial: [
      "Renewals are tracked, but several permits were renewed weeks after expiry, leaving workers without valid documents in between.",
      "The contract covers renewal, but late-renewal fines were deducted from the wages of the workers concerned.",
    ],
  },
  E11: {
    no: [
      "Sampled personal files are missing key records such as the contract, offer letter, iqama copy and medical reports.",
      "The contractor keeps no personal files for subcontractor or supplier workers on the project, only headcount lists.",
      "Personal files hold expired documents and old wage details that do not match current payroll or contracts.",
    ],
    partial: [
      "Files exist for all workers, but many are missing recent contract changes, leave records or updated emergency contacts.",
      "Files are complete for direct hires, but not for workers who joined through transfers or labour suppliers this year.",
    ],
  },
  E12: {
    no: [
      "Workers interviewed said the company keeps their passports, and passports were found stored in the site or camp office.",
      "The contractor holds workers' passports without signed consent forms or a register of when they were taken and returned.",
      "Workers cannot get their passports back on request; the office requires a manager's approval or a reason to release them.",
    ],
    partial: [
      "Passports are kept in individual lockers, but the office holds the spare keys and workers need permission to open them.",
      "Most workers hold their passports, but new arrivals' passports are still with the company months after their iqamas were issued.",
    ],
  },
  E13: {
    no: [
      "Some workers on site have no valid iqama and are working on visit or expired entry visas never converted to residence permits.",
      "The contractor could not show iqama status for sampled workers, and no list of pending conversions or renewals exists.",
      "Workers whose residence permits expired are still working on site, and renewal applications have not been started.",
    ],
    partial: [
      "Most iqamas are valid, but several recent arrivals are still on entry visas past the time allowed for conversion.",
      "Iqamas are valid, but the profession listed does not match the work the workers actually do on site.",
    ],
  },
  E14: {
    no: [
      "Workers interviewed do not hold their iqama cards; the cards are kept by the company and handed out only for checkpoints.",
      "Some workers have never received a physical iqama card or a digital copy, although their iqamas were issued months ago.",
      "Workers stopped at checkpoints had no ID with them because the company keeps all iqama cards in the office.",
    ],
    partial: [
      "Most workers hold their iqamas, but recently renewed workers' cards are still held at the office after renewal.",
      "Workers hold iqamas, but some cards are expired and the renewed details are not yet available to them.",
    ],
  },
  E15: {
    no: [
      "Workers interviewed have no health insurance cards and did not know their policy number or how to get treatment.",
      "Workers said insurance costs are deducted from their pay, which shifts a cost the employer must bear onto them.",
      "Some sampled workers had no active health insurance on the audit date, and the contractor could not show a renewal.",
    ],
    partial: [
      "Insurance is active, but cards are kept by the camp office and workers must request them each time they need care.",
      "Insurance cards were issued to direct hires, but subcontractor workers could not show any insurance card or policy number.",
    ],
  },
  E16: {
    no: [
      "Workers do not hold their own bank cards; cards and PINs are kept by supervisors or the camp office.",
      "Some workers have no bank account at all and receive wages in cash, outside the Wage Protection System.",
      "Workers said a supervisor withdraws their salary with their card and hands over cash after deducting money.",
    ],
    partial: [
      "Most workers hold their cards, but new joiners' cards are held by the office until their probation ends.",
      "Workers hold bank cards, but the nearest ATM is far from the camp and no transport is given to reach it.",
    ],
  },
  E17: {
    no: [
      "Iqama checks show workers on site sponsored by a different company from the one that employs and pays them.",
      "The contractor uses workers borrowed from another company without a Ministry-approved transfer or temporary work permit for the project.",
      "No check is made that each worker's iqama sponsor matches the employing company before site access is given.",
    ],
    partial: [
      "Most sponsors match, but workers supplied by one labour supplier are sponsored by a company not declared on the project.",
      "Sponsor checks are done at mobilisation only, and transferred workers were not checked again after their sponsor changed.",
    ],
  },

  // ---- F · Payment of workers -------------------------------------------------
  F1: {
    no: [
      "Some workers are paid in cash or by company cheque, outside the Wage Protection System, according to payroll records.",
      "WPS files for the last three months leave out subcontractor workers, and the contractor has not asked subcontractors for them.",
      "WPS records show paid amounts lower than contract wages for sampled workers, with no explanation of the difference.",
    ],
    partial: [
      "Direct workers are paid through WPS, but one subcontractor's WPS submission is missing for at least one recent month.",
      "WPS files exist, but the contractor does not check them against payroll, and several workers are missing from them.",
    ],
  },
  F2: {
    no: [
      "Payroll and WPS records show salaries paid two weeks or more late in several of the last six months.",
      "Workers interviewed said they have not been paid for the last month, and the contractor confirmed the delay.",
      "Payment dates vary from month to month with no fixed pay day, and late payments are not explained to workers.",
    ],
    partial: [
      "Most months were paid on time, but at least one month was paid late without any notice to the workers.",
      "Basic wages are paid on time, but overtime and allowances are paid one or two months later.",
    ],
  },
  F3: {
    no: [
      "Payroll shows interest or service charges taken from workers' wages for salary advances or loans given by the company.",
      "Workers said they repay more than they borrowed for salary advances, and no loan agreements show the terms.",
      "Advances are given through a supervisor who takes a cut, with no record held by payroll or HR.",
    ],
    partial: [
      "Advances carry no interest, but repayments exceed the allowed share of the monthly wage and leave workers short on pay.",
      "Loan repayments are interest-free, but no signed agreements show the amount, the schedule and the worker's consent.",
    ],
  },
  F4: {
    no: [
      "Payslips show deductions for items the labour law does not allow, such as tools, transport or uniform replacement.",
      "Total deductions for some sampled workers exceed half of their wage in a month, which the labour law does not allow.",
      "Deductions are made without the worker's written consent or any document showing the reason and the calculation.",
    ],
    partial: [
      "Allowed deductions are applied, but payslips do not explain them, so workers cannot check the reason or the amount.",
      "Loan repayments exceed ten percent of the wage for some workers, although other deductions follow the labour law.",
    ],
  },
  F5: {
    no: [
      "Payslips sampled show a monthly deduction labelled visa or iqama, a cost the employer must carry, not the worker.",
      "Workers housed in employer camps have food and accommodation deducted from their wages, with no lawful basis shown.",
      "Workers interviewed said recruitment fees are being repaid through monthly deductions agreed before they arrived.",
    ],
    partial: [
      "Most payslips are clean, but new joiners had PPE or training costs deducted in their first month on site.",
      "Payroll shows unexplained 'other' deductions; the contractor could not show what they cover or the workers' written consent.",
    ],
  },
  F6: {
    no: [
      "Workers interviewed have never received a payslip, on paper or electronically, and do not know how their pay is calculated.",
      "Payslips are issued only on request at the office, and most workers sampled had not received one this year.",
      "Payslips are handed out months after payment and do not match the amounts that reached workers' bank accounts.",
    ],
    partial: [
      "Payslips are given each month, but in English only, and workers could not read the items listed on them.",
      "Direct workers get payslips, but subcontractor workers on the project receive none from their employer.",
    ],
  },
  F7: {
    no: [
      "Payslips show only a total amount paid, without basic wage, hours worked, overtime, allowances or deductions.",
      "Payslips do not show overtime hours or rate, so workers cannot check that overtime is paid at the right rate.",
      "Deductions appear as one lump sum on payslips, with no item showing what each deduction is for.",
    ],
    partial: [
      "Payslips show salary and deductions, but leave pay, hours worked and the overtime rate are missing from them.",
      "Most items are shown, but allowances are combined into one line and cannot be checked against the contract.",
    ],
  },
  F8: {
    no: [
      "Timesheets show workers working on their weekly rest day without extra pay or a replacement day off in payroll.",
      "Workers interviewed said rest-day work is paid at the normal rate, not as overtime, and no extra day off is given.",
      "No records show which workers worked on rest days, so rest-day pay cannot be checked against payroll.",
    ],
    partial: [
      "Rest-day work is paid, but at a lower rate than required, according to the payslips sampled for recent months.",
      "Rest-day pay is correct for direct hires, but subcontractor workers on the same crews receive no extra pay.",
    ],
  },
  F9: {
    no: [
      "Workers attending induction or skills training were marked absent and lost pay for those days, according to timesheets.",
      "Training is held after shifts or on rest days without pay, and supervisors require workers to attend.",
      "No record links training attendance to payroll, and workers said training days are not counted as paid work.",
    ],
    partial: [
      "Training days are paid at basic wage, but the allowances normally paid for working days are removed for them.",
      "Paid training applies to direct hires only; subcontractor workers attending the same sessions are not paid for them.",
    ],
  },
  F10: {
    no: [
      "The contractor keeps no wage register; payroll is managed on loose spreadsheets that change from month to month.",
      "The wage register is missing for several months and does not include all the workers employed in those months.",
      "A wage register exists for staff only; manual workers' wages are recorded by supervisors in notebooks.",
    ],
    partial: [
      "A wage register is kept, but it lacks hours worked, overtime and deductions for each worker and pay period.",
      "The register is complete for direct hires, but subcontractor wages are not recorded or checked by the contractor.",
    ],
  },
  F11: {
    no: [
      "Workers called in on rest days for urgent work received no replacement rest day or extra pay, according to records.",
      "Supervisors cancel rest days at short notice during busy periods, and payroll shows no compensation for those days.",
      "Workers said refusing rest-day work leads to warnings, and the days worked are neither recorded nor paid.",
    ],
    partial: [
      "Extra pay is given for rest days worked, but no replacement rest day is granted within the following week.",
      "Compensation is given, but it is recorded as normal overtime without the higher rate for rest-day work.",
    ],
  },

  // ---- G · Summer working -----------------------------------------------------
  G1: {
    no: [
      "No heat stress training records exist for the workers or supervisors exposed to outdoor heat on this project.",
      "Workers interviewed could not name the signs of heat stroke or dehydration, or say what to do if a colleague shows them.",
      "Heat stress training was given to safety staff only; supervisors and managers who plan the work were not trained.",
    ],
    partial: [
      "Heat training was given once before summer, but workers who joined after it received no heat stress training at all.",
      "Training records exist, but sessions were in English only and workers could not explain the content afterwards.",
    ],
  },
  G2: {
    no: [
      "Workers outdoors were seen without heat protective caps, neck covers or cooling items, and none appear in PPE issue records.",
      "The PPE list for outdoor work has no heat protection items, and workers use their own scarves or cloths instead.",
      "Heat caps were issued but not worn on site, and supervisors do not enforce their use during the hot hours.",
    ],
    partial: [
      "Heat caps were given to some crews only; workers on night shifts or in remote areas received none.",
      "Heat PPE was issued once, but worn or lost items are not replaced and many workers had none on the day.",
    ],
  },
  G3: {
    no: [
      "No temperature or humidity readings are recorded on site, and no heat index is used to plan work and rest.",
      "No one is assigned to watch for heat stress signs or to stop work when the heat index reaches high levels.",
      "The site has no thermometer or heat stress meter, and supervisors rely on weather apps for the nearest city.",
    ],
    partial: [
      "Readings are taken once a day in the morning, not at intervals through the hottest hours as required.",
      "Heat readings are recorded, but no trained person acts on them or changes the work when limits are passed.",
    ],
  },
  G4: {
    no: [
      "Outdoor work continues between 12:00 and 15:00 in the summer months, according to timesheets and observations on site.",
      "Summer work schedules are the same as winter, with no shift moved to the cooler early morning or evening hours.",
      "Timesheets show outdoor crews working through midday during the summer ban period without shade or rest.",
    ],
    partial: [
      "The midday break is kept, but heavy outdoor tasks are still scheduled for the hot afternoon right after 15:00.",
      "Schedules were changed for direct crews only; subcontractor crews were seen working outdoors during the midday break.",
    ],
  },
  G5: {
    no: [
      "Drinking water stations at the work front were empty or warm during the visit, with no refill schedule in place.",
      "Cool drinking water was available only at the site office, far from where the outdoor crews were working.",
      "Workers said they buy their own water or bring it from camp, and no water is provided at the work areas.",
    ],
    partial: [
      "Water is provided, but there are too few coolers for the number of workers, and some ran out by midday.",
      "Water is available, but no oral rehydration salts or electrolyte drinks are given for heavy outdoor work in summer.",
    ],
  },
  G6: {
    no: [
      "No heat stress risk assessment exists for outdoor or enclosed work areas, and no control measures are identified.",
      "No shaded rest areas, fans or cooling are provided near outdoor work fronts, and workers rest under equipment.",
      "Work in enclosed spaces such as tanks or basements continues in summer without ventilation or cooling measures.",
    ],
    partial: [
      "A heat risk assessment exists, but its controls, such as shade and cooling, were not in place on site.",
      "Shade structures are provided at the main work front only; remote crews have no shaded rest area nearby.",
    ],
  },
  G7: {
    no: [
      "The contractor's procedures set no rest breaks for hot work, and no work-rest schedule exists for high heat.",
      "No rule requires a medical check before workers are deployed to hot work areas, and none is planned.",
      "The heat stress plan does not cover breaks or medical fitness, and supervisors decide breaks without any guidance.",
    ],
    partial: [
      "Breaks are required by the procedure, but their frequency and length are not set for different heat levels.",
      "Medical checks before deployment are required for direct hires only, not for subcontractor workers in the same heat.",
    ],
  },
  G8: {
    no: [
      "No break records or work-rest logs exist for hot weather, so the breaks in the procedure cannot be shown.",
      "Workers said they take breaks only when supervisors allow, and none were seen resting during the hot hours observed.",
      "No medical records show that workers were examined before being sent to hot work areas this summer.",
    ],
    partial: [
      "Break logs exist for some days only, and gaps during the hottest weeks of summer were not explained.",
      "Medical checks were done, but several workers deployed to hot areas had no record of being examined first.",
    ],
  },
  G9: {
    no: [
      "Workers were issued dark synthetic coveralls for outdoor summer work, and no light cotton clothing is on the PPE list.",
      "No summer clothing was issued; workers wear the same heavy coveralls all year, including the summer months.",
      "Workers bought their own light clothing for summer, and the contractor holds no issue records for summer workwear.",
    ],
    partial: [
      "Light cotton clothing was issued to some crews, but not enough sets were given to change them daily.",
      "Summer workwear was issued last year but has not been replaced, and much of it is now worn out.",
    ],
  },
  G10: {
    no: [
      "No safety officer is assigned to the project, and safety duties are covered part-time by a site engineer.",
      "The safety officer covers several sites and was not present during working hours on the day of the visit.",
      "No appointment letter or job description exists for a safety officer, and workers did not know who the safety officer is.",
    ],
    partial: [
      "A safety officer is assigned for the day shift only; night shift crews have no safety officer coverage.",
      "A safety officer is in place, but no records show awareness sessions on job-related risks given to workers.",
    ],
  },
  G11: {
    no: [
      "Worker buses and rest rooms observed had no working air conditioning during the hot hours of the visit.",
      "Site cabins used by workers for breaks have broken AC units, and no repair request or maintenance record exists.",
      "Workers are transported in vehicles without air conditioning, including open pickups used for short trips across site.",
    ],
    partial: [
      "Most buses have AC, but several in use had units that were not cooling, and no maintenance schedule was shown.",
      "Staff offices are air-conditioned, but the rest shelters used by workers at the work front have no cooling at all.",
    ],
  },
  G12: {
    no: [
      "No fruit, juice or extra drinks are provided during summer work, and meals are not adjusted for hot weather.",
      "Workers were not issued personal water bottles, and they share cups at the coolers or drink from the tap.",
      "Fresh drinking water is not available at all work fronts or in the vehicles used for long trips to site.",
    ],
    partial: [
      "Fruit and juice are provided on some days only, with no schedule showing a regular supply during summer.",
      "Water bottles were issued once but not replaced when lost or broken, and many workers had none.",
    ],
  },
  G13: {
    no: [
      "No shelter is available near work fronts for sandstorms or extreme heat, and workers stay in the open.",
      "The contractor has no procedure for stopping work and moving workers to shelter during sandstorms or extreme heat.",
      "Workers said work continued during a recent sandstorm, and no stop-work record or use of a shelter was documented.",
    ],
    partial: [
      "A shelter exists, but it is too small for all workers on the shift and is far from some work areas.",
      "A stop-work procedure exists, but workers and supervisors did not know the trigger levels or where to go.",
    ],
  },
  G14: {
    no: [
      "No medical point or first-aid room exists on site, and the nearest clinic is far from the work areas.",
      "No emergency response team or plan is in place, and no first-aiders are named for each shift.",
      "The site has no ambulance or vehicle ready for medical emergencies, and response times have not been tested.",
    ],
    partial: [
      "A first-aid point exists, but it lacks basic supplies and has no trained staff on night shifts.",
      "An emergency team is named, but no drills have been held and contact numbers are not posted at work fronts.",
    ],
  },

  // ---- H · End of employment --------------------------------------------------
  H1: {
    no: [
      "Company policies do not state that workers may leave without notice and keep their gratuity and repatriation in the listed cases.",
      "The HR policy says workers who leave without notice lose their end-of-service gratuity, with no exception for employer breaches.",
      "No written procedure exists for a worker ending the contract because of employer breach, abuse, misrepresentation or known danger.",
    ],
    partial: [
      "The policy covers the employer's breach of contract only and leaves out physical abuse, misrepresentation and known danger to workers.",
      "The right is in the policy, but employment contracts still require notice in all cases, which conflicts with it.",
    ],
  },
  H2: {
    no: [
      "Workers interviewed did not know they may leave without notice and keep their gratuity if the employer breaks welfare standards.",
      "No briefing or written material tells workers about their right to leave and be repatriated after an employer breach.",
      "Workers said they believed leaving early would cost them their gratuity and ticket home, whatever the reason.",
    ],
    partial: [
      "The right is mentioned in the induction slides, but workers interviewed could not recall it or explain it.",
      "Information on this right is posted at the camp in English only, which most workers interviewed cannot read.",
    ],
  },
  H3: {
    no: [
      "Workers who left the project paid for their own flights home, according to exit records and worker statements.",
      "The contractor's policy makes workers pay for repatriation if they resign before finishing their contract term.",
      "No records show the contractor bought tickets for workers who completed their contracts this year.",
    ],
    partial: [
      "Tickets are paid for direct hires, but subcontractor workers leaving the project were not repatriated at the employer's cost.",
      "Repatriation is paid, but the cost of the ticket was later deducted from the worker's final settlement.",
    ],
  },
  H4: {
    no: [
      "Workers who left the project months ago are still owed final wages or end-of-service gratuity, according to settlement records.",
      "Final settlements were paid after workers had already left the country, with no proof the money reached them.",
      "End-of-service gratuity was calculated on fewer years than served or on a lower wage than the worker's last wage.",
    ],
    partial: [
      "Final wages were paid on time, but gratuity and air ticket payments came weeks later, after the worker had left.",
      "Settlements were paid, but workers did not receive a written calculation showing how the final amount was worked out.",
    ],
  },
  H5: {
    no: [
      "Transfer requests from workers were refused or ignored, and the contractor keeps no record of response times to requests.",
      "The contractor requires workers to pay a release fee or finish their contract before agreeing to an iqama transfer.",
      "Workers said supervisors threatened them with absconding reports when they asked to move to a new employer.",
    ],
    partial: [
      "Transfers were approved, but several took weeks instead of 72 hours, according to the request and approval dates.",
      "Transfers are approved for workers who finished their contract only; others are told to wait until their term ends.",
    ],
  },
  H6: {
    no: [
      "Wages and end-of-service benefits of a deceased worker have not been paid to the family, months after the death.",
      "The contractor has no procedure for paying a deceased worker's dues to dependents, and no records of past cases.",
      "A deceased worker's dues were held while the family was asked for documents the contractor never explained to them.",
    ],
    partial: [
      "Dues were paid to the family, but without proof of who received them or how the amount was calculated.",
      "Wages were paid to dependents, but the end-of-service gratuity and any insurance benefit have still not been paid.",
    ],
  },
  H7: {
    no: [
      "No off-boarding commitment letters were obtained from subcontractors or suppliers that left the project this year.",
      "Workers were demobilised without a site clearance form, so final pay and the return of documents cannot be checked.",
      "The contractor has no off-boarding checklist or file and could not show which workers left the project and when.",
    ],
    partial: [
      "Commitment letters exist for some subcontractors, but not for labour suppliers that removed workers from the project.",
      "Clearance forms exist, but many are unsigned by the worker or missing the date and final settlement details.",
    ],
  },

  // ---- I · Grievances ---------------------------------------------------------
  I1: {
    no: [
      "The contractor has no written grievance procedure, and supervisors handle complaints informally without keeping any record.",
      "Workers have had no training or awareness session on how to raise a grievance and how it will be handled.",
      "Grievances raised are passed to subcontractors to solve, and the contractor does not track or close them itself.",
    ],
    partial: [
      "A grievance procedure exists, but awareness sessions were held once for direct hires and not repeated for new joiners.",
      "Grievances are logged, but the procedure does not set who is responsible for solving them or by when.",
    ],
  },
  I2: {
    no: [
      "Workers interviewed could not name any grievance contact at the client, at the contractor or in the government.",
      "No contact list for grievances is displayed at the camp or site, and none was given to workers.",
      "Workers knew only their supervisor as a contact and did not know the client's hotline or the Ministry channel.",
    ],
    partial: [
      "Workers knew the contractor's contacts, but not the client's Worker Welfare team or the government complaint channel.",
      "Contacts are posted, but some numbers listed were out of date or went unanswered when tested during the audit.",
    ],
  },
  I3: {
    no: [
      "Workers interviewed were not aware of any grievance the contractor had solved, and no outcomes are shared with them.",
      "The contractor does not publish or share grievance outcomes, so workers do not know that raising issues leads to action.",
      "Workers said complaints raised in the past got no answer, and the grievance log shows open cases with no action.",
    ],
    partial: [
      "Outcomes are shared in meetings, but only with representatives, and the information does not reach other workers.",
      "Some solved cases are posted at the camp, but the list is old and does not show recent grievances or actions.",
    ],
  },
  I4: {
    no: [
      "No Workers Welfare Forum has been set up, and the contractor could not show any meeting records or members.",
      "A forum exists on paper only; no meetings took place in recent months and workers did not know about it.",
      "Forum members were chosen by management, not nominated by workers, and no worker took part in the selection.",
    ],
    partial: [
      "The forum meets, but not every month, and several planned meetings were cancelled without a new date being set.",
      "Forum meetings take place, but the minutes do not record the issues raised by workers or the actions agreed.",
    ],
  },
  I5: {
    no: [
      "Grievances raised at the forum are not recorded, so it cannot be shown what was raised or whether it was solved.",
      "Forum minutes list the names of workers who complained, with no confidentiality, and are open to all attendees.",
      "Issues raised at the forum stay open across several meetings with no owner, action or deadline recorded.",
    ],
    partial: [
      "Grievances are recorded, but the log is kept in a shared folder that supervisors named in complaints can read.",
      "Issues are recorded and assigned, but closure is not confirmed with the workers who raised them.",
    ],
  },
  I6: {
    no: [
      "The grievance log shows most cases resolved well after 48 hours, and several are still open after weeks.",
      "The grievance log has no dates for receipt and closure, so the 48-hour target cannot be checked.",
      "Urgent cases such as unpaid wages or accommodation problems took weeks to address, according to the log and interviews.",
    ],
    partial: [
      "Simple cases close within 48 hours, but wage and contract grievances stay open far longer without updates.",
      "Cases are acknowledged within 48 hours, but closure dates are missing for many, so the time to resolve is unknown.",
    ],
  },

  // ---- J · Worker welfare reporting -------------------------------------------
  J1: {
    no: [
      "The Monthly Salary Declaration Letter was not submitted for one or more recent months, according to the client's records.",
      "Salary declarations were submitted after the 15th in most recent months, with no reason given for the delay.",
      "The contractor could not show copies or submission emails for any salary declaration made this year.",
    ],
    partial: [
      "Declarations are submitted on time, but they cover direct hires only and leave out subcontractor workers.",
      "Declarations were sent by the 15th, but their figures do not match the WPS records for the same month.",
    ],
  },
  J2: {
    no: [
      "WPS reports for the contractor and its supply chain were not sent to the client's Worker Welfare team in recent months.",
      "The contractor submits its own WPS file only and has not collected WPS reports from subcontractors or labour suppliers.",
      "No submission records exist for WPS reports, and the contractor could not show which months were sent.",
    ],
    partial: [
      "WPS reports were sent for most months, but one or more subcontractors' reports are missing for the last quarter.",
      "Supply-chain WPS reports were sent, but they were not checked against headcount and several workers are missing.",
    ],
  },
  J3: {
    no: [
      "Part of the workforce lives in private housing outside the client's accommodation, without approval or inspection records.",
      "The contractor could not show where each worker lives, and no accommodation list matches the current headcount.",
      "Subcontractor workers on the project live in rented villas or flats that are not part of the client's accommodation.",
    ],
    partial: [
      "Most workers live in the client's accommodation, but new arrivals stay in temporary housing outside it for weeks.",
      "Workers living outside were approved, but the approval has expired and was not renewed for this period.",
    ],
  },
  J4: {
    no: [
      "No monthly accommodation or kitchen inspection reports were submitted for workers housed outside the client's accommodation.",
      "Workers live in outside housing, but the contractor has never inspected the kitchens that serve them.",
      "Inspection reports were not shared with the client, and the contractor could not show any report for recent months.",
    ],
    partial: [
      "Reports were submitted for some months only, with gaps during the busiest periods of the project.",
      "Reports were submitted, but issues found were not followed up and reappear in later reports without action.",
    ],
  },
  J5: {
    no: [
      "Weekly accommodation reports were not submitted for several recent weeks, according to the client's records and the contractor's files.",
      "The contractor submits accommodation reports monthly instead of weekly and could not show any weekly submissions.",
      "No one is assigned to prepare the weekly accommodation report, and submissions stopped when the last coordinator left.",
    ],
    partial: [
      "Weekly reports are submitted, but often several days late, and occupancy figures do not match camp records.",
      "Reports are on time, but they leave out subcontractor workers housed in the same accommodation.",
    ],
  },
  J6: {
    no: [
      "The Monthly Manpower Status Report was not submitted for recent months, and the contractor holds no current version.",
      "The manpower report shows numbers that differ widely from gate records and the headcounts seen on site.",
      "The report lists direct hires only and leaves out subcontractor and labour supplier workers on the project.",
    ],
    partial: [
      "The report is submitted monthly, but new joiners and leavers are added one or two months late.",
      "The report is current, but it does not split workers by subcontractor, so the supply chain cannot be checked.",
    ],
  },
  J7: {
    no: [
      "No Worker Welfare Committee meetings took place in recent months, and no minutes or attendance records exist.",
      "Meetings are held without worker-nominated representatives or subcontractors, so the committee lacks its required members.",
      "Meeting minutes are not recorded or shared with the client, so the actions agreed cannot be followed up.",
    ],
    partial: [
      "Meetings take place, but not every month, and the months skipped have no reason recorded.",
      "Minutes are recorded, but they were not shared with the client within the month of the meeting.",
    ],
  },

  // ---- K · Contractor's responsibilities --------------------------------------
  K1: {
    no: [
      "The contractor does not use the forms and templates of the Worker Welfare Pack and uses its own incomplete formats.",
      "Staff responsible for welfare were not aware of the Worker Welfare Pack and could not show any form from it.",
      "Reports sent to the client are in free format, without the standard templates required by the Worker Welfare Pack.",
    ],
    partial: [
      "Some Pack forms are used, but the grievance and off-boarding forms are still the contractor's own versions.",
      "Pack templates are used, but in outdated versions; recent changes to the forms have not been taken up.",
    ],
  },
  K2: {
    no: [
      "Findings from earlier welfare audits remain open, and the contractor has no corrective action plan or closure evidence.",
      "Non-compliances found at subcontractors were passed on by email only, with no follow-up or check that they were fixed.",
      "The same welfare issues appear in several audits in a row, showing that the actions taken did not solve them.",
    ],
    partial: [
      "Most direct findings were closed, but subcontractor findings remain open past their due dates without escalation.",
      "Corrective actions were recorded as closed, but no photos, documents or checks prove that the fixes were made.",
    ],
  },
  K3: {
    no: [
      "Subcontractors that left the project were not off-boarded, and no off-boarding report was sent to the client.",
      "Off-boarding reports were sent long after the 30 days from demobilisation, and some have still not been sent.",
      "The contractor could not list the subcontractors that demobilised this year or show their off-boarding status.",
    ],
    partial: [
      "Off-boarding was done for larger subcontractors only; small labour suppliers left without any off-boarding record.",
      "Reports were sent within 30 days, but they do not confirm that the workers' final dues were paid.",
    ],
  },
  K4: {
    no: [
      "No evidence shows that workers of demobilised subcontractors received their salaries and final dues before leaving the project.",
      "Workers from a subcontractor that left the project reported unpaid wages, and the contractor took no action.",
      "The contractor relies on the subcontractor's word that workers were paid, without WPS records or signed settlements.",
    ],
    partial: [
      "Final pay evidence exists for direct hires, but indirect workers have no settlement records or WPS proof of payment.",
      "Salaries were paid, but end-of-service dues for some workers were still unpaid when their subcontractor demobilised.",
    ],
  },
  K5: {
    no: [
      "Workers interviewed, including subcontractor workers, could not describe the welfare policies or any of their basic legal rights.",
      "No awareness sessions or materials on welfare policies and rights were given to subcontractor or supplier workers.",
      "Welfare policies are kept in the office only and are not shared or posted where workers can see them.",
    ],
    partial: [
      "Direct workers had awareness sessions, but subcontractor and supplier workers on the same site had none.",
      "Awareness materials exist, but only in English and Arabic, not in the languages most workers speak.",
    ],
  },

  // ---- L · Worker welfare representatives -------------------------------------
  L1: {
    no: [
      "No Worker Welfare Representative has been officially assigned, and welfare tasks are covered part-time by HR staff.",
      "The named representative has not attended the client's worker welfare forums in recent months, according to attendance records.",
      "The representative has not completed the required welfare training sessions, and no training certificates are held.",
    ],
    partial: [
      "A representative is assigned and attends forums, but has not completed all of the required training sessions.",
      "The representative attends forums irregularly and has missed several meetings without a deputy attending in their place.",
    ],
  },
  L2: {
    no: [
      "No official appointment letter exists for the Worker Welfare Representative, and the role is not in their job description.",
      "The representative's performance is not measured against the client's KPIs, and no reviews or KPI reports exist.",
      "The appointment letter is unsigned or names a person who has since left the company.",
    ],
    partial: [
      "An appointment letter exists, but KPI monitoring is not done regularly and recent results are missing.",
      "KPIs are tracked, but the appointment letter does not describe the representative's duties or reporting line.",
    ],
  },
  L3: {
    no: [
      "The representative holds no HR degree or equivalent and has less than five years of relevant experience.",
      "No CV, degree certificate or experience letters are on file to show the representative meets the criteria.",
      "The representative was appointed from site supervision with no HR or welfare background, and no exemption was approved.",
    ],
    partial: [
      "The representative has relevant experience, but the documents on file cover less than five years of it.",
      "The degree held is not in HR or an equivalent field, and part of the experience shown is unrelated.",
    ],
  },
  L4: {
    no: [
      "Subcontractors without a qualified representative have no senior manager designated to coordinate welfare with the contractor's representative.",
      "The contractor could not list which subcontractors lack a representative or who coordinates welfare for them.",
      "Welfare contacts named for subcontractors are site foremen, not senior management, and have no authority to act.",
    ],
    partial: [
      "Senior contacts are named for some subcontractors, but not for labour suppliers that joined the project recently.",
      "Contacts are named, but there is no record of coordination meetings or communication with the representative.",
    ],
  },

  // ---- M · Sub-contractor management ------------------------------------------
  M1: {
    no: [
      "No welfare assessment against the client's standards was done for the company or its suppliers at prequalification.",
      "Gaps found at prequalification have no formal improvement action plan, and no senior-level commitment statement was submitted.",
      "The contractor could not show its prequalification welfare assessment or the results for its suppliers.",
    ],
    partial: [
      "The company was assessed, but its suppliers were not, and no plan exists to assess them.",
      "An improvement plan was submitted, but it has no dates, owners or progress updates since prequalification.",
    ],
  },
  M2: {
    no: [
      "No updated improvement action plan or draft Worker Welfare Management Plan was submitted within two weeks of contract award.",
      "The Worker Welfare Management Plan has no budget or financial provisions for welfare costs on the project.",
      "The company could not show a valid licence to carry out employment or recruitment activities as required by law.",
    ],
    partial: [
      "The plans were submitted, but well after the two-week deadline from contract award, with no reason recorded.",
      "A welfare plan was submitted, but its financial provisions are general and not linked to specific welfare items.",
    ],
  },

  // ---- N · Working hours ------------------------------------------------------
  N1: {
    no: [
      "Timesheets show basic working days longer than eight hours, before any overtime is recorded, for the sampled workers.",
      "Weekly hours for sampled workers exceed forty-eight before overtime, according to timesheets and the site shift schedule.",
      "No timesheets or attendance records exist for manual workers, so daily and weekly working hours cannot be checked.",
    ],
    partial: [
      "Hours are within limits for most crews, but some crews regularly work beyond eight basic hours a day.",
      "Timesheets show correct hours, but gate entry and exit times show workers on site longer than recorded.",
    ],
  },
  N2: {
    no: [
      "Timesheets show overtime of more than two hours a day for sampled workers on several days each month.",
      "Ramadan hours were not reduced to six a day for fasting Muslim workers, according to the Ramadan timesheets.",
      "During Ramadan, workers did not get a rest interval of at least one and a half hours, according to shift records.",
    ],
    partial: [
      "Ramadan hours were reduced, but some crews still worked overtime that pushed their daily hours past the limit.",
      "Overtime is mostly within two hours, but peaks of three or four hours a day appear during busy weeks.",
    ],
  },
  N3: {
    no: [
      "Shift schedules show work blocks longer than five hours without a break of at least thirty minutes.",
      "Workers said they eat lunch while working and have no set break for rest, prayer and a meal.",
      "No break times are set in the shift schedule, and supervisors decide breaks each day without keeping records.",
    ],
    partial: [
      "A meal break is set, but it is shorter than thirty minutes once the walk to the rest area is included.",
      "Breaks are scheduled for the day shift, but night shift crews work more than five hours without a recorded break.",
    ],
  },
  N4: {
    no: [
      "Timesheets show workers working through three or more consecutive weekly rest days within the same month.",
      "No records track rest days worked, so the limit on consecutive rest days worked cannot be checked.",
      "Workers said they have not had a rest day for several weeks during the current busy period on site.",
    ],
    partial: [
      "Rest days are tracked for direct crews, but subcontractor crews have no rest-day records for recent months.",
      "The limit is kept in most months, but timesheets show it was exceeded during the last busy period.",
    ],
  },
  N5: {
    no: [
      "Timesheets do not separate break time from working time, so it cannot be shown that breaks are excluded from basic hours.",
      "Workers said break periods are counted as working hours, but they keep working through them on site.",
      "No shift schedule shows rest, prayer and meal periods, and the workers' daily time on site is not recorded.",
    ],
    partial: [
      "Meal breaks are excluded, but prayer and rest periods are counted within basic hours on the shift schedule.",
      "Breaks are shown on the schedule, but timesheets record a single start and end time without them.",
    ],
  },
}

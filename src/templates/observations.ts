// Canned observation suggestions per question code, shown as tap-to-add chips
// when a question is marked No/Partial compliance. Phrases are appended into
// the free-text observation field, so they must read as standalone report
// sentence fragments. Curate freely — this is content, not logic.
//
// Codes shared by both templates use the accommodation wording. Codes that
// exist only in the welfare audit template (B2–B5, C3–C4) follow at the end
// of their letter groups.
export const OBSERVATIONS: Record<string, string[]> = {
  // A — Facility Design (accommodation)
  A1: [
    'Building numbers or names missing on some blocks',
    'Signage not compliant with NEOM requirements',
    'Building identification signage absent',
  ],
  A2: [
    'Sign plate missing establishment name',
    'Supervisor contact details not displayed',
    'Residential capacity not stated on sign plate',
    'Contractor and project names not shown',
  ],
  A3: [
    'Cracks in walls allowing insect entry',
    'Gaps admitting light and pests observed',
    'Building fabric not sealed against pest ingress',
  ],
  A4: [
    'Floor finish of substandard or unsuitable material',
    'Bare or damaged flooring observed',
  ],
  A5: [
    'Structure built of substandard materials',
    'Suspected asbestos-containing material present',
    'Building fabric in poor condition',
  ],
  A6: [
    'No outdoor seating adjacent to accommodation block',
    'No shaded external area provided',
  ],
  A7: [
    'Doors not fire rated',
    'Fire door certification not evidenced',
    'Fire doors damaged or wedged open',
  ],
  A8: [
    'Evacuation procedures not developed',
    'Procedures not aligned with Civil Defense regulations',
    'Residents not trained in evacuation procedures',
  ],
  A9: [
    'Municipality approval for group accommodation not evidenced',
    'Location licence unavailable for inspection',
  ],
  A10: [
    'No prayer room provided',
    'No mosque within close proximity',
  ],
  A11: [
    'Ambulance and police numbers not displayed',
    'Municipal report signage missing',
    'Emergency numbers not prominently positioned',
  ],
  A12: [
    'Flammable or hazardous materials stored in housing',
    'Accommodation building used for material storage',
  ],
  A13: [
    'Fire alarm not installed in building',
    'No muster point designated nearby',
    'Muster point signage missing',
  ],

  // B — Location and Buildings (accommodation)
  B1: [
    'Accommodation located near hazardous or unsuitable area',
    'Required separation distance not maintained',
    'Site within flood-prone wadi area',
  ],

  // C — Ventilation and Air Conditioning (accommodation)
  C1: [
    'Ventilation inadequate for occupancy',
    'Air conditioning units lack inverter capability',
    'Window AC units in use',
    'Cooling not compliant with local standards',
  ],
  C2: [
    'No AC maintenance schedule in place',
    'Inspection and testing records unavailable',
  ],

  // D — Bathrooms (accommodation)
  D1: [
    'Bathrooms located outside residents\' building',
    'Residents must exit building to reach bathrooms',
  ],
  D2: [
    'Bathroom fixtures insufficient for resident numbers',
    'Resident-to-fixture ratio exceeds requirement',
    'Common bathroom lacks toilet, basin or shower',
  ],
  D3: [
    'Bathroom cleaning frequency below twice daily',
    'No cleaning schedule displayed',
    'Cleaning logs unavailable for review',
    'No contracted cleaning company engaged',
  ],
  D4: [
    'Toilet room not isolated from living areas',
    'Toilet room area below required minimum',
  ],
  D5: [
    'Shower dimensions below required size',
    'Shower cubicle undersized for use',
  ],
  D6: [
    'Bathroom extractor fan missing or defective',
    'Bathroom lighting missing or defective',
  ],
  D7: [
    'Bathroom walls not tiled to ceiling',
    'Floor tiles not non-slip type',
    'Tiling damaged or of substandard quality',
  ],
  D8: [
    'Combined shower and toilet cubicle in use',
    'Shower not separated from toilet',
  ],
  D9: [
    'Mirrors not provided in bathrooms',
    'No fixtures to hang clothes and towels',
    'No soap holders provided',
  ],
  D10: [
    'Washing machine installed in bathroom',
    'Laundry equipment in use inside bathroom',
  ],

  // E — Bedrooms (accommodation)
  E1: [
    'Bedroom ceiling height below required minimum',
    'Ceiling height non-compliant for finish type',
  ],
  E2: [
    'Doors or windows not lockable',
    'Bedroom doors not fire rated',
    'Locks broken or missing',
  ],
  E3: [
    'More than four residents per room',
    'Personal space below minimum per resident',
    'Room overcrowded for its floor area',
  ],
  E4: [
    'Bed spaces lack privacy screens or curtains',
    'Privacy curtains damaged or removed',
  ],
  E5: [
    'Residents sharing sleeping areas',
    'Bed sharing or rotation of beds observed',
  ],
  E6: [
    'Spacing between beds below required minimum',
    'Beds placed directly adjacent to each other',
  ],
  E7: [
    'Bedding replacement schedule not evidenced',
    'Mattresses or pillows visibly worn',
    'Bedding replaced at cost to residents',
  ],
  E8: [
    'Signs of bed bug infestation observed',
    'Pest activity evident on furniture or beds',
  ],
  E9: [
    'Personal closets not provided for all residents',
    'Closet locks missing or defective',
    'Clearance between bed and closet insufficient',
    'Closet lacks hanging or shelf space',
  ],
  E10: [
    'Bedside tables not provided',
    'Reading lamps not provided',
  ],
  E11: [
    'Personal lock boxes not provided',
    'Lock box keys missing or unissued',
  ],
  E12: [
    'Smoke detector missing in bedroom',
    'Monthly detector testing not carried out',
    'Detector testing log unavailable',
  ],
  E13: [
    'Window insect screens missing',
    'Mesh screens torn or damaged',
  ],
  E14: [
    'Windows lack black-out blinds',
    'Curtains missing or damaged',
  ],
  E15: [
    'Water dispenser not provided in bedroom',
    'Fridge not provided in bedroom',
    'Kettle or cups not provided',
  ],
  E16: [
    'No table provided in bedroom',
    'Chairs missing or insufficient',
  ],
  E17: [
    'Insufficient electrical sockets per resident',
    'Extension leads in use',
  ],
  E18: [
    'Evacuation route signage missing behind doors',
    'Emergency contact details not displayed',
    'Signage not in residents\' languages',
  ],
  E19: [
    'Shoe racks not provided at bedroom entrances',
    'Footwear stored loose at entrances',
  ],

  // F — Kitchens, Catered and Self-Cooking (accommodation)
  F1: [
    'No caterer engaged to operate kitchen',
    'Canteen operated without professional management',
  ],
  F2: [
    'Kitchen operator licence not evidenced',
    'Kitchen run by unlicensed personnel',
  ],
  F3: [
    'Food safety certification unavailable',
    'Compliance with KSA food regulations not evidenced',
  ],
  F4: [
    'No catered kitchen facility on site',
    'Kitchen facilities not included with accommodation',
  ],
  F5: [
    'Kitchen staff health certificates missing or expired',
    'Health certificates unavailable for review',
  ],
  F6: [
    'Food contact surfaces not stainless steel or glass',
    'Preparation counters of unsuitable material',
  ],
  F7: [
    'Kitchen staff not wearing clean uniforms',
    'Uniforms soiled during service hours',
  ],
  F8: [
    'Kitchen lacks permanent natural ventilation',
    'Window not protected by fine metal mesh',
    'Air suction not provided',
  ],
  F9: [
    'Meals lack nutritional balance',
    'Daily caloric provision below requirement',
  ],
  F10: [
    'Cleaning frequency below twice daily',
    'Weekly disinfection not evidenced',
    'No specialized technician supervising cleaning',
  ],

  // G — Self-Cooking Section (accommodation)
  G1: [
    'No self-catering facilities provided',
    'Self-cooking area unavailable to residents',
  ],
  G2: [
    'Cooking stoves defective or missing',
    'Cooling equipment not provided',
    'Kitchen unclean at time of inspection',
  ],
  G3: [
    'Kitchen undersized for resident numbers',
    'Insufficient capacity for simultaneous cooking',
  ],
  G4: [
    'Washing basins insufficient for kitchen capacity',
    'Basins not stainless steel',
  ],
  G5: [
    'Preparation surfaces not stainless steel or glass',
    'Shelving of unsuitable material',
  ],
  G6: [
    'No dedicated food storage provided',
    'Storage conditions uncontrolled for temperature and humidity',
    'Foodstuffs stored directly on floor',
  ],
  G7: [
    'Insufficient washbasins provided',
    'Water taps with inadequate flow',
  ],
  G8: [
    'Kitchen wastewater not connected to sewerage',
    'Liquid waste disposal inadequate',
  ],
  G9: [
    'Kitchen floor not tiled',
    'Floor tiling damaged',
  ],
  G10: [
    'Walls or floors not easy-clean finish',
    'Floor drain missing',
    'Drain not protected against rodent entry',
  ],
  G11: [
    'Kitchen cleaning below twice daily',
    'Weekly disinfection not evidenced',
    'No specialized technician oversight',
  ],
  G12: [
    'No permanent natural ventilation in kitchen',
    'Ventilation opening lacks fine mesh protection',
    'Air suction unit not fitted',
  ],
  G13: [
    'Kitchen windows lack insect mesh screens',
    'Mesh screens damaged or missing',
  ],
  G14: [
    'No cleaning and sanitization contract in place',
    'Contract documentation unavailable',
    'Sanitization frequency below requirement',
  ],
  G15: [
    'External kitchen door lacks mesh screen',
    'Air curtain not installed',
  ],
  G16: [
    'Suction fans not fitted in kitchen',
    'Extractor fans defective',
  ],
  G17: [
    'Insect traps insufficient or missing',
    'Traps not maintained or serviced',
  ],
  G18: [
    'Carbon dioxide extinguishers missing from kitchen',
    'Fewer extinguishers than required',
    'Extinguisher inspection expired',
  ],
  G19: [
    'Food waste containers not tightly sealed',
    'Waste bins missing lids',
  ],
  G20: [
    'Meals served in unhygienic utensils',
    'Utensils not stainless steel or disposable',
  ],
  G21: [
    'Kitchen workers without hair or shoe covers',
    'Gloves not worn during food handling',
  ],
  G22: [
    'No air extractors to remove vapours',
    'Odors and heat accumulating in kitchen',
  ],

  // H — Mess and Dining Facilities (accommodation)
  H1: [
    'No dedicated dining room provided',
    'Meals consumed in bedrooms',
  ],
  H2: [
    'Dining seating insufficient for residents',
    'Dining hall unclean at inspection',
  ],
  H3: [
    'Insect traps not provided in dining hall',
    'Traps insufficient in number',
  ],
  H4: [
    'No handwashing station in dining hall',
    'Soap or disinfectant not available',
  ],
  H5: [
    'Food preparation table surfaces not steel',
    'Table surfaces worn or corroded',
  ],
  H6: [
    'Pest control frequency below weekly',
    'Pest control records unavailable',
    'Records not submitted to Worker Welfare Team',
  ],
  H7: [
    'Dining hall lacks natural light',
    'Ventilation not compliant with SBC requirements',
  ],
  H8: [
    'Air conditioning insufficient for full occupancy',
    'Dining hall uncomfortably hot when occupied',
  ],

  // I — Leisure and General Facilities (accommodation)
  I1: [
    'Communal areas insufficient for residents',
    'No shaded outdoor gathering area',
    'Outdoor seating not provided',
  ],
  I2: [
    'TV not provided for residents',
    'Channels not tailored to residents\' needs',
  ],
  I3: [
    'Wi-Fi not provided free of charge',
    'Internet coverage incomplete across accommodation',
    'No wireless access in recreational areas',
  ],
  I4: [
    'Local stores beyond reasonable walking distance',
    'Store access route not easily accessible',
  ],
  I5: [
    'No designated external smoking area',
    'Smoking observed inside building',
  ],

  // J — Laundry Services (accommodation)
  J1: [
    'Laundry service not provided free of charge',
    'Uniform washing frequency below requirement',
    'Linen and towel washing frequency insufficient',
  ],
  J2: [
    'Self-service laundry not free of charge',
    'Hot and cold water connections missing',
    'Laundry room lacks ventilation or drainage',
    'Laundry detergent not provided',
  ],
  J3: [
    'Drying racks not provided',
    'Clothes dried on windows or railings',
  ],

  // K — Lighting (accommodation)
  K1: [
    'Defective lights in residential units',
    'Rooms without working lighting',
  ],
  K2: [
    'Indoor lighting system incomplete',
    'Common areas inadequately lit',
  ],
  K3: [
    'Emergency lighting missing on escape routes',
    'Illuminated wayfinding not provided',
    'Egress illumination below required levels',
  ],
  K4: [
    'Emergency lighting backup duration not evidenced',
    'No battery backup for emergency lighting',
  ],
  K5: [
    'Lighting maintenance records unavailable',
    'Records not produced on request',
  ],

  // L — Sanitary Drainage (accommodation)
  L1: [
    'Site drainage inadequate',
    'Standing water observed around buildings',
    'Stormwater management system absent',
  ],

  // M — Water Supply System (accommodation)
  M1: [
    'Chilled water fountains missing in public areas',
    'Fountains defective or unhygienic',
  ],
  M2: [
    'Water system maintenance not evidenced',
    'System condition risks bacterial growth',
  ],
  M3: [
    'Legionella testing not carried out',
    'Legionella test records unavailable',
  ],

  // N — Hot and Cold-Water Supply (accommodation)
  N1: [
    'Water pressure outside acceptable range',
    'Pressure regulation not evidenced',
  ],
  N2: [
    'Hot water unavailable in showers or bathrooms',
    'Kitchens or laundry sinks lack hot water',
  ],
  N3: [
    'No chlorination system for stored water',
    'Sand filters not fitted',
  ],

  // O — Drinking Water (accommodation)
  O1: [
    'Drinking water quantity insufficient',
    'Water source not verified as safe',
    'Drinking water charged to residents',
  ],
  O2: [
    'Chilled fountains not provided in public areas',
    'Fountains out of service',
  ],
  O3: [
    'Water tanks uncovered or poorly maintained',
    'Tank cleaning records unavailable',
    'Tanks visibly dirty',
  ],
  O4: [
    'Annual water analysis not carried out',
    'Water analysis records unavailable',
    'Laboratory approval not evidenced',
  ],
  O5: [
    'Water coolers missing in bedrooms',
    'Cups not provided for residents',
  ],
  O6: [
    'Monthly testing certificates not submitted',
    'Certificates unavailable for review',
  ],

  // P — Electricity Supply (accommodation)
  P1: [
    'Fire extinguisher provision insufficient',
    'Civil Defense safety requirements not met',
  ],
  P2: [
    'Electrical room enclosure not fire rated',
    'No portable extinguisher at electrical room',
  ],
  P3: [
    'Damaged electrical sockets observed',
    'Exposed wiring present',
  ],
  P4: [
    'Electrical panel access obstructed',
    'Items stored against distribution boards',
  ],
  P5: [
    'Outlets inadequate for occupancy',
    'Evidence of circuit overloading',
    'Multiple adaptors in single outlet',
  ],
  P6: [
    'No documented electrical maintenance schedule',
    'PAT testing not carried out',
    'Qualified electrician inspections not evidenced',
  ],
  P7: [
    'No documented electrical failure emergency plan',
    'Emergency plan not available to workers',
  ],

  // Q — Gas Supply (accommodation)
  Q1: [
    'LPG plant not in designated plot',
    'Gas installation location non-compliant',
  ],
  Q2: [
    'LPG plant accessible to unauthorized persons',
    'Insufficient space for maintenance activities',
  ],
  Q3: [
    'LPG plant area not fenced',
    'Fencing damaged or incomplete',
  ],
  Q4: [
    'LPG area lighting inadequate',
    'Flood lamps missing or defective',
  ],
  Q5: [
    'Separation distances not compliant with NFPA 58',
    'Tanks located too close to buildings',
  ],
  Q6: [
    'Gas detectors not installed',
    'Automatic shut-off not provided',
    'Detector functionality not evidenced',
  ],

  // R — Firefighting Systems, Alarms and PA (accommodation)
  R1: [
    'Automatic fire alarm system not installed',
    'Alarm panel not in secure monitored location',
    'Alarm panel showing unresolved faults',
  ],
  R2: [
    'Fire detection missing in bedrooms',
    'Detection not compliant with KSA code',
  ],
  R3: [
    'No public announcement system installed',
    'PA system not operational',
  ],

  // S — Firefighting Equipment and Emergency Exits (accommodation)
  S1: [
    'Firefighting equipment below regulatory requirements',
    'Emergency exits insufficient or non-compliant',
    'Emergency exit obstructed or locked',
  ],
  S2: [
    'Fire detection incomplete across buildings',
    'Suppression equipment missing',
    'Fire safety signage not per NFPA',
  ],
  S3: [
    'Hose reels missing from main passages',
    'Fire extinguishers missing or inaccessible',
  ],
  S4: [
    'Smoke or heat detectors missing',
    'Manual fire alarm boxes not installed',
  ],
  S5: [
    'Evacuation plans not displayed',
    'Plans not in workers\' languages',
    'Emergency wayfinding signage missing',
  ],
  S6: [
    'Fire drill frequency below requirement',
    'Fire drill records unavailable',
  ],
  S7: [
    'No trained fire wardens appointed',
    'Fire wardens not resident in building',
    'Warden contact details not displayed',
  ],
  S8: [
    'Fire incident reporting procedure not established',
    'Incidents not reported within required timeframe',
  ],
  S9: [
    'Manual call points not provided',
    'Call points obstructed or defective',
  ],

  // T — Medical Services (accommodation)
  T1: [
    'First aid kits missing from apartments',
    'First aid kits inadequately stocked',
    'Kit provision below required ratio',
  ],
  T2: [
    'No medical emergency response plan',
    'Plan omits contagious disease outbreak',
  ],
  T3: [
    'Certified first aiders below required ratio',
    'First aider certification not evidenced',
  ],
  T4: [
    'Medical facility beyond acceptable travel time',
    'Nearest clinic distance not verified',
  ],
  T5: [
    'Medical incidents not reported in writing',
    'Incident reporting outside required timeframe',
  ],
  T6: [
    'Face mask stock unavailable',
    'Hand sanitizer not available on request',
    'Supplies charged to residents',
  ],
  T7: [
    'No qualified practitioner in first aid room',
    'First aid room unstaffed at times',
    'Practitioner certification not evidenced',
  ],
  T8: [
    'No emergency vehicle available on site',
    'Vehicle availability not demonstrated',
  ],

  // U — Public Health Hazards (accommodation)
  U1: [
    'Pest prevention measures inadequate',
    'Insect or rodent activity observed',
  ],
  U2: [
    'No licensed pest control contractor engaged',
    'Treatment frequency below monthly requirement',
    'Contractor licence not evidenced',
  ],
  U3: [
    'Extermination records unavailable',
    'Bed bug treatment not documented',
  ],

  // V — Waste Disposal (accommodation)
  V1: [
    'Waste not removed daily',
    'Accumulated waste observed at units',
  ],
  V2: [
    'Waste bins uncovered or damaged',
    'Bin quantity insufficient',
    'Bins unclean at inspection',
  ],
  V3: [
    'Facility cleaning and maintenance not evidenced',
    'No maintenance contract or proof provided',
  ],
  V4: [
    'Waste management contract unavailable',
    'Contract not provided on request',
  ],

  // W — Accommodation Management (accommodation)
  W1: [
    'No accommodation manager appointed',
    'Management responsibilities not contractually defined',
  ],
  W2: [
    'Resident register not maintained',
    'Register incomplete or outdated',
  ],
  W3: [
    'Movement restrictions imposed on residents',
    'Residents require permission to leave',
  ],
  W4: [
    'Regular inspections not coordinated',
    'Occupancy density not monitored',
    'Periodic evacuation training not held',
    'Reportable incidents not escalated to authorities',
  ],

  // X — Health, Safety and Security (accommodation)
  X1: [
    'No fire safety plan prepared',
    'Fire marshal training not included',
    'Equipment testing and drills not scheduled',
  ],
  X2: [
    'Surveillance cameras not installed',
    'Cameras not linked to Operational Command Center',
    'Camera coverage incomplete',
  ],
  X3: [
    'No security guards provided',
    'Guard licensing not evidenced',
  ],
  X4: [
    'Induction awareness program not delivered',
    'Awareness program topics incomplete',
    'House rules not displayed in apartments',
    'Attendance records unavailable',
  ],
  X5: [
    'House rules missing required topics',
    'Rules not displayed in residents\' languages',
    'Smoking policy not enforced indoors',
    'No signage supporting tobacco restrictions',
  ],

  // Welfare audit only — B: Wages & Working Hours
  B2: [
    'Payslips not issued to workers',
    'Payslips not understood by workers',
    'Payslip details incomplete',
  ],
  B3: [
    'Unexplained wage deductions identified',
    'Deductions not lawful or documented',
  ],
  B4: [
    'Working hours exceed legal limits',
    'Overtime not compensated',
    'Overtime records inconsistent',
  ],
  B5: [
    'Weekly rest day not consistently provided',
    'Leave entitlements not respected',
  ],

  // Welfare audit only — C: Grievance & Worker Voice
  C3: [
    'No welfare officer appointed',
    'Officer responsibilities not defined',
  ],
  C4: [
    'Indications of retaliation against complainants',
    'Workers fear reprisal for raising grievances',
  ],
}

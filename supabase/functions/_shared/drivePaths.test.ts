import { describe, expect, it } from 'vitest'
import { ROOT_FOLDER, cleanName, photoFileName, photoFolders } from './drivePaths.ts'

describe('Google Drive: where a photo goes', () => {
  it('a Worker Welfare audit: contractor and work order, then the audit date', () => {
    expect(ROOT_FOLDER).toBe('WW Co-pilot photos')
    expect(photoFolders({ templateId: 'welfare_audit', info: { contractorNames: 'RPCO', workOrder: '882', reviewDate: '2026-11-12' } })).toEqual([
      'RPCO – WO 882',
      '2026-11-12 Worker Welfare audit',
    ])
  })

  it('a camp inspection: the contractor, then the date and the camp', () => {
    expect(
      photoFolders({ templateId: 'accommodation', info: { contractorNames: 'SAMA', workOrder: '4800000882/1272', reviewDate: '2026-10-03', facilityLocation: 'Camp 3' } }),
    ).toEqual(['SAMA', '2026-10-03 Camp inspection – Camp 3'])
  })

  it('missing details still give a place', () => {
    expect(photoFolders({ templateId: 'welfare_audit' })).toEqual(['No contractor', 'Undated Worker Welfare audit'])
  })

  it('the file says what it shows and when (Saudi time), with a short id', () => {
    expect(photoFileName({ uuid: '3f9a2b1c-0000', itemId: 'F5', createdAt: '2026-11-12T11:32:00Z' })).toBe('F5 2026-11-12 14.32 3f9a.jpg')
    expect(photoFileName({ uuid: 'ab12cd', itemId: '@facility', createdAt: '2026-11-12T22:05:00Z' })).toBe('General 2026-11-13 01.05 ab12.jpg')
    expect(photoFileName({ uuid: 'ff00', itemId: null, createdAt: '2026-11-12T08:00:00Z' })).toBe('Unplaced 2026-11-12 11.00 ff00.jpg')
  })

  it('names Drive would refuse are cleaned', () => {
    expect(cleanName('A/B: "C"  *D*')).toBe('A B C D')
  })
})

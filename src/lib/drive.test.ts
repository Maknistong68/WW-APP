import { describe, expect, it } from 'vitest'
import { OFF_RECHECK_MS, driveLine, driveRecentlyOff, photoDriveText, photosToCopy } from './drive'

describe('photosToCopy', () => {
  const remote = [
    { uuid: 'a', user_id: 'me', drive_file_id: null, deleted: false },
    { uuid: 'b', user_id: 'me', drive_file_id: 'd1', deleted: false },
    { uuid: 'c', user_id: 'other', drive_file_id: null, deleted: false },
    { uuid: 'd', user_id: 'me', drive_file_id: null, deleted: true },
    { uuid: 'e', user_id: 'me', drive_file_id: null, deleted: false },
  ]
  it('asks for my own photos without a Drive copy, just uploaded first', () => {
    expect(photosToCopy(remote, 'me', ['e'])).toEqual(['e', 'a'])
  })
  it('includes a photo uploaded in this sync even though the list was read before it went up', () => {
    expect(photosToCopy(remote, 'me', ['new'])).toEqual(['new', 'a', 'e'])
  })
  it('never asks for copied, deleted or someone else’s photos', () => {
    expect(photosToCopy(remote, 'me', ['b', 'c', 'd'])).toEqual(['a', 'e'])
  })
  it('keeps to the batch size', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ uuid: `p${i}`, user_id: 'me', drive_file_id: null, deleted: false }))
    expect(photosToCopy(many, 'me', [])).toHaveLength(25)
  })
})

describe('driveRecentlyOff', () => {
  it('waits an hour after hearing Drive is off', () => {
    expect(driveRecentlyOff(1000, { on: false, at: 0 })).toBe(true)
    expect(driveRecentlyOff(OFF_RECHECK_MS + 1, { on: false, at: 0 })).toBe(false)
    expect(driveRecentlyOff(1000, { on: true, at: 0 })).toBe(false)
    expect(driveRecentlyOff(1000, null)).toBe(false)
  })
})

describe('photoDriveText', () => {
  it('says where the copy is', () => {
    expect(photoDriveText({ driveFileId: 'x' }, true)).toBe('Saved to Google Drive')
    expect(photoDriveText({ syncedAt: '2026-11-14' }, true)).toBe('Waiting to copy to Google Drive')
    expect(photoDriveText({}, true)).toMatch(/after the next sync/)
    expect(photoDriveText({}, null)).toMatch(/after the next sync/)
  })
  it('says nothing when Drive isn’t used', () => {
    expect(photoDriveText({ syncedAt: '2026-11-14' }, false)).toBeNull()
    expect(photoDriveText({}, false)).toBeNull()
    expect(photoDriveText({ syncedAt: '2026-11-14' }, null)).toBeNull()
  })
})

describe('driveLine', () => {
  it('reads the status in a few words', () => {
    expect(driveLine(null)).toBe('Checking…')
    expect(driveLine({ ready: false, connected: false, waiting: 3 })).toBe('Not set up on the server yet')
    expect(driveLine({ ready: true, connected: false, waiting: 3 })).toBe('Not connected')
    expect(driveLine({ ready: true, connected: true, email: 'team@example.com', waiting: 1 })).toBe('team@example.com · 1 photo waiting')
    expect(driveLine({ ready: true, connected: true, email: 'team@example.com', waiting: 0 })).toBe('team@example.com · all photos copied')
    expect(driveLine({ ready: true, connected: true, waiting: 0, problem: 'invalid_grant' })).toMatch(/Connect again/)
  })
})

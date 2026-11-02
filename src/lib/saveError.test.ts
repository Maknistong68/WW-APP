import { describe, expect, it } from 'vitest'
import { describeSaveError, isNoise, unexpectedText } from './saveError'

/** A DOMException-like error, as IndexedDB and Dexie throw them. */
const err = (name: string, message = 'x', inner?: { name: string; message?: string }) =>
  Object.assign(new Error(message), { name, inner })

describe('Why a save failed, in plain words', () => {
  it('full storage', () => {
    expect(describeSaveError(err('QuotaExceededError')).text).toMatch(/storage is full/)
    // a transaction aborted by a full disk: Dexie wraps it in an AbortError
    expect(describeSaveError(err('AbortError', 'aborted', { name: 'QuotaExceededError' })).text).toMatch(/storage is full/)
  })
  it('an old copy of the app after an update asks for a reload', () => {
    for (const name of ['VersionError', 'DatabaseClosedError', 'OpenFailedError']) {
      const d = describeSaveError(err(name))
      expect(d.text).toBe('The app was updated. Reload to save.')
      expect(d.reload).toBe(true)
    }
  })
  it('a storage that stopped answering asks for a reload', () => {
    for (const name of ['InvalidStateError', 'UnknownError', 'MissingAPIError']) {
      const d = describeSaveError(err(name))
      expect(d.text).toMatch(/storage didn’t answer/)
      expect(d.reload).toBe(true)
    }
  })
  it('a duplicate and an unsavable record', () => {
    expect(describeSaveError(err('ConstraintError')).text).toBe('This already exists.')
    expect(describeSaveError(err('DataCloneError')).text).toBe('Could not save this record.')
  })
  it('anything else names the reason', () => {
    expect(describeSaveError(new Error('disk on fire')).text).toBe('Could not save: disk on fire')
    expect(describeSaveError('boom').text).toBe('Could not save: boom')
  })
  it('keeps the technical name for the log', () => {
    expect(describeSaveError(err('AbortError', 'aborted', { name: 'QuotaExceededError', message: 'quota' })).detail).toBe(
      'QuotaExceededError: quota',
    )
    expect(describeSaveError(err('VersionError', 'old')).detail).toBe('VersionError: old')
  })
})

describe('Errors that are not worth a message', () => {
  it('skipped screen transitions, ResizeObserver loops, a refused clipboard', () => {
    expect(isNoise(err('AbortError', 'Transition was skipped'))).toBe(true)
    expect(isNoise(new Error('ResizeObserver loop completed with undelivered notifications.'))).toBe(true)
    expect(isNoise(err('NotAllowedError', 'Write permission denied.'))).toBe(true)
  })
  it('a storage failure is never noise', () => {
    expect(isNoise(err('AbortError', 'aborted', { name: 'QuotaExceededError' }))).toBe(false)
    expect(isNoise(err('VersionError'))).toBe(false)
    expect(isNoise(new Error('real bug'))).toBe(false)
  })
})

describe('An unexpected error, in plain words', () => {
  it('real storage trouble keeps its own message', () => {
    expect(unexpectedText(err('QuotaExceededError')).text).toMatch(/storage is full/)
    expect(unexpectedText(err('VersionError')).reload).toBe(true)
    expect(unexpectedText(err('InvalidStateError', 'Failed to execute transaction on IDBDatabase: The database connection is closing.')).text).toMatch(
      /storage didn’t answer/,
    )
  })
  it('the same error name from something else is not blamed on storage', () => {
    const d = unexpectedText(err('InvalidStateError', 'The play() request was interrupted'))
    expect(d.text).toBe('Something went wrong. Details in Settings › Sync log.')
    expect(d.reload).toBeUndefined()
    expect(unexpectedText(new Error('x is undefined')).text).toBe('Something went wrong. Details in Settings › Sync log.')
  })
})

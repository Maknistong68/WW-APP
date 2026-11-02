export const newUuid = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Fallback must still be a valid v4 UUID: these ids go into Postgres `uuid`
  // columns during cloud sync, so a non-UUID shape would make the record
  // permanently unsyncable.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

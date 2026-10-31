import Icon from './Icon'
import { useState } from 'react'

/** Password field with a show / hide eye. */
export default function PasswordInput({
  value,
  onChange,
  autoComplete,
}: {
  value: string
  onChange: (v: string) => void
  autoComplete: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        style={{ paddingRight: 48 }}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow(!show)}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          border: 'none',
          background: 'none',
          padding: 8,
          cursor: 'pointer',
          color: show ? 'var(--text)' : 'var(--muted)',
          display: 'inline-flex',
        }}
      >
        <Icon name="eye" size={22} fill={show} />
      </button>
    </div>
  )
}

import Icon from './Icon'
import { useState } from 'react'

/** Password field with a show / hide eye. */
export default function PasswordInput({
  value,
  onChange,
  autoComplete,
  id,
  onBlur,
  enterKeyHint,
}: {
  value: string
  onChange: (v: string) => void
  autoComplete: string
  id?: string
  onBlur?: () => void
  enterKeyHint?: 'go' | 'done' | 'next' | 'send'
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        onBlur={onBlur}
        enterKeyHint={enterKeyHint}
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
          right: 2,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 44,
          height: 44,
          border: 'none',
          borderRadius: '50%',
          background: 'none',
          padding: 0,
          cursor: 'pointer',
          color: show ? 'var(--text)' : 'var(--muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="eye" size={22} fill={show} />
      </button>
    </div>
  )
}

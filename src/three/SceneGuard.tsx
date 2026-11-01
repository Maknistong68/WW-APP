import { Component, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'

/** Catches render errors from the 3D scene so the page shows a message instead of hanging or crashing. */
export class SceneErrorBoundary extends Component<{ onError: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error))
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Tells the page once the first frame has actually been drawn. */
export function FirstFrame({ onFrame }: { onFrame: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    onFrame()
  })
  return null
}

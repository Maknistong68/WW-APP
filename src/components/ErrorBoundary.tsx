import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Keeps a runtime error from blanking the whole app; data stays in IndexedDB. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <p style={{ fontSize: 40, margin: 0 }}>⚠️</p>
        <h2>Something went wrong</h2>
        <p>
          Your inspections and photos are safe on this phone. Reload the app to continue — if this keeps
          happening, export a backup from the home screen.
        </p>
        <p className="crash-detail">{this.state.error.message}</p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload app
        </button>
      </div>
    )
  }
}

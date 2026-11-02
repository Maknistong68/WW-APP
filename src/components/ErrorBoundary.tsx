import { Component, type ReactNode } from 'react'
import Icon from './Icon'

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
        <Icon name="alert" size={44} className="crash-icon" />
        <h2>Something went wrong</h2>
        <p>Your data is safe on this phone. Reload, or open Settings › Save backup file.</p>
        <p className="crash-detail">{this.state.error.message}</p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload app
        </button>
      </div>
    )
  }
}

import { Component, type ReactNode } from 'react';
import { idbDelete } from '../state/idb';

/** Clears every saved deal workspace in this browser and reloads (demo data is rebuilt). */
export async function resetSavedData() {
  try { for (const id of ['rioja', 'phoenix']) await idbDelete(`ws:${id}`); } catch { /* ignore */ }
  try { Object.keys(localStorage).filter((k) => k.startsWith('dealsync.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  location.hash = '';
  location.reload();
}

/**
 * Catches render errors so a problem never leaves a blank page.
 * `full` = wraps the whole app (store included); otherwise it wraps one screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; full?: boolean; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[DealSync] screen error:', error); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const box = <div className="crash-box">
      <span className="eyebrow">Something went wrong</span>
      <h2>{this.props.full ? 'DealSync could not open your saved workspace' : `${this.props.label ?? 'This screen'} could not be shown`}</h2>
      <p>This usually happens when data saved in this browser by an older version of the prototype no longer matches the app. Resetting rebuilds the demo deals from the sample files; nothing on your computer is deleted.</p>
      <code>{error.message}</code>
      <div className="row">
        <button className="btn primary" onClick={() => { void resetSavedData(); }}>Reset saved data and reload</button>
        <button className="btn secondary" onClick={() => (this.props.full ? location.reload() : this.setState({ error: null }))}>Try again</button>
      </div>
    </div>;
    return this.props.full ? <div className="crash-page">{box}</div> : box;
  }
}

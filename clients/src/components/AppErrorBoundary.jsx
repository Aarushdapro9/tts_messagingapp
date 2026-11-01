import React from 'react';

// A cached deployment can occasionally reference a JavaScript chunk that was
// replaced by a newer deployment. Without a boundary React removes the whole
// tree, which looks like a blank page on phones. Keep the recovery local and
// give the user a single, clear way to fetch the current app.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Preserve diagnostics in the browser without exposing internal details
    // in the interface.
    console.error('Application render failed', error, info);
  }

  reloadApp = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-recovery" role="alert">
        <section>
          <p className="app-recovery-eyebrow">MESSAGES</p>
          <h1>Update ready</h1>
          <p>The app has a newer version available. Reload once to continue.</p>
          <button type="button" onClick={this.reloadApp}>Reload app</button>
        </section>
      </main>
    );
  }
}

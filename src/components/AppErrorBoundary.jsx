import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Marlin Flow Studio runtime error:", error, info);
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error?.message || String(this.state.error);
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="w-full max-w-2xl rounded-xl border border-red-500/30 bg-card p-6 shadow-sm">
          <div className="text-lg font-semibold text-red-600">Erreur d'affichage</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Un composant a rencontré une erreur. L'application n'est plus blanche et le détail est affiché ci-dessous.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs whitespace-pre-wrap">{message}</pre>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={this.handleReload} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground">Recharger</button>
            <button type="button" onClick={() => this.setState({ error: null })} className="px-4 py-2 rounded-lg border border-border">Réessayer</button>
          </div>
        </div>
      </div>
    );
  }
}

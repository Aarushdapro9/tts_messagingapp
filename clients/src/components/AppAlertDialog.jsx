import React from 'react';

function AppAlertDialog({ alert, dismissing, onDismiss }) {
  if (!alert) return null;

  const isUrgent = alert.type === 'alert';
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="app-alert-title" className="w-full max-w-md rounded-2xl bg-white p-6 text-[#1f2228] shadow-2xl">
      <p className={`text-xs font-extrabold uppercase tracking-[0.16em] ${isUrgent ? 'text-[#c33b36]' : 'text-[#267d5b]'}`}>{isUrgent ? 'Important alert' : 'New notification'}</p>
      <h2 id="app-alert-title" className="mt-2 text-2xl font-extrabold">{alert.title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#4d5964]">{alert.message}</p>
      <button type="button" onClick={onDismiss} disabled={dismissing} className={`mt-6 w-full rounded-lg px-4 py-2.5 font-bold text-white disabled:opacity-60 ${isUrgent ? 'bg-[#c33b36]' : 'bg-[#319268]'}`}>{dismissing ? 'Closing…' : 'Got it'}</button>
    </section>
  </div>;
}

export default AppAlertDialog;

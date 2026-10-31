import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createAppAlert, deleteUserAccount, downloadOwnerExport, getAdminChatMessages, getAdminOverview, getAuditLogs, getReports, getSystemSettings, updateReport, updateSystemSettings, updateUserModeration, updateUserRole } from '../apis/admin';

function chatName(chat) {
  if (chat.isGlobal) return 'Global Chat';
  if (chat.isGroup) return chat.chatName;
  return chat.users?.map((user) => user.name).join(' and ') || 'Direct chat';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function Admin() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [query, setQuery] = useState('');
  const [roleDrafts, setRoleDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState('');
  const [alertDraft, setAlertDraft] = useState({ type: 'notification', title: '', message: '' });
  const [sendingAlert, setSendingAlert] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState('');
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [moderatingUserId, setModeratingUserId] = useState('');
  const [systemSettings, setSystemSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOverview, nextReports, nextAuditLogs, nextSettings] = await Promise.all([getAdminOverview(), getReports(), getAuditLogs(), getSystemSettings()]);
      setOverview(nextOverview);
      setReports(nextReports.reports || []);
      setAuditLogs(nextAuditLogs.logs || []);
      setSystemSettings(nextSettings.settings || null);
    } catch (error) {
      const status = error.response?.status;
      toast.error(status === 403 ? 'Your account is not an administrator.' : 'Unable to load the admin panel.');
      navigate(status === 401 ? '/login' : '/chats');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return overview?.users || [];
    return (overview?.users || []).filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(normalizedQuery)
    );
  }, [overview, query]);

  const openChat = useCallback(async (chat) => {
    setSelectedChat(chat);
    setMessages([]);
    setLoadingMessages(true);
    try {
      const data = await getAdminChatMessages(chat._id);
      setSelectedChat(data.chat);
      setMessages(data.messages);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load this conversation.');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const changeRoleDraft = (user, changes) => {
    setRoleDrafts((current) => ({
      ...current,
      [user._id]: {
        title: user.title || 'Member',
        isAdmin: Boolean(user.isAdmin),
        ...current[user._id],
        ...changes,
      },
    }));
  };

  const saveRole = async (user) => {
    const role = roleDrafts[user._id] || {
      title: user.title || 'Member',
      isAdmin: Boolean(user.isAdmin),
    };
    setSavingUserId(user._id);
    try {
      const data = await updateUserRole(user._id, role);
      setOverview((current) => ({
        ...current,
        users: current.users.map((item) => item._id === user._id ? data.user : item),
      }));
      setRoleDrafts((current) => {
        const next = { ...current };
        delete next[user._id];
        return next;
      });
      toast.success('Role updated.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update this role.');
    } finally {
      setSavingUserId('');
    }
  };

  const sendAlert = async (event) => {
    event.preventDefault();
    setSendingAlert(true);
    try {
      await createAppAlert(alertDraft);
      setAlertDraft({ type: 'notification', title: '', message: '' });
      toast.success('Notification will appear when users next open the app.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to send this notification.');
    } finally {
      setSendingAlert(false);
    }
  };

  const deleteAccount = async (user) => {
    if (!window.confirm(`Permanently delete ${user.name}'s account and its messages, chats, and matches? This cannot be undone.`)) return;
    setDeletingUserId(user._id);
    try {
      const result = await deleteUserAccount(user._id);
      setOverview((current) => ({
        ...current,
        users: current.users.filter((item) => item._id !== result.deletedUserId),
        chats: current.chats.filter((chat) => !result.removedChatIds.includes(chat._id)),
      }));
      setSelectedChat((current) => result.removedChatIds.includes(current?._id) ? null : current);
      toast.success('Account deleted.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete this account.');
    } finally {
      setDeletingUserId('');
    }
  };

  const moderateUser = async (user, kind, hours = 0) => {
    if (!window.confirm(`Confirm ${kind.replace('_', ' ')} for ${user.name}?`)) return;
    setModeratingUserId(user._id);
    try {
      const until = hours ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : undefined;
      const data = await updateUserModeration(user._id, { kind, until });
      setOverview((current) => ({ ...current, users: current.users.map((item) => item._id === user._id ? data.user : item) }));
      toast.success('Moderation action saved.');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to save moderation action.'); }
    finally { setModeratingUserId(''); }
  };

  const resolveReport = async (report, status) => {
    try {
      const data = await updateReport(report.id, { status });
      setReports((current) => current.map((item) => item.id === report.id ? data.report : item));
      toast.success('Report updated.');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update report.'); }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    try {
      const data = await updateSystemSettings(systemSettings);
      setSystemSettings(data.settings);
      toast.success('Owner settings updated.');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update owner settings.'); }
    finally { setSavingSettings(false); }
  };

  const exportData = async () => {
    try {
      const response = await downloadOwnerExport();
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = 'messaging-app-owner-export.json'; link.click();
      URL.revokeObjectURL(url);
      toast.success('Owner export downloaded.');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to create the export.'); }
  };

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-[#121418] text-white">Loading admin panel…</div>;
  }

  const canManageRoles = Boolean(overview?.capabilities?.canManageRoles);

  return (
    <main className="min-h-[100dvh] bg-[#121418] px-4 py-6 text-white sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-bold tracking-wide text-[#48cda1]">RESTRICTED ACCESS</p><h1 className="text-3xl font-extrabold">Admin panel</h1></div>
          <div className="flex gap-3"><button onClick={loadOverview} className="rounded-lg border border-[#536070] px-4 py-2">Refresh</button><Link to="/chats" className="rounded-lg bg-[#48cda1] px-4 py-2 font-bold text-[#111b21]">Open chats</Link></div>
        </header>

        <p className="mb-6 rounded-lg border border-[#3b4653] bg-[#242a32] p-4 text-sm text-[#d6dce5]">Passwords are never shown or retrievable. {canManageRoles ? 'As Owner, you can set display titles and choose which accounts are administrators.' : 'This view is for account and conversation moderation; keep access limited to trusted administrators.'}</p>

        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-[#1d232b] p-5"><p className="text-sm text-[#9eabba]">Users</p><p className="mt-1 text-3xl font-extrabold">{overview?.users.length || 0}</p></div>
          <div className="rounded-xl bg-[#1d232b] p-5"><p className="text-sm text-[#9eabba]">Conversations</p><p className="mt-1 text-3xl font-extrabold">{overview?.chats.length || 0}</p></div>
          <div className="rounded-xl bg-[#1d232b] p-5"><p className="text-sm text-[#9eabba]">Private chats</p><p className="mt-1 text-3xl font-extrabold">{overview?.chats.filter((chat) => !chat.isGlobal && !chat.isGroup).length || 0}</p></div>
          <div className="rounded-xl bg-[#1d232b] p-5"><p className="text-sm text-[#9eabba]">Pending reports</p><p className="mt-1 text-3xl font-extrabold">{overview?.stats?.reportsPending || 0}</p></div>
          <div className="rounded-xl bg-[#1d232b] p-5"><p className="text-sm text-[#9eabba]">Suspended / banned</p><p className="mt-1 text-3xl font-extrabold">{(overview?.stats?.suspended || 0) + (overview?.stats?.banned || 0)}</p></div>
        </section>

        <section className="mb-7 grid grid-cols-1 gap-7 lg:grid-cols-2">
          <div className="rounded-xl bg-[#1d232b] p-5"><h2 className="text-xl font-bold">Report queue</h2><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{reports.length ? reports.map((report) => <div key={report.id} className="rounded bg-[#121418] p-3 text-sm"><b>{report.priority} · {report.targetType}</b><p className="mt-1 text-[#c5ced9]">{report.reason}</p><div className="mt-2 flex gap-2"><button onClick={() => resolveReport(report, 'reviewing')} className="text-xs text-[#48cda1]">Review</button><button onClick={() => resolveReport(report, 'resolved')} className="text-xs text-[#48cda1]">Resolve</button><span className="ml-auto text-xs text-[#9eabba]">{report.status}</span></div></div>) : <p className="text-sm text-[#9eabba]">No reports.</p>}</div></div>
          <div className="rounded-xl bg-[#1d232b] p-5"><h2 className="text-xl font-bold">Security audit</h2><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{auditLogs.length ? auditLogs.map((log) => <div key={log.id} className="rounded bg-[#121418] p-3 text-xs"><b>{log.action}</b><span className="ml-2 text-[#9eabba]">{formatDate(log.createdAt)}</span></div>) : <p className="text-sm text-[#9eabba]">No sensitive actions recorded yet.</p>}</div></div>
        </section>

        <section className="mb-7 rounded-xl bg-[#1d232b] p-5">
          <div className="mb-4"><h2 className="text-xl font-bold">Send app notification</h2><p className="mt-1 text-sm text-[#9eabba]">This is shown as a popup to every current account the next time they open the app.</p></div>
          <form onSubmit={sendAlert} className="grid grid-cols-1 gap-3 md:grid-cols-[150px_minmax(0,1fr)]">
            <label className="text-sm font-semibold">Type<select value={alertDraft.type} onChange={(event) => setAlertDraft((current) => ({ ...current, type: event.target.value }))} className="mt-1 w-full rounded-lg bg-[#121418] px-3 py-2 font-normal outline-none"><option value="notification">Notification</option><option value="alert">Important alert</option></select></label>
            <label className="text-sm font-semibold">Title<input required maxLength="80" value={alertDraft.title} onChange={(event) => setAlertDraft((current) => ({ ...current, title: event.target.value }))} placeholder="For example: Scheduled maintenance" className="mt-1 w-full rounded-lg bg-[#121418] px-3 py-2 font-normal outline-none" /></label>
            <label className="text-sm font-semibold md:col-span-2">Message<textarea required maxLength="500" value={alertDraft.message} onChange={(event) => setAlertDraft((current) => ({ ...current, message: event.target.value }))} placeholder="Write the message users will see." rows="3" className="mt-1 w-full resize-y rounded-lg bg-[#121418] px-3 py-2 font-normal outline-none" /></label>
            <div className="md:col-span-2"><button type="submit" disabled={sendingAlert} className="rounded-lg bg-[#48cda1] px-4 py-2 font-bold text-[#111b21] disabled:opacity-50">{sendingAlert ? 'Sending…' : 'Send notification'}</button></div>
          </form>
        </section>

        {canManageRoles && systemSettings && <section className="mb-7 rounded-xl bg-[#1d232b] p-5"><h2 className="text-xl font-bold">Owner controls</h2><p className="mt-1 text-sm text-[#9eabba]">Changes apply server-side. Maintenance mode lets only the Owner use the app.</p><form onSubmit={saveSettings} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Registration<select value={systemSettings.registrationMode} onChange={(event) => setSystemSettings((current) => ({ ...current, registrationMode: event.target.value }))} className="mt-1 block w-full rounded bg-[#121418] p-2"><option value="open">Open registration</option><option value="invite_only">Invite only</option></select></label><label className="text-sm font-semibold">Global Chat slow mode (seconds)<input type="number" min="0" max="300" value={systemSettings.globalChatSlowModeSeconds} onChange={(event) => setSystemSettings((current) => ({ ...current, globalChatSlowModeSeconds: Number(event.target.value) }))} className="mt-1 block w-full rounded bg-[#121418] p-2" /></label>{[['maintenanceMode', 'Maintenance mode'], ['globalChatLocked', 'Lock Global Chat'], ['games', 'Games enabled'], ['polls', 'Polls enabled']].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={key === 'games' || key === 'polls' ? Boolean(systemSettings.featureFlags?.[key]) : Boolean(systemSettings[key])} onChange={(event) => setSystemSettings((current) => key === 'games' || key === 'polls' ? ({ ...current, featureFlags: { ...current.featureFlags, [key]: event.target.checked } }) : ({ ...current, [key]: event.target.checked }))} />{label}</label>)}<div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" disabled={savingSettings} className="rounded bg-[#48cda1] px-4 py-2 font-bold text-[#111b21] disabled:opacity-50">{savingSettings ? 'Saving…' : 'Save system settings'}</button><button type="button" onClick={exportData} className="rounded border border-[#718096] px-4 py-2 font-bold">Download data export</button></div></form></section>}

        <section className="mb-7 rounded-xl bg-[#1d232b] p-5"><h2 className="text-xl font-bold">Account safety controls</h2><p className="mt-1 text-sm text-[#9eabba]">Every action is recorded. The Owner and your own account cannot be changed here.</p><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{visibleUsers.filter((user) => !user.isOwner && user._id !== overview?.capabilities?.currentUserId).map((user) => <article key={user._id} className="rounded-lg bg-[#121418] p-3"><p className="font-bold">{user.name} <span className="text-xs font-normal text-[#9eabba]">· {user.status}</span></p><p className="mt-1 text-xs text-[#9eabba]">Last active: {formatDate(user.lastActiveAt)}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={moderatingUserId === user._id} onClick={() => moderateUser(user, 'mute_chat', 24)} className="rounded border border-[#e6b85c] px-2 py-1 text-xs">Mute 24h</button><button disabled={moderatingUserId === user._id} onClick={() => moderateUser(user, 'suspend', 24)} className="rounded border border-[#e6b85c] px-2 py-1 text-xs">Suspend 24h</button><button disabled={moderatingUserId === user._id} onClick={() => moderateUser(user, 'ban_global', 168)} className="rounded border border-[#e6b85c] px-2 py-1 text-xs">Global ban 7d</button><button disabled={moderatingUserId === user._id} onClick={() => moderateUser(user, 'restrict_matchmaking', 168)} className="rounded border border-[#e6b85c] px-2 py-1 text-xs">Games 7d</button><button disabled={moderatingUserId === user._id} onClick={() => moderateUser(user, 'ban')} className="rounded border border-[#e16363] px-2 py-1 text-xs text-[#ff8e8e]">Permanent ban</button><button disabled={moderatingUserId === user._id} onClick={() => moderateUser(user, 'clear')} className="rounded border border-[#48cda1] px-2 py-1 text-xs text-[#48cda1]">Clear limits</button></div></article>)}</div></section>

        <section className="mb-7 overflow-hidden rounded-xl bg-[#1d232b]">
          <div className="flex flex-wrap justify-between gap-3 border-b border-[#323b47] p-5"><h2 className="text-xl font-bold">Users</h2><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="w-full rounded-lg bg-[#121418] px-3 py-2 text-sm outline-none sm:w-64" /></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="text-xs uppercase text-[#9eabba]"><tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Title</th><th className="p-4">Access</th><th className="p-4">Joined</th><th className="p-4">Actions</th></tr></thead><tbody>{visibleUsers.map((user) => {
            const draft = roleDrafts[user._id] || { title: user.title || 'Member', isAdmin: Boolean(user.isAdmin) };
            const canDeleteAccount = !user.isOwner && user._id !== overview?.capabilities?.currentUserId;
            return <tr key={user._id} className="border-t border-[#323b47] text-sm"><td className="p-4 font-semibold">{user.name}</td><td className="p-4 text-[#c5ced9]">{user.email}</td><td className="p-4">{canManageRoles && !user.isOwner ? <input value={draft.title} maxLength="32" onChange={(event) => changeRoleDraft(user, { title: event.target.value })} className="w-32 rounded bg-[#121418] px-2 py-1 text-sm outline-none" /> : <span>{user.title}</span>}</td><td className="p-4">{user.isOwner ? <span className="rounded-full bg-[#f4c95d] px-2 py-1 text-xs font-bold text-[#29220d]">Owner</span> : canManageRoles ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.isAdmin} onChange={(event) => changeRoleDraft(user, { isAdmin: event.target.checked })} /> Administrator</label> : user.isAdmin ? <span className="text-[#48cda1]">Administrator</span> : <span className="text-[#9eabba]">Member</span>}</td><td className="p-4 text-[#9eabba]">{formatDate(user.createdAt)}</td><td className="p-4">{user.isOwner ? '—' : <div className="flex gap-2">{canManageRoles && <button onClick={() => saveRole(user)} disabled={savingUserId === user._id} className="rounded bg-[#48cda1] px-3 py-1 text-xs font-bold text-[#111b21] disabled:opacity-50">{savingUserId === user._id ? 'Saving…' : 'Save'}</button>}{canDeleteAccount && <button onClick={() => deleteAccount(user)} disabled={deletingUserId === user._id} className="rounded border border-[#e16363] px-3 py-1 text-xs font-bold text-[#ff8e8e] disabled:opacity-50">{deletingUserId === user._id ? 'Deleting…' : 'Delete'}</button>}</div>}</td></tr>;
          })}</tbody></table></div>
        </section>

        <section className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl bg-[#1d232b]"><div className="border-b border-[#323b47] p-5"><h2 className="text-xl font-bold">Conversations</h2><p className="mt-1 text-sm text-[#9eabba]">Open a conversation to view its messages.</p></div><div className="max-h-[540px] overflow-y-auto">{overview?.chats.map((chat) => <button key={chat._id} onClick={() => openChat(chat)} className={`w-full border-b border-[#323b47] p-4 text-left hover:bg-[#27313c] ${selectedChat?._id === chat._id ? 'bg-[#27313c]' : ''}`}><p className="font-semibold">{chatName(chat)}</p><p className="mt-1 text-xs text-[#9eabba]">{chat.isGlobal ? 'Global' : chat.isGroup ? 'Group' : 'Private'} · {chat.users?.length || 0} members</p></button>)}</div></div>
          <div className="overflow-hidden rounded-xl bg-[#1d232b]"><div className="border-b border-[#323b47] p-5"><h2 className="text-xl font-bold">{selectedChat ? chatName(selectedChat) : 'Conversation'}</h2><p className="mt-1 text-sm text-[#9eabba]">{selectedChat ? 'Moderation view' : 'Choose a conversation on the left.'}</p></div><div className="max-h-[540px] overflow-y-auto p-5">{loadingMessages ? <p className="text-[#9eabba]">Loading messages…</p> : selectedChat ? messages.length ? messages.map((message) => <article key={message._id} className="mb-4"><p className="text-xs font-bold text-[#48cda1]">{message.sender?.name || 'Unknown'} {message.sender?.title && message.sender.title !== 'Member' ? `· ${message.sender.title}` : ''} <span className="font-normal text-[#9eabba]">· {formatDate(message.createdAt)}</span></p><p className="mt-1 whitespace-pre-wrap rounded-lg bg-[#121418] p-3 text-sm">{message.message}</p></article>) : <p className="text-[#9eabba]">No messages in this conversation.</p> : <p className="text-[#9eabba]">No conversation selected.</p>}</div></div>
        </section>
      </div>
    </main>
  );
}

export default Admin;

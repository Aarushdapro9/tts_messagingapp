import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAdminChatMessages, getAdminOverview } from '../apis/admin';

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

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await getAdminOverview());
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

  if (loading) {
    return <div className="min-h-[100dvh] bg-[#121418] text-white flex items-center justify-center">Loading admin panel…</div>;
  }

  return (
    <main className="min-h-[100dvh] bg-[#121418] text-white px-4 py-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap gap-4 items-center justify-between mb-7">
          <div><p className="text-[#48cda1] text-sm font-bold tracking-wide">RESTRICTED ACCESS</p><h1 className="text-3xl font-extrabold">Admin panel</h1></div>
          <div className="flex gap-3"><button onClick={loadOverview} className="border border-[#536070] px-4 py-2 rounded-lg">Refresh</button><Link to="/chats" className="bg-[#48cda1] text-[#111b21] font-bold px-4 py-2 rounded-lg">Open chats</Link></div>
        </header>

        <p className="bg-[#242a32] border border-[#3b4653] text-[#d6dce5] rounded-lg p-4 mb-6 text-sm">Passwords are never shown or retrievable. This view is for account and conversation moderation; keep access limited to trusted administrators.</p>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="bg-[#1d232b] rounded-xl p-5"><p className="text-[#9eabba] text-sm">Users</p><p className="text-3xl font-extrabold mt-1">{overview?.users.length || 0}</p></div>
          <div className="bg-[#1d232b] rounded-xl p-5"><p className="text-[#9eabba] text-sm">Conversations</p><p className="text-3xl font-extrabold mt-1">{overview?.chats.length || 0}</p></div>
          <div className="bg-[#1d232b] rounded-xl p-5"><p className="text-[#9eabba] text-sm">Private chats</p><p className="text-3xl font-extrabold mt-1">{overview?.chats.filter((chat) => !chat.isGlobal && !chat.isGroup).length || 0}</p></div>
        </section>

        <section className="bg-[#1d232b] rounded-xl overflow-hidden mb-7">
          <div className="p-5 border-b border-[#323b47] flex flex-wrap justify-between gap-3"><h2 className="font-bold text-xl">Users</h2><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="bg-[#121418] rounded-lg px-3 py-2 text-sm outline-none w-full sm:w-64" /></div>
          <div className="overflow-x-auto"><table className="w-full text-left min-w-[580px]"><thead className="text-[#9eabba] text-xs uppercase"><tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Bio</th><th className="p-4">Joined</th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user._id} className="border-t border-[#323b47] text-sm"><td className="p-4 font-semibold">{user.name}</td><td className="p-4 text-[#c5ced9]">{user.email}</td><td className="p-4 text-[#c5ced9]">{user.bio || '—'}</td><td className="p-4 text-[#9eabba]">{formatDate(user.createdAt)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-7">
          <div className="bg-[#1d232b] rounded-xl overflow-hidden"><div className="p-5 border-b border-[#323b47]"><h2 className="font-bold text-xl">Conversations</h2><p className="text-sm text-[#9eabba] mt-1">Open a conversation to view its messages.</p></div><div className="max-h-[540px] overflow-y-auto">{overview?.chats.map((chat) => <button key={chat._id} onClick={() => openChat(chat)} className={`w-full text-left p-4 border-b border-[#323b47] hover:bg-[#27313c] ${selectedChat?._id === chat._id ? 'bg-[#27313c]' : ''}`}><p className="font-semibold">{chatName(chat)}</p><p className="text-xs text-[#9eabba] mt-1">{chat.isGlobal ? 'Global' : chat.isGroup ? 'Group' : 'Private'} · {chat.users?.length || 0} members</p></button>)}</div></div>
          <div className="bg-[#1d232b] rounded-xl overflow-hidden"><div className="p-5 border-b border-[#323b47]"><h2 className="font-bold text-xl">{selectedChat ? chatName(selectedChat) : 'Conversation'}</h2><p className="text-sm text-[#9eabba] mt-1">{selectedChat ? 'Moderation view' : 'Choose a conversation on the left.'}</p></div><div className="p-5 max-h-[540px] overflow-y-auto">{loadingMessages ? <p className="text-[#9eabba]">Loading messages…</p> : selectedChat ? messages.length ? messages.map((message) => <article key={message._id} className="mb-4"><p className="text-xs text-[#48cda1] font-bold">{message.sender?.name || 'Unknown'} <span className="text-[#9eabba] font-normal">· {formatDate(message.createdAt)}</span></p><p className="bg-[#121418] rounded-lg p-3 mt-1 text-sm whitespace-pre-wrap">{message.message}</p></article>) : <p className="text-[#9eabba]">No messages in this conversation.</p> : <p className="text-[#9eabba]">No conversation selected.</p>}</div></div>
        </section>
      </div>
    </main>
  );
}

export default Admin;

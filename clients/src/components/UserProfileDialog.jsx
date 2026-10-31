import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createReport, updateUserApproval, updateUserRole } from '../apis/admin';
import { toggleUserBlock } from '../apis/auth';
import { setSelectedUser } from '../redux/profileSlice';
import RankBadge from './RankBadge';

const fallbackAvatar = 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg';

function UserProfileDialog() {
  const dispatch = useDispatch();
  const { selectedUser } = useSelector((state) => state.profile);
  const activeUser = useSelector((state) => state.activeUser);
  const [title, setTitle] = useState('Member');
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (!selectedUser) return;
    setTitle(selectedUser.title || 'Member');
    setIsAdmin(Boolean(selectedUser.isAdmin));
  }, [selectedUser]);

  if (!selectedUser) return null;

  const canEdit = activeUser.isOwner && selectedUser._id !== activeUser.id;
  const close = () => dispatch(setSelectedUser(null));

  const save = async () => {
    setSaving(true);
    try {
      const data = await updateUserRole(selectedUser._id, { title, isAdmin });
      dispatch(setSelectedUser(data.user));
      toast.success('Title updated.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update this title.');
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    setApproving(true);
    try {
      const data = await updateUserApproval(selectedUser._id, true);
      dispatch(setSelectedUser(data.user));
      toast.success('Account approved.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to approve this account.');
    } finally {
      setApproving(false);
    }
  };

  const toggleBlock = async () => {
    setBlocking(true);
    try {
      const { data } = await toggleUserBlock(selectedUser._id);
      toast.success(data.blocked ? 'User blocked.' : 'User unblocked.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update this block.');
    } finally { setBlocking(false); }
  };

  const reportUser = async () => {
    const reason = window.prompt('Why are you reporting this user?');
    if (!reason?.trim()) return;
    try {
      await createReport({ targetType: 'user', targetId: selectedUser._id, reason });
      toast.success('Report sent to the moderation team.');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to submit report.'); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={close}>
    <section className="w-full max-w-sm rounded-2xl bg-white p-5 text-[#1f2228] shadow-2xl" role="dialog" aria-modal="true" aria-label={`${selectedUser.name}'s profile`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex justify-end"><button onClick={close} aria-label="Close profile" className="rounded p-1 text-[#68737c] hover:bg-[#edf3f0]">×</button></div>
      <div className="-mt-2 flex flex-col items-center text-center"><img className="h-20 w-20 rounded-full object-cover" src={selectedUser.profilePic || fallbackAvatar} alt="" /><h2 className="mt-3 text-xl font-extrabold">{selectedUser.name}</h2>{selectedUser.title && selectedUser.title !== 'Member' ? <RankBadge title={selectedUser.title} className="mt-2" /> : <span className="mt-2 rounded-full bg-[#edf3f0] px-2 py-0.5 text-[10px] font-bold text-[#486057]">Member</span>}<p className="mt-3 text-sm text-[#68737c]">{selectedUser.bio || 'Available'}</p></div>
      {canEdit ? <div className="mt-6 border-t border-[#e4ebe7] pt-4"><p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#166e48]">Owner controls</p>{selectedUser.approved === false && <button onClick={approve} disabled={approving} className="mb-4 w-full rounded-lg bg-[#efb340] px-4 py-2 font-bold text-[#302204] disabled:opacity-50">{approving ? 'Approving…' : 'Approve account'}</button>}<label className="block text-sm font-semibold">Title<input value={title} maxLength="32" onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-[#b9c9c0] px-3 py-2 font-normal outline-none focus:border-[#319268]" /></label><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={isAdmin} onChange={(event) => setIsAdmin(event.target.checked)} /> Administrator — can delete messages</label><button onClick={save} disabled={saving} className="mt-4 w-full rounded-lg bg-[#319268] px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save title'}</button></div> : <p className="mt-6 border-t border-[#e4ebe7] pt-4 text-center text-xs text-[#68737c]">Only the Owner can change account titles.</p>}
      {!canEdit && selectedUser._id !== activeUser.id && <div className="mt-5 flex gap-2 border-t border-[#e4ebe7] pt-4"><button onClick={toggleBlock} disabled={blocking} className="rounded-lg border border-[#a75a5a] px-3 py-2 text-sm font-bold text-[#9b3434] disabled:opacity-50">{blocking ? 'Saving…' : 'Block / unblock'}</button><button onClick={reportUser} className="rounded-lg border border-[#68737c] px-3 py-2 text-sm font-bold">Report</button></div>}
    </section>
  </div>;
}

export default UserProfileDialog;

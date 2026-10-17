import React from 'react';

function RankBadge({ title, className = '' }) {
  if (!title || title === 'Member') return null;
  const isOwner = title.trim().toLowerCase() === 'owner';

  if (isOwner) {
    return <span className={`inline-flex items-center rounded border border-[#ff8a8a] bg-[#2b1014] px-1.5 py-0.5 font-mono text-[10px] font-black tracking-tight text-[#ff5555] shadow-[0_0_8px_rgba(255,85,85,0.38)] ${className}`}>[OWNER]</span>;
  }

  return <span className={`inline-flex items-center rounded-full bg-[#e8f7ef] px-2 py-0.5 text-[10px] font-bold text-[#166e48] ${className}`}>{title}</span>;
}

export default RankBadge;

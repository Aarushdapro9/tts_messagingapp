import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import ScrollableFeed from 'react-scrollable-feed'
import { Tooltip } from '@chakra-ui/tooltip'
import { Avatar } from '@chakra-ui/avatar'
import { isSameSender, isSameSenderMargin, isSameUser, isLastMessage } from '../utils/logics'
import { setSelectedUser } from '../redux/profileSlice'
import RankBadge from './RankBadge'
import '../pages/home.css'

function Poll({ message, activeUser, onVote }) {
  const options = message.poll?.options || []
  const votes = options.reduce((total, option) => total + (option.votes?.length || 0), 0)
  return <div className='min-w-[220px]'><p className='font-bold'>📊 {message.poll?.question || message.message}</p><div className='mt-2 space-y-1'>{options.map((option) => {
    const selected = option.votes?.includes(activeUser.id)
    const percent = votes ? Math.round(((option.votes?.length || 0) / votes) * 100) : 0
    return <button key={option.id} onClick={() => onVote(message._id, option.id)} className={`relative block w-full overflow-hidden rounded border px-2 py-1 text-left text-xs ${selected ? 'border-white' : 'border-white/60'}`}><span className='absolute inset-y-0 left-0 bg-white/20' style={{ width: `${percent}%` }} /><span className='relative'>{option.text} <span className='float-right'>{option.votes?.length || 0}</span></span></button>
  })}</div><p className='mt-2 text-[10px] opacity-80'>{votes} vote{votes === 1 ? '' : 's'} · tap to change vote</p></div>
}

function MessageHistory({ messages, onVote, onTogglePin, canDelete, onDelete }) {
  const activeUser = useSelector((state) => state.activeUser)
  const dispatch = useDispatch()
  return <ScrollableFeed className='scrollbar-hide'>
    {messages?.map((message, index) => {
      const mine = message.sender?._id === activeUser.id
      const ownerMessage = mine && activeUser.isOwner
      return <div className='flex items-center gap-x-[6px]' key={message._id}>
        {(isSameSender(messages, message, index, activeUser.id) || isLastMessage(messages, index, activeUser.id)) && <Tooltip label={`View ${message.sender?.name}'s profile`} placement='bottom-start' hasArrow><button type='button' onClick={() => dispatch(setSelectedUser(message.sender))} className='mt-[43px] mr-1 rounded-full focus:outline-none focus:ring-2 focus:ring-[#319268]' aria-label={`View ${message.sender?.name}'s profile`}><Avatar style={{ width: '32px', height: '32px' }} cursor='pointer' name={message.sender?.name} src={message.sender?.profilePic} borderRadius='25px' /></button></Tooltip>}
        <div className='relative tracking-wider text-[15px] font-medium' style={{ background: ownerMessage ? 'linear-gradient(135deg, #050505 0%, #16051f 58%, #2e0b42 100%)' : mine ? '#268d61' : '#f0f0f0', border: ownerMessage ? '1px solid rgba(214, 129, 255, 0.7)' : 'none', boxShadow: ownerMessage ? '0 0 10px rgba(190, 95, 255, 0.38)' : 'none', marginLeft: isSameSenderMargin(messages, message, index, activeUser.id), marginTop: isSameUser(messages, message, index) ? 3 : 10, borderRadius: mine ? '10px 10px 0 10px' : '10px 10px 10px 0', padding: '10px 18px', maxWidth: '460px', color: mine ? '#fff' : '#54565a' }}>
          {message.pinned && <span className='mr-1 text-xs'>📌</span>}
          {message.sender?.title && message.sender.title !== 'Member' ? <div className='mb-1'><RankBadge title={message.sender.title} /></div> : null}
          <button type='button' onClick={() => dispatch(setSelectedUser(message.sender))} className='mb-1 block text-left text-[10px] font-bold underline decoration-transparent hover:decoration-current'>{message.sender?.name}</button>
          {message.scheduledFor && !message.deliveredAt ? <p className='mb-1 text-[10px] opacity-75'>Scheduled for {new Date(message.scheduledFor).toLocaleString()}</p> : null}
          {message.type === 'poll' ? <Poll message={message} activeUser={activeUser} onVote={onVote} /> : message.message}
          {message.expiresAt && <p className='mt-1 text-[10px] opacity-70'>Disappears {new Date(message.expiresAt).toLocaleString()}</p>}
          {message.deliveredAt && <button onClick={() => onTogglePin(message._id)} className='ml-2 text-[10px] opacity-75 hover:opacity-100'>{message.pinned ? 'Unpin' : 'Pin'}</button>}
          {canDelete && <button onClick={() => onDelete(message._id)} className='ml-2 text-[10px] font-bold opacity-75 hover:opacity-100'>Delete</button>}
        </div>
      </div>
    })}
  </ScrollableFeed>
}

export default MessageHistory

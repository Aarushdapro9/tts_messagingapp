import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { BsEmojiSmile, BsFillEmojiSmileFill } from 'react-icons/bs'
import { BiArrowBack } from 'react-icons/bi'
import io from 'socket.io-client'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { toast } from 'react-toastify'
import Model from '../components/Model'
import MessageHistory from '../components/MessageHistory'
import Loading from '../components/ui/Loading'
import Typing from '../components/ui/Typing'
import RankBadge from '../components/RankBadge'
import GameLauncher from '../components/games/GameLauncher'
import { createPoll, deleteMessage, fetchMessages, sendMessage, togglePinnedMessage, voteOnPoll } from '../apis/messages'
import { fetchChats, setActiveChat, setNotifications } from '../redux/chatsSlice'
import { getChatName } from '../utils/logics'
import './home.css'

const GameScreen = lazy(() => import('../components/games/GameScreen'))

const ENDPOINT = process.env.REACT_APP_SERVER_URL || window.location.origin
const expiryOptions = [
  { value: '', label: 'Keep messages' },
  { value: '60', label: 'Disappear in 1 hour' },
  { value: '1440', label: 'Disappear in 1 day' },
  { value: '10080', label: 'Disappear in 7 days' },
]

function Chat({ className }) {
  const { activeChat, notifications } = useSelector((state) => state.chats)
  const activeUser = useSelector((state) => state.activeUser)
  const dispatch = useDispatch()
  const socketRef = useRef(null)
  const activeChatRef = useRef(activeChat)
  const notificationsRef = useRef(notifications)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [expiresInMinutes, setExpiresInMinutes] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')
  const [showPoll, setShowPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [openGame, setOpenGame] = useState(null)

  const refreshMessages = useCallback(async () => {
    if (!activeChat?._id) return
    try {
      const nextMessages = await fetchMessages(activeChat._id)
      if (Array.isArray(nextMessages)) setMessages(nextMessages)
    } catch {
      // A background sync should stay quiet; a manual action reports its own error.
    }
  }, [activeChat?._id])

  useEffect(() => { activeChatRef.current = activeChat }, [activeChat])
  useEffect(() => { notificationsRef.current = notifications }, [notifications])

  useEffect(() => {
    const socket = io(ENDPOINT)
    socketRef.current = socket
    socket.on('typing', () => setIsTyping(true))
    socket.on('stop typing', () => setIsTyping(false))
    socket.on('message recieved', (newMessage) => {
      const selectedChat = activeChatRef.current
      if (!selectedChat || selectedChat._id !== newMessage.chatId?._id) {
        const current = notificationsRef.current
        const next = current.some((item) => item._id === newMessage._id) ? current : [newMessage, ...current]
        notificationsRef.current = next
        dispatch(setNotifications(next))
      } else {
        setMessages((current) => current.some((item) => item._id === newMessage._id) ? current : [...current, newMessage])
      }
      dispatch(fetchChats())
    })
    return () => socket.disconnect()
  }, [dispatch])

  useEffect(() => {
    if (!activeUser?.id || !socketRef.current) return
    socketRef.current.emit('setup', activeUser)
  }, [activeUser])

  useEffect(() => {
    if (!activeChat?._id) return undefined
    setLoading(true)
    refreshMessages().finally(() => setLoading(false))
    socketRef.current?.emit('join room', activeChat._id)
    const sync = setInterval(() => {
      refreshMessages()
    }, 30_000)
    return () => clearInterval(sync)
  }, [activeChat?._id, dispatch, refreshMessages])

  const sendCurrentMessage = async (event) => {
    event?.preventDefault()
    if (!message.trim() || !activeChat?._id) return
    const text = message.trim()
    setMessage('')
    socketRef.current?.emit('stop typing', activeChat._id)
    setTyping(false)
    try {
      const saved = await sendMessage({
        chatId: activeChat._id,
        message: text,
        expiresInMinutes: expiresInMinutes || undefined,
        scheduledFor: showSchedule && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      })
      setMessages((current) => [...current, saved])
      if (saved.deliveredAt) socketRef.current?.emit('new message', saved)
      if (saved.scheduledFor) toast.success('Message scheduled.')
      setScheduledFor('')
      setShowSchedule(false)
      dispatch(fetchChats())
    } catch (error) {
      setMessage(text)
      toast.error(error.response?.data?.message || 'Unable to send message.')
    }
  }

  const submitPoll = async (event) => {
    event.preventDefault()
    try {
      const poll = await createPoll({ chatId: activeChat._id, question: pollQuestion, options: pollOptions })
      setMessages((current) => [...current, poll])
      socketRef.current?.emit('new message', poll)
      setPollQuestion('')
      setPollOptions(['', ''])
      setShowPoll(false)
      dispatch(fetchChats())
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create poll.')
    }
  }

  const onVote = async (messageId, optionId) => {
    try {
      const updated = await voteOnPoll(messageId, optionId)
      setMessages((current) => current.map((item) => item._id === updated._id ? updated : item))
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save your vote.')
    }
  }

  const onTogglePin = async (messageId) => {
    try {
      const result = await togglePinnedMessage(messageId)
      setMessages((current) => current.map((item) => item._id === result.message._id ? result.message : item))
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update the pin.')
    }
  }

  const onDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message for everyone?')) return
    try {
      await deleteMessage(messageId)
      setMessages((current) => current.filter((item) => item._id !== messageId))
      dispatch(fetchChats())
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete the message.')
    }
  }

  const onType = (event) => {
    setMessage(event.target.value)
    if (!socketRef.current || typing || !activeChat?._id) return
    setTyping(true)
    socketRef.current.emit('typing', activeChat._id)
    window.setTimeout(() => {
      socketRef.current?.emit('stop typing', activeChat._id)
      setTyping(false)
    }, 3000)
  }

  const pinnedMessages = messages.filter((item) => item.pinned)
  if (loading) return <div className={className}><Loading /></div>

  if (!activeChat) {
    return <div className={`${className} flex items-center justify-center`}><div className='flex flex-col items-center justify-center gap-y-3 px-5 text-center'><img className='w-[50px] h-[50px] rounded-[25px]' alt='User profile' src={activeUser.profilePic} /><h3 className='text-[#111b21] text-[20px] font-medium tracking-wider'>Welcome <span className='text-[#166e48] text-[19px] font-bold'>{activeUser.name}</span></h3><RankBadge title={activeUser.title} /><p className='max-w-sm text-sm text-[#607166]'>Your chats, folders, pins, and scheduled messages sync with this account on every device.</p></div></div>
  }

  return <div className={className}>
    {activeUser.approved === false && <div className='bg-[#fff4d6] px-4 py-2 text-center text-xs font-semibold text-[#835500]'>Your account is pending Owner approval. You can only message the Owner until approved.</div>}
    <div className='chat-header flex justify-between items-center px-4 md:px-5 h-[61px] bg-[#ffff] w-full'>
      <div className='flex items-center gap-x-[10px]'><button onClick={() => dispatch(setActiveChat(null))} className='md:hidden text-[#319268] p-1 -ml-1' aria-label='Back to chats'><BiArrowBack className='w-6 h-6' /></button><h5 className='chat-title text-[17px] font-bold tracking-wide'>{getChatName(activeChat, activeUser)}</h5></div>
      {!activeChat.isGlobal && <Model />}
    </div>
    {pinnedMessages.length > 0 && <div className='mx-3 mt-2 rounded-lg border border-[#cfe7dc] bg-[#f1fbf6] px-3 py-2 text-xs text-[#295743]'><b>📌 Pinned</b> · {pinnedMessages.map((item) => item.type === 'poll' ? 'Poll' : item.message).join(' · ')}</div>}
    <div className='scrollbar-hide w-full h-[calc(100dvh-205px)] md:h-[calc(100dvh-155px)] flex flex-col overflow-y-scroll p-3 md:p-4'>
      <MessageHistory messages={messages} onVote={onVote} onTogglePin={onTogglePin} canDelete={activeUser.isAdmin} onDelete={onDeleteMessage} onOpenGame={(matchId) => setOpenGame({ id: matchId })} />
      <div className='ml-7 -mb-10'>{isTyping ? <Typing width='100' height='100' /> : null}</div>
    </div>
    <div className='chat-composer absolute left-3 right-3 bottom-3 md:left-4 md:right-auto md:bottom-4'>
      {showPoll && activeChat.isGroup && <form onSubmit={submitPoll} className='mb-2 rounded-lg border border-[#aabac8] bg-white p-3 shadow-lg'><div className='mb-2 flex justify-between'><b className='text-sm'>New poll</b><button type='button' onClick={() => setShowPoll(false)} className='text-xs text-[#687a70]'>Close</button></div><input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} placeholder='Question' className='mb-2 w-full rounded border p-2 text-sm' required />{pollOptions.map((option, index) => <input key={index} value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} className='mb-2 w-full rounded border p-2 text-sm' required />)}<div className='flex gap-2'><button type='button' onClick={() => setPollOptions((current) => current.length < 6 ? [...current, ''] : current)} className='text-xs text-[#319268]'>+ Option</button><button className='ml-auto rounded bg-[#319268] px-3 py-1 text-xs font-bold text-white'>Create poll</button></div></form>}
      {showPicker && <Picker data={data} onEmojiSelect={(emoji) => setMessage((current) => current + emoji.native)} />}
      {showSchedule && <div className='mb-2 flex items-center gap-2 rounded-lg border bg-white p-2 text-xs'><label htmlFor='scheduled-for'>Send at</label><input id='scheduled-for' type='datetime-local' min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className='min-w-0 flex-1' /><button type='button' onClick={() => setShowSchedule(false)} className='text-[#687a70]'>Cancel</button></div>}
      <form onSubmit={sendCurrentMessage} className='chat-input border border-[#aabac8] rounded-t-[10px] px-4 py-2 w-full md:w-[400px]'>
        <input onChange={onType} className='chat-message-field focus:outline-0 w-full text-sm' type='text' placeholder='Enter message' value={message} />
      </form>
      <div className='chat-tools flex items-center gap-2 border-x border-b bg-[#f8f9fa] border-[#aabac8] px-3 py-2 w-full md:w-[400px] rounded-b-[10px] min-h-[48px]'>
        <button onClick={() => setShowPicker((current) => !current)} aria-label='Add emoji'>{showPicker ? <BsFillEmojiSmileFill className='w-5 h-5 text-[#ffb02e]' /> : <BsEmojiSmile className='w-5 h-5' />}</button>
        <select aria-label='Message expiry' value={expiresInMinutes} onChange={(event) => setExpiresInMinutes(event.target.value)} className='min-w-0 flex-1 bg-transparent text-[11px] outline-none'>{expiryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <button onClick={() => setShowSchedule((current) => !current)} className='text-[11px] text-[#319268]'>Later</button>
        {activeChat.isGroup && <button onClick={() => setShowPoll((current) => !current)} className='text-[11px] text-[#319268]'>Poll</button>}
        {!activeChat.isGroup && !activeChat.isGlobal && <GameLauncher chatId={activeChat._id} onMatchCreated={(match) => { dispatch(fetchChats()); refreshMessages(); setOpenGame({ id: match.id, initialMatch: match }) }} />}
        <button onClick={sendCurrentMessage} className='rounded border-2 border-[#d4d4d4] px-2 py-1 text-[12px] font-medium text-[#4d5e54]'>Send</button>
      </div>
    </div>
    {openGame && <Suspense fallback={<div className='game-screen-backdrop'><div className='game-loading'>Loading game…</div></div>}><GameScreen matchId={openGame.id} initialMatch={openGame.initialMatch} activeUserId={activeUser.id} onClose={() => { setOpenGame(null); refreshMessages(); dispatch(fetchChats()) }} /></Suspense>}
  </div>
}

export default Chat

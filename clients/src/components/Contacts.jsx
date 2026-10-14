import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchChats, setActiveChat } from '../redux/chatsSlice'
import { getChatName, getChatPhoto, timeSince } from '../utils/logics'
import { getChatFolders, updateChatFolder } from '../apis/chat'
import NoContacts from './ui/NoContacts'

const aDay = 24 * 60 * 60 * 1000
const folderTabs = [
  { id: 'all', label: 'All' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
  { id: 'groups', label: 'Groups' },
]

function Contacts() {
  const { chats, activeChat } = useSelector((state) => state.chats)
  const activeUser = useSelector((state) => state.activeUser)
  const dispatch = useDispatch()
  const [folders, setFolders] = useState({ personal: [], work: [] })
  const [selectedFolder, setSelectedFolder] = useState('all')

  useEffect(() => {
    dispatch(fetchChats())
    getChatFolders().then(setFolders).catch(() => setFolders({ personal: [], work: [] }))
  }, [dispatch])

  const visibleChats = useMemo(() => {
    if (selectedFolder === 'groups') return chats.filter((chat) => chat.isGroup)
    if (selectedFolder === 'personal' || selectedFolder === 'work') {
      return chats.filter((chat) => folders[selectedFolder]?.includes(chat._id))
    }
    return chats
  }, [chats, folders, selectedFolder])

  const moveChat = async (event, chatId) => {
    event.stopPropagation()
    try {
      setFolders(await updateChatFolder(chatId, event.target.value))
    } catch {
      // Keep the current folder view if the server could not sync the change.
    }
  }

  return (
    <>
      <div className="flex gap-1 px-4 pt-2 overflow-x-auto scrollbar-hide">
        {folderTabs.map((folder) => (
          <button key={folder.id} onClick={() => setSelectedFolder(folder.id)} className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${selectedFolder === folder.id ? 'bg-[#319268] text-white' : 'bg-[#edf3f0] text-[#486057]'}`}>
            {folder.label}
          </button>
        ))}
      </div>
      <div className='flex flex-col -space-y-1 overflow-y-scroll scrollbar-hide h-[calc(100dvh-190px)] md:h-[calc(100dvh-180px)] pb-10'>
        {visibleChats?.length > 0 ? visibleChats.map((chat) => (
          <div onClick={() => dispatch(setActiveChat(chat))} key={chat._id} className={`flex items-center justify-between gap-x-1 mt-3 ${activeChat?._id === chat._id ? 'bg-[#fafafa]' : 'bg-[#fff]'} cursor-pointer py-3 px-2`}>
            <div className='flex min-w-0 items-center gap-x-3'>
              <img className='w-11 h-11 rounded-[30px] shadow-lg object-cover' src={getChatPhoto(chat, activeUser)} alt="" />
              <div className="min-w-0">
                <h5 className='truncate text-[14px] sm:text-[16px] text-[#2b2e33] font-bold'>{getChatName(chat, activeUser)}</h5>
                <p className='truncate text-[12px] sm:text-[13px] font-medium text-[#56585c]'>{chat.latestMessage?.type === 'poll' ? 'Poll' : chat.latestMessage?.message || 'No messages yet'}</p>
              </div>
            </div>
            <div className='flex shrink-0 flex-col items-end gap-y-1'>
              <p className='text-[10px] font-normal text-[#b0b2b3]'>{timeSince(new Date(Date.parse(chat.updatedAt) - aDay))}</p>
              {!chat.isGlobal && <select aria-label={`Move ${getChatName(chat, activeUser)} to a folder`} value={folders.work?.includes(chat._id) ? 'work' : folders.personal?.includes(chat._id) ? 'personal' : 'none'} onClick={(event) => event.stopPropagation()} onChange={(event) => moveChat(event, chat._id)} className="max-w-[72px] bg-transparent text-[10px] text-[#319268] outline-none">
                <option value="none">Folder</option><option value="personal">Personal</option><option value="work">Work</option>
              </select>}
            </div>
          </div>
        )) : <NoContacts />}
      </div>
    </>
  )
}

export default Contacts

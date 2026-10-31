import React, { useState } from 'react'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { searchUsers, validUser } from '../apis/auth'
import { setActiveUser } from '../redux/activeUserSlice'
import { RiNotificationBadgeFill } from "react-icons/ri"
import { BsSearch } from "react-icons/bs"
import { BiNotification } from "react-icons/bi"
import { IoIosArrowDown } from "react-icons/io"
import { setShowNotifications, setShowProfile } from '../redux/profileSlice'
import Chat from './Chat'
import Profile from "../components/Profile"
import { acessCreate } from "../apis/chat.js"
import "./home.css"
import { fetchChats, setNotifications } from '../redux/chatsSlice'
import { getSender } from '../utils/logics'
import { setActiveChat } from '../redux/chatsSlice'
import Group from '../components/Group'
import Contacts from '../components/Contacts'
import { Effect } from "react-notification-badge"
// import NotificationBadge from 'react-notification-badge/lib/components/NotificationBadge';
import NotificationBadge from 'react-notification-badge';
import Search from '../components/group/Search'
import UserProfileDialog from '../components/UserProfileDialog'
import AppAlertDialog from '../components/AppAlertDialog'
import { dismissAppAlert, getPendingAlerts } from '../apis/admin'
import { toast } from 'react-toastify'
import { themeCssVars } from '../utils/theme'

function getDeviceType() {
  const hasTouchInput = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
  if (!hasTouchInput) return 'desktop'
  if (window.innerWidth < 768) return 'phone'
  if (window.innerWidth <= 1366) return 'tablet'
  return 'desktop'
}

function Home() {
  const dispatch = useDispatch()
  const { showProfile, showNotifications } = useSelector((state) => state.profile)
  const { notifications, activeChat } = useSelector((state) => state.chats)
  const { activeUser } = useSelector((state) => state)
  const [searchResults, setSearchResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [showUsers, setShowUsers] = useState(false)
  const [appAlerts, setAppAlerts] = useState([])
  const [dismissingAlert, setDismissingAlert] = useState(false)
  const [deviceType, setDeviceType] = useState(getDeviceType)

  const handleSearch = async (e) => {
    setSearch(e.target.value)
  }
  const handleClick = async (e) => {
    await acessCreate({ userId: e._id })
    dispatch(fetchChats())
    setSearch("")
    setShowUsers(false)
  }
  useEffect(() => {
    const query = search.trim()
    if (!query && !showUsers) {
      setSearchResults([])
      setIsLoading(false)
      return undefined
    }
    let cancelled = false
    const searchChange = async () => {
      setIsLoading(true)
      try {
        const { data } = await searchUsers(query)
        if (!cancelled) setSearchResults(data)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    const timeout = window.setTimeout(searchChange, 250)
    return () => { cancelled = true; window.clearTimeout(timeout) }
  }, [search, showUsers])
  useEffect(() => {
    const isValid = async () => {
      const data = await validUser()

      const user = {
        id: data?.user?._id,
        email: data?.user?.email,
        profilePic: data?.user?.profilePic,
        bio: data?.user?.bio,
        name: data?.user?.name,
        isAdmin: data?.user?.isAdmin,
        isOwner: data?.user?.isOwner,
        title: data?.user?.title,
        theme: data?.user?.theme,
        themeSettings: data?.user?.themeSettings,
        approved: data?.user?.approved,
        onboardingChatId: data?.user?.onboardingChatId,
      }
      dispatch(setActiveUser(user))
      const chatsRequest = dispatch(fetchChats())
      if (data?.user?.approved === false && data?.user?.onboardingChatId) {
        const action = await chatsRequest
        const onboardingChat = action.payload?.find((chat) => chat._id === data.user.onboardingChatId)
        if (onboardingChat) dispatch(setActiveChat(onboardingChat))
      }
    }
    isValid()

  }, [dispatch])

  useEffect(() => {
    const updateDeviceType = () => setDeviceType(getDeviceType())
    window.addEventListener('resize', updateDeviceType, { passive: true })
    return () => window.removeEventListener('resize', updateDeviceType)
  }, [])

  useEffect(() => {
    if (!activeUser.id) return undefined
    let cancelled = false
    getPendingAlerts()
      .then(({ alerts }) => {
        if (!cancelled) setAppAlerts(alerts || [])
      })
      .catch(() => {
        if (!cancelled) setAppAlerts([])
      })
    return () => { cancelled = true }
  }, [activeUser.id])

  useEffect(() => {
    if (!activeUser.id) return undefined
    const syncChats = () => dispatch(fetchChats())
    const interval = window.setInterval(syncChats, 30_000)
    return () => window.clearInterval(interval)
  }, [activeUser.id, dispatch])

  const dismissCurrentAlert = async () => {
    const currentAlert = appAlerts[0]
    if (!currentAlert) return
    setDismissingAlert(true)
    try {
      await dismissAppAlert(currentAlert._id)
      setAppAlerts((current) => current.slice(1))
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to dismiss this notification.')
    } finally {
      setDismissingAlert(false)
    }
  }


  return (
    <>

      <div data-device={deviceType} style={themeCssVars(activeUser.themeSettings, activeUser.theme)} className="themed-app chat-shell bg-[#282C35!] scrollbar-hide z-10 h-[100dvh] lg:w-[90%] lg:mx-auto overflow-hidden shadow-2xl">

        <div className='flex h-full'>
          {
            !showProfile ?
              <div className={`${activeChat ? 'hidden md:flex' : 'flex'} chat-sidebar flex-col w-full md:min-w-[360px] md:max-w-[420px] h-[100dvh] md:h-[98.6vh] bg-[#ffff] relative`}>

                <div className='h-[61px] px-4'>
                  <div className='flex'>
                    <a className='flex items-center relative  -top-4 block h-[90px]' href='/'>

                      <h3 className='app-title text-[20px] font-body font-extrabold tracking-wider'>Messages</h3>
                    </a>
                  </div>
                  <div className='absolute top-4 right-5 flex items-center gap-x-3'>
                    {activeUser?.isAdmin ? <a href='/admin' className='text-[11px] font-bold text-[#166e48] border border-[#9dd8c0] rounded px-2 py-1'>{activeUser.isOwner ? 'Owner' : 'Admin'}</a> : null}
                    <button onClick={() => dispatch(setShowNotifications(!showNotifications))}>
                      <NotificationBadge
                        count={notifications.length}
                        effect={Effect.SCALE}
                        style={{ width: "15px", height: "15px", fontSize: "9px", padding: "4px 2px 2px 2px" }}
                      />
                      {
                        showNotifications ? <RiNotificationBadgeFill style={{ width: "25px", height: "25px", color: "#319268" }} /> : <BiNotification style={{ color: "#319268", width: "25px", height: "25px" }} />
                      }

                    </button>
                    <div className={`${showNotifications ? "overflow-y-scroll scrollbar-hide tracking-wide absolute top-10 -left-32 z-10 w-[240px] bg-[#fafafa] px-4 py-2 shadow-2xl" : "hidden"}`}>
                      <div className='text-[13px]'>

                        {!notifications.length && "No new messages"}
                      </div>
                      {
                        notifications.map((e, index) => {
                          return (
                            <div onClick={() => {
                              dispatch(setActiveChat(e.chatId))
                              dispatch(setNotifications(notifications.filter((data) => data !== e)))

                            }} key={index} className='text-[12.5px] text-black px-2 cursor-pointer' >

                              {e.chatId.isGlobal
                                ? `New message in ${e.chatId.chatName}`
                                : e.chatId.isGroup
                                ? `New Message in ${e.chatId.chatName}`
                                : `New Message from ${getSender(activeUser, e.chatId.users)}`}
                            </div>

                          )

                        })
                      }
                    </div>
                    <button onClick={() => dispatch(setShowProfile(true))} className='flex items-center gap-x-1 relative'>
                      <img className='w-[28px] h-[28px] rounded-[25px]' src={activeUser?.profilePic} alt="" />
                      <IoIosArrowDown style={{ color: "#616c76", height: "14px", width: "14px" }} />
                    </button>
                  </div>
                </div>

                <div>

                  <div className='-mt-6 relative pt-6 px-4'>
                    <form onSubmit={(e) => e.preventDefault()}>

                      <input onChange={handleSearch} className='sidebar-search w-[99.5%] tracking-wider pl-9 py-[8px] rounded-[9px] outline-0' type="text" name="search" placeholder="Search" />

                    </form>

                    <div className='absolute top-[36px] left-[27px]'>
                      <BsSearch style={{ color: "#c4c4c5" }} />
                    </div>
                    <div className='flex items-center justify-between pr-1'>
                      {activeUser.approved ? <Group /> : <span className='mt-3 text-[11px] font-semibold text-[#a66b00]'>Waiting for Owner approval</span>}
                      {activeUser.approved && <button onClick={() => setShowUsers(!showUsers)} className='mt-3 text-[11px] font-normal tracking-wide bg-[#f6f6f6] text-[#1f2228] py-1 px-2'>
                        {showUsers ? "Hide users" : "All users"}
                      </button>}
                    </div>

                    <div style={{ display: search || showUsers ? "" : "none" }} className='h-[calc(100dvh-70px)] absolute z-10 w-[100%] left-[0px] top-[70px] bg-[#fff] flex flex-col gap-y-3 pt-3 px-4'>
                      <div className='flex items-center justify-between'>
                        <h4 className='text-[13px] font-semibold text-[#1f2228]'>{search ? "Search results" : "All users"}</h4>
                        <button onClick={() => { setSearch(""); setShowUsers(false) }} className='text-[12px] text-[#0086ea]'>Close</button>
                      </div>
                      <Search alwaysVisible={showUsers} searchResults={searchResults} isLoading={isLoading} handleClick={handleClick} search={search} />

                    </div>
                  </div>


                  <Contacts />


                </div>


              </div> : <Profile className="profile-panel min-w-[100%] sm:min-w-[360px] h-[100vh] bg-[#fafafa] shodow-xl relative" />
          }
          <Chat className={`${activeChat ? 'block' : 'hidden md:block'} chat-page relative w-full min-w-0 h-[100dvh] bg-[#fafafa]`} />




        </div>
      </div >
      <UserProfileDialog />
      <AppAlertDialog alert={appAlerts[0]} dismissing={dismissingAlert} onDismiss={dismissCurrentAlert} />

    </>
  )
}

export default Home

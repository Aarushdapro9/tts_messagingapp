import React, { useState } from 'react'
import { IoArrowBack } from "react-icons/io5"
import { useDispatch, useSelector } from 'react-redux'
import { setShowProfile } from '../redux/profileSlice'
import { IoMdLogOut } from "react-icons/io"
import InputEdit from './profile/InputEdit'
import { updateUser } from '../apis/auth'
import { toast } from 'react-toastify'
import { setUserNameAndBio } from '../redux/activeUserSlice'
import RankBadge from './RankBadge'
import { DEFAULT_THEME, normalizeTheme } from '../utils/theme'

const themeFields = [
  ['app', 'App background'],
  ['surface', 'Chat background'],
  ['sidebar', 'Sidebar'],
  ['accent', 'Accent'],
  ['outgoing', 'Your bubbles'],
  ['incoming', 'Other bubbles'],
]

const themePresets = [
  ['Default', DEFAULT_THEME],
  ['Midnight', { app: '#111827', surface: '#1f2937', sidebar: '#172033', accent: '#60a5fa', outgoing: '#2563eb', incoming: '#374151' }],
  ['Lavender', { app: '#24112f', surface: '#fffaff', sidebar: '#f8edff', accent: '#8b5cf6', outgoing: '#6d28d9', incoming: '#eee2ff' }],
  ['Sunset', { app: '#34130d', surface: '#fff8f4', sidebar: '#fff0e8', accent: '#e85d3f', outgoing: '#c2410c', incoming: '#ffe1d2' }],
]

function ThemeEditor({ theme, onChange, onPreset, onSave }) {
  return <section className="mt-5 bg-white px-4 py-5 shadow-md">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-[#1f2228]">Your theme</h2><p className="mt-1 text-[11px] text-[#52616d]">Choose a preset or create your own colors.</p></div><button type="button" onClick={onSave} className="rounded-md bg-[var(--theme-accent)] px-3 py-2 text-xs font-bold text-white">Save theme</button></div>
    <div className="mt-4 flex flex-wrap gap-2">{themePresets.map(([name, colors]) => <button type="button" key={name} onClick={() => onPreset(colors)} className="rounded-full border border-[#d7e0dc] px-3 py-1.5 text-xs font-semibold text-[#31423a] hover:border-[var(--theme-accent)]">{name}</button>)}</div>
    <div className="mt-5 grid grid-cols-2 gap-3">{themeFields.map(([key, label]) => <label key={key} className="rounded-lg border border-[#e1e7e4] p-2 text-[11px] font-semibold text-[#44514c]">{label}<span className="mt-2 flex items-center gap-2"><input type="color" value={theme[key]} onChange={(event) => onChange(key, event.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /><output className="font-mono text-[10px] uppercase">{theme[key]}</output></span></label>)}</div>
    <div className="mt-4 rounded-xl p-3 text-sm text-white" style={{ background: theme.app }}><p className="font-bold">Theme preview</p><div className="mt-2 flex gap-2"><span className="rounded-lg px-3 py-2" style={{ background: theme.outgoing }}>Your message</span><span className="rounded-lg px-3 py-2 text-[#4b5563]" style={{ background: theme.incoming }}>Reply</span></div></div>
  </section>
}

function Profile(props) {
  const dispatch = useDispatch()
  const { showProfile } = useSelector((state) => state.profile)
  const activeUser = useSelector((state) => state.activeUser)
  const [formData, setFormData] = useState({
    name: activeUser.name,
    bio: activeUser.bio,
    theme: normalizeTheme(activeUser.theme),
  })
  const logoutUser = () => {
    toast.success("Logout Successfull!")
    localStorage.removeItem("userToken")
    window.location.href = "/login"
  }
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }
  const submit = async () => {
    const savedUser = await updateUser(activeUser.id, formData)
    if (!savedUser) return
    dispatch(setUserNameAndBio(savedUser))
    toast.success("Updated!")
  }

  const setThemeColor = (key, value) => setFormData((current) => ({
    ...current,
    theme: { ...current.theme, [key]: value },
  }))

  const applyPreset = (theme) => setFormData((current) => ({ ...current, theme: normalizeTheme(theme) }))

  return (

    <div style={{ transition: showProfile ? "0.3s ease-in-out" : "" }} className={`${props.className} overflow-y-auto scrollbar-hide`}>
      <div className='min-h-full w-[100%]'>
        <div className='profile-header sticky top-0 z-20 bg-[#166e48] pt-12 pb-3'>
          <button onClick={() => dispatch(setShowProfile(false))} className='flex items-center'>
            <IoArrowBack style={{ color: "#fff", width: "30px", height: "20px" }} />
            <h6 className='text-[16px] text-[#fff] font-semibold'>Profile</h6>
          </button>
        </div>
        <div className=' pt-5'>
          <div className='flex items-center flex-col'>
            <img className='w-[150px] h-[150px] rounded-[100%] -ml-5' src={activeUser?.profilePic} alt="" />
            <RankBadge title={activeUser?.title} className='mt-3' />
          </div>
          <InputEdit type="name" handleChange={handleChange} input={formData.name} handleSubmit={submit} />

          <div>

            <div className='py-5 px-4'>
              <p className='text-[10px] tracking-wide text-[#3b4a54] '>
                This is not your username or pin. This name will be visible to your contacts
              </p>
            </div>

          </div>
          <InputEdit type="bio" handleChange={handleChange} input={formData.bio} handleSubmit={submit} />
          <ThemeEditor theme={formData.theme} onChange={setThemeColor} onPreset={applyPreset} onSave={submit} />
        </div>

        <div onClick={logoutUser} className='flex items-center justify-center mt-5 cursor-pointer shadow-2xl'>
          <IoMdLogOut className='text-[#e44d4d] w-[27px] h-[23px]' />
          <h6 className='text-[17px] text-[#e44d4d] font-semibold'>Logout</h6>
        </div>
      </div>
    </div>
  )
}

export default Profile

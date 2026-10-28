import React, { useState } from 'react'
import { IoArrowBack } from "react-icons/io5"
import { useDispatch, useSelector } from 'react-redux'
import { setShowProfile } from '../redux/profileSlice'
import { IoMdLogOut } from "react-icons/io"
import InputEdit from './profile/InputEdit'
import { updateUser } from '../apis/auth'
import { toast } from 'react-toastify'
import { setUserNameAndBio, setUserThemeSettings } from '../redux/activeUserSlice'
import RankBadge from './RankBadge'
import ThemeStudio from './ThemeStudio'

function Profile(props) {
  const dispatch = useDispatch()
  const { showProfile } = useSelector((state) => state.profile)
  const activeUser = useSelector((state) => state.activeUser)
  const [formData, setFormData] = useState({
    name: activeUser.name,
    bio: activeUser.bio,
  })
  const [savingTheme, setSavingTheme] = useState(false)
  const logoutUser = () => {
    toast.success("Logout Successfull!")
    localStorage.removeItem("userToken")
    window.location.href = "/login"
  }
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }
  const submit = async () => {
    const savedUser = await updateUser(activeUser.id, { name: formData.name, bio: formData.bio })
    if (!savedUser) return
    dispatch(setUserNameAndBio(savedUser))
    toast.success("Updated!")
  }

  const saveThemeSettings = async (themeSettings) => {
    setSavingTheme(true)
    dispatch(setUserThemeSettings(themeSettings))
    const savedUser = await updateUser(activeUser.id, { themeSettings })
    if (savedUser?.themeSettings) {
      dispatch(setUserThemeSettings(savedUser.themeSettings))
      toast.success('Theme saved across your devices!')
    }
    setSavingTheme(false)
  }

  return (

    <div style={{ transition: showProfile ? "0.3s ease-in-out" : "" }} className={`${props.className} flex flex-col overflow-hidden`}>
      <div className='profile-header z-20 shrink-0 bg-[#166e48] pt-12 pb-3'>
          <button onClick={() => dispatch(setShowProfile(false))} className='flex items-center rounded-md bg-[#111b21] px-2 py-1.5 shadow-md'>
            <IoArrowBack style={{ color: "#fff", width: "30px", height: "20px" }} />
            <h6 className='text-[16px] text-[#fff] font-semibold'>Profile</h6>
          </button>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto scrollbar-hide'>
        <div className='min-h-full w-[100%]'>
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
          <ThemeStudio settings={activeUser.themeSettings} legacyTheme={activeUser.theme} onSave={saveThemeSettings} saving={savingTheme} />
        </div>

        <div onClick={logoutUser} className='flex items-center justify-center mt-5 cursor-pointer shadow-2xl'>
          <IoMdLogOut className='text-[#e44d4d] w-[27px] h-[23px]' />
          <h6 className='text-[17px] text-[#e44d4d] font-semibold'>Logout</h6>
        </div>
      </div>
      </div>
    </div>
  )
}

export default Profile

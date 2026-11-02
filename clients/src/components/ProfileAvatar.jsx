import React from 'react'

const FALLBACK_PROFILE_PIC = 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg'

const animalPresetPositions = {
  // The supplied sheet has generous space between portraits. These positions
  // centre on the illustration itself instead of on the larger grid cell.
  'preset:animal-horse': '7.3% 12.4%',
  'preset:animal-zebra': '35.2% 12.4%',
  'preset:animal-antelope': '63.3% 12.4%',
  'preset:animal-deer': '91.7% 12.4%',
  'preset:animal-crocodile': '7.3% 47.7%',
  'preset:animal-rhinoceros': '35.2% 47.7%',
  'preset:animal-gazelle': '63.3% 47.7%',
  'preset:animal-giraffe': '91.7% 47.7%',
  'preset:animal-gorilla': '7.3% 83.2%',
  'preset:animal-chimpanzee': '35.2% 83.2%',
  'preset:animal-orangutan': '63.3% 83.2%',
  'preset:animal-monkey': '91.7% 83.2%',
}

function ProfileAvatar({ profilePic, name = 'User', className = '', alt, style, ...props }) {
  const presetPosition = animalPresetPositions[profilePic]

  if (presetPosition) {
    return <span
      {...props}
      role='img'
      aria-label={alt || `${name}'s profile picture`}
      className={`inline-block shrink-0 bg-cover ${className}`}
      style={{
        ...style,
        backgroundImage: `url(${process.env.PUBLIC_URL || ''}/avatars/animal-avatar-sheet.png)`,
        backgroundColor: '#f4f3f0',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '591% 443%',
        backgroundPosition: presetPosition,
      }}
    />
  }

  return <img {...props} className={`object-cover ${className}`} src={profilePic || FALLBACK_PROFILE_PIC} alt={alt || `${name}'s profile picture`} style={style} />
}

export default ProfileAvatar

import React from 'react'

const FALLBACK_PROFILE_PIC = 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg'

const animalPresetPositions = {
  'preset:animal-horse': '0% 0%',
  'preset:animal-zebra': '33.333% 0%',
  'preset:animal-antelope': '66.667% 0%',
  'preset:animal-deer': '100% 0%',
  'preset:animal-crocodile': '0% 50%',
  'preset:animal-rhinoceros': '33.333% 50%',
  'preset:animal-gazelle': '66.667% 50%',
  'preset:animal-giraffe': '100% 50%',
  'preset:animal-gorilla': '0% 100%',
  'preset:animal-chimpanzee': '33.333% 100%',
  'preset:animal-orangutan': '66.667% 100%',
  'preset:animal-monkey': '100% 100%',
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
        backgroundSize: '400% 300%',
        backgroundPosition: presetPosition,
      }}
    />
  }

  return <img {...props} className={`object-cover ${className}`} src={profilePic || FALLBACK_PROFILE_PIC} alt={alt || `${name}'s profile picture`} style={style} />
}

export default ProfileAvatar

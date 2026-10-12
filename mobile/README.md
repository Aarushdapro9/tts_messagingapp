# TTS Messaging for iOS

This Expo app is the native mobile version of TTS Messaging. It connects to the deployed API by default and supports email registration/login, the global chat, the user directory, direct chats, and sending messages.

## Run it on an iPhone

1. Install [Expo Go](https://expo.dev/go) on the iPhone.
2. In this folder, run `npm install` and then `npm start`.
3. Scan the QR code with the iPhone camera and open it in Expo Go.

The default API is `https://tts-messagingapp-brown.vercel.app`. To point at a different deployment, copy `.env.example` to `.env` and change `EXPO_PUBLIC_API_URL`, then restart Expo.

## Create an iOS build

Install and log into the Expo Application Services CLI, then run `npx eas build --platform ios`. An Apple Developer account is required to distribute through TestFlight or the App Store. Change `ios.bundleIdentifier` in `app.json` before a store build if `com.aarush.ttsmessaging` is not your Apple bundle identifier.

Google sign-in is intentionally not shown in this first native build. It requires an iOS OAuth client ID and a matching URL scheme in Google Cloud, not the web client ID used by the website.

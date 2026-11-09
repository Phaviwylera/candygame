# Astra Grove

Astra Grove is an original, touch-friendly match-three puzzle with a quiet night-sky art direction. It is an installable progressive web app and has a Capacitor Android shell.

## Run locally

Install Node.js 20.19+ and Java 21, then run:

```sh
npm install
npm run dev
npm test
npm run build
```

## Android

Install Android Studio and Android SDK Platform 36, then run `npm run android:sync` and open the `android/` project in Android Studio. The generated project targets API 36.

AdMob is wired to request consent before loading an interstitial at a natural break after every four completed rounds. The repository currently uses Google's demo app and ad unit IDs. These only serve test ads and earn no revenue. Before release, create an AdMob app and ad unit; replace the app ID in `android/app/src/main/res/values/strings.xml` and interstitial ID in `src/ads.js`. Test on a registered device, and never click live ads during development.

Before a Play release, verify the public privacy policy and developer support contact; complete Play Console's Data safety, ads, and content declarations; prepare store screenshots and a feature graphic; sign an Android App Bundle; and complete the testing track. New personal developer accounts may need 12 opted-in closed testers for 14 continuous days before production access.

## Game rules

Match three or more pieces, build cascades, and reach 900 stardust within 24 moves. Four-piece matches create a row or column clearer; five-piece matches create a wild piece that clears its color. The game supports touch, swipes, keyboard play, mute, and restart.

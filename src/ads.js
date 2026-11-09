import { AdMob, AdmobConsentStatus, InterstitialAdPluginEvents } from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";

const TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
let initialized = false;
let prepared = false;

export async function prepareGameBreakAd() {
  if (Capacitor.getPlatform() !== "android" || !Capacitor.isNativePlatform()) return;
  try {
    let consent = await AdMob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) consent = await AdMob.showConsentForm();
    if (!consent.canRequestAds) return;
    if (!initialized) {
      await AdMob.initialize();
      initialized = true;
      await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        prepared = false;
        void prepareGameBreakAd();
      });
    }
    await AdMob.prepareInterstitial({ adId: TEST_INTERSTITIAL });
    prepared = true;
  } catch {
    // Ads are optional; a load or consent failure never interrupts the puzzle.
  }
}

export async function showGameBreakAd() {
  if (!prepared || Capacitor.getPlatform() !== "android") return;
  prepared = false;
  try { await AdMob.showInterstitial(); } catch { /* The game remains available. */ }
}

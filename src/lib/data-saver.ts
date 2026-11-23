/**
 * Data saver (#216, phase 1, low-data mode): for students on mobile data.
 * While it's on, lesson images and videos load only when tapped and course
 * cover photos are left out.
 *
 * The choice is per device, in the `nexa_data_saver` cookie, so the server
 * knows it before rendering and no image starts loading first:
 *
 *   on | off   the user's choice
 *   (none)     automatic: on when the browser sends `Save-Data: on`
 *              (Android's and Chrome's data saver)
 *
 * Offline reading (the service worker) is A's and comes later.
 *
 * Pure: safe in server and client components and in scripts.
 */

export const DATA_SAVER_COOKIE = "nexa_data_saver";
export const DATA_SAVER_CHOICES = ["auto", "on", "off"] as const;
export type DataSaverChoice = (typeof DATA_SAVER_CHOICES)[number];

export function readDataSaverChoice(v: string | null | undefined): DataSaverChoice {
  return v === "on" || v === "off" ? v : "auto";
}

/** Whether the browser asked to save data (the `Save-Data` request header). */
export const saveDataRequested = (header: string | null | undefined) => (header ?? "").trim().toLowerCase() === "on";

export function dataSaverOn(choice: DataSaverChoice, saveDataHint: boolean): boolean {
  return choice === "on" || (choice === "auto" && saveDataHint);
}

/** The cookie string that stores a choice; "auto" clears it. */
export function dataSaverCookie(choice: DataSaverChoice): string {
  return choice === "auto"
    ? `${DATA_SAVER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    : `${DATA_SAVER_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Inline script for <head> (next to the theme script): puts
 * data-saver="on" on <html> before anything is drawn, from the cookie or
 * the browser's own data saver. Public pages are static, so the server
 * can't decide there. StockPhoto hides its photo's box under that
 * attribute, and a lazy image in a hidden box is never fetched.
 */
export const dataSaverBootScript = `try{var m=document.cookie.match(/(?:^|; )${DATA_SAVER_COOKIE}=(on|off)/),c=navigator.connection;if(m?m[1]==="on":c&&c.saveData){document.documentElement.dataset.saver="on"}}catch(e){}`;

/** "photo.jpg" from a URL, for the placeholder's label; "" when there's none. */
export function fileNameOf(src: string): string {
  try {
    const path = new URL(src, "https://x.invalid").pathname;
    return decodeURIComponent(path.split("/").pop() ?? "");
  } catch {
    return "";
  }
}

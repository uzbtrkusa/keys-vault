export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser =
    /edg\//i.test(ua) ? "Edge" :
    /chrome\//i.test(ua) && !/edg\//i.test(ua) ? "Chrome" :
    /firefox\//i.test(ua) ? "Firefox" :
    /safari\//i.test(ua) && !/chrome\//i.test(ua) ? "Safari" :
    "Browser";
  const os =
    /windows/i.test(ua) ? "Windows" :
    /android/i.test(ua) ? "Android" :
    /iphone|ipad|ipod/i.test(ua) ? "iOS" :
    /macintosh/i.test(ua) ? "macOS" :
    /linux/i.test(ua) ? "Linux" :
    "device";
  return `${browser} on ${os}`;
}

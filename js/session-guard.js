// Absolute session timeout for signed-in client/master pages.
//
// Firebase's own ID tokens refresh silently in the background for as long
// as the browser holds a valid refresh token -- left alone, a signed-in
// session never expires on its own. This layers a fixed 4-hour cap on top,
// tracked by a plain timestamp in localStorage rather than anything from
// Firebase, so it works the same regardless of activity.
export var SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;

var STORAGE_KEY = "nkmw-session-start";

// Call this right after a *fresh* sign-in succeeds (password sign-in,
// signup email verification, or the password-reset auto-sign-in on
// login.html) -- never from a passive onAuthStateChanged listener, since
// those also fire for an already-signed-in returning visitor and would
// keep pushing the 4-hour clock forward on every page load.
export function startSession() {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

// Call from every protected page's onAuthStateChanged, once a verified user
// is present. Returns true (and starts signing the user out) if the 4-hour
// window has elapsed, in which case the caller should stop what it was
// doing. Otherwise schedules its own timer so a tab left open gets kicked
// to login.html right at the 4-hour mark, not just on the next reload.
export function enforceSessionTimeout(auth, signOut) {
  var raw;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
  var start = raw ? Number(raw) : NaN;

  if (!start || isNaN(start)) {
    // No timestamp on file -- e.g. a session that pre-dates this feature.
    // Start the clock now rather than guessing how old it already is.
    startSession();
    start = Date.now();
  }

  function expire() {
    clearSession();
    signOut(auth).then(function () {
      window.location.replace("login.html?expired=1");
    });
  }

  var remaining = SESSION_TIMEOUT_MS - (Date.now() - start);
  if (remaining <= 0) {
    expire();
    return true;
  }
  setTimeout(expire, remaining);
  return false;
}

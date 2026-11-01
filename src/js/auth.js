const GOOGLE_OAUTH_CLIENT_ID = '65097864960-vbe2ukqcoi9mpqc9capgtu9mak6vf4qs.apps.googleusercontent.com';
const LOGIN_HISTORY_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_VERIFIED_TTL_MS = 10 * 60 * 1000;

const CONFIG = {
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbynzAVfuPKHqT9jkKX-JPh5l42JCbR6d6d0sb9PT_TAilMhtDSY2PW2hOMdEPEMXBgT/exec",
  STORAGE_KEYS: {
    IS_LOGGED_IN: "higopella_is_logged_in",
    IS_ADMIN: "higopella_is_admin",
    ID_TOKEN: "higopella_id_token",
    LAST_ACCESS_TIME: "higopella_last_access_time",
    LAST_LOGIN_AT: "higopella_last_login_at",
    ROLES: "higopella_roles",
    SESSION_VERIFIED_AT: "higopella_session_verified_at"
  }
};

let currentIdToken = sessionStorage.getItem(CONFIG.STORAGE_KEYS.ID_TOKEN) || '';

function setCurrentIdToken(idToken) {
  currentIdToken = typeof idToken === 'string' ? idToken : '';
  if (currentIdToken) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.ID_TOKEN, currentIdToken);
  } else {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.ID_TOKEN);
  }
}

function getCurrentIdToken() {
  return currentIdToken;
}

function clearCurrentIdToken() {
  setCurrentIdToken('');
}

function checkUserLogin() {
  return Boolean(getCurrentIdToken()) && sessionStorage.getItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN) === "true";
}

function setUserLogin(status) {
  if (status) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN, "true");
  } else {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.IS_LOGGED_IN);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION_VERIFIED_AT);
    clearCurrentIdToken();
  }
  syncDrawerLogoutVisibility();
}

function checkAdminLogin() {
  return sessionStorage.getItem(CONFIG.STORAGE_KEYS.IS_ADMIN) === "true";
}

function setAdminLogin(status) {
  if (status) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.IS_ADMIN, "true");
    return;
  }
  sessionStorage.removeItem(CONFIG.STORAGE_KEYS.IS_ADMIN);
}

function setUserRoles(roles) {
  const normalized = Array.isArray(roles) ? roles : [];
  if (normalized.length > 0) {
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.ROLES, JSON.stringify(normalized));
  } else {
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.ROLES);
  }
  setAdminLogin(normalized.indexOf('admin') !== -1);
}

function getUserRoles() {
  try {
    const raw = sessionStorage.getItem(CONFIG.STORAGE_KEYS.ROLES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function hasRole(role) {
  const roles = getUserRoles();
  if (roles.indexOf('admin') !== -1) return true;
  return roles.indexOf(role) !== -1;
}

function markSessionVerified() {
  sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_VERIFIED_AT, String(Date.now()));
}

function isSessionRecentlyVerified() {
  const raw = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_VERIFIED_AT);
  if (!raw) return false;
  const verifiedAt = Number(raw);
  return Number.isFinite(verifiedAt) && Date.now() - verifiedAt <= SESSION_VERIFIED_TTL_MS;
}

function logoutUser() {
  clearCurrentIdToken();
  setUserLogin(false);
  setAdminLogin(false);
  clearLoginHistory();
  window.location.replace(window.location.pathname.includes('/portal_test/') ? '/portal_test/' : '/');
}

function recordLoginHistory() {
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_LOGIN_AT, String(Date.now()));
}

function clearLoginHistory() {
  localStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_LOGIN_AT);
}

function hasValidLoginHistory() {
  const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_LOGIN_AT);
  if (!raw) return false;
  const lastLoginAt = Number(raw);
  return Number.isFinite(lastLoginAt) && Date.now() - lastLoginAt <= LOGIN_HISTORY_TTL_MS;
}

let gisInitialized = false;
let gisCredentialHandler = null;

function initGoogleIdentity(callback) {
  if (!window.google || !google.accounts || !google.accounts.id) return false;
  gisCredentialHandler = callback;
  if (!gisInitialized) {
    gisInitialized = true;
    google.accounts.id.initialize({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      auto_select: !shouldSkipAutoAuth(),
      callback: (response) => {
        if (gisCredentialHandler) gisCredentialHandler(response);
      }
    });
  }
  return true;
}

function waitForGisReady(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (window.google && google.accounts && google.accounts.id) {
      resolve(true);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (window.google && google.accounts && google.accounts.id) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

function requestSilentIdToken(timeoutMs = 6000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (token) => {
      if (settled) return;
      settled = true;
      resolve(token);
    };
    if (!initGoogleIdentity((response) => finish(response && response.credential ? response.credential : null))) {
      finish(null);
      return;
    }
    try {
      google.accounts.id.prompt(() => {});
    } catch (error) {
      finish(null);
      return;
    }
    setTimeout(() => finish(null), timeoutMs);
  });
}

function shouldSkipAutoAuth() {
  return document.body && document.body.dataset.skipAutoAuth === 'true';
}

async function trySilentReauth() {
  if (shouldSkipAutoAuth()) return false;
  if (!hasValidLoginHistory()) return false;
  if (!await waitForGisReady()) return false;
  const token = await requestSilentIdToken();
  if (!token) return false;
  setCurrentIdToken(token);
  return true;
}

async function verifySessionWithGas() {
  try {
    const result = await callGasApi('authenticateGoogle', { idToken: getCurrentIdToken() });
    if (result.status === 'authenticated') {
      setUserLogin(true);
      setUserRoles(result.user && Array.isArray(result.user.roles) ? result.user.roles : (result.user && result.user.role ? [result.user.role] : []));
      recordLoginHistory();
      markSessionVerified();
      return true;
    }
  } catch (error) {
    // Treat communication and authentication failures as logged out.
  }
  clearCurrentIdToken();
  setUserLogin(false);
  return false;
}

function syncDrawerLogoutVisibility() {
  const logoutFooter = document.querySelector('.drawer-footer');
  if (logoutFooter) logoutFooter.hidden = !checkUserLogin();
}

async function requirePageAuthentication() {
  const homePath = window.location.pathname.includes('/portal_test/') ? '/portal_test/' : '/';
  if (!getCurrentIdToken()) {
    await trySilentReauth();
  }

  if (!getCurrentIdToken()) {
    window.location.replace(homePath);
    return false;
  }

  if (isSessionRecentlyVerified()) return true;

  if (await verifySessionWithGas()) return true;

  window.location.replace(homePath);
  return false;
}
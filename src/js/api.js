// 環境判定: URLの先頭セグメントで自動判別（/portal_test/ → test、それ以外 → production、file:// → test）
const SITE_ENV = (function () {
  if (window.location.protocol === 'file:') return 'test';
  return window.location.pathname.indexOf('/portal_test/') === 0 ? 'test' : 'production';
})();

const GAS_API_URLS = {
  test: "https://script.google.com/macros/s/AKfycbynzAVfuPKHqT9jkKX-JPh5l42JCbR6d6d0sb9PT_TAilMhtDSY2PW2hOMdEPEMXBgT/exec",
  production: "https://script.google.com/macros/s/AKfycbynzAVfuPKHqT9jkKX-JPh5l42JCbR6d6d0sb9PT_TAilMhtDSY2PW2hOMdEPEMXBgT/exec" // TODO: 本番用GASのURLに差し替える
};

function getSiteBasePath() {
  if (window.location.protocol === 'file:') return '/';
  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
  return firstSegment ? '/' + firstSegment + '/' : '/';
}

async function callGasApi(action, data = {}) {
  try {
    const payload = { action: action, data: data };
    const idToken = typeof getCurrentIdToken === "function" ? getCurrentIdToken() : "";
    if (idToken) payload.auth = { idToken: idToken };
    const response = await fetch(CONFIG.GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[GAS通信エラー] action: ${action}`, error);
    throw error;
  }
}
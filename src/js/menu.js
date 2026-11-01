/**
 * Higo-Pella Portal 共通スクリプト (src/js/menu.js)
 */

function initCommonLayout(activeKey = "") {
  const depth = activeKey === "home" ? 0 : (activeKey.indexOf("role-") === 0 ? 2 : 1);
  const basePath = depth === 0 ? "./" : "../".repeat(depth);

  const menuItems = [
    { key: "home", title: "ホーム", href: `${basePath}` },
    { key: "booking", title: "練習予約", href: `${basePath}booking/` },
    { key: "meeting", title: "部会", href: `${basePath}meeting/` },
    { key: "live", title: "Higopelive!!", href: `${basePath}live/` },
    { key: "score", title: "Score", href: `${basePath}score/` },
    { key: "searchYT", title: "YouTube検索", href: `${basePath}searchYT/` },
    { key: "forms", title: "フォーム", href: `${basePath}forms/` }
  ];

  const layoutHtml = `
    <header class="site-header">
      <button type="button" class="btn-menu" id="btn-open-drawer" aria-label="メニューを開く">☰</button>
      <a href="${basePath}" class="site-logo">
        <span>Higo-Pella Portal</span>
      </a>
      <button type="button" class="site-tour-button" id="btn-tour" aria-label="使い方の案内">？</button>
      <button type="button" class="site-refresh-button" id="btn-site-refresh" aria-label="ページを更新">更新</button>
    </header>

    <div class="drawer-overlay" id="drawer-overlay"></div>

    <nav class="drawer-menu" id="drawer-menu" aria-label="メインメニュー">
      <div class="drawer-header">
        <span class="drawer-title">メニュー</span>
        <button type="button" class="btn-close" id="btn-close-drawer" aria-label="メニューを閉じる">×</button>
      </div>
      <ul class="drawer-nav">
        ${menuItems
          .map(
            (item) =>
              `<li><a href="${item.href}" class="${item.key === activeKey ? "current" : ""}">${escapeHtml(item.title)}</a></li>`
          )
          .join("")}
      </ul>
      <div class="drawer-admin">
        <a href="${basePath}role/" class="${activeKey === "role" || activeKey.indexOf("role-") === 0 ? "current" : ""}">管理者</a>
      </div>
      <div class="drawer-footer">
        <a href="#" class="drawer-logout-link" id="btn-drawer-logout">ログアウト</a>
      </div>
    </nav>

    <button type="button" class="btn-scroll-top" id="btn-scroll-top" aria-label="ページ最上部へスクロール">↑</button>
  `;

  document.body.insertAdjacentHTML("afterbegin", layoutHtml);

  if (typeof syncDrawerLogoutVisibility === "function") {
    syncDrawerLogoutVisibility();
  }

  const openDrawerBtn = document.getElementById("btn-open-drawer");
  const closeDrawerBtn = document.getElementById("btn-close-drawer");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const logoutBtn = document.getElementById("btn-drawer-logout");
  const siteRefreshBtn = document.getElementById("btn-site-refresh");

  if (openDrawerBtn) {
    openDrawerBtn.addEventListener("click", () => toggleDrawerMenu(true));
  }
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener("click", () => toggleDrawerMenu(false));
  }
  if (drawerOverlay) {
    drawerOverlay.addEventListener("click", () => toggleDrawerMenu(false));
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("ログアウトしますか？")) logoutUser();
    });
  }
  if (siteRefreshBtn) {
    siteRefreshBtn.addEventListener("click", async () => {
      if (typeof clearScheduleDeviceCache === "function") await clearScheduleDeviceCache();
      if (typeof clearNoticeDeviceCache === "function") await clearNoticeDeviceCache();
      window.location.reload();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleDrawerMenu(false);
  });

  initScrollTopButton();
  recordPageAccess();
}

const ACCESS_COUNT_INTERVAL_MS = 30 * 60 * 1000;

function recordPageAccess() {
  if (typeof callGasApi !== "function") return;
  const now = Date.now();
  const lastRaw = localStorage.getItem("higopella_last_access_count");
  const last = Number(lastRaw);
  if (lastRaw && Number.isFinite(last) && now - last < ACCESS_COUNT_INTERVAL_MS) return;
  localStorage.setItem("higopella_last_access_count", String(now));
  callGasApi('recordAccess').catch(() => {});
}

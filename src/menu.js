// 全ページ共通のハンバーガーメニュー生成と、アクセス解析を行うスクリプト

function injectMenu(basePath) {
  const menuHTML = `
    <div class="drawer-overlay" id="drawer-overlay" onclick="toggleDrawer()"></div>
    <div class="drawer" id="drawer">
      <button class="drawer-close" onclick="toggleDrawer()">×</button>
      <div>
        <a href="${basePath}booking/" class="drawer-item">予約</a>
        <a href="${basePath}searchYT/" class="drawer-item">映像</a>
        <a href="${basePath}forms/" class="drawer-item">Forms</a>
      </div>
      <a href="${basePath}admin/" class="drawer-item" style="margin-top: auto; margin-bottom: 20px; color: var(--primary-dark); border-top: 1px solid var(--border);">管理者</a>
    </div>
  `;
  document.getElementById('global-menu-container').innerHTML = menuHTML;
}

function toggleDrawer() { 
  document.getElementById('drawer').classList.toggle('open'); 
  document.getElementById('drawer-overlay').classList.toggle('open'); 
}

// ★追加：アクセス数を計測する関数（1時間以上空いた場合のみカウント）
function trackAccess(gasUrl) {
  const now = new Date().getTime();
  const lastAccess = localStorage.getItem('lastAccessTime');
  
  // 3600000ミリ秒 = 1時間。初回、または1時間以上経過している場合
  if (!lastAccess || (now - parseInt(lastAccess)) > 3600000) {
    // 画面の動作を止めないようにバックグラウンドでこっそり送信（awaitしない）
    fetch(gasUrl, {
      method: "POST",
      body: JSON.stringify({ action: "recordAccess" })
    }).catch(e => {}); 
  }
  // 操作中は常に「今」の時間をメモに残す
  localStorage.setItem('lastAccessTime', now.toString());
}

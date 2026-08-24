// 全ページ共通のハンバーガーメニューを動的に生成するスクリプト
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
      <!-- 管理者ボタンがスマホで欠けないように margin-bottom: 20px を追加 -->
      <a href="${basePath}admin/" class="drawer-item" style="margin-top: auto; margin-bottom: 20px; color: var(--primary-dark); border-top: 1px solid var(--border);">管理者</a>
    </div>
  `;
  document.getElementById('global-menu-container').innerHTML = menuHTML;
}

function toggleDrawer() { 
  document.getElementById('drawer').classList.toggle('open'); 
  document.getElementById('drawer-overlay').classList.toggle('open'); 
}

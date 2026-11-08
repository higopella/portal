/**
 * ページガイドツアー (src/js/tour.js)
 * JIZURA方式の自作実装：暗転スポット＋説明バブル
 */

const TOUR_STEPS = {
	home: [
		{ target: '#btn-open-drawer', title: 'メニュー', text: 'ここから各ページへ移動します' },
		{ target: '.home-notices', title: 'お知らせ', text: 'サークルからの連絡がここに出ます' },
		{ target: '.home-calendar', title: 'カレンダー', text: '練習予約や部会の予定が見えます。予定をタップすると詳細が開きます' },
		{ target: '#btn-site-refresh', title: '更新', text: '情報を最新の状態にします' }
	],
	booking: [
		{ target: '[data-schedule-calendar]', title: 'カレンダー', text: '予定や部室の空き枠を確認できます' },
		{ target: '.schedule-booking-link', title: 'カレンダーの＋ボタン', text: '練習場所の予約へ進みます' },
		{ target: '#tab-btn-create', title: '新規予約', text: '新規予約ができます' },
		{ target: '#tab-btn-search', title: '予約削除', text: '予約の削除ができます' }
	],
	searchYT: [
		{ target: '#select-playlist', title: 'カテゴリ', text: '動画の種類で絞り込めます' },
		{ target: '#input-search', title: '検索', text: 'タイトルで曲を探せます' },
		{ target: '.tab-nav', title: '種別タブ', text: '通常動画とShortsを切り替えられます' },
		{ target: '#video-list', title: '動画一覧', text: '検索結果がここに並びます' }
	],
	forms: [
		{ target: '#google-form-iframe', title: '報告フォーム', text: 'このフォームに内容を入力して送信します' }
	],
	live: [
		{ target: '#live-basic-section', title: '基本情報（必須）', text: '必要な情報を入力してください' },
		{ target: '#live-pa-section', title: 'PA表', text: '演者の順番・パート・要望やマイクの持ち込み情報を入力します' },
		{ target: '#light-section', title: '照明表', text: 'イメージカラー・要望情報を入力します', optional: true }
	],
	role: [
		{ target: '#role-select-buttons', title: '権限ページ選択', text: '持っている権限のページへここから移動します。ログイン中は次回から自動で移動します' }
	],
	'role-admin': [
		{ target: '.admin-tabs', title: '管理メニュー', text: 'お知らせの追加・ユーザー管理など、担当の機能をタブで切り替えます' },
		{ target: '#role-switcher', title: '権限切替', text: '複数の権限を持つ場合はここでページを切り替えられます', optional: true }
	],
	'role-kanbu': [
		{ target: '.admin-tabs', title: '管理メニュー', text: '予約管理・ログ・ユーザー管理など、担当の機能をタブで切り替えます' },
		{ target: '#role-switcher', title: '権限切替', text: '複数の権限を持つ場合はここでページを切り替えられます', optional: true }
	],
	'role-higopelive': [
		{ target: '.admin-tabs', title: 'Higopelive!!メニュー', text: 'ライブの作成と申請の確認をタブで切り替えます' },
		{ target: '#role-switcher', title: '権限切替', text: '複数の権限を持つ場合はここでページを切り替えられます', optional: true }
	],
	signup: [
		{ target: '#signup-google-panel', title: 'Google認証', text: 'Googleアカウントで認証します' },
		{ target: '#signup-school-email', title: '大学メール', text: '大学のメールアドレスを入力します' },
		{ target: '#btn-request-otp', title: 'パスキー送信', text: '届いた6桁の確認コードを次の画面で入力します' }
	]
};

const TOUR_DONE_PREFIX = 'higopella_tour_done_';
let tourCurrentIndex = -1;
let tourActiveSteps = [];

function getTourSteps(pageKey) {
	const steps = TOUR_STEPS[pageKey] || [];
	return steps.filter((step) => {
		const el = step.target ? document.querySelector(step.target) : null;
		if (!el) return !step.optional;
		// 非表示（親含む）の要素はスキップする
		if (el.hidden || el.offsetParent === null) return false;
		return true;
	}).map((step) => ({ ...step, el: document.querySelector(step.target) }));
}

function isTourDone(pageKey) {
	try {
		return localStorage.getItem(TOUR_DONE_PREFIX + pageKey) === '1';
	} catch (e) { return true; }
}

function markTourDone(pageKey) {
	try {
		localStorage.setItem(TOUR_DONE_PREFIX + pageKey, '1');
	} catch (e) {}
}

function createTourDom() {
	if (document.getElementById('portal-tour')) return;
	document.body.insertAdjacentHTML('beforeend', `
		<div id="portal-tour" class="tour" hidden role="dialog" aria-modal="true" aria-labelledby="tourTitle">
			<div class="tour-spot"></div>
			<div class="tour-bub">
				<div class="tour-step"></div>
				<h3 id="tourTitle" class="tour-title"></h3>
				<p class="tour-text"></p>
				<div class="tour-nav">
					<button type="button" class="tour-skip btn small-action-button">スキップ</button>
					<span class="tour-sp"></span>
					<button type="button" class="tour-prev btn small-action-button">戻る</button>
					<button type="button" class="tour-next btn btn-primary small-action-button">次へ</button>
				</div>
			</div>
		</div>
	`);
	const root = document.getElementById('portal-tour');
	root.querySelector('.tour-next').addEventListener('click', () => tourShowStep(tourCurrentIndex + 1));
	root.querySelector('.tour-prev').addEventListener('click', () => tourShowStep(tourCurrentIndex - 1));
	root.querySelector('.tour-skip').addEventListener('click', tourEndStep);
	document.addEventListener('keydown', (e) => {
		if (tourCurrentIndex < 0) return;
		if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); tourShowStep(tourCurrentIndex + 1); }
		else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); tourShowStep(tourCurrentIndex - 1); }
		else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); tourEndStep(); }
	}, true);
	window.addEventListener('resize', () => { if (tourCurrentIndex >= 0) tourPlaceBubble(tourActiveSteps[tourCurrentIndex]); });
	window.addEventListener('scroll', () => { if (tourCurrentIndex >= 0) tourPlaceBubble(tourActiveSteps[tourCurrentIndex]); }, true);
}

function tourStartPage(pageKey) {
	createTourDom();
	tourActiveSteps = getTourSteps(pageKey);
	if (tourActiveSteps.length === 0) return;
	tourActiveSteps._pageKey = pageKey;
	tourShowStep(0);
}

function tourShowStep(index) {
	const root = document.getElementById('portal-tour');
	if (index < 0 || index >= tourActiveSteps.length) {
		tourEndStep();
		return;
	}
	tourCurrentIndex = index;
	const step = tourActiveSteps[index];
	root.hidden = false;
	root.querySelector('.tour-step').textContent = `${index + 1} / ${tourActiveSteps.length}`;
	root.querySelector('.tour-title').textContent = step.title;
	root.querySelector('.tour-text').textContent = step.text;
	root.querySelector('.tour-prev').disabled = index === 0;
	root.querySelector('.tour-next').textContent = index === tourActiveSteps.length - 1 ? 'はじめる' : '次へ';
	tourScrollToStep(step);
	requestAnimationFrame(() => tourPlaceBubble(step));
	root.querySelector('.tour-next').focus();
}

function tourScrollToStep(step) {
	if (!step || !step.el) return;
	const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
	const offset = headerHeight + 12;
	const rect = step.el.getBoundingClientRect();
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	// 枠が全て見えている場合は center で表示
	const visible = rect.top >= offset && rect.bottom <= vh - 8 && rect.left >= 0 && rect.right <= vw;
	if (visible) {
		step.el.scrollIntoView({ block: 'center', behavior: 'auto' });
		return;
	}
	// 見切れている場合は最上部に表示（ヘッダーに隠れないようオフセット付き）
	const targetTop = window.scrollY + rect.top - offset;
	window.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
}

function tourPlaceBubble(step) {
	const root = document.getElementById('portal-tour');
	const spot = root.querySelector('.tour-spot');
	const bub = root.querySelector('.tour-bub');
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
	const offset = headerHeight + 12;
	const pad = 6;
	const rect = step && step.el ? step.el.getBoundingClientRect() : { left: vw / 2, top: vh / 2, width: 0, height: 0, right: vw / 2, bottom: vh / 2 };
	const x0 = Math.max(4, rect.left - pad);
	const y0 = Math.max(4, rect.top - pad);
	const x1 = Math.min(vw - 4, rect.right + pad);
	const y1 = Math.min(vh - 4, rect.bottom + pad);
	Object.assign(spot.style, { left: x0 + 'px', top: y0 + 'px', width: Math.max(0, x1 - x0) + 'px', height: Math.max(0, y1 - y0) + 'px' });
	const bw = bub.offsetWidth;
	const bh = bub.offsetHeight;
	const gap = 12;
	// 枠の下部が見切れる場合は上部に表示
	let top;
	if (rect.bottom + gap + bh <= vh - 8) {
		top = rect.bottom + gap;
	} else if (rect.top - gap - bh >= offset) {
		top = rect.top - gap - bh;
	} else {
		top = Math.max(offset, vh - bh - 8);
	}
	let left = Math.min(Math.max(8, x0 + (x1 - x0) / 2 - bw / 2), vw - bw - 8);
	Object.assign(bub.style, { top: top + 'px', left: left + 'px' });
}

function tourEndStep() {
	const root = document.getElementById('portal-tour');
	if (root) root.hidden = true;
	if (tourActiveSteps._pageKey) markTourDone(tourActiveSteps._pageKey);
	tourCurrentIndex = -1;
	tourActiveSteps = [];
}

function initPageTour(pageKey) {
	const btn = document.getElementById('btn-tour');
	if (!btn) return;
	const canUse = typeof checkUserLogin === 'function' ? checkUserLogin() : false;
	btn.style.display = canUse ? '' : 'none';
	if (!canUse) return;
	btn.addEventListener('click', () => tourStartPage(pageKey));
}

initCommonLayout('home');

let homeScheduleController = null;
let noticeRequestId = 0;
let homeDataLoaded = false;

function renderHomeView() {
	const loginSec = document.getElementById('login-section');
	const mainSec = document.getElementById('main-section');
	if (!loginSec || !mainSec) return;

	if (checkUserLogin()) {
		loginSec.style.display = 'none';
		mainSec.style.display = 'flex';
		if (!homeDataLoaded) {
			homeDataLoaded = true;
			calcNextMeeting();
			loadHomeDataInOrder();
		}
	} else if (!getCurrentIdToken()) {
		loginSec.style.display = 'block';
		mainSec.style.display = 'none';
		setLoginStatus('Googleログインをお待ちください。');
	}
}

document.addEventListener('DOMContentLoaded', async () => {
	initPageTour('home');
	let hasAuthenticatedSession = false;
	if (getCurrentIdToken() || hasValidLoginHistory()) {
		setLoginStatus('ログイン状態を確認しています...', 'loading');
		if (!getCurrentIdToken()) {
			await trySilentReauth();
		}
		if (getCurrentIdToken()) {
			hasAuthenticatedSession = await verifySessionWithGas();
		}
	}
	initializeGoogleLogin(hasAuthenticatedSession);

	renderHomeView();
});
window.addEventListener('pageshow', renderHomeView);

async function loadHomeDataInOrder() {
	fetchNotices();
	setTimeout(() => initializeHomeScheduleCalendar(), 500);
}

function initializeGoogleLogin(hasAuthenticatedSession = false) {
	const buttonContainer = document.getElementById('google-login-button');
	if (!buttonContainer) return;
	if (!initGoogleIdentity(handleGoogleCredential)) {
		setLoginStatus('Googleログインを準備しています。');
		const googleScript = document.getElementById('google-identity-script');
		if (googleScript) googleScript.addEventListener('load', initializeGoogleLogin, { once: true });
		return;
	}

	google.accounts.id.renderButton(buttonContainer, { theme: 'outline', size: 'large', width: 280 });
	if (!hasAuthenticatedSession) setLoginStatus('Googleアカウントでログインしてください。');
}

function setLoginStatus(message, type = '') {
	const status = document.getElementById('login-status');
	if (!status) return;
	status.textContent = message;
	status.className = `login-status${type ? ` is-${type}` : ''}`;
}

async function handleGoogleCredential(response) {
	if (!response || !response.credential) {
		setLoginStatus('Google認証に失敗しました。', 'error');
		showToast('Google認証に失敗しました', 'error');
		return;
	}

	setLoginStatus('認証情報を確認しています...', 'loading');
	setCurrentIdToken(response.credential);
	try {
		const result = await callGasApi('authenticateGoogle', { idToken: response.credential });
		if (result.status === 'authenticated') {
			setLoginStatus('認証に成功しました。画面を準備しています...', 'success');
			setUserLogin(true);
			recordLoginHistory();
			showToast('ログインしました');
			renderHomeView();
			return;
		}
		if (result.status === 'unregistered') {
			setLoginStatus('アカウントが未登録のため、登録画面へ移動します...', 'loading');
			window.location.assign('signup/');
			return;
		}
		clearCurrentIdToken();
		setLoginStatus(result.error || 'ログインできません。', 'error');
		showToast(result.error || 'ログインできません', 'error');
	} catch (error) {
		clearCurrentIdToken();
		setLoginStatus('認証通信に失敗しました。もう一度お試しください。', 'error');
		showToast('認証に失敗しました', 'error');
	}
}

function calcNextMeeting() {
	const today = new Date();
	let targetDate = null;

	for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
		let year = today.getFullYear();
		let month = today.getMonth() + monthOffset;
		let tuesdayCount = 0;

		for (let day = 1; day <= 31; day++) {
			let checkDate = new Date(year, month, day);
			if (checkDate.getMonth() !== (month % 12)) break;
			if (checkDate.getDay() === 2) {
				tuesdayCount++;
				if (tuesdayCount === 2) {
					if (checkDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
						targetDate = checkDate;
						break;
					}
				}
			}
		}
		if (targetDate) break;
	}

	if (targetDate) {
		const str = `${targetDate.getMonth() + 1}/${targetDate.getDate()}(火) 18:30〜`;
		document.getElementById('next-meeting-text').textContent = str;
	}
}

function getLocalDateString(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

async function initializeHomeScheduleCalendar() {
	if (homeScheduleController) {
		await homeScheduleController.refresh();
		return;
	}
	const host = document.querySelector('#main-section [data-schedule-calendar]');
	if (!host) return;
	homeScheduleController = await initScheduleCalendar({
		host,
		defaultView: 'day',
		loadEvents: async (start, end, forceRefresh) => {
			const result = await callGasApi('getScheduleEvents', {
				startDate: getLocalDateString(start),
				endDate: getLocalDateString(end),
				forceRefresh
			});
			if (!result.success) throw new Error(result.error || '予定の取得に失敗しました');
			return result.events;
		},
		createEventElement: createHomeScheduleEvent
	});
}

function createHomeScheduleEvent(event, isAllDay) {
	const element = document.createElement('div');
	element.className = `home-schedule-event schedule-event ${getHomeScheduleRoomClass(event.room)}${isAllDay ? ' home-schedule-event-all-day schedule-event-all-day' : ''}`;
	const title = document.createElement('span');
	title.className = 'home-schedule-event-title';
	title.textContent = event.title;
	element.appendChild(title);
	if (event.transferStatus) {
		const transfer = document.createElement('span');
		transfer.className = 'home-schedule-event-transfer';
		transfer.textContent = event.transferStatus;
		element.appendChild(transfer);
	}
	element.addEventListener('click', () => showScheduleEventDetail(event));
	return element;
}

function getHomeScheduleRoomClass(room) {
	if (room === '②') return 'home-schedule-event-equipment schedule-event-equipment';
	if (room === '③') return 'home-schedule-event-classroom schedule-event-classroom';
	if (room === 'メイン') return 'home-schedule-event-main schedule-event-main';
	return 'home-schedule-event-clubroom schedule-event-clubroom';
}

function renderNoticeText(text) {
	const wrapper = document.createElement('div');
	wrapper.className = 'notice-body';
	const str = String(text ?? '');
	const pattern = /\[\[(.*?)\]\]|~~(.*?)~~/g;
	let lastIndex = 0;
	let match;
	while ((match = pattern.exec(str)) !== null) {
		if (match.index > lastIndex) {
			wrapper.appendChild(document.createTextNode(str.slice(lastIndex, match.index)));
		}
		const span = document.createElement('span');
		if (match[1] !== undefined) {
			span.className = 'highlight';
			span.textContent = match[1];
		} else {
			span.className = 'notice-strikethrough';
			span.textContent = match[2];
		}
		wrapper.appendChild(span);
		lastIndex = pattern.lastIndex;
	}
	if (lastIndex < str.length) {
		wrapper.appendChild(document.createTextNode(str.slice(lastIndex)));
	}
	return wrapper;
}

async function fetchNotices() {
	const container = document.getElementById('notice-container');
	const requestId = ++noticeRequestId;
	const cached = await readNoticeDeviceCache();
	if (requestId !== noticeRequestId) return;
	if (cached && cached.version === NOTICE_DEVICE_CACHE_VERSION && Array.isArray(cached.notices)) {
		renderNotices(cached.notices, container);
	}
	try {
		const res = await withNoticeRefreshTimeout(callGasApi('getNotice'));
		if (requestId !== noticeRequestId) return;
		if (!res.success) throw new Error(res.error || 'お知らせの取得に失敗しました');
		await writeNoticeDeviceCache(res.notices || [], requestId);
		renderNotices(res.notices || [], container);
	} catch (e) {
		if (requestId !== noticeRequestId) return;
		if (cached && cached.version === NOTICE_DEVICE_CACHE_VERSION) return;
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'notice-message notice-message-error';
		error.textContent = 'お知らせの取得に失敗しました。再読み込みしてください。';
		container.appendChild(error);
	}
}

function renderNotices(notices, container) {
	container.textContent = '';
	if (notices.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'notice-message';
		empty.textContent = '現在お知らせはありません。';
		container.appendChild(empty);
		return;
	}
	notices.forEach((item) => {
			const notice = document.createElement('div');
			notice.className = `notice-item${item.isPinned ? ' is-pinned' : ''}`;
			const header = document.createElement('div');
			header.className = 'notice-header';
			if (item.isPinned) {
				const pinTag = document.createElement('span');
				pinTag.className = 'notice-pin-tag';
				pinTag.textContent = '[固定]';
				header.appendChild(pinTag);
			}
			const time = document.createElement('span');
			time.textContent = String(item.time ?? '').replace(/:\d{2}$/, '');
			header.appendChild(time);
			const body = renderNoticeText(item.text);
			notice.appendChild(header);
			notice.appendChild(body);
			container.appendChild(notice);
	});
}

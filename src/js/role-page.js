const ROLE_PAGE_KEY = (document.body.dataset.roleKey || 'admin');
const REQUIRED_ROLE = (document.body.dataset.requiredRole || ROLE_PAGE_KEY);

initCommonLayout(`role-${ROLE_PAGE_KEY}`);

const ROLE_SWITCH_PAGES = [
	{ role: 'kanbu', label: '幹部', href: '../kanbu/' },
	{ role: 'higopelive', label: 'Higopelive!!', href: '../higopelive/' },
	{ role: 'admin', label: '管理者', href: '../admin/' }
];

document.addEventListener('DOMContentLoaded', async () => {
	initPageTour(`role-${ROLE_PAGE_KEY}`);
	showChecking();
	bindRolePageEvents();
	if (!await requirePageAuthentication()) return;
	if (hasRole(REQUIRED_ROLE)) {
		showDashboard();
	} else {
		showAccessDenied();
	}
});

function bindRolePageEvents() {
	const on = (id, event, handler) => {
		const el = document.getElementById(id);
		if (el) el.addEventListener(event, handler);
	};
	on('form-add-notice', 'submit', (e) => {
		e.preventDefault();
		handleAddNotice();
	});
	on('btn-insert-highlight', 'click', () => wrapNoticeSelection('[[', ']]'));
	on('btn-insert-strike', 'click', () => wrapNoticeSelection('~~', '~~'));
	on('btn-cancel-edit', 'click', cancelEditNotice);
	on('btn-refresh-all', 'click', loadDashboardData);
	on('form-main-event', 'submit', (e) => {
		e.preventDefault();
		handleAddMainEvent();
	});
	on('main-event-all-day', 'change', (e) => {
		document.getElementById('main-event-time-row').classList.toggle('is-hidden', e.target.checked);
	});
	on('btn-admin-search-events', 'click', handleAdminSearchEvents);
	on('btn-save-rooms', 'click', handleSaveRooms);
	on('btn-issue-invite', 'click', handleIssueInviteCode);
	on('btn-create-live', 'click', handleCreateLive);
	on('btn-print-pa', 'click', (e) => downloadHigopelivePdf('pa', e.currentTarget));
	on('btn-print-light', 'click', (e) => downloadHigopelivePdf('light', e.currentTarget));
	on('btn-batch-pa', 'click', (e) => downloadAllHigopelivePdf('pa', e.currentTarget));
	on('btn-batch-light', 'click', (e) => downloadAllHigopelivePdf('light', e.currentTarget));
	document.querySelectorAll('.admin-tab').forEach((tab) => {
		tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
	});
	const deleteDate = document.getElementById('admin-delete-date');
	if (deleteDate) deleteDate.value = getScheduleDateString(new Date());
}

function renderRoleSwitcher() {
	const container = document.getElementById('role-switcher');
	if (!container || typeof hasRole !== 'function') return;
	const available = ROLE_SWITCH_PAGES.filter((page) => hasRole(page.role));
	if (available.length < 2) return;
	available.forEach((page) => {
		const link = document.createElement('a');
		link.className = 'role-switch-link' + (page.role === REQUIRED_ROLE ? ' current' : '');
		link.href = page.href;
		link.textContent = page.label;
		container.appendChild(link);
	});
	const selectLink = document.createElement('a');
	selectLink.className = 'role-switch-link';
	selectLink.href = '../';
	selectLink.textContent = '選択画面へ';
	selectLink.addEventListener('click', () => {
		sessionStorage.removeItem('higopella_role_page');
	});
	container.appendChild(selectLink);
	container.classList.remove('is-hidden');
}

function switchAdminTab(tabKey) {
	document.querySelectorAll('.admin-tab').forEach((tab) => {
		tab.classList.toggle('active', tab.dataset.tab === tabKey);
	});
	document.querySelectorAll('.admin-tab-panel').forEach((panel) => {
		panel.classList.toggle('is-hidden', panel.id !== `tab-${tabKey}`);
	});
}

function showChecking() {
	document.getElementById('admin-checking-section').style.display = 'flex';
	document.getElementById('admin-access-denied-section').style.display = 'none';
	document.getElementById('admin-dashboard-section').style.display = 'none';
}

function showDashboard() {
	document.getElementById('admin-checking-section').style.display = 'none';
	document.getElementById('admin-access-denied-section').style.display = 'none';
	document.getElementById('admin-dashboard-section').style.display = 'flex';
	renderRoleSwitcher();
	loadDashboardData();
}

function showAccessDenied() {
	document.getElementById('admin-checking-section').style.display = 'none';
	document.getElementById('admin-access-denied-section').style.display = 'block';
	document.getElementById('admin-dashboard-section').style.display = 'none';
}

async function loadDashboardData() {
	const refreshBtn = document.getElementById('btn-refresh-all');
	const tasks = [];
	if (document.getElementById('stat-access-count')) tasks.push(fetchAccessCount());
	if (document.getElementById('admin-notice-list')) tasks.push(fetchAdminNotices());
	if (document.getElementById('log-table-body')) tasks.push(fetchLogs());
	if (document.getElementById('kanbu-user-list')) tasks.push(fetchUsers());
	if (document.getElementById('invite-code-list')) tasks.push(fetchInviteCodes());
	if (document.getElementById('kanbu-room-list')) tasks.push(fetchRooms());
	if (document.getElementById('higopelive-live-list')) tasks.push(fetchHigopeliveLives());
	if (refreshBtn) {
		await withButtonLoading(refreshBtn, async () => {
			await Promise.all(tasks);
		}, '更新中');
	} else {
		await Promise.all(tasks);
	}
}

async function fetchAccessCount() {
	try {
		const res = await callGasApi('getAccessCount');
		if (res.success) {
			document.getElementById('stat-access-count').textContent = Number(res.count).toLocaleString();
		}
	} catch(e) {}
}

function wrapNoticeSelection(before, after) {
	const textarea = document.getElementById('notice-text');
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selected = textarea.value.substring(start, end);
	if (!selected) {
		showToast('装飾したい文字を選択してください');
		return;
	}
	textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end');
	textarea.focus();
}

let editingNoticeTime = null;

function startEditNotice(item) {
	editingNoticeTime = item.time;
	document.getElementById('notice-text').value = item.text;
	document.getElementById('notice-is-pinned').checked = !!item.isPinned;
	document.getElementById('btn-submit-notice').textContent = '更新';
	document.getElementById('btn-cancel-edit').classList.remove('is-hidden');
	document.getElementById('notice-text').focus();
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditNotice() {
	editingNoticeTime = null;
	document.getElementById('form-add-notice').reset();
	document.getElementById('btn-submit-notice').textContent = '追加';
	document.getElementById('btn-cancel-edit').classList.add('is-hidden');
}

async function handleAddNotice() {
	const text = document.getElementById('notice-text').value.trim();
	const isPinned = document.getElementById('notice-is-pinned').checked;
	const btn = document.getElementById('btn-submit-notice');

	if (editingNoticeTime) {
		await withButtonLoading(btn, async () => {
			const res = await callGasApi('editNotice', { time: editingNoticeTime, text });
			if (res.success) {
				await clearNoticeDeviceCache();
				showToast('お知らせを更新しました');
				cancelEditNotice();
				fetchAdminNotices();
			} else {
				showToast(res.error || '更新に失敗しました', 'error');
			}
		}, '更新中...');
		return;
	}

	await withButtonLoading(btn, async () => {
		const res = await callGasApi('updateNotice', { text, isPinned });
		if (res.success) {
			await clearNoticeDeviceCache();
			showToast('お知らせを追加しました');
			document.getElementById('form-add-notice').reset();
			fetchAdminNotices();
		} else {
			showToast(res.error || '追加に失敗しました', 'error');
		}
	}, '追加中...');
}

async function fetchAdminNotices() {
	const container = document.getElementById('admin-notice-list');
	if (!container) return;
	try {
		const res = await callGasApi('getNotice');
		if (!res.success || !res.notices || res.notices.length === 0) {
			container.textContent = '';
			const empty = document.createElement('div');
			empty.className = 'table-message';
			empty.textContent = 'お知らせはありません';
			container.appendChild(empty);
			return;
		}

		container.textContent = '';
		res.notices.forEach((item) => {
			const noticeItem = document.createElement('div');
			noticeItem.className = 'admin-notice-item';

			const noticeText = document.createElement('div');
			noticeText.className = 'admin-notice-text';
			const time = document.createElement('span');
			time.className = 'admin-notice-time';
			time.textContent = item.time;
			const body = document.createElement('div');
			body.textContent = item.text;
			noticeText.appendChild(time);
			noticeText.appendChild(body);

			const actions = document.createElement('div');
			actions.className = 'admin-notice-actions';
			const toggleBtn = document.createElement('button');
			toggleBtn.type = 'button';
			toggleBtn.className = 'btn btn-primary small-action-button';
			toggleBtn.textContent = item.isPinned ? '解除' : '固定';
			toggleBtn.addEventListener('click', () => handleTogglePin(item.time, toggleBtn));
			const editBtn = document.createElement('button');
			editBtn.type = 'button';
			editBtn.className = 'btn btn-primary small-action-button';
			editBtn.textContent = '編集';
			editBtn.addEventListener('click', () => startEditNotice(item));
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.className = 'btn btn-danger small-action-button';
			deleteBtn.textContent = '削除';
			deleteBtn.addEventListener('click', () => handleDeleteNotice(item.time, deleteBtn));

			actions.appendChild(toggleBtn);
			actions.appendChild(editBtn);
			actions.appendChild(deleteBtn);
			noticeItem.appendChild(noticeText);
			noticeItem.appendChild(actions);
			container.appendChild(noticeItem);
		});
	} catch(e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

async function handleTogglePin(timeStr, btn) {
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('toggleNoticePin', { time: timeStr });
		if (res.success) {
			await clearNoticeDeviceCache();
			showToast('固定状態を切り替えました');
			fetchAdminNotices();
		} else {
			showToast(res.error || '失敗しました', 'error');
		}
	}, '処理中');
}

async function handleDeleteNotice(timeStr, btn) {
	if (!confirm('このお知らせを削除しますか？')) return;
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('deleteNotice', { time: timeStr });
		if (res.success) {
			await clearNoticeDeviceCache();
			showToast('削除しました');
			fetchAdminNotices();
		} else {
			showToast(res.error || '失敗しました', 'error');
		}
	}, '削除中');
}

async function handleAdminSearchEvents() {
	const date = document.getElementById('admin-delete-date').value;
	if (!date) {
		showToast('対象日を選択してください', 'error');
		return;
	}
	const container = document.getElementById('admin-event-list');
	container.textContent = '読み込み中...';
	try {
		const res = await callGasApi('adminFindEvents', { date });
		container.textContent = '';
		if (!res.success || !res.events || res.events.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'table-message';
			empty.textContent = '予定はありません';
			container.appendChild(empty);
			return;
		}
		res.events.forEach((event) => {
			const item = document.createElement('div');
			item.className = 'admin-notice-item';

			const text = document.createElement('div');
			text.className = 'admin-notice-text';
			const timeLabel = event.isAllDay ? '終日' : `${event.startTime}-${event.endTime}`;
			text.textContent = `${timeLabel} ${event.room} ${event.title}`;

			const actions = document.createElement('div');
			actions.className = 'admin-notice-actions';
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.className = 'btn btn-danger small-action-button';
			deleteBtn.textContent = '削除';
			deleteBtn.addEventListener('click', () => handleAdminDeleteEvent(event.id, event.title, deleteBtn));
			actions.appendChild(deleteBtn);

			item.appendChild(text);
			item.appendChild(actions);
			container.appendChild(item);
		});
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

async function handleAdminDeleteEvent(eventId, title, btn) {
	if (!confirm(`「${title}」を削除しますか？`)) return;
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('adminDeleteEvent', { eventId });
		if (res.success) {
			if (typeof clearScheduleDeviceCache === 'function') await clearScheduleDeviceCache();
			showToast('削除しました');
			handleAdminSearchEvents();
			fetchLogs();
		} else {
			showToast(res.error || '削除に失敗しました', 'error');
		}
	}, '削除中');
}

async function handleAddMainEvent() {
	const date = document.getElementById('main-event-date').value;
	const isAllDay = document.getElementById('main-event-all-day').checked;
	const startTime = document.getElementById('main-event-start').value;
	const endTime = document.getElementById('main-event-end').value;
	const title = document.getElementById('main-event-title').value.trim();
	const repName = document.getElementById('main-event-rep-name').value.trim();
	if (!date || !title || (!isAllDay && (!startTime || !endTime))) {
		showToast('未入力の項目があります', 'error');
		return;
	}
	const btn = document.getElementById('btn-submit-main-event');
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('addMainEvent', { date, isAllDay, startTime, endTime, title, repName });
		if (res.success) {
			if (typeof clearScheduleDeviceCache === 'function') await clearScheduleDeviceCache();
			showToast('メインカレンダーに登録しました');
			document.getElementById('form-main-event').reset();
			fetchLogs();
		} else {
			showToast(res.error || '登録に失敗しました', 'error');
		}
	}, '登録中...');
}

async function fetchLogs() {
	const tbody = document.getElementById('log-table-body');
	if (!tbody) return;
	try {
		const res = await callGasApi('getLogs');
		if (!res.success || !res.logs || res.logs.length === 0) {
			tbody.textContent = '';
			const row = document.createElement('tr');
			const cell = document.createElement('td');
			cell.colSpan = 8;
			cell.className = 'table-message';
			cell.textContent = 'ログはありません';
			row.appendChild(cell);
			tbody.appendChild(row);
			return;
		}

		tbody.textContent = '';
		res.logs.forEach((rowData) => {
			const row = document.createElement('tr');
			for (let i = 0; i < 8; i += 1) {
				const cell = document.createElement('td');
				cell.textContent = rowData[i] ?? '';
				row.appendChild(cell);
			}
			tbody.appendChild(row);
		});
	} catch(e) {
		tbody.textContent = '';
		const row = document.createElement('tr');
		const cell = document.createElement('td');
		cell.colSpan = 8;
		cell.className = 'table-message table-message-error';
		cell.textContent = '取得失敗';
		row.appendChild(cell);
		tbody.appendChild(row);
	}
}
const USERS_PER_PAGE = 100;
let allUsersCache = [];
let userListPage = 0;
let userGenerationFilter = '';

function getUserFilteredUsers() {
	if (!userGenerationFilter) return allUsersCache;
	return allUsersCache.filter((user) => String(user.generation || '') === userGenerationFilter);
}

function getUserGenerations() {
	const set = new Set();
	allUsersCache.forEach((user) => {
		const g = String(user.generation || '').trim();
		if (g) set.add(g);
	});
	return Array.from(set).sort((a, b) => Number(b) - Number(a));
}

async function fetchUsers() {
	const container = document.getElementById('kanbu-user-list');
	if (!container) return;
	try {
		const res = await callGasApi('listUsers');
		allUsersCache = (res.success && Array.isArray(res.users)) ? res.users : [];
		renderGenerationFilter();
		renderUserListPage(container, 0);
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

function renderGenerationFilter() {
	const select = document.getElementById('user-generation-filter');
	if (!select) return;
	const current = select.value;
	select.textContent = '';
	const all = document.createElement('option');
	all.value = '';
	all.textContent = '全ての期';
	select.appendChild(all);
	getUserGenerations().forEach((g) => {
		const option = document.createElement('option');
		option.value = g;
		option.textContent = `${g}期`;
		select.appendChild(option);
	});
	select.value = getUserGenerations().indexOf(current) !== -1 ? current : '';
	select.onchange = () => {
		userGenerationFilter = select.value;
		renderUserListPage(document.getElementById('kanbu-user-list'), 0);
	};
}

function renderUserListPage(container, page) {
	container.textContent = '';
	const filtered = getUserFilteredUsers();
	if (filtered.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'table-message';
		empty.textContent = userGenerationFilter ? '該当するユーザーがいません' : 'ユーザーがいません';
		container.appendChild(empty);
		return;
	}
	const totalPages = Math.ceil(filtered.length / USERS_PER_PAGE);
	userListPage = Math.max(0, Math.min(page, totalPages - 1));
	const start = userListPage * USERS_PER_PAGE;
	filtered.slice(start, start + USERS_PER_PAGE).forEach((user) => container.appendChild(createUserRow(user)));

	if (totalPages > 1) {
		const pager = document.createElement('div');
		pager.className = 'user-pager';
		const prevBtn = document.createElement('button');
		prevBtn.type = 'button';
		prevBtn.className = 'btn small-action-button';
		prevBtn.textContent = '前へ';
		prevBtn.disabled = userListPage === 0;
		prevBtn.addEventListener('click', () => renderUserListPage(container, userListPage - 1));
		const info = document.createElement('span');
		info.className = 'user-pager-info';
		info.textContent = `${userListPage + 1} / ${totalPages} ページ（全${filtered.length}人）`;
		const nextBtn = document.createElement('button');
		nextBtn.type = 'button';
		nextBtn.className = 'btn small-action-button';
		nextBtn.textContent = '次へ';
		nextBtn.disabled = userListPage >= totalPages - 1;
		nextBtn.addEventListener('click', () => renderUserListPage(container, userListPage + 1));
		pager.appendChild(prevBtn);
		pager.appendChild(info);
		pager.appendChild(nextBtn);
		container.appendChild(pager);
	}
}

async function fetchInviteCodes() {
	const container = document.getElementById('invite-code-list');
	if (!container) return;
	try {
		const res = await callGasApi('listInviteCodes');
		renderInviteCodeList(container, res.success && Array.isArray(res.codes) ? res.codes : []);
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

function renderInviteCodeList(container, codes) {
	container.textContent = '';
	if (codes.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'table-message';
		empty.textContent = '発行済みのコードはありません';
		container.appendChild(empty);
		return;
	}
	codes.forEach((item) => {
		const row = document.createElement('div');
		row.className = 'invite-code-row';
		const code = document.createElement('span');
		code.className = 'invite-code-value';
		code.textContent = item.code;
		const meta = document.createElement('span');
		meta.className = 'invite-code-meta';
		meta.textContent = `${item.status} / ${item.usedCount}/${item.maxUses}回 / 期限 ${item.expiresAt} / 発行 ${item.issuerNickname}`;
		row.appendChild(code);
		row.appendChild(meta);
		container.appendChild(row);
	});
}

async function handleIssueInviteCode() {
	const btn = document.getElementById('btn-issue-invite');
	const resultArea = document.getElementById('invite-code-result');
	await withButtonLoading(btn, async () => {
		try {
			const res = await callGasApi('issueInviteCode', {});
			if (!res.success) {
				showToast(res.error || '発行に失敗しました', 'error');
				return;
			}
			if (resultArea) {
				resultArea.classList.remove('is-hidden');
				resultArea.textContent = `発行しました: ${res.code}（有効期限 ${res.expiresAt}・${res.maxUses}回まで）`;
			}
			showToast('招待コードを発行しました');
			fetchInviteCodes();
		} catch (e) {
			showToast('発行に失敗しました', 'error');
		}
	}, '発行中');
}

const ROLE_SELECT_OPTIONS = ['user', 'higopelive', 'kanbu'];
const ROLE_SORT_ORDER = { user: 0, higopelive: 1, kanbu: 2 };
const ASSIGNABLE_ROLES = ['kanbu', 'higopelive'];
const MAX_ROLE_SELECTS = ASSIGNABLE_ROLES.length;

function buildUserMetaLines(user) {
	const lines = [];
	const identity = [
		user.fullName ? (user.furigana ? `${user.fullName}（${user.furigana}）` : user.fullName) : '',
		user.generation ? `${user.generation}期` : '',
		[user.faculty, user.department].filter(Boolean).join(' ')
	].filter(Boolean).join(' / ');
	if (identity) lines.push(identity);
	const contact = [
		user.studentId ? `学籍番号: ${user.studentId}` : '',
		user.favoriteArtist ? `好きな: ${user.favoriteArtist}` : ''
	].filter(Boolean).join(' / ');
	if (contact) lines.push(contact);
	return lines;
}

function createUserRow(user) {
	const item = document.createElement('div');
	item.className = 'admin-notice-item user-item';

	const info = document.createElement('div');
	info.className = 'admin-notice-text';
	const name = document.createElement('div');
	name.className = 'user-item-name';
	name.textContent = `${user.internalUserId} ${user.nickname}`;
	const email = document.createElement('div');
	email.className = 'user-item-email';
	email.textContent = user.schoolEmail;
	info.appendChild(name);
	info.appendChild(email);
	buildUserMetaLines(user).forEach((text) => {
		const meta = document.createElement('div');
		meta.className = 'user-item-meta';
		meta.textContent = text;
		info.appendChild(meta);
	});
	item.appendChild(info);

	const roleArea = document.createElement('div');
	roleArea.className = 'user-role-area';

	if (user.roles.indexOf('admin') !== -1) {
		const badge = document.createElement('span');
		badge.className = 'user-admin-badge';
		badge.textContent = 'admin';
		roleArea.appendChild(badge);
		item.appendChild(roleArea);
		return item;
	}

	const selectWrap = document.createElement('div');
	selectWrap.className = 'user-role-selects';
	const editableRoles = user.roles
		.filter((role) => role !== 'user' && role !== 'admin')
		.sort((a, b) => ROLE_SORT_ORDER[a] - ROLE_SORT_ORDER[b]);
	const addBtn = document.createElement('button');
	addBtn.type = 'button';
	addBtn.className = 'btn small-action-button';
	addBtn.textContent = '＋';
	addBtn.title = 'ロールを追加';
	addBtn.addEventListener('click', () => {
		if (selectWrap.querySelectorAll('select').length >= MAX_ROLE_SELECTS) return;
		selectWrap.appendChild(createRoleSelectRow('user', selectWrap, addBtn));
		refreshRoleSelects(selectWrap);
		updateRoleAddBtn(selectWrap, addBtn);
	});
	(editableRoles.length > 0 ? editableRoles : ['user']).forEach((role) => {
		selectWrap.appendChild(createRoleSelectRow(role, selectWrap, addBtn));
	});
	selectWrap.addEventListener('change', () => refreshRoleSelects(selectWrap));
	roleArea.appendChild(selectWrap);

	const actions = document.createElement('div');
	actions.className = 'admin-notice-actions user-role-actions';
	const saveBtn = document.createElement('button');
	saveBtn.type = 'button';
	saveBtn.className = 'btn btn-primary small-action-button';
	saveBtn.textContent = '保存';
	saveBtn.addEventListener('click', () => handleSaveUserRoles(user.internalUserId, selectWrap, saveBtn));
	actions.appendChild(addBtn);
	actions.appendChild(saveBtn);
	roleArea.appendChild(actions);

	refreshRoleSelects(selectWrap);
	updateRoleAddBtn(selectWrap, addBtn);

	item.appendChild(roleArea);
	return item;
}

function createRoleSelectRow(value, selectWrap, addBtn) {
	const row = document.createElement('div');
	row.className = 'user-role-select-row';
	const select = createRoleSelect(value);
	const removeBtn = document.createElement('button');
	removeBtn.type = 'button';
	removeBtn.className = 'btn btn-danger small-action-button';
	removeBtn.textContent = '×';
	removeBtn.title = 'このロールを削除';
	removeBtn.addEventListener('click', () => {
		row.remove();
		refreshRoleSelects(selectWrap);
		updateRoleAddBtn(selectWrap, addBtn);
	});
	row.appendChild(select);
	row.appendChild(removeBtn);
	return row;
}

function createRoleSelect(value) {
	const select = document.createElement('select');
	select.className = 'input-text user-role-select';
	select.setAttribute('aria-label', 'ロール');
	ROLE_SELECT_OPTIONS.forEach((role) => {
		const option = document.createElement('option');
		option.value = role;
		option.textContent = role;
		select.appendChild(option);
	});
	select.value = value;
	return select;
}

function refreshRoleSelects(selectWrap) {
	const selects = Array.from(selectWrap.querySelectorAll('select'));
	const selectedRoles = selects.map((s) => s.value).filter((v) => v !== 'user');
	selects.forEach((select) => {
		const current = select.value;
		select.textContent = '';
		ROLE_SELECT_OPTIONS.forEach((role) => {
			if (role !== 'user' && role !== current && selectedRoles.indexOf(role) !== -1) return;
			const option = document.createElement('option');
			option.value = role;
			option.textContent = role;
			select.appendChild(option);
		});
		select.value = current;
	});
}

function updateRoleAddBtn(selectWrap, addBtn) {
	addBtn.classList.toggle('is-hidden', selectWrap.querySelectorAll('select').length >= MAX_ROLE_SELECTS);
}

async function handleSaveUserRoles(internalUserId, selectWrap, btn) {
	const picked = [];
	selectWrap.querySelectorAll('select').forEach((select) => {
		if (select.value !== 'user' && picked.indexOf(select.value) === -1) picked.push(select.value);
	});
	const roles = picked.length > 0 ? picked : ['user'];
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('updateUserRoles', { internalUserId, roles });
		if (res.success) {
			showToast('ロールを更新しました');
			fetchUsers();
		} else {
			showToast(res.error || '更新に失敗しました', 'error');
		}
	}, '保存中');
}

/* ===== Higopelive! 管理 ===== */

let higopeliveLives = [];
let currentHigopeliveLive = null;
let currentHigopeliveApp = null;

function isHigopeliveLiveStale(live) {
	const date = new Date(String(live.date).replace(/-/g, '/'));
	if (!Number.isFinite(date.getTime())) return false;
	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - 3);
	return date < cutoff;
}

/* ===== 練習場所の有効化（幹部） ===== */

const ROOM_LABELS = { '①': '部室①', '②': '機材庫②', '③': '教室③' };

async function fetchRooms() {
	const container = document.getElementById('kanbu-room-list');
	if (!container) return;
	try {
		const res = await callGasApi('getEnabledRooms');
		const enabled = (res.success && Array.isArray(res.rooms)) ? res.rooms : Object.keys(ROOM_LABELS);
		container.textContent = '';
		Object.keys(ROOM_LABELS).forEach((room) => {
			const item = document.createElement('label');
			item.className = 'admin-notice-item room-item';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = enabled.indexOf(room) !== -1;
			checkbox.dataset.room = room;
			const text = document.createElement('span');
			text.textContent = ROOM_LABELS[room];
			item.appendChild(checkbox);
			item.appendChild(text);
			container.appendChild(item);
		});
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

async function handleSaveRooms() {
	const container = document.getElementById('kanbu-room-list');
	const rooms = [];
	container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
		if (cb.checked) rooms.push(cb.dataset.room);
	});
	if (rooms.length === 0) {
		showToast('有効にする練習場所を1つ以上選択してください', 'error');
		return;
	}
	const btn = document.getElementById('btn-save-rooms');
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('updateEnabledRooms', { rooms });
		if (res.success) {
			if (typeof clearScheduleDeviceCache === 'function') await clearScheduleDeviceCache();
			showToast('練習場所を更新しました');
		} else {
			showToast(res.error || '更新に失敗しました', 'error');
		}
	}, '保存中');
}

async function handleCreateLive() {
	const title = document.getElementById('live-new-title').value.trim();
	const date = document.getElementById('live-new-date').value;
	const lightingEnabled = document.getElementById('live-new-lighting').checked;
	if (!title || !date) {
		showToast('タイトルと開催日を入力してください', 'error');
		return;
	}
	const btn = document.getElementById('btn-create-live');
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('createLive', { title, date, lightingEnabled });
		if (res.success) {
			showToast(`ライブを作成しました（${res.liveId}）`);
			document.getElementById('live-new-title').value = '';
			fetchHigopeliveLives();
		} else {
			showToast(res.error || '作成に失敗しました', 'error');
		}
	}, '作成中');
}

async function fetchHigopeliveLives() {
	const container = document.getElementById('higopelive-live-list');
	if (!container) return;
	try {
		const res = await callGasApi('getLives');
		container.textContent = '';
		higopeliveLives = (res.success && Array.isArray(res.lives)) ? res.lives : [];
		const stale = higopeliveLives.filter(isHigopeliveLiveStale);
		if (stale.length > 0) {
			const warn = document.createElement('div');
			warn.className = 'table-message';
			warn.style.color = 'var(--danger)';
			warn.textContent = `開催から3ヶ月以上過ぎたライブが${stale.length}件あります。不要なら削除してください`;
			container.appendChild(warn);
		}
		if (higopeliveLives.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'table-message';
			empty.textContent = 'ライブがありません。上のフォームから作成してください';
			container.appendChild(empty);
			return;
		}
			higopeliveLives.forEach((live) => {
			const item = document.createElement('div');
			item.className = 'admin-notice-item';
			const text = document.createElement('div');
			text.className = 'admin-notice-text';
			text.textContent = `📁 ${live.title}（${live.date}）${isHigopeliveLiveStale(live) ? ' ⚠️' : ''}`;
			const actions = document.createElement('div');
			actions.className = 'admin-notice-actions';
			const openBtn = document.createElement('button');
			openBtn.type = 'button';
			openBtn.className = 'btn btn-primary small-action-button';
			openBtn.textContent = '開く';
			openBtn.addEventListener('click', () => selectHigopeliveLive(live));
			const editBtn = document.createElement('button');
			editBtn.type = 'button';
			editBtn.className = 'btn btn-primary small-action-button';
			editBtn.textContent = '編集';
			editBtn.addEventListener('click', () => handleEditLive(live, editBtn));
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.className = 'btn btn-danger small-action-button';
			deleteBtn.textContent = '削除';
			deleteBtn.addEventListener('click', () => handleDeleteLive(live, deleteBtn));
			actions.appendChild(openBtn);
			actions.appendChild(editBtn);
			actions.appendChild(deleteBtn);
			item.appendChild(text);
			item.appendChild(actions);
			container.appendChild(item);
		});
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

function selectHigopeliveLive(live) {
	currentHigopeliveLive = live;
	currentHigopeliveApp = null;
	document.getElementById('higopelive-detail-card').classList.add('is-hidden');
	document.getElementById('higopelive-current-live').textContent = `（${live.title}）`;
	switchAdminTab('apps');
	fetchHigopeliveApplications();
}

async function handleDeleteLive(live, btn) {
	if (!confirm(`「${live.title}」を削除しますか？\nこのライブの申請データは残りますが、一覧からは消えます。`)) return;
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('deleteLive', { liveId: live.liveId });
		if (res.success) {
			showToast('削除しました');
			if (currentHigopeliveLive && currentHigopeliveLive.liveId === live.liveId) {
				currentHigopeliveLive = null;
				currentHigopeliveApp = null;
				document.getElementById('higopelive-current-live').textContent = '';
				document.getElementById('higopelive-app-list').textContent = 'ライブ管理タブからライブを選択してください';
				document.getElementById('higopelive-detail-card').classList.add('is-hidden');
			}
			fetchHigopeliveLives();
		} else {
			showToast(res.error || '削除に失敗しました', 'error');
		}
	}, '削除中');
}

async function handleEditLive(live, btn) {
	const input = prompt('タイトルを編集してください', live.title);
	if (input === null) return;
	const title = input.trim();
	if (!title || title === live.title) return;
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('editLive', { liveId: live.liveId, title: title });
		if (res.success) {
			showToast('タイトルを更新しました');
			if (currentHigopeliveLive && currentHigopeliveLive.liveId === live.liveId) {
				currentHigopeliveLive.title = title;
				document.getElementById('higopelive-current-live').textContent = `（${title}）`;
			}
			fetchHigopeliveLives();
		} else {
			showToast(res.error || '更新に失敗しました', 'error');
		}
	}, '更新中');
}

function hasLightingContent(app) {
	const lighting = app && app.lighting;
	if (!lighting) return false;
	if (Array.isArray(lighting.songDetails) && lighting.songDetails.length > 0) return true;
	if (typeof lighting.notes === 'string' && lighting.notes.trim()) return true;
	return false;
}

async function fetchHigopeliveApplications() {
	const container = document.getElementById('higopelive-app-list');
	if (!container || !currentHigopeliveLive) return;
	container.textContent = '読み込み中...';
	try {
		const res = await callGasApi('getApplications', { liveId: currentHigopeliveLive.liveId });
		container.textContent = '';
		const batchLightBtn = document.getElementById('btn-batch-light');
		if (batchLightBtn) batchLightBtn.classList.toggle('is-hidden', !(res.success && res.applications && res.applications.some(hasLightingContent)));
		if (!res.success || !res.applications || res.applications.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'table-message';
			empty.textContent = 'このライブの申請はまだありません';
			container.appendChild(empty);
			return;
		}
		res.applications.forEach((app) => {
			const item = document.createElement('div');
			item.className = 'admin-notice-item';
			const text = document.createElement('div');
			text.className = 'admin-notice-text';
			const title = document.createElement('div');
			title.className = 'user-item-name';
			title.textContent = `${app.groupName}（代表: ${app.representative}）`;
			const meta = document.createElement('div');
			meta.className = 'user-item-email';
			meta.textContent = `投稿: ${app.submittedAt} / ${app.submittedBy}`;
			text.appendChild(title);
			text.appendChild(meta);
			const actions = document.createElement('div');
			actions.className = 'admin-notice-actions';
			const detailBtn = document.createElement('button');
			detailBtn.type = 'button';
			detailBtn.className = 'btn btn-primary small-action-button';
			detailBtn.textContent = '詳細';
			detailBtn.addEventListener('click', () => showHigopeliveDetail(app));
			actions.appendChild(detailBtn);
			item.appendChild(text);
			item.appendChild(actions);
			container.appendChild(item);
		});
	} catch (e) {
		container.textContent = '';
		const error = document.createElement('div');
		error.className = 'table-message table-message-error';
		error.textContent = '取得失敗';
		container.appendChild(error);
	}
}

function buildHigopeliveTable(parent, headers, rowsData) {
	const wrapper = document.createElement('div');
	wrapper.className = 'table-responsive';
	const table = document.createElement('table');
	table.className = 'log-table';
	const thead = document.createElement('thead');
	const headRow = document.createElement('tr');
	headers.forEach((h) => {
		const th = document.createElement('th');
		th.textContent = h;
		headRow.appendChild(th);
	});
	thead.appendChild(headRow);
	const tbody = document.createElement('tbody');
	rowsData.forEach((cells) => {
		const row = document.createElement('tr');
		cells.forEach((cellText) => {
			const td = document.createElement('td');
			td.textContent = cellText;
			row.appendChild(td);
		});
		tbody.appendChild(row);
	});
	table.appendChild(thead);
	table.appendChild(tbody);
	wrapper.appendChild(table);
	parent.appendChild(wrapper);
}

function buildHigopeliveNote(parent, label, value) {
	const note = document.createElement('p');
	note.className = 'higopelive-note';
	note.textContent = `${label}: ${value || 'なし'}`;
	parent.appendChild(note);
}

const PA_PART_COLORS = {
	'1st': '#ffc6c6',
	'2nd': '#ffea83',
	'3rd': '#ffffff',
	'4th': '#ffbd6c',
	'Lead': '#baf9bf',
	'Bass': '#bad3ff',
	'Perc.': '#d0a5fd'
};

function buildPaMemberTable(parent, members) {
	const wrapper = document.createElement('div');
	wrapper.className = 'table-responsive';
	const table = document.createElement('table');
	table.className = 'log-table higopelive-member-table';
	table.style.tableLayout = 'fixed';
	const tbody = document.createElement('tbody');
	[
		['パート', ...members.map((m) => m.part)],
		['名前', ...members.map((m) => m.name)]
	].forEach((cells) => {
		const row = document.createElement('tr');
		cells.forEach((cellText, cellIndex) => {
			const cell = document.createElement(cellIndex === 0 ? 'th' : 'td');
			cell.textContent = cellText;
			if (cellIndex === 0) {
				cell.style.width = '64px';
			} else {
				cell.style.width = `calc((100% - 64px) / ${members.length})`;
				if (PA_PART_COLORS[cellText]) cell.style.backgroundColor = PA_PART_COLORS[cellText];
			}
			row.appendChild(cell);
		});
		tbody.appendChild(row);
	});
	table.appendChild(tbody);
	wrapper.appendChild(table);
	parent.appendChild(wrapper);
}

function buildPaSection(app) {
	const section = document.createElement('div');
	section.className = 'higopelive-section';
	const heading = document.createElement('div');
	heading.className = 'card-title notice-list-heading';
	heading.textContent = 'PA表';
	section.appendChild(heading);

	const micBrings = (app.pa && Array.isArray(app.pa.micBringList)) ? app.pa.micBringList : [];
	if (micBrings.length > 0) {
		const micHeading = document.createElement('div');
		micHeading.className = 'higopelive-subheading';
		micHeading.textContent = '持ち込みマイク';
		section.appendChild(micHeading);
		const wrapper = document.createElement('div');
		wrapper.className = 'table-responsive higopelive-mic-table';
		const table = document.createElement('table');
		table.className = 'log-table higopelive-member-table';
		table.style.tableLayout = 'fixed';
		table.style.width = 'auto';
		const tbody = document.createElement('tbody');
		[
			['パート', ...micBrings.map((item) => item.part || '-')],
			['マイク', ...micBrings.map((item) => item.mic || '-')]
		].forEach((cells) => {
			const row = document.createElement('tr');
			cells.forEach((cellText, cellIndex) => {
				const cell = document.createElement(cellIndex === 0 ? 'th' : 'td');
				cell.textContent = cellText;
				if (cellIndex === 0) cell.style.width = '64px';
				row.appendChild(cell);
			});
			tbody.appendChild(row);
		});
		table.appendChild(tbody);
		wrapper.appendChild(table);
		section.appendChild(wrapper);
	}

	const songs = (app.pa && Array.isArray(app.pa.songs)) ? app.pa.songs : [];
	songs.forEach((song, index) => {
		const songHeading = document.createElement('div');
		songHeading.className = 'higopelive-subheading';
		songHeading.textContent = `演奏${index + 1}曲目（${song.title}）`;
		section.appendChild(songHeading);
		const members = Array.isArray(song.members) ? song.members : [];
		if (members.length > 0) buildPaMemberTable(section, members);
		if (song.notes) buildHigopeliveNote(section, '要望', song.notes);
	});
	return section;
}

function buildLightSection(app) {
	const section = document.createElement('div');
	section.className = 'higopelive-section';
	const heading = document.createElement('div');
	heading.className = 'card-title notice-list-heading';
	heading.textContent = '照明表';
	section.appendChild(heading);
	const details = (app.lighting && Array.isArray(app.lighting.songDetails)) ? app.lighting.songDetails : [];
	if (details.length > 0) {
		buildHigopeliveTable(section, ['曲', '曲名', 'テンポ', 'イメージカラー', 'ジャンル', '演奏前のMC', '要望'], details.map((s, i) => [`${i + 1}曲目`, s.title, s.tempo, s.color, s.genre || '-', s.preMc ? 'あり' : 'なし', s.notes || '-']));
	}
	return section;
}

function showHigopeliveDetail(app) {
	currentHigopeliveApp = app;
	const card = document.getElementById('higopelive-detail-card');
	card.classList.remove('is-hidden');
	document.getElementById('higopelive-detail-title').textContent = `${app.groupName}（代表: ${app.representative}）`;
	const lightBtn = document.getElementById('btn-print-light');
	if (lightBtn) lightBtn.classList.toggle('is-hidden', !hasLightingContent(app));
	const container = document.getElementById('higopelive-detail');
	container.textContent = '';
	container.appendChild(buildPaSection(app));
	container.appendChild(buildLightSection(app));
	card.scrollIntoView({ behavior: 'smooth' });
}

function downloadBase64Pdf(base64, filename) {
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	const blob = new Blob([bytes], { type: 'application/pdf' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

async function downloadHigopelivePdf(kind, btn) {
	if (!currentHigopeliveApp || !currentHigopeliveLive) return;
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('exportApplicationPdf', { liveId: currentHigopeliveLive.liveId, appId: currentHigopeliveApp.appId, kind: kind });
		if (res.success && res.data) {
			downloadBase64Pdf(res.data, res.name);
			showToast('ダウンロードしました');
		} else {
			showToast(res.error || 'PDFの生成に失敗しました', 'error');
		}
	}, 'PDF生成中');
}

async function downloadAllHigopelivePdf(kind, btn) {
	if (!currentHigopeliveLive) return;
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('exportAllApplicationsPdf', { liveId: currentHigopeliveLive.liveId, kind: kind });
		if (res.success && res.data) {
			downloadBase64Pdf(res.data, res.name);
			showToast('ダウンロードしました');
		} else {
			showToast(res.error || 'PDFの生成に失敗しました', 'error');
		}
	}, 'PDF生成中');
}
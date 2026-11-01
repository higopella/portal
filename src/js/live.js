/**
 * Higopelive! 申請フォーム (src/js/live.js)
 */

initCommonLayout('live');

const PA_PARTS = ['1st', '2nd', '3rd', '4th','lead', 'bass', 'perc.'];
const LIGHT_TEMPOS = ['アップテンポ', 'ミドルテンポ', 'スローテンポ'];
const LIGHT_COLORS = ['白', '赤', '青', '黄', '緑', '紫', 'ピンク', 'オレンジ'];
const MAX_PA_MEMBERS = 7;
const MAX_SONGS = 10;

document.addEventListener('DOMContentLoaded', async () => {
	initPageTour('live');
	if (!await requirePageAuthentication()) return;
	for (let i = 0; i < MAX_PA_MEMBERS; i++) addPaMemberRow();
	addSongTitleRow();
	bindLiveFormEvents();
	loadLiveOptions();
});

function bindLiveFormEvents() {
	document.getElementById('btn-add-mic-bring').addEventListener('click', () => addMicBringRow());
	document.getElementById('btn-add-song').addEventListener('click', () => addSongTitleRow());
	document.getElementById('form-live-application').addEventListener('submit', handleSubmitLiveApplication);
}

async function loadLiveOptions() {
	const select = document.getElementById('live-select');
	try {
		const res = await callGasApi('getLives');
		select.textContent = '';
		if (!res.success || !res.lives || res.lives.length === 0) {
			const option = document.createElement('option');
			option.value = '';
			option.textContent = '申請受付中のライブがありません';
			select.appendChild(option);
			select.disabled = true;
			return;
		}
		res.lives.forEach((live) => {
			const option = document.createElement('option');
			option.value = live.liveId;
			option.textContent = `${live.title}（${live.date}）`;
			select.appendChild(option);
		});
		const lightSection = document.getElementById('light-section');
		select.addEventListener('change', () => {
			const selected = res.lives.find((live) => live.liveId === select.value);
			if (lightSection) lightSection.classList.toggle('is-hidden', !(selected && selected.lightingEnabled !== false));
		});
		select.dispatchEvent(new Event('change'));
	} catch (e) {
		select.textContent = '';
		const option = document.createElement('option');
		option.value = '';
		option.textContent = 'ライブ情報を取得できませんでした';
		select.appendChild(option);
	}
}

function createRowButton(text, className, title) {
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = className;
	btn.textContent = text;
	if (title) btn.title = title;
	return btn;
}

function addPaMemberRow() {
	const list = document.getElementById('pa-member-list');
	if (list.children.length >= MAX_PA_MEMBERS) {
		showToast(`演者は${MAX_PA_MEMBERS}人までです`, 'error');
		return;
	}
	const col = document.createElement('div');
	col.className = 'live-member-col';

	const order = document.createElement('div');
	order.className = 'live-member-order';

	const partSelect = document.createElement('select');
	partSelect.className = 'live-input live-member-part';
	const partPlaceholder = document.createElement('option');
	partPlaceholder.value = '';
	partPlaceholder.textContent = 'パートを記入';
	partPlaceholder.disabled = true;
	partPlaceholder.selected = true;
	partSelect.appendChild(partPlaceholder);
	PA_PARTS.forEach((part) => {
		const option = document.createElement('option');
		option.value = part;
		option.textContent = part;
		partSelect.appendChild(option);
	});

	const nameInput = document.createElement('input');
	nameInput.type = 'text';
	nameInput.className = 'live-input live-member-name';
	nameInput.placeholder = '名前';
	nameInput.maxLength = 100;

	col.append(order, partSelect, nameInput);
	list.appendChild(col);
	renumberPaMembers();
}

function renumberPaMembers() {
	document.querySelectorAll('#pa-member-list .live-member-col').forEach((col, index) => {
		col.querySelector('.live-member-order').textContent = `${index + 1}`;
	});
}

function addSongTitleRow(title = '') {
	const list = document.getElementById('song-title-list');
	if (list.children.length >= MAX_SONGS) {
		showToast(`曲は${MAX_SONGS}曲までです`, 'error');
		return;
	}
	const isFirst = list.children.length === 0;
	const row = document.createElement('div');
	row.className = 'live-song-row';
	const input = document.createElement('input');
	input.type = 'text';
	input.className = 'live-input song-title-input';
	input.placeholder = `曲名（${list.children.length + 1}曲目）`;
	input.maxLength = 100;
	input.value = title;
	input.addEventListener('input', syncSongSections);
	if (!isFirst) {
		const removeBtn = createRowButton('×', 'btn btn-danger small-action-button', 'この曲を削除');
		removeBtn.addEventListener('click', () => {
			row.remove();
			syncSongSections();
		});
		row.append(input, removeBtn);
	} else {
		row.append(input);
	}
	list.appendChild(row);
	syncSongSections();
}

function getSongTitles() {
	const titles = [];
	document.querySelectorAll('#song-title-list .song-title-input').forEach((input) => {
		const value = input.value.trim();
		if (value) titles.push(value);
	});
	return titles;
}

function addMicBringRow() {
	const list = document.getElementById('mic-bring-list');
	const row = document.createElement('div');
	row.className = 'live-song-row';
	const partInput = document.createElement('input');
	partInput.type = 'text';
	partInput.className = 'live-input mic-bring-part';
	partInput.placeholder = 'パート';
	partInput.maxLength = 50;
	const micInput = document.createElement('input');
	micInput.type = 'text';
	micInput.className = 'live-input mic-bring-mic';
	micInput.placeholder = 'マイク名';
	micInput.maxLength = 100;
	const removeBtn = createRowButton('×', 'btn btn-danger small-action-button', 'この持ち込みを削除');
	removeBtn.addEventListener('click', () => row.remove());
	row.append(partInput, micInput, removeBtn);
	list.appendChild(row);
}

function collectMicBrings() {
	const items = [];
	document.querySelectorAll('#mic-bring-list .live-song-row').forEach((row) => {
		const part = row.querySelector('.mic-bring-part').value.trim();
		const mic = row.querySelector('.mic-bring-mic').value.trim();
		if (part || mic) items.push({ part, mic });
	});
	return items;
}

function syncSongSections() {
	document.querySelectorAll('#song-title-list .song-title-input').forEach((input, i) => {
		input.placeholder = `曲名（${i + 1}曲目）`;
	});
	const titles = getSongTitles();
	syncPaSongNotes(titles);
	syncLightSongDetails(titles);
}

function syncPaSongNotes(titles) {
	const container = document.getElementById('pa-song-notes');
	const existing = Array.from(container.querySelectorAll('textarea')).map((t) => t.value);
	container.textContent = '';
	titles.forEach((title, index) => {
		const group = document.createElement('div');
		group.className = 'live-form-group';
		const label = document.createElement('label');
		label.className = 'live-label';
		label.textContent = `${index + 1}曲目（${title}）のPA要望`;
		const textarea = document.createElement('textarea');
		textarea.className = 'live-textarea pa-song-note';
		textarea.rows = 2;
		textarea.maxLength = 1000;
		textarea.value = existing[index] || '';
		group.append(label, textarea);
		container.appendChild(group);
	});
}

function createLightSongDetail(index, title, values) {
	const group = document.createElement('div');
	group.className = 'live-form-group live-song-detail';
	const label = document.createElement('label');
	label.className = 'live-label';
	label.textContent = `${index + 1}曲目（${title}）`;

	const row = document.createElement('div');
	row.className = 'live-song-row';
	const tempoSelect = document.createElement('select');
	tempoSelect.className = 'live-input live-song-tempo';
	appendSelectPlaceholder(tempoSelect, 'テンポを選択');
	LIGHT_TEMPOS.forEach((tempo) => {
		const option = document.createElement('option');
		option.value = tempo;
		option.textContent = tempo;
		tempoSelect.appendChild(option);
	});
	const colorSelect = document.createElement('select');
	colorSelect.className = 'live-input live-song-color';
	appendSelectPlaceholder(colorSelect, 'カラーを選択');
	LIGHT_COLORS.forEach((color) => {
		const option = document.createElement('option');
		option.value = color;
		option.textContent = color;
		colorSelect.appendChild(option);
	});
	const genreInput = document.createElement('input');
	genreInput.type = 'text';
	genreInput.className = 'live-input live-song-genre';
	genreInput.placeholder = 'ジャンル（任意）';
	genreInput.maxLength = 50;
	const preMcSelect = document.createElement('select');
	preMcSelect.className = 'live-input live-song-pre-mc';
	appendSelectPlaceholder(preMcSelect, '演奏前のMC');
	[['true', 'あり'], ['false', 'なし']].forEach(([v, text]) => {
		const option = document.createElement('option');
		option.value = v;
		option.textContent = text;
		preMcSelect.appendChild(option);
	});
	row.append(tempoSelect, colorSelect, genreInput, preMcSelect);

	const notes = document.createElement('textarea');
	notes.className = 'live-textarea live-song-notes';
	notes.rows = 2;
	notes.maxLength = 1000;
	notes.placeholder = 'この曲の照明要望（任意）';

	if (values) {
		tempoSelect.value = values.tempo;
		colorSelect.value = values.color;
		genreInput.value = values.genre;
		preMcSelect.value = values.preMc;
		notes.value = values.notes;
	}

	group.append(label, row, notes);
	return group;
}

function appendSelectPlaceholder(select, text) {
	const placeholder = document.createElement('option');
	placeholder.value = '';
	placeholder.textContent = text;
	placeholder.disabled = true;
	placeholder.selected = true;
	select.appendChild(placeholder);
}

function syncLightSongDetails(titles) {
	const container = document.getElementById('light-song-detail-list');
	const existing = Array.from(container.querySelectorAll('.live-song-detail')).map((detail) => ({
		tempo: detail.querySelector('.live-song-tempo').value,
		color: detail.querySelector('.live-song-color').value,
		genre: detail.querySelector('.live-song-genre').value,
		preMc: detail.querySelector('.live-song-pre-mc').value,
		notes: detail.querySelector('.live-song-notes').value
	}));
	container.textContent = '';
	titles.forEach((title, index) => {
		container.appendChild(createLightSongDetail(index, title, existing[index]));
	});
}

async function handleSubmitLiveApplication(e) {
	e.preventDefault();
	const liveId = document.getElementById('live-select').value;
	const groupName = document.getElementById('live-group-name').value.trim();
	const representative = document.getElementById('live-representative').value.trim();

	const members = [];
	let memberError = '';
	document.querySelectorAll('#pa-member-list .live-member-col').forEach((col) => {
		const name = col.querySelector('.live-member-name').value.trim();
		const part = col.querySelector('.live-member-part').value;
		if (!name) return;
		if (!part) memberError = `演者「${name}」のパートを選択してください`;
		members.push({ name, part });
	});

	const songTitles = getSongTitles();
	const paSongNotes = [];
	Array.from(document.querySelectorAll('#pa-song-notes .pa-song-note')).forEach((textarea, index) => {
		paSongNotes.push({ title: songTitles[index], notes: textarea.value.trim() });
	});
	const songDetails = [];
	const lightEnabled = document.getElementById('light-section') && !document.getElementById('light-section').classList.contains('is-hidden');
	let songError = '';
	if (lightEnabled) {
		Array.from(document.querySelectorAll('#light-song-detail-list .live-song-detail')).forEach((detail, index) => {
			const tempo = detail.querySelector('.live-song-tempo').value;
			const color = detail.querySelector('.live-song-color').value;
			const preMc = detail.querySelector('.live-song-pre-mc').value;
			if (!tempo || !color || preMc === '') songError = `${index + 1}曲目（${songTitles[index]}）のテンポ・カラー・演奏前のMCを選択してください`;
			songDetails.push({
				title: songTitles[index],
				tempo: tempo,
				color: color,
				genre: detail.querySelector('.live-song-genre').value.trim(),
				preMc: preMc === 'true',
				notes: detail.querySelector('.live-song-notes').value.trim()
			});
		});
	}

	if (!liveId) { showToast('対象ライブを選択してください', 'error'); return; }
	if (!groupName || !representative) { showToast('グループ名と代表者を入力してください', 'error'); return; }
	if (memberError) { showToast(memberError, 'error'); return; }
	if (members.length === 0) { showToast('演者を1人以上入力してください', 'error'); return; }
	if (songTitles.length === 0) { showToast('演奏曲を1曲以上入力してください', 'error'); return; }
	if (songError) { showToast(songError, 'error'); return; }
	const lightingNotes = document.getElementById('light-notes').value.trim();

	const payload = {
		liveId: liveId,
		groupName: groupName,
		representative: representative,
		pa: {
			members: members,
			micBringList: collectMicBrings(),
			notes: document.getElementById('pa-notes').value.trim(),
			songNotes: paSongNotes
		},
		lighting: lightEnabled ? {
			notes: lightingNotes,
			songDetails: songDetails
		} : {
			notes: '',
			songDetails: []
		}
	};

	const btn = document.getElementById('btn-submit-live-application');
	await withButtonLoading(btn, async () => {
		const res = await callGasApi('submitApplication', payload);
		if (res.success) {
			showToast('申請しました');
			document.getElementById('form-live-application').reset();
			document.getElementById('pa-member-list').textContent = '';
			document.getElementById('song-title-list').textContent = '';
			for (let i = 0; i < MAX_PA_MEMBERS; i++) addPaMemberRow();
			addSongTitleRow();
			loadLiveOptions();
		} else {
			showToast(res.error || '申請に失敗しました', 'error');
		}
	}, '送信中...');
}

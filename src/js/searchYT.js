initCommonLayout('searchYT');

let allVideos = [];
let currentType = 'ALL';
let latestRequestId = 0;
let visibleCount = 50;
const VIDEOS_PER_PAGE = 50;

document.addEventListener('DOMContentLoaded', async () => {
	initPageTour('searchYT');
	if (!await requirePageAuthentication()) return;
	const selectPlaylist = document.getElementById('select-playlist');
	if (selectPlaylist) {
		selectPlaylist.addEventListener('change', filterVideos);
	}
	const inputSearch = document.getElementById('input-search');
	if (inputSearch) {
		inputSearch.addEventListener('input', filterVideos);
	}
	const refreshBtn = document.getElementById('btn-refresh');
	if (refreshBtn) {
		refreshBtn.addEventListener('click', () => refreshVideoCatalog(true));
	}
	document.querySelectorAll('.tab-btn').forEach((button) => {
		button.addEventListener('click', () => setVideoType(button.dataset.videoType || 'ALL'));
	});
	const loadMoreBtn = document.getElementById('btn-load-more');
	if (loadMoreBtn) {
		loadMoreBtn.addEventListener('click', () => {
			visibleCount += VIDEOS_PER_PAGE;
			filterVideos();
		});
	}
	refreshVideoCatalog(false);
});

async function refreshVideoCatalog(forceRefresh) {
	const requestId = ++latestRequestId;
	const selectEl = document.getElementById('select-playlist');
	const refreshBtn = document.getElementById('btn-refresh');

	if (!forceRefresh) {
		const cached = await readYouTubeCatalogCache();
		if (isYouTubeCatalogCacheValid(cached)) {
			allVideos = cached.videos;
			renderPlaylistOptions(selectEl, cached.playlists, cached.videos);
			filterVideos();
		}
	} else {
		await clearYouTubeCatalogCache();
	}

	try {
		const playlistRes = await callGasApi('getPlaylists');
		const playlists = playlistRes.success && Array.isArray(playlistRes.playlists) ? playlistRes.playlists : [];
		const videoRes = await callGasApi('getPlaylistVideos', { playlistId: 'ALL', forceRefresh: Boolean(forceRefresh) });
		if (!videoRes.success) throw new Error(videoRes.error || '動画の取得に失敗しました');
		if (requestId !== latestRequestId) return;

		allVideos = Array.isArray(videoRes.videos) ? videoRes.videos : [];
		renderPlaylistOptions(selectEl, playlists, allVideos);
		visibleCount = VIDEOS_PER_PAGE;
		filterVideos();
		await writeYouTubeCatalogCache(allVideos, playlists);
	} catch (error) {
		if (allVideos.length === 0) {
			const listContainer = document.getElementById('video-list');
			listContainer.textContent = '';
			const errorMessage = document.createElement('div');
			errorMessage.className = 'video-message video-message-error';
			errorMessage.textContent = '動画の読み込みに失敗しました';
			listContainer.appendChild(errorMessage);
		} else {
			showToast('最新の動画一覧を取得できませんでした', 'error');
		}
	} finally {
		if (refreshBtn) refreshBtn.disabled = false;
	}
}

function renderPlaylistOptions(selectEl, playlists, videos) {
	const selectedValue = selectEl.value || 'ALL';
	selectEl.textContent = '';
	const allOption = document.createElement('option');
	allOption.value = 'ALL';
	allOption.textContent = 'すべての動画';
	selectEl.appendChild(allOption);

	extractTitleCategories(videos).forEach((category) => {
		const opt = document.createElement('option');
		opt.value = `CAT:${category}`;
		opt.textContent = `【${category}】`;
		selectEl.appendChild(opt);
	});

	(playlists || []).forEach((pl) => {
		const opt = document.createElement('option');
		opt.value = pl.id;
		opt.textContent = pl.title;
		selectEl.appendChild(opt);
	});

	selectEl.value = Array.from(selectEl.options).some(option => option.value === selectedValue)
		? selectedValue : 'ALL';
}

function extractTitleCategories(videos) {
	const categories = new Set();
	(videos || []).forEach((video) => {
		const match = String(video.title || '').match(/【([^】]+)】/);
		if (match && match[1].trim() && match[1].trim() !== 'Higo-Pella' && match[1].trim() !== 'Higo-pella' && match[1].trim() !== 'HigoーPella' && match[1].trim() !== 'higopella') categories.add(match[1].trim());
	});
	return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ja'));
}

function setVideoType(type) {
	currentType = type;
	document.getElementById('tab-all').classList.toggle('active', type === 'ALL');
	document.getElementById('tab-regular').classList.toggle('active', type === 'REGULAR');
	document.getElementById('tab-shorts').classList.toggle('active', type === 'SHORTS');
	visibleCount = VIDEOS_PER_PAGE;
	filterVideos();
}

function filterVideos() {
	const query = document.getElementById('input-search').value.toLowerCase().trim();
	const selectedValue = document.getElementById('select-playlist').value;
	const selectedCategory = selectedValue.startsWith('CAT:') ? selectedValue.slice(4) : null;
	const listContainer = document.getElementById('video-list');

	let filtered = allVideos.filter(v => {
		const title = String(v.title ?? '');
		if (query && !title.toLowerCase().includes(query)) return false;
		if (selectedCategory && !title.includes(`【${selectedCategory}】`)) return false;
		if (currentType === 'REGULAR') return !v.isShort;
		if (currentType === 'SHORTS') return v.isShort;
		return true;
	});

	if (filtered.length === 0) {
		listContainer.textContent = '';
		const empty = document.createElement('div');
		empty.className = 'video-message';
		empty.textContent = '該当する動画がありません';
		listContainer.appendChild(empty);
		const loadMoreBtn = document.getElementById('btn-load-more');
		if (loadMoreBtn) loadMoreBtn.hidden = true;
		return;
	}

	listContainer.textContent = '';
	const visibleVideos = filtered.slice(0, visibleCount);
	visibleVideos.forEach((v) => {
		const dateStr = v.publishedAt ? v.publishedAt.split('T')[0] : '';
		const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`;
		const card = document.createElement('a');
		card.href = youtubeUrl;
		card.target = '_blank';
		card.rel = 'noopener noreferrer';
		card.className = 'video-card';
		const img = document.createElement('img');
		img.src = v.thumbnail;
		img.alt = v.title;
		img.className = 'video-thumb';
		img.loading = 'lazy';
		const info = document.createElement('div');
		info.className = 'video-info';
		const title = document.createElement('span');
		title.className = 'video-title';
		title.textContent = v.title;
		const date = document.createElement('span');
		date.className = 'video-date';
		date.textContent = dateStr;
		info.appendChild(title);
		info.appendChild(date);
		card.appendChild(img);
		card.appendChild(info);
		listContainer.appendChild(card);
	});

	const loadMoreBtn = document.getElementById('btn-load-more');
	if (loadMoreBtn) {
		loadMoreBtn.hidden = filtered.length <= visibleCount;
	}
}

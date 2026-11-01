/**
 * 権限ページ選択 (src/js/role-select.js)
 */

const ROLE_PAGE_STORAGE_KEY = 'higopella_role_page';

const ROLE_SELECT_PAGES = [
	{ role: 'kanbu', label: '幹部', description: '予約管理・予約ログ・ユーザー管理など', href: 'kanbu/' },
	{ role: 'higopelive', label: 'Higopelive!', description: 'Higopelive!,その他Live担当ページ', href: 'higopelive/' },
	{ role: 'admin', label: '管理者', description: '', href: 'admin/' }
];

initCommonLayout('role');

document.addEventListener('DOMContentLoaded', async () => {
	initPageTour('role');
	const checkingSection = document.getElementById('role-select-checking');
	const deniedSection = document.getElementById('role-select-denied');
	const mainSection = document.getElementById('role-select-section');

	if (!await requirePageAuthentication()) return;

	const available = ROLE_SELECT_PAGES.filter((page) => hasRole(page.role));
	if (available.length === 0) {
		checkingSection.style.display = 'none';
		deniedSection.style.display = 'block';
		return;
	}

	// ログイン中のパス仕組み：権限が1つだけ、または保存済みの選択があれば即遷移
	const saved = sessionStorage.getItem(ROLE_PAGE_STORAGE_KEY);
	const target = available.find((page) => page.role === saved);
	if (available.length === 1 || target) {
		const destination = target || available[0];
		sessionStorage.setItem(ROLE_PAGE_STORAGE_KEY, destination.role);
		window.location.replace(destination.href);
		return;
	}

	checkingSection.style.display = 'none';
	mainSection.style.display = 'flex';
	renderRoleSelectButtons(available);
});

function renderRoleSelectButtons(pages) {
	const container = document.getElementById('role-select-buttons');
	pages.forEach((page) => {
		const btn = document.createElement('a');
		btn.className = 'btn btn-primary full-width role-select-button';
		btn.href = page.href;
		btn.textContent = page.label;
		btn.addEventListener('click', () => {
			sessionStorage.setItem(ROLE_PAGE_STORAGE_KEY, page.role);
		});
		container.appendChild(btn);

		if (page.description) {
			const desc = document.createElement('p');
			desc.className = 'role-select-description';
			desc.textContent = page.description;
			container.appendChild(desc);
		}
	});
}

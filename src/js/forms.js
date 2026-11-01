initCommonLayout('forms');

document.addEventListener('DOMContentLoaded', async () => {
	initPageTour('forms');
	await requirePageAuthentication();
});

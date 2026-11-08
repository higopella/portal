initCommonLayout('profile');

document.addEventListener('DOMContentLoaded', async () => {
  initPageTour('profile');
  const isAuthenticated = await requirePageAuthentication();
  if (!isAuthenticated) return;

  document.getElementById('profile-form').addEventListener('submit', saveProfile);
  document.getElementById('btn-send-email-otp').addEventListener('click', sendEmailChangeOtp);
  document.getElementById('profile-email-otp-form').addEventListener('submit', verifyEmailChangeOtpCode);
  await loadProfile();
});

async function loadProfile() {
  try {
    const result = await callGasApi('getMyProfile');
    if (!result.success || !result.profile) {
      showToast(result.error || 'ユーザー情報を取得できません', 'error');
      return;
    }
    const profile = result.profile;
    document.getElementById('profile-full-name').value = profile.fullName || '';
    document.getElementById('profile-furigana').value = profile.furigana || '';
    document.getElementById('profile-nickname').value = profile.nickname || '';
    document.getElementById('profile-student-id').value = profile.studentId || '';
    document.getElementById('profile-generation').value = profile.generation || '';
    document.getElementById('profile-faculty').value = profile.faculty || '';
    document.getElementById('profile-department').value = profile.department || '';
    document.getElementById('profile-favorite-artist').value = profile.favoriteArtist || '';
    document.getElementById('profile-current-email').textContent = profile.schoolEmail || '';
  } catch (error) {
    showToast('ユーザー情報の取得に失敗しました', 'error');
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const button = document.getElementById('btn-save-profile');

  const profile = {
    fullName: document.getElementById('profile-full-name').value.trim(),
    furigana: document.getElementById('profile-furigana').value.trim(),
    nickname: document.getElementById('profile-nickname').value.trim(),
    studentId: document.getElementById('profile-student-id').value.trim(),
    generation: Number(document.getElementById('profile-generation').value),
    faculty: document.getElementById('profile-faculty').value,
    department: document.getElementById('profile-department').value.trim(),
    favoriteArtist: document.getElementById('profile-favorite-artist').value.trim()
  };

  const validationError = validateProfile(profile);
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  await withButtonLoading(button, async () => {
    try {
      const result = await callGasApi('updateMyProfile', profile);
      if (!result.success) {
        showToast(result.error || '保存できません', 'error');
        return;
      }
      showToast('保存しました');
    } catch (error) {
      showToast('保存に失敗しました', 'error');
    }
  }, '保存中...');
}

function validateProfile(profile) {
  if (!profile.fullName || profile.fullName.length > 50) return '氏名は1〜50文字で入力してください';
  if (!/^[ぁ-んァ-ヶー\s　]+$/.test(profile.furigana) || profile.furigana.length > 50) return 'ふりがなは1〜50文字のかなで入力してください';
  if (!profile.nickname || profile.nickname.length > 10) return 'ニックネームは1〜10文字で入力してください';
  if (!/^[A-Za-z0-9]{4,20}$/.test(profile.studentId)) return '学籍番号は4〜20文字の英数字で入力してください';
  if (!Number.isInteger(profile.generation) || profile.generation < 1 || profile.generation > 99) return '期は1〜99の整数で入力してください';
  if (!profile.faculty) return '学部を選択してください';
  if (!profile.department || profile.department.length > 50) return '学科は1〜50文字で入力してください';
  if (profile.favoriteArtist.length > 100) return '好きなアーティスト/ジャンルは100文字以内で入力してください';
  return null;
}

async function sendEmailChangeOtp() {
  const button = document.getElementById('btn-send-email-otp');
  const newSchoolEmail = document.getElementById('profile-new-email').value.trim();
  if (!newSchoolEmail) {
    showToast('新しい学校メールアドレスを入力してください', 'error');
    return;
  }

  await withButtonLoading(button, async () => {
    try {
      const result = await callGasApi('requestEmailChangeOtp', { newSchoolEmail });
      if (!result.success) {
        showToast(result.error || '確認コードを送信できません', 'error');
        return;
      }
      document.getElementById('profile-email-otp-form').classList.remove('is-hidden');
      showToast('確認コードを送信しました');
    } catch (error) {
      showToast('確認コードの送信に失敗しました', 'error');
    }
  }, '送信中...');
}

async function verifyEmailChangeOtpCode(event) {
  event.preventDefault();
  const button = document.getElementById('btn-verify-email-otp');
  const otp = document.getElementById('profile-email-otp').value.trim();

  await withButtonLoading(button, async () => {
    try {
      const result = await callGasApi('verifyEmailChangeOtp', { otp });
      if (!result.success) {
        showToast(result.error || '確認コードを確認できません', 'error');
        return;
      }
      document.getElementById('profile-current-email').textContent = result.schoolEmail || '';
      document.getElementById('profile-new-email').value = '';
      document.getElementById('profile-email-otp').value = '';
      document.getElementById('profile-email-otp-form').classList.add('is-hidden');
      showToast('メールアドレスを変更しました');
    } catch (error) {
      showToast('メールアドレスの変更に失敗しました', 'error');
    }
  }, '変更中...');
}

const SIGNUP_GOOGLE_OAUTH_CLIENT_ID = '65097864960-vbe2ukqcoi9mpqc9capgtu9mak6vf4qs.apps.googleusercontent.com';

document.addEventListener('DOMContentLoaded', () => {
  initializeSignupGoogleLogin();

  const profileForm = document.getElementById('signup-profile-form');
  if (profileForm) profileForm.addEventListener('submit', requestSignupOtp);

  const otpForm = document.getElementById('signup-otp-form');
  if (otpForm) otpForm.addEventListener('submit', verifySignupOtp);

  const externalToggle = document.getElementById('signup-external-toggle');
  if (externalToggle) externalToggle.addEventListener('click', toggleExternalMode);
});

function initializeSignupGoogleLogin() {
  const buttonContainer = document.getElementById('signup-google-button');
  if (!buttonContainer) return;
  if (!window.google || !google.accounts || !google.accounts.id) {
    const googleScript = document.getElementById('google-identity-script');
    if (googleScript) googleScript.addEventListener('load', initializeSignupGoogleLogin, { once: true });
    return;
  }

  google.accounts.id.initialize({
    client_id: SIGNUP_GOOGLE_OAUTH_CLIENT_ID,
    callback: handleSignupGoogleCredential
  });
  google.accounts.id.renderButton(buttonContainer, { theme: 'outline', size: 'large', width: 280 });
}

async function handleSignupGoogleCredential(response) {
  if (!response || !response.credential) {
    showToast('Google認証に失敗しました', 'error');
    return;
  }

  setCurrentIdToken(response.credential);
  try {
    const result = await callGasApi('authenticateGoogle', { idToken: response.credential });
    if (result.status === 'authenticated') {
      setUserLogin(true);
      setUserRoles(result.user && Array.isArray(result.user.roles) ? result.user.roles : (result.user && result.user.role ? [result.user.role] : []));
      recordLoginHistory();
      window.location.replace('../');
      return;
    }
    if (result.status === 'unregistered') {
      document.getElementById('signup-google-panel').classList.add('is-hidden');
      document.getElementById('signup-profile-form').classList.remove('is-hidden');
      return;
    }
    clearCurrentIdToken();
    showToast(result.error || '登録を開始できません', 'error');
  } catch (error) {
    clearCurrentIdToken();
    showToast('認証に失敗しました', 'error');
  }
}

let isExternalMode = false;

function toggleExternalMode() {
  isExternalMode = !isExternalMode;
  document.getElementById('signup-invite-area').classList.toggle('is-hidden', !isExternalMode);
  document.getElementById('signup-school-email-label').classList.toggle('is-hidden', isExternalMode);
  const emailInput = document.getElementById('signup-school-email');
  emailInput.classList.toggle('is-hidden', isExternalMode);
  emailInput.required = !isExternalMode;
  document.getElementById('signup-external-toggle').textContent = isExternalMode ? '熊本大学の方はこちら' : '熊本大学以外の方はこちら';
  ['signup-student-id', 'signup-faculty', 'signup-department'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.required = !isExternalMode;
  });
  if (!isExternalMode) document.getElementById('signup-invite-code').value = '';
}

async function requestSignupOtp(event) {
  event.preventDefault();
  const button = document.getElementById('btn-request-otp');
  const idToken = getCurrentIdToken();
  if (!idToken) return;

  const profile = {
    fullName: document.getElementById('signup-full-name').value.trim(),
    furigana: document.getElementById('signup-furigana').value.trim(),
    nickname: document.getElementById('signup-nickname').value.trim(),
    schoolEmail: isExternalMode ? '' : document.getElementById('signup-school-email').value.trim(),
    studentId: document.getElementById('signup-student-id').value.trim(),
    generation: Number(document.getElementById('signup-generation').value),
    faculty: document.getElementById('signup-faculty').value,
    department: document.getElementById('signup-department').value.trim(),
    favoriteArtist: document.getElementById('signup-favorite-artist').value.trim(),
    inviteCode: isExternalMode ? document.getElementById('signup-invite-code').value.trim() : ''
  };

  const validationError = validateSignupProfile(profile, isExternalMode);
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  await withButtonLoading(button, async () => {
    try {
      const result = await callGasApi('requestOtp', { idToken, ...profile });
      if (!result.success) {
        showToast(result.error || 'パスキーを送信できません', 'error');
        return;
      }
      document.getElementById('signup-profile-form').classList.add('is-hidden');
      document.getElementById('signup-otp-form').classList.remove('is-hidden');
      if (isExternalMode) {
        const googleEmail = getEmailFromIdToken(idToken);
        const description = document.getElementById('signup-otp-description');
        if (description && googleEmail) description.textContent = `Googleアカウント（${googleEmail}）に届いた6桁の確認コードを入力してください`;
      }
      showToast('パスキーを送信しました');
    } catch (error) {
      showToast('パスキーの送信に失敗しました', 'error');
    }
  }, '送信中...');
}

function validateSignupProfile(profile, isExternal) {
  if (!profile.fullName || profile.fullName.length > 20) return '氏名は1〜20文字で入力してください';
  if (!/^[ぁ-んァ-ヶー\s　]+$/.test(profile.furigana) || profile.furigana.length > 20) return 'ふりがなは1〜20文字のかなで入力してください';
  if (!profile.nickname || profile.nickname.length > 10) return 'ニックネームは1〜10文字で入力してください';
  if (!isExternal && !profile.schoolEmail) return '大学メールアドレスを入力してください';
  if (isExternal && !profile.inviteCode) return '招待コードを入力してください';
  if (profile.studentId && !/^[A-Za-z0-9]{8,10}$/.test(profile.studentId)) return '学籍番号は8〜10文字の英数字で入力してください';
  if (!isExternal && !profile.studentId) return '学籍番号を入力してください';
  if (!Number.isInteger(profile.generation) || profile.generation < 1 || profile.generation > 99) return '期は1〜99の整数で入力してください';
  if (!isExternal && !profile.faculty) return '学部を選択してください';
  if (profile.department.length > 10 || (!isExternal && !profile.department)) return '学科は1〜10文字で入力してください';
  if (profile.favoriteArtist.length > 20) return '好きなアーティスト/ジャンルは１〜20文字以内で入力してください';
  return null;
}

async function verifySignupOtp(event) {
  event.preventDefault();
  const button = document.getElementById('btn-verify-otp');
  const schoolEmail = isExternalMode ? '' : document.getElementById('signup-school-email').value.trim();
  const nickname = document.getElementById('signup-nickname').value.trim();
  const otp = document.getElementById('signup-otp').value.trim();
  const inviteCode = isExternalMode ? document.getElementById('signup-invite-code').value.trim() : '';
  const idToken = getCurrentIdToken();
  if (!idToken) return;

  await withButtonLoading(button, async () => {
    try {
      const result = await callGasApi('verifyOtp', { idToken, schoolEmail, nickname, otp, inviteCode });
      if (!result.success) {
        if (result.code === 'USER_ALREADY_EXISTS' && await finalizeSignupAsLoggedIn()) return;
        showToast(result.error || '確認コードを確認できません', 'error');
        return;
      }
      setUserLogin(true);
      setUserRoles(result.user && Array.isArray(result.user.roles) ? result.user.roles : (result.user && result.user.role ? [result.user.role] : []));
      recordLoginHistory();
      showToast('登録が完了しました');
      window.location.replace('../');
    } catch (error) {
      if (await finalizeSignupAsLoggedIn()) return;
      showToast('登録に失敗しました', 'error');
    }
  }, '登録中...');
}

function getEmailFromIdToken(idToken) {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload && payload.email ? String(payload.email) : '';
  } catch (error) {
    return '';
  }
}

async function finalizeSignupAsLoggedIn() {
  try {
    const result = await callGasApi('authenticateGoogle', { idToken: getCurrentIdToken() });
    if (result.status === 'authenticated') {
      setUserLogin(true);
      setUserRoles(result.user && Array.isArray(result.user.roles) ? result.user.roles : (result.user && result.user.role ? [result.user.role] : []));
      recordLoginHistory();
      showToast('登録が完了しました');
      window.location.replace('../');
      return true;
    }
  } catch (error) {}
  return false;
}
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBNtPX9hy5571gDKoXvxV8QN8uXCdsLVng',
  authDomain: 'my-scoreboard-pwa.firebaseapp.com',
  projectId: 'my-scoreboard-pwa',
  storageBucket: 'my-scoreboard-pwa.firebasestorage.app',
  messagingSenderId: '367812239652',
  appId: '1:367812239652:web:867c4631d6587b9d8713b1'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const provider = new GoogleAuthProvider();

let currentUser = null;
let hasStartedApp = false;

export function getCurrentUser() {
  return currentUser;
}

export function getFirebaseAuth() {
  return auth;
}

export function getFirebaseDb() {
  return db;
}

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error('Google sign-in failed.', err);
    showAuthError(getFriendlyAuthError_(err));
  }
}

export async function signOutUser() {
  await signOut(auth);
  window.location.hash = '';
  window.location.reload();
}

export function initAuthGate(onSignedIn) {
  renderAuthShell_();
  bindAuthButtons_();

  onAuthStateChanged(auth, async user => {
    currentUser = user || null;

    if (!user) {
      hasStartedApp = false;
      showSignedOut_();
      return;
    }

    showSigningIn_('Loading your scoreboard...');

    try {
      await upsertUserProfile_(user);
      showSignedIn_(user);

      if (!hasStartedApp) {
        hasStartedApp = true;
        await onSignedIn(user);
      }
    } catch (err) {
      console.error('Could not create Firebase user profile.', err);
      showAuthError('You are signed in, but your profile could not be saved. Check Firestore rules and try again.');
    }
  });
}

async function upsertUserProfile_(user) {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  const baseProfile = {
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    provider: 'google',
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...baseProfile,
      createdAt: serverTimestamp(),
      settings: {
        density: 'expanded',
        theme: 'default'
      },
      favorites: {},
      roku: {}
    });
    return;
  }

  await setDoc(userRef, baseProfile, { merge: true });
}

function renderAuthShell_() {
  if (document.getElementById('auth-gate')) return;

  const gate = document.createElement('div');
  gate.id = 'auth-gate';
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">🏟️</div>
      <h1>My Scoreboard</h1>
      <p class="auth-subtitle">Sign in to sync your scoreboard settings and prepare for personalized teams, golfers, and Roku pairing.</p>
      <button id="google-signin-btn" class="google-signin-btn" type="button">
        <span class="google-g">G</span>
        <span>Sign in with Google</span>
      </button>
      <p id="auth-status" class="auth-status">Firebase authentication is enabled. Scores still come from your existing backend.</p>
    </div>
  `;

  document.body.appendChild(gate);
}

function bindAuthButtons_() {
  const signInBtn = document.getElementById('google-signin-btn');
  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      showSigningIn_('Opening Google sign-in...');
      signInWithGoogle();
    });
  }

  const signOutBtn = document.getElementById('signout-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', signOutUser);
  }
}

function showSignedOut_() {
  const gate = document.getElementById('auth-gate');
  if (gate) gate.style.display = 'flex';

  const app = document.querySelector('.app');
  if (app) app.classList.add('auth-locked');

  const status = document.getElementById('auth-status');
  if (status) status.textContent = 'Sign in to continue.';

  const signInBtn = document.getElementById('google-signin-btn');
  if (signInBtn) signInBtn.disabled = false;
}

function showSigningIn_(message) {
  const status = document.getElementById('auth-status');
  if (status) status.textContent = message || 'Signing in...';

  const signInBtn = document.getElementById('google-signin-btn');
  if (signInBtn) signInBtn.disabled = true;
}

function showSignedIn_(user) {
  const gate = document.getElementById('auth-gate');
  if (gate) gate.style.display = 'none';

  const app = document.querySelector('.app');
  if (app) app.classList.remove('auth-locked');

  renderUserChip_(user);
}

function renderUserChip_(user) {
  const target = document.querySelector('.top-actions');
  if (!target || document.getElementById('user-chip')) return;

  const chip = document.createElement('div');
  chip.id = 'user-chip';
  chip.className = 'user-chip';

  const photo = user.photoURL
    ? `<img src="${escapeHtml_(user.photoURL)}" alt="" />`
    : `<span class="user-avatar-fallback">${escapeHtml_((user.displayName || user.email || 'U').charAt(0).toUpperCase())}</span>`;

  chip.innerHTML = `
    <button id="user-menu-btn" class="user-menu-btn" type="button" aria-expanded="false">
      ${photo}
      <span>${escapeHtml_(user.displayName || user.email || 'Signed in')}</span>
    </button>
    <div id="user-menu" class="user-menu" hidden>
      <div class="user-menu-name">${escapeHtml_(user.displayName || 'Signed in')}</div>
      <div class="user-menu-email">${escapeHtml_(user.email || '')}</div>
      <button id="signout-btn" type="button">Sign Out</button>
    </div>
  `;

  target.appendChild(chip);

  const menuBtn = document.getElementById('user-menu-btn');
  const menu = document.getElementById('user-menu');
  const signOutBtn = document.getElementById('signout-btn');

  if (menuBtn && menu) {
    menuBtn.addEventListener('click', event => {
      event.stopPropagation();
      const isHidden = menu.hidden;
      menu.hidden = !isHidden;
      menuBtn.setAttribute('aria-expanded', String(isHidden));
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', signOutUser);
  }

  document.addEventListener('click', () => {
    if (menu && !menu.hidden) {
      menu.hidden = true;
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

function showAuthError(message) {
  const status = document.getElementById('auth-status');
  if (status) status.textContent = message || 'Sign-in failed. Please try again.';

  const signInBtn = document.getElementById('google-signin-btn');
  if (signInBtn) signInBtn.disabled = false;
}

function getFriendlyAuthError_(err) {
  const code = String(err?.code || '');

  if (code.includes('unauthorized-domain')) {
    return 'This domain is not authorized in Firebase Authentication. Add your GitHub Pages domain under Authentication > Settings > Authorized domains.';
  }

  if (code.includes('popup-closed-by-user')) {
    return 'Sign-in was cancelled.';
  }

  if (code.includes('popup-blocked')) {
    return 'The sign-in popup was blocked. Allow popups for this site and try again.';
  }

  return err?.message || 'Google sign-in failed. Please try again.';
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

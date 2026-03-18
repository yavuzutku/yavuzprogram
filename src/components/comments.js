
/**
 * comments.js — Evrensel Yorum Sistemi
 * AlmancaPratik için yeniden kullanılabilir yorum bileşeni.
 *
 * Kullanım:
 *   import { initComments } from '../../src/components/comments.js';
 *
 *   initComments('mountElementId', {
 *     context:     'seviyetespit',          // sayfa/bölüm tanımlayıcı
 *     contextId:   '',                      // opsiyonel – belirli içerik (blog post id gibi)
 *     contextData: { level, score, total }, // opsiyonel – kullanıcıya özel rozet
 *   });
 *
 * Firestore Gereksinimleri:
 *   Collection: comments
 *   Composite index: context ASC, contextId ASC, createdAt DESC
 *   (Firebase ilk sorguda index URL'i otomatik verir)
 *
 *   Collection: userProfiles
 *   Security rules (örnek):
 *     comments  → read: true, create: auth!=null && userId==auth.uid, update: owner
 *     userProfiles → read: true, write: auth!=null && uid==auth.uid
 */

import { auth, db }       from '../../js/firebase.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection, addDoc, getDocs, getDoc, updateDoc,
  doc, query, orderBy, where, serverTimestamp,
  arrayUnion, arrayRemove, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showAuthGate } from './authGate.js';

/* ══════════════════════════════════════════════
   CSS INJECTION
══════════════════════════════════════════════ */
function injectCSS() {
  if (document.getElementById('__cm-style')) return;
  const link = document.createElement('link');
  link.id   = '__cm-style';
  link.rel  = 'stylesheet';
  link.href = new URL('../styles/comments.css', import.meta.url).href;
  document.head.appendChild(link);
}

/* ══════════════════════════════════════════════
   MODULE STATE
══════════════════════════════════════════════ */
let _user        = null;   // Firebase kullanıcısı
let _profile     = null;   // { username }
let _container   = null;   // mount DOM elementi
let _opts        = {};     // { context, contextId, contextData }
let _comments    = [];     // yüklenen yorumlar
let _replyTarget = null;   // { id, username } – yanıtlama hedefi
let _busy        = false;  // submit işlemi sürüyor mu

/* ── Auth listener — modül yüklenince başlar ── */
onAuthStateChanged(auth, async (user) => {
  _user    = user;
  _profile = user ? await _loadProfile(user.uid) : null;
  if (_container) _renderAll();
});

/* ══════════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════════ */
export async function initComments(containerId, opts = {}) {
  injectCSS();

  _opts = {
    context:     opts.context     || 'general',
    contextId:   opts.contextId   || '',
    contextData: opts.contextData || null,
  };
  _replyTarget = null;
  _container   = document.getElementById(containerId);
  if (!_container) return;

  /* Skeleton göster */
  _container.innerHTML = _buildSkeleton();

  /* Verileri paralel yükle */
  const [comments] = await Promise.all([
    _loadComments(),
    _user && !_profile ? _loadProfile(_user.uid).then(p => { _profile = p; }) : null,
  ]);
  _comments = comments;

  _renderAll();
}

/* ══════════════════════════════════════════════
   FIRESTORE — READ
══════════════════════════════════════════════ */
async function _loadProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'userProfiles', uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

async function _checkUsernameAvailable(username) {
  try {
    const q    = query(collection(db, 'userProfiles'), where('username', '==', username));
    const snap = await getDocs(q);
    return snap.empty;
  } catch { return false; }
}

async function _loadComments() {
  try {
    const q = query(
      collection(db, 'comments'),
      where('context',   '==', _opts.context),
      where('contextId', '==', _opts.contextId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[comments] loadComments:', e.message);
    return [];
  }
}

/* ══════════════════════════════════════════════
   FIRESTORE — WRITE
══════════════════════════════════════════════ */
async function _saveUsername(uid, username) {
  await setDoc(doc(db, 'userProfiles', uid), {
    username:  username.trim(),
    createdAt: serverTimestamp(),
  });
}

async function _submitComment(text, parentId = null) {
  if (!_user || !_profile || _busy) return;
  _busy = true;

  const data = {
    userId:      _user.uid,
    username:    _profile.username,
    text:        text.trim(),
    context:     _opts.context,
    contextId:   _opts.contextId,
    contextData: parentId ? null : (_opts.contextData || null),
    likes:       [],
    parentId:    parentId || null,
    createdAt:   serverTimestamp(),
    deleted:     false,
  };

  try {
    const ref   = await addDoc(collection(db, 'comments'), data);
    const local = { ...data, id: ref.id, createdAt: { toDate: () => new Date() } };
    parentId ? _comments.push(local) : _comments.unshift(local);
    _replyTarget = null;
    _renderAll();
  } finally {
    _busy = false;
  }
}

async function _toggleLike(commentId) {
  if (!_user) {
    showAuthGate({ title: 'Beğenmek için giriş yap', desc: 'AlmancaPratik topluluğuna ücretsiz katıl.' });
    return;
  }

  const cm    = _comments.find(c => c.id === commentId);
  if (!cm) return;

  const uid   = _user.uid;
  const liked = (cm.likes || []).includes(uid);

  /* Optimistik güncelleme */
  cm.likes = liked
    ? (cm.likes || []).filter(u => u !== uid)
    : [...(cm.likes || []), uid];
  _renderAll();

  try {
    await updateDoc(doc(db, 'comments', commentId),
      liked ? { likes: arrayRemove(uid) } : { likes: arrayUnion(uid) },
    );
  } catch {
    /* Hata → geri al */
    cm.likes = liked
      ? [...(cm.likes || []), uid]
      : (cm.likes || []).filter(u => u !== uid);
    _renderAll();
  }
}

async function _deleteComment(commentId) {
  if (!_user) return;
  const cm = _comments.find(c => c.id === commentId);
  if (!cm || cm.userId !== _user.uid) return;
  if (!confirm('Bu yorumu silmek istediğine emin misin?')) return;

  try {
    await updateDoc(doc(db, 'comments', commentId), { deleted: true });
    cm.deleted = true;
    _renderAll();
  } catch (e) { console.error('[comments] delete:', e); }
}

/* ══════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════ */
function _renderAll() {
  if (!_container) return;
  _container.innerHTML = _buildHTML();
  _bindEvents();
}

/* ── Skeleton ── */
function _buildSkeleton() {
  return `<div class="cm-wrap" style="opacity:.5">
    <div class="cm-skel" style="width:130px;height:24px;margin-bottom:22px"></div>
    <div class="cm-skel" style="height:90px;margin-bottom:12px"></div>
    <div class="cm-skel" style="height:72px;margin-bottom:12px"></div>
    <div class="cm-skel" style="height:60px"></div>
  </div>`;
}

/* ── Ana yapı ── */
function _buildHTML() {
  const topLevel    = _comments.filter(c => !c.parentId);
  const visibleCount = topLevel.filter(c => !c.deleted).length;

  return `
    <div class="cm-wrap">
      <div class="cm-header">
        <span class="cm-title">Yorumlar</span>
        <span class="cm-count">${visibleCount}</span>
      </div>

      ${_buildFormSection()}

      <div class="cm-list">
        ${topLevel.length === 0
          ? _buildEmpty()
          : topLevel.map(_buildCommentHTML).join('')}
      </div>
    </div>

    ${_buildUsernameModal()}
  `;
}

/* ── Form / auth prompt ── */
function _buildFormSection() {
  if (!_user) {
    return `
      <div class="cm-auth-prompt">
        <div class="cm-auth-prompt__icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div class="cm-auth-prompt__body">
          <div class="cm-auth-prompt__title">Düşüncelerini paylaş</div>
          <div class="cm-auth-prompt__desc">Yorum yapmak için giriş yap</div>
        </div>
        <button class="cm-auth-prompt__btn" id="cm-do-login">Giriş Yap →</button>
      </div>`;
  }

  if (!_profile) {
    return `
      <div class="cm-auth-prompt">
        <div class="cm-auth-prompt__icon">🏷️</div>
        <div class="cm-auth-prompt__body">
          <div class="cm-auth-prompt__title">Kullanıcı adı seç</div>
          <div class="cm-auth-prompt__desc">Yorum yapmadan önce benzersiz bir kullanıcı adı belirle</div>
        </div>
        <button class="cm-auth-prompt__btn" id="cm-open-username">Kullanıcı Adı Seç →</button>
      </div>`;
  }

  const avatar  = _avatarUrl(_user, _profile.username);
  const badge   = _opts.contextData?.level
    ? _levelBadge(_opts.contextData.level, _opts.contextData.score, _opts.contextData.total)
    : '';

  return `
    <div class="cm-form">
      <div class="cm-form__meta">
        <img class="cm-avatar" src="${_esc(avatar)}" alt="">
        <span class="cm-uname">@${_esc(_profile.username)}</span>
        ${badge}
      </div>
      <textarea
        class="cm-textarea" id="cm-ta"
        placeholder="Düşüncelerini paylaş… Hangi seviyedesin? Nasıl geçti? 😊"
        maxlength="500" rows="3"
      ></textarea>
      <div class="cm-form__footer">
        <span class="cm-char" id="cm-char">0 / 500</span>
        <button class="cm-btn-send" id="cm-send">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Yorum Yap
        </button>
      </div>
    </div>`;
}

/* ── Yorum kartı ── */
function _buildCommentHTML(comment) {
  const replies = _comments.filter(c => c.parentId === comment.id && !c.deleted);

  if (comment.deleted) {
    if (replies.length === 0) return '';
    return `
      <div class="cm-item cm-item--deleted">
        <div class="cm-item__deleted">[Bu yorum silindi]</div>
        <div class="cm-replies">${replies.map(_buildReplyHTML).join('')}</div>
      </div>`;
  }

  const likeCount  = (comment.likes || []).length;
  const liked      = !!(_user && (comment.likes || []).includes(_user.uid));
  const isOwn      = !!(_user && comment.userId === _user.uid);
  const isReplying = _replyTarget?.id === comment.id;
  const badge      = comment.contextData?.level
    ? _levelBadge(comment.contextData.level, comment.contextData.score, comment.contextData.total)
    : '';

  return `
    <div class="cm-item" data-id="${comment.id}">
      <div class="cm-item__header">
        <img class="cm-avatar-sm" src="${_esc(_avatarUrl(null, comment.username))}" alt="">
        <span class="cm-uname">@${_esc(comment.username)}</span>
        ${badge}
        <span class="cm-time">${_timeAgo(comment.createdAt)}</span>
      </div>

      <div class="cm-item__body">${_esc(comment.text)}</div>

      <div class="cm-item__actions">
        <button class="cm-action-btn cm-like${liked ? ' cm-liked' : ''}" data-id="${comment.id}" title="Beğen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          ${likeCount > 0 ? likeCount : ''}
        </button>

        <button class="cm-action-btn cm-reply-toggle" data-id="${comment.id}" data-user="${_esc(comment.username)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          ${isReplying ? 'İptal' : 'Yanıtla'}
        </button>

        ${isOwn ? `
          <button class="cm-action-btn cm-del" data-id="${comment.id}" title="Sil">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Sil
          </button>` : ''}
      </div>

      ${isReplying ? _buildReplyForm(comment.id, comment.username) : ''}

      ${replies.length > 0 ? `
        <div class="cm-replies">
          ${replies.map(_buildReplyHTML).join('')}
        </div>` : ''}
    </div>`;
}

/* ── Yanıt kartı ── */
function _buildReplyHTML(reply) {
  const likeCount = (reply.likes || []).length;
  const liked     = !!(_user && (reply.likes || []).includes(_user.uid));
  const isOwn     = !!(_user && reply.userId === _user.uid);

  return `
    <div class="cm-reply" data-id="${reply.id}">
      <div class="cm-item__header">
        <img class="cm-avatar-sm" src="${_esc(_avatarUrl(null, reply.username))}" alt="">
        <span class="cm-uname">@${_esc(reply.username)}</span>
        <span class="cm-time">${_timeAgo(reply.createdAt)}</span>
      </div>
      <div class="cm-item__body">${_esc(reply.text)}</div>
      <div class="cm-item__actions">
        <button class="cm-action-btn cm-like${liked ? ' cm-liked' : ''}" data-id="${reply.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          ${likeCount > 0 ? likeCount : ''}
        </button>
        ${isOwn ? `
          <button class="cm-action-btn cm-del" data-id="${reply.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Sil
          </button>` : ''}
      </div>
    </div>`;
}

/* ── Yanıt formu ── */
function _buildReplyForm(parentId, parentUsername) {
  if (!_profile) return '';
  const avatar = _avatarUrl(_user, _profile.username);
  return `
    <div class="cm-reply-form">
      <img class="cm-avatar-sm" src="${_esc(avatar)}" alt="">
      <div class="cm-reply-form__inner">
        <textarea
          class="cm-reply-ta" id="cm-rta-${parentId}"
          placeholder="@${_esc(parentUsername)}'a yanıtla…"
          maxlength="300" rows="2"
        ></textarea>
        <div class="cm-reply-form__actions">
          <button class="cm-btn-reply-cancel" data-id="${parentId}">İptal</button>
          <button class="cm-btn-reply-send"   data-parent="${parentId}">Yanıtla</button>
        </div>
      </div>
    </div>`;
}

/* ── Boş durum ── */
function _buildEmpty() {
  return `
    <div class="cm-empty">
      <div class="cm-empty__icon">💬</div>
      <p>Henüz yorum yok. İlk yorumu sen yap!</p>
    </div>`;
}

/* ── Username modal ── */
function _buildUsernameModal() {
  return `
    <div class="cm-modal" id="cm-modal" style="display:none" role="dialog" aria-modal="true" aria-label="Kullanıcı adı seç">
      <div class="cm-modal__card">
        <button class="cm-modal__close" id="cm-modal-close" aria-label="Kapat">✕</button>
        <div class="cm-modal__icon">🏷️</div>
        <h3 class="cm-modal__title">Kullanıcı Adın</h3>
        <p class="cm-modal__desc">Yorumlarda görünecek benzersiz bir kullanıcı adı seç.</p>
        <input
          type="text" id="cm-uname-input"
          class="cm-modal__input"
          placeholder="ör. almanca_seviye_b2"
          maxlength="20" autocomplete="off" spellcheck="false"
        >
        <p class="cm-uname-hint" id="cm-uname-hint" aria-live="polite"></p>
        <div class="cm-modal__rules">
          <span>3–20 karakter</span>
          <span>a–z, 0–9, alt çizgi</span>
          <span>Benzersiz olmalı</span>
        </div>
        <button class="cm-modal__save" id="cm-uname-save">Kaydet →</button>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════
   EVENT BINDING
══════════════════════════════════════════════ */
function _bindEvents() {
  /* ── Auth prompt ── */
  document.getElementById('cm-do-login')?.addEventListener('click', () => {
    showAuthGate({
      title: 'Yorum yapmak için giriş yap',
      desc:  'AlmancaPratik topluluğuna ücretsiz katıl ve düşüncelerini paylaş.',
    });
  });
  document.getElementById('cm-open-username')?.addEventListener('click', _openModal);

  /* ── Ana form ── */
  const ta = document.getElementById('cm-ta');
  if (ta) {
    ta.addEventListener('input', () => {
      const el = document.getElementById('cm-char');
      if (el) {
        el.textContent  = `${ta.value.length} / 500`;
        el.style.color  = ta.value.length > 450 ? '#f07068' : '';
      }
    });
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); _handleMainSubmit(); }
    });
  }
  document.getElementById('cm-send')?.addEventListener('click', _handleMainSubmit);

  /* ── Beğeni ── */
  document.querySelectorAll('.cm-like').forEach(btn =>
    btn.addEventListener('click', () => _toggleLike(btn.dataset.id)),
  );

  /* ── Yanıtla toggle ── */
  document.querySelectorAll('.cm-reply-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_user) {
        showAuthGate({ title: 'Yanıtlamak için giriş yap' }); return;
      }
      if (!_profile) { _openModal(); return; }
      const id   = btn.dataset.id;
      const user = btn.dataset.user;
      _replyTarget = (_replyTarget?.id === id) ? null : { id, username: user };
      _renderAll();
      if (_replyTarget) setTimeout(() => document.getElementById(`cm-rta-${id}`)?.focus(), 30);
    });
  });

  /* ── Yanıt iptal ── */
  document.querySelectorAll('.cm-btn-reply-cancel').forEach(btn =>
    btn.addEventListener('click', () => { _replyTarget = null; _renderAll(); }),
  );

  /* ── Yanıt gönder ── */
  document.querySelectorAll('.cm-btn-reply-send').forEach(btn =>
    btn.addEventListener('click', () => _handleReplySubmit(btn.dataset.parent)),
  );

  /* ── Sil ── */
  document.querySelectorAll('.cm-del').forEach(btn =>
    btn.addEventListener('click', () => _deleteComment(btn.dataset.id)),
  );

  /* ── Modal ── */
  document.getElementById('cm-modal-close')?.addEventListener('click', _closeModal);
  document.getElementById('cm-modal')?.addEventListener('click', e => {
    if (e.target.id === 'cm-modal') _closeModal();
  });

  const unameInput = document.getElementById('cm-uname-input');
  if (unameInput) {
    unameInput.addEventListener('input', _debounce(_checkUnameInput, 420));
    unameInput.addEventListener('keydown', e => { if (e.key === 'Enter') _handleSaveUsername(); });
  }
  document.getElementById('cm-uname-save')?.addEventListener('click', _handleSaveUsername);
}

/* ── Submit handlers ── */
async function _handleMainSubmit() {
  const ta  = document.getElementById('cm-ta');
  const btn = document.getElementById('cm-send');
  const text = ta?.value.trim();
  if (!text || _busy) return;

  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    await _submitComment(text);
    if (ta) ta.value = '';
    const charEl = document.getElementById('cm-char');
    if (charEl) charEl.textContent = '0 / 500';
  } catch (e) { console.error('[comments] submit:', e); }
  finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Yorum Yap`;
    }
  }
}

async function _handleReplySubmit(parentId) {
  const ta  = document.getElementById(`cm-rta-${parentId}`);
  const btn = document.querySelector(`.cm-btn-reply-send[data-parent="${parentId}"]`);
  const text = ta?.value.trim();
  if (!text || _busy) return;

  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    await _submitComment(text, parentId);
  } catch (e) {
    console.error('[comments] reply submit:', e);
    if (btn) { btn.disabled = false; btn.textContent = 'Yanıtla'; }
  }
}

/* ══════════════════════════════════════════════
   USERNAME MODAL
══════════════════════════════════════════════ */
let _unameOk = false;

function _openModal() {
  const modal = document.getElementById('cm-modal');
  if (modal) modal.style.display = 'flex';
  _unameOk = false;
  setTimeout(() => document.getElementById('cm-uname-input')?.focus(), 50);
}

function _closeModal() {
  const modal = document.getElementById('cm-modal');
  if (modal) modal.style.display = 'none';
}

async function _checkUnameInput() {
  const val  = (document.getElementById('cm-uname-input')?.value || '').trim();
  const hint = document.getElementById('cm-uname-hint');
  if (!hint) return;

  _unameOk = false;

  if (!val) { hint.textContent = ''; hint.className = 'cm-uname-hint'; return; }
  if (val.length < 3) {
    hint.textContent = 'En az 3 karakter gerekli.';
    hint.className = 'cm-uname-hint cm-hint-err'; return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(val)) {
    hint.textContent = 'Sadece harf, rakam ve _ kullanabilirsin.';
    hint.className = 'cm-uname-hint cm-hint-err'; return;
  }

  hint.textContent = 'Kontrol ediliyor…'; hint.className = 'cm-uname-hint';

  const available = await _checkUsernameAvailable(val);
  if (available) {
    hint.textContent = '✓ Kullanılabilir!';
    hint.className   = 'cm-uname-hint cm-hint-ok';
    _unameOk = true;
  } else {
    hint.textContent = '✗ Bu kullanıcı adı alınmış.';
    hint.className   = 'cm-uname-hint cm-hint-err';
  }
}

async function _handleSaveUsername() {
  const val = (document.getElementById('cm-uname-input')?.value || '').trim();
  const btn = document.getElementById('cm-uname-save');

  if (!val || val.length < 3 || !/^[a-zA-Z0-9_]+$/.test(val)) return;

  if (!_unameOk) {
    await _checkUnameInput();
    if (!_unameOk) return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Kaydediliyor…'; }
  try {
    await _saveUsername(_user.uid, val);
    _profile = { username: val };
    _closeModal();
    _renderAll();
  } catch (e) {
    console.error('[comments] saveUsername:', e);
    if (btn) { btn.disabled = false; btn.textContent = 'Kaydet →'; }
  }
}

/* ══════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════ */
function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _avatarUrl(user, username) {
  if (user?.photoURL) return user.photoURL;
  const name = encodeURIComponent(username || 'U');
  return `https://ui-avatars.com/api/?name=${name}&background=1e1830&color=a064ff&size=64&bold=true`;
}

function _levelBadge(level, score, total) {
  const colors = { A1: '#22c55e', A2: '#86efac', B1: '#60c8f0', B2: '#818cf8', C1: '#c9a84c' };
  const c      = colors[level] || '#c9a84c';
  const extra  = (score != null && total) ? ` · ${score}/${total}` : '';
  return `<span class="cm-badge" style="color:${c};border-color:${c}33;background:${c}15;">${_esc(level)}${extra}</span>`;
}

function _timeAgo(ts) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return '';
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'az önce';
  if (mins < 60) return `${mins} dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün`;
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

function _debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
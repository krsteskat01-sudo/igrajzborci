// ── chat.js — Real-time hub community chat ────────────────────
// Requires: db, currentUser, playerAvatarHtml, escHtml,
//           loadPlayerName, loadAvatarId  (all defined in earlier scripts)

let _chatUnsub       = null;   // Firestore onSnapshot unsubscribe fn
let _chatCachedDocs  = [];     // last snapshot docs — survives hub re-renders
let _chatRenderedIds = new Set();
let _chatLastSentMs  = 0;

const CHAT_COOLDOWN_MS = 60 * 1000; // 1 comment per minute per session

// ── Start / Stop ──────────────────────────────────────────────
function chatStart() {
  if (_chatUnsub || typeof db === 'undefined' || !currentUser) return;
  _chatUnsub = db.collection('comments')
    .orderBy('timestamp', 'asc')
    .limitToLast(20)
    .onSnapshot(snap => {
      _chatCachedDocs = snap.docs;
      _chatOnUpdate(snap.docs);
    }, err => {
      console.warn('[Chat]', err.message);
      _chatUnsub = null; // allow restart on next chatInject call
    });
}
window.chatStart = chatStart;

function chatStop() {
  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  _chatRenderedIds = new Set();
  _chatCachedDocs  = [];
  _chatLastSentMs  = 0;
}
window.chatStop = chatStop;

// ── Inject section into hub (called by extras.js showHub patch) ─
function chatInject() {
  if (document.getElementById('hub-chat')) return;
  const footer = document.querySelector('.hub-footer');
  if (!footer) return;

  const chatSection = document.createElement('section');
  chatSection.id        = 'hub-chat';
  chatSection.className = 'hub-chat';

  if (!currentUser) {
    chatSection.innerHTML = `
      <div class="chat-header">💬 Коментари на заедницата</div>
      <div class="chat-guest-msg">
        <span class="chat-login-link" onclick="showAuthScreen('login')">Најави се</span>
        или
        <span class="chat-login-link" onclick="showAuthScreen('signup')">регистрирај се</span>
        за да коментираш
      </div>`;
    footer.insertAdjacentElement('beforebegin', chatSection);
    return;
  }

  chatSection.innerHTML = `
    <div class="chat-header">💬 Коментари на заедницата</div>
    <div class="chat-feed" id="chat-feed">
      <div class="chat-empty">Биди прв да коментираш! 💬</div>
    </div>
    <div class="chat-form">
      <input type="text" id="chat-input" class="chat-input" maxlength="200"
        placeholder="Напиши нешто…" autocomplete="off"
        onkeydown="if(event.key==='Enter') chatSend()">
      <button class="chat-send-btn" id="chat-send-btn" onclick="chatSend()">→</button>
    </div>
    <div class="chat-rate-msg" id="chat-rate-msg"></div>`;
  footer.insertAdjacentElement('beforebegin', chatSection);

  // DOM is fresh — reset rendered set so cached docs re-render
  _chatRenderedIds = new Set();
  if (_chatCachedDocs.length > 0) _chatOnUpdate(_chatCachedDocs);

  chatStart(); // no-op if listener already running
}
window.chatInject = chatInject;

// ── Render ────────────────────────────────────────────────────
function _chatOnUpdate(docs) {
  const feed = document.getElementById('chat-feed');
  if (!feed) return;

  const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;

  if (_chatRenderedIds.size === 0) {
    // Initial load — render everything without animation then scroll
    if (docs.length === 0) return; // keep placeholder
    feed.innerHTML = docs.map(doc => _chatBubble(doc.id, doc.data(), false)).join('');
    _chatRenderedIds = new Set(docs.map(doc => doc.id));
    setTimeout(() => { feed.scrollTop = feed.scrollHeight; }, 30);
  } else {
    const fresh = docs.filter(doc => !_chatRenderedIds.has(doc.id));
    if (fresh.length === 0) return;

    fresh.forEach(doc => {
      feed.querySelector('.chat-empty')?.remove();
      feed.insertAdjacentHTML('beforeend', _chatBubble(doc.id, doc.data(), true));
      _chatRenderedIds.add(doc.id);
    });

    const isMyMsg = fresh.some(doc => currentUser && doc.data().uid === currentUser.uid);
    if (nearBottom || isMyMsg) {
      setTimeout(() => { feed.scrollTop = feed.scrollHeight; }, 60);
    }
  }
}

function _chatBubble(id, data, animate) {
  if (!data || !data.text) return '';
  const isMe = currentUser && data.uid === currentUser.uid;
  const side = isMe ? 'chat-mine' : 'chat-other';
  const animClass = animate ? ' chat-anim' : '';
  const avatarHtml   = playerAvatarHtml(data.displayName || '?', data.avatarId || '', 30);
  const name = escHtml(data.displayName || '?');
  const text = escHtml(data.text);
  const timeAgoText  = _chatAgo(data.timestamp);

  return `<div class="chat-msg ${side}${animClass}" data-id="${id}">
    ${!isMe ? `<div class="chat-av">${avatarHtml}</div>` : ''}
    <div class="chat-bubble-wrap">
      <div class="chat-name">${name}</div>
      <div class="chat-bubble">${text}</div>
      <div class="chat-ago">${timeAgoText}</div>
    </div>
    ${isMe ? `<div class="chat-av">${avatarHtml}</div>` : ''}
  </div>`;
}

function _chatAgo(ts) {
  if (!ts || typeof ts.toMillis !== 'function') return '';
  const secondsElapsed = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (secondsElapsed < 5)  return 'пред малку';
  if (secondsElapsed < 60) return `пред ${secondsElapsed}с`;
  const minutesElapsed = Math.floor(secondsElapsed / 60);
  if (minutesElapsed < 60) return `пред ${minutesElapsed} мин`;
  return `пред ${Math.floor(minutesElapsed / 60)}ч`;
}

// ── Send ──────────────────────────────────────────────────────
window.chatSend = async function() {
  if (!currentUser || typeof db === 'undefined') return;

  const input  = document.getElementById('chat-input');
  const rateLimitElement = document.getElementById('chat-rate-msg');
  if (!input) return;

  const messageText = input.value.trim();
  if (!messageText) return;

  // Rate limit
  const currentTime     = Date.now();
  const timeSinceLastMessage = currentTime - _chatLastSentMs;
  if (_chatLastSentMs > 0 && timeSinceLastMessage < CHAT_COOLDOWN_MS) {
    const secs = Math.ceil((CHAT_COOLDOWN_MS - timeSinceLastMessage) / 1000);
    if (rateLimitElement) rateLimitElement.textContent = `Почекај уште ${secs}с пред да коментираш повторно.`;
    setTimeout(() => { if (rateLimitElement && rateLimitElement.textContent.includes('с')) rateLimitElement.textContent = ''; }, 3500);
    return;
  }

  input.value     = '';
  _chatLastSentMs = currentTime;
  if (rateLimitElement) rateLimitElement.textContent = '';

  const sendButton = document.getElementById('chat-send-btn');
  if (sendButton) sendButton.disabled = true;

  try {
    await db.collection('comments').add({
      uid:         currentUser.uid,
      displayName: loadPlayerName() || 'Анонимно',
      avatarId:    loadAvatarId() || '',
      text: messageText,
      timestamp:   new Date(),
    });
  } catch (error) {
    console.warn('[Chat] Send error:', error.message);
    if (rateLimitElement) {
      rateLimitElement.textContent = 'Грешка. Обиди се пак.';
      setTimeout(() => { if (rateLimitElement) rateLimitElement.textContent = ''; }, 3000);
    }
  } finally {
    if (sendButton) sendButton.disabled = false;
    input.focus();
  }
};

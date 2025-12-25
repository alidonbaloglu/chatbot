(function () {
  // Authentication kontrolü
  if (!localStorage.getItem('authToken')) {
    window.location.href = '/login.html';
    return;
  }

  const el = sel => document.querySelector(sel);
  const messagesEl = el('#messages');
  const inputEl = el('#input');
  const sendEl = el('#send');
  const newChatBtn = el('#newChatBtn');
  const historyBtn = el('#historyBtn');
  const closeHistoryBtn = el('#closeHistoryBtn');
  const historySidebar = el('#historySidebar');
  const historyList = el('#historyList');
  const avatar = el('#avatar');
  const avatarImg = el('#avatarImg');
  const avatarInput = el('#avatarInput');
  const greetingEl = el('#greeting');
  const heroLogo = el('#heroLogo');
  const modelSelect = document.getElementById('modelSelect');
  const fileInput = el('#fileInput');
  const fileUploadBtn = el('#fileUploadBtn');
  const fileStatus = el('#fileStatus');
  const userInfoEl = el('#userInfo');
  const logoutBtn = el('#logoutBtn');

  // Admin panel elements
  const sidebarTabs = el('#sidebarTabs');
  const historySection = el('#historySection');
  const adminSection = el('#adminSection');
  const closeAdminBtn = el('#closeAdminBtn');
  const adminFileInput = el('#adminFileInput');
  const adminFileUploadBtn = el('#adminFileUploadBtn');
  const adminFileStatus = el('#adminFileStatus');
  const allChatsContainer = el('#allChatsContainer');
  const refreshAdminBtn = el('#refreshAdminBtn');
  const totalChatsCount = el('#totalChatsCount');
  const totalUsersCount = el('#totalUsersCount');
  const totalMessagesCount = el('#totalMessagesCount');
  const uploadedFilesCount = el('#uploadedFilesCount');
  const uploadedSourcesList = el('#uploadedSourcesList');

  // Kullanıcı bilgilerini al
  const username = localStorage.getItem('username') || 'Kullanıcı';
  const userRole = localStorage.getItem('userRole') || 'user';
  const isAdmin = userRole === 'admin';

  // Admin ise admin paneline yönlendir
  if (isAdmin) {
    window.location.href = '/admin.html';
    return;
  }

  // Role bazlı localStorage keys
  const CHATS_KEY = isAdmin ? 'chatbot.allChats.admin' : `chatbot.chats.${username}`;
  const CURRENT_CHAT_KEY = `chatbot.currentChat.${username}`;
  const AVATAR_KEY = 'chatbot.avatar.v1';
  const MODEL_KEY = 'chatbot.model.v1';

  // Mevcut sohbet ID'si
  let currentChatId = localStorage.getItem(CURRENT_CHAT_KEY) || null;

  // Tüm sohbetleri yükle
  let chats = JSON.parse(localStorage.getItem(CHATS_KEY) || '{}');

  // Mevcut sohbet verilerini yükle
  let history = [];
  let currentFileUri = null;
  let currentFileName = null;
  let currentFileMime = null;

  function loadChat(chatId) {
    if (!chatId || !chats[chatId]) return;
    const chat = chats[chatId];
    history = chat.history || [];
    currentFileUri = chat.fileUri || null;
    currentFileName = chat.fileName || null;
    currentFileMime = chat.fileMime || null;
    currentChatId = chatId;
    localStorage.setItem(CURRENT_CHAT_KEY, chatId);
    render();
    updateFileStatus(currentFileName, !!currentFileName);
  }

  function saveChat() {
    if (!currentChatId) {
      currentChatId = 'chat_' + Date.now();
    }
    chats[currentChatId] = {
      id: currentChatId,
      username: username,
      history: history,
      fileUri: currentFileUri,
      fileName: currentFileName,
      fileMime: currentFileMime,
      updatedAt: Date.now(),
      title: getChatTitle()
    };
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    localStorage.setItem(CURRENT_CHAT_KEY, currentChatId);
    renderHistoryList();
  }

  function getChatTitle() {
    if (history.length === 0) return 'Yeni Sohbet';
    const firstUserMsg = history.find(m => m.who === 'me');
    if (firstUserMsg) {
      return firstUserMsg.text.substring(0, 50) + (firstUserMsg.text.length > 50 ? '...' : '');
    }
    return 'Yeni Sohbet';
  }

  function newChat() {
    saveChat(); // Mevcut sohbeti kaydet
    currentChatId = null;
    history = [];
    currentFileUri = null;
    currentFileName = null;
    currentFileMime = null;
    localStorage.removeItem(CURRENT_CHAT_KEY);
    render();
    updateFileStatus(null, false);
    renderHistoryList();
  }

  function renderHistoryList() {
    if (!historyList) return;

    // Admin tüm sohbetleri görsün, normal kullanıcılar sadece kendi sohbetlerini görsün
    let displayChats = Object.values(chats);

    if (!isAdmin) {
      // Sadece kendi sohbetlerini göster
      displayChats = displayChats.filter(chat => chat.username === username);
    }

    const chatArray = displayChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (chatArray.length === 0) {
      historyList.innerHTML = '<div class="history-item-empty">Henüz sohbet yok</div>';
      return;
    }

    historyList.innerHTML = chatArray.map(chat => {
      const date = new Date(chat.updatedAt);
      const dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const isActive = chat.id === currentChatId ? 'active' : '';

      // Admin görüntüsü: kullanıcı adını göster
      const titleText = isAdmin && chat.username ? `${chat.username}: ${chat.title || 'Yeni Sohbet'}` : (chat.title || 'Yeni Sohbet');

      return `
        <div class="history-item ${isActive}" data-chat-id="${chat.id}">
          <div class="history-item-title">${titleText}</div>
          <div class="history-item-date">${dateStr}</div>
        </div>
      `;
    }).join('');

    // Tıklama event'leri ekle
    historyList.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const chatId = item.dataset.chatId;
        loadChat(chatId);
        closeHistorySidebar();
      });
    });
  }

  function openHistorySidebar() {
    if (historySidebar) historySidebar.classList.add('open');
    // Overlay ekle
    let overlay = el('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeHistorySidebar);
    }
    overlay.classList.add('active');
  }

  function closeHistorySidebar() {
    if (historySidebar) historySidebar.classList.remove('open');
    const overlay = el('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  // İlk yükleme
  if (currentChatId && chats[currentChatId]) {
    loadChat(currentChatId);
  } else {
    render();
  }
  renderHistoryList();

  // Greeting based on time
  function greeting() {
    const h = new Date().getHours();
    const name = 'Ali';
    if (h >= 6 && h < 12) return `Günaydın, ${name}`;
    if (h >= 12 && h < 18) return `İyi günler, ${name}`;
    if (h >= 18 && h < 24) return `İyi akşamlar, ${name}`;
    return `İyi geceler, ${name}`;
  }
  // Kullanıcı bilgilerini güncelle
  const userNameEl = el('#userName');
  const userPositionEl = el('#userPosition');
  const userDepartmentEl = el('#userDepartment');

  if (userNameEl) {
    userNameEl.textContent = username || 'Ali Çelik';
  }
  if (userPositionEl) {
    userPositionEl.textContent = 'Mühendis';
  }
  if (userDepartmentEl) {
    userDepartmentEl.textContent = 'Ar-Ge';
  }

  greetingEl.textContent = greeting();

  // Model selection persistence
  const savedModel = localStorage.getItem(MODEL_KEY) || (modelSelect ? modelSelect.value : 'gpt-4o-mini');
  if (modelSelect) {
    modelSelect.value = savedModel;
    modelSelect.addEventListener('change', () => {
      localStorage.setItem(MODEL_KEY, modelSelect.value);
    });
  }

  // Detect provider and adapt model list
  (async function initProvider() {
    try {
      const base = (location.origin && location.origin.startsWith('http')) ? location.origin : 'http://localhost:5280';
      const r = await fetch(base + '/api/health');
      if (!r.ok) return;
      const info = await r.json();
      if (info && info.provider === 'gemini' && modelSelect) {
        const opts = [
          { v: 'gemini-2.5-flash', t: 'gemini-2.5-flash' },
          { v: 'gemini-2.5-flash-lite', t: 'gemini-2.5-flash-lite' },
          { v: 'gemini-3-flash', t: 'gemini-3-flash' },
          { v: 'gemini-1.5-pro', t: 'gemini-1.5-pro' }
        ];
        modelSelect.innerHTML = opts.map(o => `<option value="${o.v}">${o.t}</option>`).join('');
        const def = localStorage.getItem(MODEL_KEY) || info.model || 'gemini-2.5-flash';
        modelSelect.value = def;
        localStorage.setItem(MODEL_KEY, def);
      }
    } catch { /* ignore */ }
  })();

  // Local storage helpers
  const persist = () => {
    saveChat();
  };

  function scrollToBottom() {
    // The scrollable container is the wrapper, not the messages div itself
    const wrapper = messagesEl.parentElement;
    if (wrapper) {
      setTimeout(() => {
        wrapper.scrollTo({
          top: wrapper.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }

  function render() {
    messagesEl.innerHTML = '';
    if (history.length === 0) {
      addSystemMessage('Hazırsanız yazmaya başlayın.');
    } else {
      history.forEach(addMessageEl);
    }

    // Dosya yükleme butonunu kontrol et
    if (fileUploadBtn) {
      fileUploadBtn.style.display = isAdmin ? 'block' : 'none';
    }

    scrollToBottom();
  }

  // Markdown'ı HTML'e çevir (basit formatlama)
  function formatMessage(text) {
    if (!text) return '';

    // Önce satırları ayır
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Boş satırlar
      if (trimmed === '') {
        if (inList) {
          html += '</div>';
          inList = false;
        }
        html += '<br>';
        continue;
      }

      // * veya - ile başlayan madde işaretleri
      if (trimmed.match(/^[\*\-]\s+/)) {
        if (!inList) {
          html += '<div class="message-list">';
          inList = true;
        }
        const content = trimmed.replace(/^[\*\-]\s+/, '');
        // İçindeki **kalın** formatlamasını koru
        const formattedContent = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html += `<div class="list-item"><span class="bullet">•</span><span class="item-content">${formattedContent}</span></div>`;
        continue;
      }

      // Sayı ile başlayan madde işaretleri (1. 2. vb.)
      if (trimmed.match(/^\d+\.\s+/)) {
        if (!inList) {
          html += '<div class="message-list">';
          inList = true;
        }
        const match = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (match) {
          const formattedContent = match[2].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          html += `<div class="list-item numbered"><span class="number">${match[1]}.</span><span class="item-content">${formattedContent}</span></div>`;
        }
        continue;
      }

      // Liste bitiyor
      if (inList) {
        html += '</div>';
        inList = false;
      }

      // ** ile başlayıp biten satırlar (başlık gibi)
      if (trimmed.match(/^\*\*.+\*\*$/)) {
        const content = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong class="heading">$1</strong>');
        html += `<div class="message-line heading-line">${content}</div>`;
        continue;
      }

      // Normal satır - **kalın** ve *italik* formatlamasını uygula
      let formattedLine = trimmed;
      formattedLine = formattedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      formattedLine = formattedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html += `<div class="message-line">${formattedLine}</div>`;
    }

    // Liste kapanmamışsa kapat
    if (inList) {
      html += '</div>';
    }

    return html;
  }

  function addSystemMessage(text) {
    addMessageEl({ who: 'bot', text });
  }

  function addMessageEl(msg) {
    const row = document.createElement('div');
    row.className = `message ${msg.who === 'me' ? 'user' : 'bot'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    const img = document.createElement('img');

    // User messages use user.png, bot messages use robot
    if (msg.who === 'me') {
      img.src = 'assets/user.png';
      img.alt = 'Ben';
    } else {
      img.src = 'assets/Medya.png';
      img.alt = 'Bot';
    }
    avatar.appendChild(img);

    const content = document.createElement('div');
    content.className = 'message-content';

    // Bot mesajları için formatlanmış HTML, kullanıcı mesajları için düz metin
    if (msg.who === 'bot') {
      content.innerHTML = formatMessage(msg.text);
    } else {
      content.textContent = msg.text;
    }

    row.appendChild(avatar);
    row.appendChild(content);

    messagesEl.appendChild(row);
  }

  function send() {
    const text = inputEl.value.trim();
    if (!text) return;
    const user = { who: 'me', text };
    history.push(user);
    persist();
    addMessageEl(user);
    inputEl.value = '';
    scrollToBottom();

    // Streaming ile cevap al
    aiReplyStream(history).catch((err) => {
      console.error('Streaming chat hatası:', err);
      const errorText = err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.';
      const errorReply = { who: 'bot', text: '❌ ' + errorText };
      history.push(errorReply);
      persist();
      addMessageEl(errorReply);
      scrollToBottom();
    });
  }

  // Streaming AI Reply fonksiyonu
  async function aiReplyStream(history) {
    const mapped = history.map(m => ({
      role: m.who === 'me' ? 'user' : (m.who === 'bot' ? 'assistant' : 'system'),
      content: m.text
    }));
    const systemPreface = { role: 'system', content: 'You are a helpful assistant. Reply concisely in Turkish unless the user uses another language.' };
    const body = JSON.stringify({
      messages: [systemPreface, ...mapped.slice(-20)],
      model: (modelSelect ? modelSelect.value : localStorage.getItem(MODEL_KEY) || 'gemini-2.5-flash')
    });

    const origins = [];
    if (location.origin && location.origin.startsWith('http')) origins.push(location.origin);
    origins.push('http://localhost:5280', 'http://127.0.0.1:5280');

    // Bot mesaj balonunu hemen oluştur
    const botMsg = { who: 'bot', text: '' };
    const row = document.createElement('div');
    row.className = 'message bot';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    const img = document.createElement('img');
    img.src = 'assets/Medya.png';
    img.alt = 'Bot';
    avatar.appendChild(img);

    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = '<span class="typing-indicator">●●●</span>';

    row.appendChild(avatar);
    row.appendChild(content);
    messagesEl.appendChild(row);
    scrollToBottom();

    let fullText = '';
    let lastErr;

    for (const base of origins) {
      try {
        const resp = await fetch(base + '/api/chat-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(errorText);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.text) {
                  fullText += data.text;
                  content.innerHTML = formatMessage(fullText);
                  scrollToBottom();
                }

                if (data.done) {
                  if (fullText) {
                    botMsg.text = fullText;
                    history.push(botMsg);
                    persist();
                  }
                  return fullText;
                }
              } catch (e) {
                // JSON parse hatası, devam et
              }
            }
          }
        }

        if (fullText) {
          botMsg.text = fullText;
          history.push(botMsg);
          persist();
          return fullText;
        }
      } catch (e) {
        lastErr = e;
        console.error('Stream error for', base, e);
      }
    }

    // Tüm origin'ler başarısız oldu, fallback
    bubble.innerHTML = '';
    throw lastErr || new Error('Bağlantı kurulamadı');
  }

  function makeReply(text) {
    const lower = text.toLowerCase();
    if (lower.includes('merhaba') || lower.includes('selam')) return 'Merhaba! Nasıl yardımcı olabilirim?';
    if (lower.includes('hava')) return 'Hava durumu özelliği henüz eklenmedi, ama yakında!';
    if (lower.includes('teşekkür')) return 'Rica ederim!';
    return 'Bunu not aldım. Birlikte çözebiliriz.';
  }

  async function aiReply(history) {
    const mapped = history.map(m => ({
      role: m.who === 'me' ? 'user' : (m.who === 'bot' ? 'assistant' : 'system'),
      content: m.text
    }));
    const systemPreface = { role: 'system', content: 'You are a helpful assistant. Reply concisely in Turkish unless the user uses another language.' };
    const body = JSON.stringify({ messages: [systemPreface, ...mapped.slice(-20)], model: (modelSelect ? modelSelect.value : localStorage.getItem(MODEL_KEY) || 'gpt-4o-mini') });

    async function post(url) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try {
        const resp = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal
        });
        clearTimeout(t);

        if (!resp.ok) {
          const errorText = await resp.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(errorText);
          }

          // Rate limit hatası
          if (resp.status === 429) {
            throw new Error('⚠️ Gemini API kullanım limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.');
          }

          throw new Error(errorData.details || errorData.error || errorText);
        }

        const data = await resp.json();
        if (!data || typeof data.content !== 'string' || !data.content.trim()) throw new Error('empty_response');
        return data.content.trim();
      } finally { clearTimeout(t); }
    }

    const origins = [];
    if (location.origin && location.origin.startsWith('http')) origins.push(location.origin);
    origins.push('http://localhost:5280', 'http://127.0.0.1:5280');

    let lastErr;
    for (const base of origins) {
      try { return await post(base + '/api/chat'); }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('no_server');
  }

  // Döküman bazlı chat fonksiyonu
  async function aiReplyWithDoc(history, message) {
    const body = JSON.stringify({
      message: message,
      fileUri: currentFileUri,
      mimeType: currentFileMime,
      model: (modelSelect ? modelSelect.value : localStorage.getItem(MODEL_KEY) || 'gemini-2.5-flash')
    });

    async function post(url) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60000); // Döküman işleme daha uzun sürebilir
      try {
        const resp = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal
        });
        clearTimeout(t);

        if (!resp.ok) {
          const errorText = await resp.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            throw new Error(errorText);
          }

          // Rate limit hatası
          if (resp.status === 429) {
            throw new Error('⚠️ Gemini API kullanım limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.');
          }

          throw new Error(errorData.details || errorData.error || errorText);
        }

        const data = await resp.json();
        if (!data || typeof data.content !== 'string' || !data.content.trim()) throw new Error('empty_response');
        return data.content.trim();
      } finally { clearTimeout(t); }
    }

    const origins = [];
    if (location.origin && location.origin.startsWith('http')) origins.push(location.origin);
    origins.push('http://localhost:5280', 'http://127.0.0.1:5280');

    let lastErr;
    for (const base of origins) {
      try { return await post(base + '/api/chat-with-doc'); }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('no_server');
  }

  // Dosya yükleme fonksiyonu
  async function uploadFile(file) {
    if (!file) return;

    // Admin kontrolü
    if (!isAdmin) {
      alert('Dosya yükleme sadece Admin tarafından yapılabilir');
      updateFileStatus(null, false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', username);

    const origins = [];
    if (location.origin && location.origin.startsWith('http')) origins.push(location.origin);
    origins.push('http://localhost:5280', 'http://127.0.0.1:5280');

    let lastErr;
    for (const base of origins) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 120000); // Dosya yükleme uzun sürebilir

        const resp = await fetch(base + '/api/upload', {
          method: 'POST',
          body: formData,
          signal: ctrl.signal,
          headers: {
            'x-user-role': userRole,
            'x-username': username
          }
        });

        clearTimeout(t);

        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(errorText);
        }

        const data = await resp.json();

        // Dosya URI'sini kaydet
        currentFileUri = data.fileUri;
        currentFileName = data.fileName || file.name;
        currentFileMime = data.mimeType || file.type;

        // Sohbeti kaydet
        saveChat();

        // Dosya durumunu göster
        updateFileStatus(currentFileName, true);

        // Başarı mesajı ekle
        addSystemMessage(`📄 "${currentFileName}" dosyası yüklendi! Artık bu dökümana dayalı sorular sorabilirsiniz.`);

        return;
      } catch (e) {
        lastErr = e;
      }
    }

    console.error('Dosya yükleme hatası:', lastErr);
    updateFileStatus('Yükleme başarısız', false);
    alert('Dosya yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
  }

  // Dosya durumunu güncelle
  function updateFileStatus(fileName, isUploaded) {
    if (!fileStatus) return;

    if (isUploaded && fileName) {
      fileStatus.style.display = 'block';
      fileStatus.textContent = `📄 Yüklü: ${fileName}`;
      fileStatus.style.color = '#4CAF50';
      fileUploadBtn.style.opacity = '1';
      fileUploadBtn.title = `Döküman: ${fileName} - Yeni dosya yüklemek için tıklayın`;
    } else {
      fileStatus.style.display = 'none';
      fileUploadBtn.title = 'Döküman Yükle';
    }
  }

  // Event listeners
  if (newChatBtn) {
    newChatBtn.addEventListener('click', newChat);
  }

  if (historyBtn) {
    historyBtn.addEventListener('click', openHistorySidebar);
  }

  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', closeHistorySidebar);
  }

  sendEl.addEventListener('click', send);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  // Dosya yükleme butonu event listener
  if (fileUploadBtn && fileInput) {
    fileUploadBtn.addEventListener('click', () => {
      if (!isAdmin) {
        alert('Dosya yükleme sadece Admin tarafından yapılabilir');
        return;
      }
      fileInput.click();
    });
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        if (!isAdmin) {
          alert('Dosya yükleme sadece Admin tarafından yapılabilir');
          return;
        }
        updateFileStatus('Yükleniyor...', false);
        await uploadFile(file);
      }
      // Input'u temizle ki aynı dosya tekrar seçilebilsin
      e.target.value = '';
    });
  }

  // Overlay için event listener
  const overlay = el('.sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', closeHistorySidebar);
  }

  // Avatar upload & persistence
  const savedAvatar = localStorage.getItem(AVATAR_KEY);
  if (savedAvatar) {
    avatarImg.src = savedAvatar;
    if (heroLogo) heroLogo.src = savedAvatar;
  } else {
    // Varsayılan olarak Medya.png kullanmayı dene, ardından diğer olası dosyalar
    const candidates = ['assets/Medya.png', 'Medya.png', 'assets/logo.png', 'assets/avatar.svg'];
    (async function pick() {
      for (const src of candidates) {
        const ok = await exists(src);
        if (ok) {
          avatarImg.src = src;
          if (heroLogo) heroLogo.src = src;
          localStorage.setItem(AVATAR_KEY, src);
          return;
        }
      }
    })();
  }

  avatar.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await toDataURL(file);
    avatarImg.src = dataUrl;
    if (heroLogo) heroLogo.src = dataUrl;
    localStorage.setItem(AVATAR_KEY, dataUrl);
  });

  // Logout işlemi
  // Logout işlemi
  logoutBtn.addEventListener('click', async () => {
    if (await showConfirm('Çıkış yapmak istediğinizden emin misiniz?')) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('username');
      window.location.href = '/login.html';
    }
  });

  // Custom confirm modal
  function showConfirm(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const msgEl = document.getElementById('confirmModalMessage');
      const okBtn = document.getElementById('confirmOkBtn');
      const cancelBtn = document.getElementById('confirmCancelBtn');
      const closeBtn = document.getElementById('closeConfirmModalBtn');
      const overlay = modal.querySelector('.feka-modal-overlay');

      if (!modal || !msgEl || !okBtn || !cancelBtn) {
        // Fallback
        resolve(confirm(message));
        return;
      }

      msgEl.textContent = message;
      modal.style.display = 'flex';

      // Remove old listeners to prevent stacking if reusing elements (though here we add new ones each time, 
      // they are scoped to this promise execution if we don't clear them carefully.
      // Better to clone or removeEventListener. Since we define onOk/onCancel inside, we can remove them.)

      const cleanup = () => {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        if (closeBtn) closeBtn.removeEventListener('click', onCancel);
        if (overlay) overlay.removeEventListener('click', onCancel);
        modal.style.display = 'none';
      };

      const onOk = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      if (closeBtn) closeBtn.addEventListener('click', onCancel);
      if (overlay) overlay.addEventListener('click', onCancel);
    });
  }

  function toDataURL(file) {
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.readAsDataURL(file);
    });
  }

  function exists(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  // Kullanıcı bilgilerini göster
  if (userInfoEl) {
    userInfoEl.textContent = `${username} (${userRole === 'admin' ? 'Admin' : 'Kullanıcı'})`;
  }

  // Greeting'i güncelle
  if (greetingEl) {
    greetingEl.textContent = `Merhaba, ${username}`;
  }

  // Sidebar tabs kontrolleri (sadece admin için göster)
  if (isAdmin && sidebarTabs) {
    sidebarTabs.style.display = 'flex';

    const tabButtons = document.querySelectorAll('.sidebar-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;

        // Aktif tab'ı güncelle
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Sections'ı güncelle
        historySection.classList.remove('active');
        adminSection.classList.remove('active');

        if (tabName === 'history') {
          historySection.classList.add('active');
        } else {
          adminSection.classList.add('active');
          updateAdminStats();
          renderAllChats();
        }
      });
    });
  }

  // Admin tab close butonu
  if (closeAdminBtn) {
    closeAdminBtn.addEventListener('click', () => {
      historySidebar.classList.remove('open');
    });
  }

  // Admin dosya yükleme
  if (adminFileUploadBtn && adminFileInput) {
    adminFileUploadBtn.addEventListener('click', () => {
      adminFileInput.click();
    });

    adminFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        adminFileStatus.textContent = '⏳ Yükleniyor...';
        adminFileStatus.style.color = '#666';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadedBy', username);

        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            headers: {
              'x-user-role': userRole,
              'x-username': username
            }
          });

          if (response.ok) {
            const data = await response.json();
            adminFileStatus.textContent = `✅ Başarıyla yüklendi: ${data.fileName}`;
            adminFileStatus.style.color = '#4CAF50';
            updateAdminStats();
            loadUploadedSources(); // Yüklenen kaynakları yenile
          } else {
            adminFileStatus.textContent = '❌ Yükleme başarısız';
            adminFileStatus.style.color = '#dc3545';
          }
        } catch (error) {
          console.error('Admin file upload error:', error);
          adminFileStatus.textContent = '❌ Hata oluştu';
          adminFileStatus.style.color = '#dc3545';
        }

        e.target.value = '';
      }
    });
  }

  // Admin refresh butonu
  if (refreshAdminBtn) {
    refreshAdminBtn.addEventListener('click', () => {
      refreshAdminBtn.textContent = '⏳ Yükleniyor...';
      updateAdminStats();
      renderAllChats();
      setTimeout(() => {
        refreshAdminBtn.textContent = '🔄 Verileri Yenile';
      }, 500);
    });
  }

  // Admin istatistiklerini güncelle
  function updateAdminStats() {
    const chatValues = Object.values(chats);
    const totalChats = chatValues.length;
    const userSet = new Set(chatValues.map(c => c.username));
    const totalUsers = userSet.size;
    let totalMessages = 0;
    let uploadedFiles = 0;

    chatValues.forEach(chat => {
      totalMessages += (chat.history || []).length;
      if (chat.fileName) uploadedFiles++;
    });

    if (totalChatsCount) totalChatsCount.textContent = totalChats;
    if (totalUsersCount) totalUsersCount.textContent = totalUsers;
    if (totalMessagesCount) totalMessagesCount.textContent = totalMessages;
    if (uploadedFilesCount) uploadedFilesCount.textContent = uploadedFiles;
  }

  // Tüm sohbetleri renderla
  function renderAllChats() {
    if (!allChatsContainer) return;

    const chatValues = Object.values(chats).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    allChatsContainer.innerHTML = '';

    if (chatValues.length === 0) {
      allChatsContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted); font-size:12px;">Henüz sohbet yok</div>';
      return;
    }

    chatValues.forEach(chat => {
      const userMsg = (chat.history || []).find(m => m.who === 'me');
      const userQuestion = userMsg ? userMsg.text.substring(0, 100) : 'Sohbet yok';
      const date = new Date(chat.updatedAt);
      const dateStr = date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      const chatEl = document.createElement('div');
      chatEl.className = 'chat-item';
      chatEl.innerHTML = `
        <div class="chat-item-username">👤 ${chat.username || 'Bilinmeyen'}</div>
        <div class="chat-item-text">${userQuestion}${userQuestion.length === 100 ? '...' : ''}</div>
        <div class="chat-item-meta">📅 ${dateStr} | 💬 ${(chat.history || []).length} mesaj</div>
      `;
      allChatsContainer.appendChild(chatEl);
    });
  }

  // Yüklenen kaynakları yükle ve göster
  async function loadUploadedSources() {
    if (!uploadedSourcesList) return;

    uploadedSourcesList.innerHTML = '<div class="no-sources">⏳ Yükleniyor...</div>';

    try {
      const response = await fetch('/api/uploaded-files', {
        headers: {
          'x-user-role': userRole,
          'x-username': username
        }
      });

      if (!response.ok) {
        throw new Error('Dosya listesi alınamadı');
      }

      const data = await response.json();
      const files = data.files || [];

      if (files.length === 0) {
        uploadedSourcesList.innerHTML = '<div class="no-sources">Henüz kaynak yüklenmedi</div>';
        return;
      }

      uploadedSourcesList.innerHTML = '';
      files.forEach(file => {
        const date = new Date(file.uploadedAt);
        const dateStr = date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const sizeKB = file.fileSize ? (file.fileSize / 1024).toFixed(2) : '?';

        const sourceEl = document.createElement('div');
        sourceEl.className = 'source-item';
        sourceEl.innerHTML = `
          <div class="source-icon">📄</div>
          <div class="source-info">
            <div class="source-name">${file.fileName}</div>
            <div class="source-meta">
              👤 ${file.uploadedBy} | 📅 ${dateStr} | 💾 ${sizeKB} KB
            </div>
          </div>
        `;
        uploadedSourcesList.appendChild(sourceEl);
      });

      // Yüklü dosya sayısını güncelle
      if (uploadedFilesCount) {
        uploadedFilesCount.textContent = files.length;
      }
    } catch (error) {
      console.error('Kaynak listesi hatası:', error);
      uploadedSourcesList.innerHTML = '<div class="no-sources" style="color: #dc3545;">❌ Yüklenirken hata oluştu</div>';
    }
  }

  render();
})();


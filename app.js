(function(){
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

  const CHATS_KEY = 'chatbot.chats.v2';
  const CURRENT_CHAT_KEY = 'chatbot.currentChat.v2';
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
  
  function loadChat(chatId){
    if(!chatId || !chats[chatId]) return;
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
  
  function saveChat(){
    if(!currentChatId){
      currentChatId = 'chat_' + Date.now();
    }
    chats[currentChatId] = {
      id: currentChatId,
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
  
  function getChatTitle(){
    if(history.length === 0) return 'Yeni Sohbet';
    const firstUserMsg = history.find(m => m.who === 'me');
    if(firstUserMsg){
      return firstUserMsg.text.substring(0, 50) + (firstUserMsg.text.length > 50 ? '...' : '');
    }
    return 'Yeni Sohbet';
  }
  
  function newChat(){
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
  
  function renderHistoryList(){
    if(!historyList) return;
    const chatArray = Object.values(chats).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    if(chatArray.length === 0){
      historyList.innerHTML = '<div class="history-item-empty">Henüz sohbet yok</div>';
      return;
    }
    
    historyList.innerHTML = chatArray.map(chat => {
      const date = new Date(chat.updatedAt);
      const dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const isActive = chat.id === currentChatId ? 'active' : '';
      return `
        <div class="history-item ${isActive}" data-chat-id="${chat.id}">
          <div class="history-item-title">${chat.title || 'Yeni Sohbet'}</div>
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
  
  function openHistorySidebar(){
    if(historySidebar) historySidebar.classList.add('open');
    // Overlay ekle
    let overlay = el('.sidebar-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeHistorySidebar);
    }
    overlay.classList.add('active');
  }
  
  function closeHistorySidebar(){
    if(historySidebar) historySidebar.classList.remove('open');
    const overlay = el('.sidebar-overlay');
    if(overlay) overlay.classList.remove('active');
  }
  
  // İlk yükleme
  if(currentChatId && chats[currentChatId]){
    loadChat(currentChatId);
  } else {
    render();
  }
  renderHistoryList();

  // Greeting based on time
  function greeting(){
    const h = new Date().getHours();
    const name = 'Ali';
    if(h >= 6 && h < 12) return `Günaydın, ${name}`;
    if(h >= 12 && h < 18) return `İyi günler, ${name}`;
    if(h >= 18 && h < 24) return `İyi akşamlar, ${name}`;
    return `İyi geceler, ${name}`;
  }
  greetingEl.textContent = greeting();

  // Model selection persistence
  const savedModel = localStorage.getItem(MODEL_KEY) || (modelSelect ? modelSelect.value : 'gpt-4o-mini');
  if(modelSelect){
    modelSelect.value = savedModel;
    modelSelect.addEventListener('change', ()=>{
      localStorage.setItem(MODEL_KEY, modelSelect.value);
    });
  }

  // Detect provider and adapt model list
  (async function initProvider(){
    try{
      const base = (location.origin && location.origin.startsWith('http')) ? location.origin : 'http://localhost:5280';
      const r = await fetch(base + '/api/health');
      if(!r.ok) return;
      const info = await r.json();
      if(info && info.provider === 'gemini' && modelSelect){
        const opts = [
          {v:'gemini-2.5-flash', t:'gemini-2.5-flash'},
          {v:'gemini-2.5-flash-lite', t:'gemini-2.5-flash-lite'},
          {v:'gemini-1.5-flash', t:'gemini-1.5-flash'}
        ];
        modelSelect.innerHTML = opts.map(o=>`<option value="${o.v}">${o.t}</option>`).join('');
        const def = localStorage.getItem(MODEL_KEY) || info.model || 'gemini-2.5-flash';
        modelSelect.value = def;
        localStorage.setItem(MODEL_KEY, def);
      }
    }catch{ /* ignore */ }
  })();

  // Local storage helpers
  const persist = () => {
    saveChat();
  };

  function scrollToBottom(){
    setTimeout(() => {
      messagesEl.scrollTo({
        top: messagesEl.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  }

  function render(){
    messagesEl.innerHTML = '';
    if(history.length === 0){
      addSystemMessage('Hazırsanız yazmaya başlayın.');
    } else {
      history.forEach(addMessageEl);
    }
    scrollToBottom();
  }

  // Markdown'ı HTML'e çevir (basit formatlama)
  function formatMessage(text){
    if(!text) return '';
    
    // Önce satırları ayır
    const lines = text.split('\n');
    let html = '';
    let inList = false;
    
    for(let i = 0; i < lines.length; i++){
      const line = lines[i];
      const trimmed = line.trim();
      
      // Boş satırlar
      if(trimmed === ''){
        if(inList){
          html += '</div>';
          inList = false;
        }
        html += '<br>';
        continue;
      }
      
      // * veya - ile başlayan madde işaretleri
      if(trimmed.match(/^[\*\-]\s+/)){
        if(!inList){
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
      if(trimmed.match(/^\d+\.\s+/)){
        if(!inList){
          html += '<div class="message-list">';
          inList = true;
        }
        const match = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if(match){
          const formattedContent = match[2].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          html += `<div class="list-item numbered"><span class="number">${match[1]}.</span><span class="item-content">${formattedContent}</span></div>`;
        }
        continue;
      }
      
      // Liste bitiyor
      if(inList){
        html += '</div>';
        inList = false;
      }
      
      // ** ile başlayıp biten satırlar (başlık gibi)
      if(trimmed.match(/^\*\*.+\*\*$/)){
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
    if(inList){
      html += '</div>';
    }
    
    return html;
  }

  function addSystemMessage(text){
    addMessageEl({who:'bot', text});
  }

  function addMessageEl(msg){
    const row = document.createElement('div');
    row.className = `msg ${msg.who === 'me' ? 'me' : ''}`;

    const who = document.createElement('div');
    who.className = 'who';
    const img = document.createElement('img');
    const currentAvatar = localStorage.getItem(AVATAR_KEY) || 'assets/Medya.png';
    // Use the same avatar image for both sides as requested
    img.src = currentAvatar;
    img.alt = msg.who === 'me' ? 'Ben' : 'Bot';
    who.appendChild(img);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    // Bot mesajları için formatlanmış HTML, kullanıcı mesajları için düz metin
    if(msg.who === 'bot'){
      bubble.innerHTML = formatMessage(msg.text);
    } else {
      bubble.textContent = msg.text;
    }

    if(msg.who === 'me'){
      row.appendChild(bubble);
      row.appendChild(who);
    } else {
      row.appendChild(who);
      row.appendChild(bubble);
    }

    messagesEl.appendChild(row);
  }

  function send(){
    const text = inputEl.value.trim();
    if(!text) return;
    const user = {who:'me', text};
    history.push(user);
    persist();
    addMessageEl(user);
    inputEl.value='';
    scrollToBottom();

    // Eğer dosya yüklüyse döküman bazlı chat kullan, değilse normal chat
    if(currentFileUri) {
      aiReplyWithDoc(history, text).then(botText => {
        const reply = { who: 'bot', text: botText };
        history.push(reply);
        persist();
        addMessageEl(reply);
        scrollToBottom();
      }).catch((err) => {
        console.error('Döküman bazlı chat hatası:', err);
        // Hata durumunda normal chat'e düş
        aiReply(history).then(botText => {
          const reply = { who: 'bot', text: botText };
          history.push(reply);
          persist();
          addMessageEl(reply);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }).catch(() => {
          const fallback = { who: 'bot', text: makeReply(text) };
          history.push(fallback);
          persist();
          addMessageEl(fallback);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        });
      });
    } else {
      // Call backend for AI response
      aiReply(history).then(botText => {
        const reply = { who: 'bot', text: botText };
        history.push(reply);
        persist();
        addMessageEl(reply);
        scrollToBottom();
      }).catch(() => {
        const fallback = { who: 'bot', text: makeReply(text) };
        history.push(fallback);
        persist();
        addMessageEl(fallback);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
  }

  function makeReply(text){
    const lower = text.toLowerCase();
    if(lower.includes('merhaba')||lower.includes('selam')) return 'Merhaba! Nasıl yardımcı olabilirim?';
    if(lower.includes('hava')) return 'Hava durumu özelliği henüz eklenmedi, ama yakında!';
    if(lower.includes('teşekkür')) return 'Rica ederim!';
    return 'Bunu not aldım. Birlikte çözebiliriz.';
  }

  async function aiReply(history){
    const mapped = history.map(m => ({
      role: m.who === 'me' ? 'user' : (m.who === 'bot' ? 'assistant' : 'system'),
      content: m.text
    }));
    const systemPreface = { role: 'system', content: 'You are a helpful assistant. Reply concisely in Turkish unless the user uses another language.' };
    const body = JSON.stringify({ messages: [systemPreface, ...mapped.slice(-20)], model: (modelSelect ? modelSelect.value : localStorage.getItem(MODEL_KEY) || 'gpt-4o-mini') });

    async function post(url){
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 15000);
      try{
        const resp = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal
        });
        clearTimeout(t);
        if(!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        if(!data || typeof data.content !== 'string' || !data.content.trim()) throw new Error('empty_response');
        return data.content.trim();
      } finally { clearTimeout(t); }
    }

    const origins = [];
    if(location.origin && location.origin.startsWith('http')) origins.push(location.origin);
    origins.push('http://localhost:5280','http://127.0.0.1:5280');

    let lastErr;
    for(const base of origins){
      try{ return await post(base + '/api/chat'); }
      catch(e){ lastErr = e; }
    }
    throw lastErr || new Error('no_server');
  }

  // Döküman bazlı chat fonksiyonu
  async function aiReplyWithDoc(history, message){
    const body = JSON.stringify({ 
      message: message,
      fileUri: currentFileUri,
      mimeType: currentFileMime,
      model: (modelSelect ? modelSelect.value : localStorage.getItem(MODEL_KEY) || 'gemini-2.5-flash')
    });

    async function post(url){
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 60000); // Döküman işleme daha uzun sürebilir
      try{
        const resp = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal
        });
        clearTimeout(t);
        if(!resp.ok) throw new Error(await resp.text());
        const data = await resp.json();
        if(!data || typeof data.content !== 'string' || !data.content.trim()) throw new Error('empty_response');
        return data.content.trim();
      } finally { clearTimeout(t); }
    }

    const origins = [];
    if(location.origin && location.origin.startsWith('http')) origins.push(location.origin);
    origins.push('http://localhost:5280','http://127.0.0.1:5280');

    let lastErr;
    for(const base of origins){
      try{ return await post(base + '/api/chat-with-doc'); }
      catch(e){ lastErr = e; }
    }
    throw lastErr || new Error('no_server');
  }

  // Dosya yükleme fonksiyonu
  async function uploadFile(file){
    if(!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const origins = [];
    if(location.origin && location.origin.startsWith('http')) origins.push(location.origin);
    origins.push('http://localhost:5280','http://127.0.0.1:5280');

    let lastErr;
    for(const base of origins){
      try{
        const ctrl = new AbortController();
        const t = setTimeout(()=>ctrl.abort(), 120000); // Dosya yükleme uzun sürebilir
        
        const resp = await fetch(base + '/api/upload', {
          method: 'POST',
          body: formData,
          signal: ctrl.signal
        });
        
        clearTimeout(t);
        
        if(!resp.ok) {
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
      } catch(e){ 
        lastErr = e; 
      }
    }
    
    console.error('Dosya yükleme hatası:', lastErr);
    updateFileStatus('Yükleme başarısız', false);
    alert('Dosya yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
  }

  // Dosya durumunu güncelle
  function updateFileStatus(fileName, isUploaded){
    if(!fileStatus) return;
    
    if(isUploaded && fileName){
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
  if(newChatBtn){
    newChatBtn.addEventListener('click', newChat);
  }
  
  if(historyBtn){
    historyBtn.addEventListener('click', openHistorySidebar);
  }
  
  if(closeHistoryBtn){
    closeHistoryBtn.addEventListener('click', closeHistorySidebar);
  }

  sendEl.addEventListener('click', send);
  inputEl.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });
  
  // Dosya yükleme butonu event listener
  if(fileUploadBtn && fileInput){
    fileUploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if(file){
        updateFileStatus('Yükleniyor...', false);
        await uploadFile(file);
      }
      // Input'u temizle ki aynı dosya tekrar seçilebilsin
      e.target.value = '';
    });
  }

  // Overlay için event listener
  const overlay = el('.sidebar-overlay');
  if(overlay){
    overlay.addEventListener('click', closeHistorySidebar);
  }

  // Avatar upload & persistence
  const savedAvatar = localStorage.getItem(AVATAR_KEY);
  if(savedAvatar){
    avatarImg.src = savedAvatar;
    if(heroLogo) heroLogo.src = savedAvatar;
  } else {
    // Varsayılan olarak Medya.png kullanmayı dene, ardından diğer olası dosyalar
    const candidates = ['assets/Medya.png','Medya.png','assets/logo.png','assets/avatar.svg'];
    (async function pick(){
      for(const src of candidates){
        const ok = await exists(src);
        if(ok){
          avatarImg.src = src;
          if(heroLogo) heroLogo.src = src;
          localStorage.setItem(AVATAR_KEY, src);
          return;
        }
      }
    })();
  }

  avatar.addEventListener('click', ()=> avatarInput.click());
  avatarInput.addEventListener('change', async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const dataUrl = await toDataURL(file);
    avatarImg.src = dataUrl;
    if(heroLogo) heroLogo.src = dataUrl;
    localStorage.setItem(AVATAR_KEY, dataUrl);
  });

  function toDataURL(file){
    return new Promise(res=>{
      const reader = new FileReader();
      reader.onload = ()=> res(reader.result);
      reader.readAsDataURL(file);
    });
  }

  function exists(src){
    return new Promise(resolve=>{
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  render();
})();

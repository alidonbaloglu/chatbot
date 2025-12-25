(function(){
  // Authentication kontrolü
  const authToken = localStorage.getItem('authToken');
  const userRole = localStorage.getItem('userRole');
  const username = localStorage.getItem('username');
  
  if (!authToken || userRole !== 'admin') {
    window.location.href = '/login.html';
    return;
  }

  const el = sel => document.querySelector(sel);
  
  // Elements
  const userInfoEl = el('#userInfo');
  const logoutBtn = el('#logoutBtn');
  const totalChatsCount = el('#totalChatsCount');
  const totalUsersCount = el('#totalUsersCount');
  const totalMessagesCount = el('#totalMessagesCount');
  const uploadedFilesCount = el('#uploadedFilesCount');
  const adminFileInput = el('#adminFileInput');
  const adminFileUploadBtn = el('#adminFileUploadBtn');
  const adminFileStatus = el('#adminFileStatus');
  const uploadedSourcesList = el('#uploadedSourcesList');
  const allChatsContainer = el('#allChatsContainer');
  const refreshSourcesBtn = el('#refreshSourcesBtn');
  const refreshChatsBtn = el('#refreshChatsBtn');
  const chatDetailModal = el('#chatDetailModal');
  const closeModalBtn = el('#closeModalBtn');
  const modalChatUsername = el('#modalChatUsername');
  const modalChatMessages = el('#modalChatMessages');
  const documentDetailModal = el('#documentDetailModal');
  const closeDocModalBtn = el('#closeDocModalBtn');
  const modalDocumentName = el('#modalDocumentName');
  const modalDocFileName = el('#modalDocFileName');
  const modalDocUploadedBy = el('#modalDocUploadedBy');
  const modalDocUploadedAt = el('#modalDocUploadedAt');
  const modalDocFileSize = el('#modalDocFileSize');
  const modalDocMimeType = el('#modalDocMimeType');

  // Kullanıcı bilgisini göster
  const adminUserName = el('#adminUserName');
  if (adminUserName) {
    adminUserName.textContent = username || 'Admin';
  }
  
  // Refresh All button
  const refreshAllBtn = el('#refreshAllBtn');
  if (refreshAllBtn) {
    refreshAllBtn.addEventListener('click', () => {
      loadAllData();
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
      localStorage.removeItem('userRole');
      window.location.href = '/login.html';
    });
  }

  // Modal kapatma
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      chatDetailModal.style.display = 'none';
    });
  }

  if (chatDetailModal) {
    const overlay = chatDetailModal.querySelector('.feka-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        chatDetailModal.style.display = 'none';
      });
    }
  }

  // Döküman modal kapatma
  if (closeDocModalBtn) {
    closeDocModalBtn.addEventListener('click', () => {
      documentDetailModal.style.display = 'none';
    });
  }

  if (documentDetailModal) {
    const overlay = documentDetailModal.querySelector('.feka-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        documentDetailModal.style.display = 'none';
      });
    }
  }

  // Dosya yükleme
  if (adminFileUploadBtn && adminFileInput) {
    adminFileUploadBtn.addEventListener('click', () => {
      adminFileInput.click();
    });
    
    adminFileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      adminFileStatus.textContent = `⏳ ${files.length} dosya yükleniyor... (PDF, Excel, Word, Resim, vs.)`;
      adminFileStatus.style.color = '#666';
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Upload error:', error);
          errorCount++;
        }
      }
      
      if (errorCount === 0) {
        adminFileStatus.textContent = `✅ ${successCount} dosya başarıyla yüklendi`;
        adminFileStatus.style.color = '#4CAF50';
      } else {
        adminFileStatus.textContent = `⚠️ ${successCount} başarılı, ${errorCount} başarısız`;
        adminFileStatus.style.color = '#ff9800';
      }
      
      e.target.value = '';
      loadUploadedSources();
      updateStats();
    });
  }

  // Yüklenen kaynakları yükle
  async function loadUploadedSources() {
    if (!uploadedSourcesList) return;
    
    uploadedSourcesList.innerHTML = '<div class="loading">⏳ Yükleniyor...</div>';
    
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
        uploadedSourcesList.innerHTML = '<div class="empty-state">Henüz döküman yüklenmedi</div>';
        return;
      }
      
      uploadedSourcesList.innerHTML = '';
      files.forEach((file, index) => {
        const date = new Date(file.uploadedAt);
        const dateStr = date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const sizeKB = file.fileSize ? (file.fileSize / 1024).toFixed(1) : '?';
        
        const sourceEl = document.createElement('div');
        sourceEl.className = 'admin-source-item';
        sourceEl.innerHTML = `
          <div class="admin-source-icon">📄</div>
          <div class="admin-source-info">
            <div class="admin-source-name">${file.fileName}</div>
            <div class="admin-source-meta">
              👤 ${file.uploadedBy} | 📅 ${dateStr} | 💾 ${sizeKB} KB
            </div>
          </div>
          <button class="btn-delete" data-index="${index}" title="Sil">🗑️</button>
        `;
        
        // Döküman tıklama (sil butonundan hariç)
        sourceEl.style.cursor = 'pointer';
        sourceEl.addEventListener('click', (e) => {
          if (e.target.closest('.btn-delete')) return;
          openDocumentDetail(file);
        });
        
        // Silme butonu
        const deleteBtn = sourceEl.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`"${file.fileName}" dosyasını silmek istediğinize emin misiniz?`)) return;
          
          try {
            const response = await fetch('/api/delete-file', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'x-user-role': userRole,
                'x-username': username
              },
              body: JSON.stringify({ index: index })
            });
            
            if (response.ok) {
              loadUploadedSources();
              updateStats();
            } else {
              alert('Dosya silinemedi');
            }
          } catch (error) {
            console.error('Delete error:', error);
            alert('Hata oluştu');
          }
        });
        
        uploadedSourcesList.appendChild(sourceEl);
      });
      
      if (uploadedFilesCount) {
        uploadedFilesCount.textContent = files.length;
      }
    } catch (error) {
      console.error('Kaynak listesi hatası:', error);
      uploadedSourcesList.innerHTML = '<div class="empty-state error">❌ Yüklenirken hata oluştu</div>';
    }
  }

  // Döküman detaylarını göster
  function openDocumentDetail(file) {
    if (!documentDetailModal) return;
    
    const date = new Date(file.uploadedAt);
    const dateStr = date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + 
                   date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sizeMB = file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) : '?';
    const sizeKB = file.fileSize ? (file.fileSize / 1024).toFixed(1) : '?';
    const fileSize = file.fileSize > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
    
    // Modal başlığı
    if (modalDocumentName) {
      modalDocumentName.textContent = `📄 ${file.fileName}`;
    }
    
    // Dosya detayları
    if (modalDocFileName) modalDocFileName.textContent = file.fileName;
    if (modalDocUploadedBy) modalDocUploadedBy.textContent = file.uploadedBy;
    if (modalDocUploadedAt) modalDocUploadedAt.textContent = dateStr;
    if (modalDocFileSize) modalDocFileSize.textContent = fileSize;
    if (modalDocMimeType) modalDocMimeType.textContent = file.mimeType || 'Bilinmiyor';
    
    // Modal aç
    documentDetailModal.style.display = 'flex';
  }

  // Kullanıcı sohbetlerini yükle
  async function loadUserChats() {
    if (!allChatsContainer) return;
    
    allChatsContainer.innerHTML = '<div class="loading">⏳ Yükleniyor...</div>';
    
    try {
      // localStorage'dan TÜM sohbetleri al
      const allChatsData = {};
      
      // localStorage'da "chatbot.chats.USERNAME" şeklinde saklanmış sohbetleri bul
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chatbot.chats.')) {
          const username = key.replace('chatbot.chats.', '');
          const chatsJson = localStorage.getItem(key);
          if (chatsJson) {
            try {
              const chats = JSON.parse(chatsJson);
              Object.keys(chats).forEach(chatId => {
                chats[chatId].username = username;
                allChatsData[chatId] = chats[chatId];
              });
            } catch (e) {
              console.error('Sohbet parse hatası:', e);
            }
          }
        }
      }
      
      const chatArray = Object.values(allChatsData).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      
      if (chatArray.length === 0) {
        allChatsContainer.innerHTML = '<div class="empty-state">Henüz sohbet yok</div>';
        
        // İstatistikleri sıfırla
        if (totalChatsCount) totalChatsCount.textContent = '0';
        if (totalUsersCount) totalUsersCount.textContent = '0';
        if (totalMessagesCount) totalMessagesCount.textContent = '0';
        return;
      }
      
      allChatsContainer.innerHTML = '';
      
      // İstatistik hesapla
      const userSet = new Set();
      let totalMessages = 0;
      
      chatArray.forEach(chat => {
        userSet.add(chat.username);
        totalMessages += (chat.history || []).length;
        
        const userMsg = (chat.history || []).find(m => m.who === 'me');
        const userQuestion = userMsg ? userMsg.text.substring(0, 100) : 'Sohbet yok';
        const date = new Date(chat.updatedAt);
        const dateStr = date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const messageCount = (chat.history || []).length;
        
        const chatEl = document.createElement('div');
        chatEl.className = 'admin-chat-item';
        chatEl.innerHTML = `
          <div class="admin-chat-item-header">
            <div class="admin-chat-item-username">👤 ${chat.username || 'Bilinmeyen'}</div>
            <button class="btn-delete-chat" data-chat-id="${chat.id}" title="Sil">🗑️</button>
          </div>
          <div class="admin-chat-item-text">${userQuestion}${userQuestion.length === 100 ? '...' : ''}</div>
          <div class="admin-chat-item-meta">📅 ${dateStr} | 💬 ${messageCount} mesaj</div>
        `;
        
        // Tüm alana tıklanabilen kılma (sil butonundan hariç)
        chatEl.style.cursor = 'pointer';
        chatEl.addEventListener('click', (e) => {
          if (e.target.closest('.btn-delete-chat')) return;
          openChatDetail(chat);
        });
        
        // Silme butonu
        const deleteBtn = chatEl.querySelector('.btn-delete-chat');
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`${chat.username} kullanıcısının sohbetini silmek istediğinize emin misiniz?`)) return;
          
          try {
            // localStorage'dan sil
            const userChatsKey = `chatbot.chats.${chat.username}`;
            const userChats = JSON.parse(localStorage.getItem(userChatsKey) || '{}');
            delete userChats[chat.id];
            localStorage.setItem(userChatsKey, JSON.stringify(userChats));
            
            loadUserChats();
            updateStats();
          } catch (error) {
            console.error('Delete chat error:', error);
            alert('Hata oluştu');
          }
        });
        
        allChatsContainer.appendChild(chatEl);
      });
      
      // İstatistikleri güncelle
      if (totalChatsCount) totalChatsCount.textContent = chatArray.length;
      if (totalUsersCount) totalUsersCount.textContent = userSet.size;
      if (totalMessagesCount) totalMessagesCount.textContent = totalMessages;
      
    } catch (error) {
      console.error('Sohbet listesi hatası:', error);
      allChatsContainer.innerHTML = '<div class="empty-state error">❌ Yüklenirken hata oluştu</div>';
    }
  }

  // Sohbet detaylarını göster
  function openChatDetail(chat) {
    if (!chatDetailModal) return;
    
    // Modal başlığı
    if (modalChatUsername) {
      modalChatUsername.textContent = `👤 ${chat.username} - Sohbet Detayları`;
    }
    
    // Mesajları göster
    if (modalChatMessages) {
      modalChatMessages.innerHTML = '';
      
      if (!chat.history || chat.history.length === 0) {
        modalChatMessages.innerHTML = '<div class="empty-state">Bu sohbette mesaj yok</div>';
      } else {
        chat.history.forEach(msg => {
          const msgEl = document.createElement('div');
          msgEl.className = 'feka-modal-message';
          
          const roleLabel = document.createElement('div');
          roleLabel.className = 'feka-modal-message-role';
          roleLabel.textContent = msg.who === 'me' ? '👤 Kullanıcı' : '🤖 Bot';
          
          const textContent = document.createElement('div');
          textContent.className = 'feka-modal-message-text';
          textContent.textContent = msg.text;
          
          msgEl.appendChild(roleLabel);
          msgEl.appendChild(textContent);
          modalChatMessages.appendChild(msgEl);
        });
      }
    }
    
    // Modal aç
    chatDetailModal.style.display = 'flex';
  }

  // İstatistikleri güncelle
  async function updateStats() {
    try {
      // localStorage'dan TÜM sohbetleri al
      const allChatsData = {};
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chatbot.chats.')) {
          const username = key.replace('chatbot.chats.', '');
          const chatsJson = localStorage.getItem(key);
          if (chatsJson) {
            try {
              const chats = JSON.parse(chatsJson);
              Object.keys(chats).forEach(chatId => {
                chats[chatId].username = username;
                allChatsData[chatId] = chats[chatId];
              });
            } catch (e) {}
          }
        }
      }
      
      const chatValues = Object.values(allChatsData);
      const totalChats = chatValues.length;
      const userSet = new Set(chatValues.map(c => c.username));
      const totalUsers = userSet.size;
      let totalMessages = 0;
      
      chatValues.forEach(chat => {
        totalMessages += (chat.history || []).length;
      });
      
      if (totalChatsCount) totalChatsCount.textContent = totalChats;
      if (totalUsersCount) totalUsersCount.textContent = totalUsers;
      if (totalMessagesCount) totalMessagesCount.textContent = totalMessages;
      
      // Dosya sayısını al
      const filesResponse = await fetch('/api/uploaded-files', {
        headers: { 'x-user-role': userRole, 'x-username': username }
      });
      
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        const files = filesData.files || [];
        if (uploadedFilesCount) uploadedFilesCount.textContent = files.length;
      }
    } catch (error) {
      console.error('Stats update error:', error);
    }
  }

  // Refresh butonları
  if (refreshSourcesBtn) {
    refreshSourcesBtn.addEventListener('click', () => {
      loadUploadedSources();
      updateStats();
    });
  }

  if (refreshChatsBtn) {
    refreshChatsBtn.addEventListener('click', () => {
      loadUserChats();
      updateStats();
    });
  }

  // İlk yükleme
  loadUploadedSources();
  loadUserChats();
  updateStats();
})();

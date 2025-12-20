import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5280;
const PROVIDER = process.env.PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = PROVIDER === 'gemini'
  ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash')
  : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

// Demo kullanıcılar (Üretim ortamında veritabanı kullanılmalı)
const DEMO_USERS = {
  'user1': { password: 'password123', role: 'user' },
  'admin': { password: 'admin123', role: 'admin' }
};

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));
app.use('/api', cors());

// Multer yapılandırması - geçici dosyalar için uploads klasörü
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });

// Gemini API ve File Manager kurulumu
let fileManager = null;
if (GEMINI_API_KEY) {
  fileManager = new GoogleAIFileManager(GEMINI_API_KEY);
}

// Login Endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    }

    const user = DEMO_USERS[username];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    if (user.role !== role) {
      return res.status(403).json({ error: `Bu kullanıcı ${role} rolüne sahip değil` });
    }

    // Token oluştur (basit demo için random token)
    const token = crypto.randomBytes(32).toString('hex');

    res.json({
      token,
      username,
      role: user.role
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Token doğrulama middleware (isteğe bağlı)
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  const token = authHeader.substring(7);
  // Demo için basit doğrulama
  if (!token) {
    return res.status(401).json({ error: 'Geçersiz token' });
  }

  next();
}

// Admin endpoint: Tüm kullanıcıların sohbet geçmişini getir
app.get('/api/all-chats', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'] || 'user';
    const username = req.headers['x-username'] || 'unknown';

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Bu endpoint sadece Admin tarafından erişilebilir.' });
    }

    // Demo: localStorage'dan tüm verileri al (üretimde veritabanı kullan)
    // Sunucu tarafında bu veriler saklanmıyor, sadece frontend'de localStorage'da var
    // Bu endpoint mock data dönüyor
    const allChats = {
      admin: {
        user: 'admin',
        chats: []
      }
    };

    res.json({
      message: 'Tüm sohbetler (Admin view)',
      chats: allChats,
      note: 'Not: Gerçek sohbetler localStorage\'da istemci tarafında saklanır. Bu bir demo response\'dur.'
    });
  } catch (error) {
    console.error('All chats error:', error);
    res.status(500).json({ error: 'Sohbetler alınırken hata oluştu' });
  }
});

// Admin endpoint: İstatistikler
app.get('/api/admin/stats', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'] || 'user';

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Bu endpoint sadece Admin tarafından erişilebilir.' });
    }

    res.json({
      registeredUsers: ['user1', 'admin'],
      systemStatus: 'Aktif',
      uploadedFiles: 'Gemini API ile',
      availableModels: [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-3-flash',
        'gpt-4o-mini',
        'gpt-4o'
      ]
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'İstatistikler alınırken hata oluştu' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array' });
    }

    let response;
    if (PROVIDER === 'gemini') {
      if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY missing on server' });
      }
      const gemModel = model || DEFAULT_MODEL;

      // Admin'in yüklediği dosyaları kontrol et
      const uploadedFilesPath = path.join(__dirname, 'uploaded_files.json');
      let uploadedFiles = [];
      if (fs.existsSync(uploadedFilesPath)) {
        uploadedFiles = JSON.parse(fs.readFileSync(uploadedFilesPath, 'utf-8'));
      }

      // Prepare history + last message once
      const lastUserIndex = [...messages].reverse().findIndex(m => m.role === 'user');
      const splitIndex = lastUserIndex >= 0 ? messages.length - 1 - lastUserIndex : messages.length - 1;
      const historyMsgs = messages.slice(0, Math.max(0, splitIndex));
      const latest = messages[messages.length - 1] || { role: 'user', content: '' };
      const history = historyMsgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
      const latestText = String(latest.content || '');

      // Eğer dosyalar yüklenmişse, TÜM dosyaları bilgi havuzu olarak kullan
      if (uploadedFiles.length > 0) {
        try {
          const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
          const modelClient = genAI.getGenerativeModel({ model: gemModel });
          
          // TÜM dosyaları içeren prompt oluştur
          const fileNames = uploadedFiles.map(f => f.fileName).join(', ');
          const systemPrompt = `Sen yardımcı bir asistansın. Kullanıcının sorularını yüklenen ${uploadedFiles.length} döküman içeriğine göre cevapla. Dökümanlar: ${fileNames}. Türkçe cevap ver. Cevabını döküman içeriğine dayandır.`;
          
          // TÜM dosyaları parts dizisine ekle
          const contentParts = [systemPrompt];
          
          uploadedFiles.forEach(file => {
            contentParts.push({
              fileData: {
                mimeType: file.mimeType,
                fileUri: file.fileUri
              }
            });
          });
          
          contentParts.push(latestText);
          
          const result = await modelClient.generateContent(contentParts);
          const text = result.response?.text?.() ?? '';
          return res.json({ content: text });
        } catch (fileErr) {
          console.log('Dosyalar ile chat başarısız, normal chat\'e geçiliyor:', fileErr.message);
          
          // Rate limit veya desteklenmeyen dosya hatası ise kullanıcıya bildir
          if (fileErr.message && (fileErr.message.includes('429') || fileErr.message.includes('quota') || fileErr.message.includes('rate limit'))) {
            return res.status(429).json({ 
              error: 'Rate limit aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.',
              details: 'Gemini API günlük kullanım limitine ulaşıldı. Biraz bekleyin.'
            });
          }
          
          if (fileErr.message && fileErr.message.includes('Unsupported MIME type')) {
            return res.status(400).json({ 
              error: 'Desteklenmeyen dosya türü',
              details: 'Yüklediğiniz dosya türü Gemini tarafından desteklenmiyor. Sadece PDF, TXT, CSV, resimler kullanın.'
            });
          }
          
          // Diğer hatalar için normal chat'e düş
        }
      }

      // Normal chat (dosya yoksa veya dosya ile başarısızsa)
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const modelClient = genAI.getGenerativeModel({ model: gemModel });
        const chat = modelClient.startChat({ history });
        const result = await chat.sendMessage(latestText);
        const text = result.response?.text?.() ?? '';
        return res.json({ content: text });
      } catch (e) {
        // Model varyantlarını dene (Aralık 2025 güncel modeller)
        const modelVariants = [
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite',
          'gemini-3-flash',
          'gemini-1.5-pro',
          'gemini-1.5-flash',
          gemModel
        ];
        
        let lastErr = e;
        for (const mId of modelVariants) {
          try {
            const contents = [...history, { role: 'user', parts: [{ text: latestText }] }];
            // v1beta API'sini kullan
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mId)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ contents, generationConfig: { temperature: 0.7 } })
            });
            if (!resp.ok) { 
              const errorText = await resp.text();
              lastErr = new Error(errorText); 
              continue; 
            }
            const data = await resp.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const text = parts.map(p => p?.text || '').join('\n').trim();
            if (text) {
              return res.json({ content: text });
            }
          } catch (err) { 
            lastErr = err; 
            continue;
          }
        }
        console.error('Gemini error', lastErr);
        return res.status(502).json({ error: 'gemini_unavailable', details: String(lastErr?.message || lastErr) });
      }
    } else {
      if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });
      }
      const useResponses = (model || DEFAULT_MODEL).startsWith('o4') || (model || DEFAULT_MODEL).startsWith('gpt-4.1');
      if (useResponses) {
        const conversation = messages.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : ''}`).join('\n');
        response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ model: model || DEFAULT_MODEL, input: conversation, temperature: 0.7 })
        });
      } else {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ model: model || DEFAULT_MODEL, messages, temperature: 0.7, stream: false })
        });
      }
    }

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenAI error', response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    let content = '';
    if (PROVIDER === 'gemini') {
      const parts = data?.candidates?.[0]?.content?.parts || [];
      content = parts.map(p => p?.text || '').join('\n').trim();
    } else {
      if (data?.choices?.[0]?.message?.content) content = data.choices[0].message.content;
      else if (data?.output_text) content = data.output_text;
      else if (Array.isArray(data?.output)) content = data.output.map(o => (o?.content?.[0]?.text ?? '')).join('\n').trim();
    }
    return res.json({ content });
  } catch (err) {
    console.error('Server error', err);
    return res.status(500).json({ error: 'unexpected_error', details: String(err?.message || err) });
  }
});

// Dosya yükleme endpoint'i
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    // Admin kontrolü - demo için header'dan alıyoruz
    // Üretimde token doğrulanmalı
    const userRole = req.headers['x-user-role'] || 'user';
    const uploadedBy = req.body?.uploadedBy || req.headers['x-username'] || 'unknown';
    
    if (userRole !== 'admin') {
      // Geçici dosyayı temizle
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: 'Dosya yükleme sadece Admin tarafından yapılabilir.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi.' });
    }

    // Gemini destekli dosya türlerini kontrol et
    const supportedMimeTypes = [
      'application/pdf',
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'video/mp4',
      'video/avi',
      'video/quicktime'
    ];

    const fileMimeType = req.file.mimetype || 'application/octet-stream';
    
    if (!supportedMimeTypes.includes(fileMimeType)) {
      // Geçici dosyayı temizle
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: `Desteklenmeyen dosya türü: ${fileMimeType}. Sadece PDF, TXT, CSV, resimler, ses ve video dosyaları destekleniyor.` 
      });
    }

    if (!GEMINI_API_KEY || !fileManager) {
      // Geçici dosyayı temizle
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Gemini API anahtarı bulunamadı. Dosya yükleme özelliği sadece Gemini ile çalışır.' });
    }

    // Dosyayı Gemini'ye yükle
    const uploadResponse = await fileManager.uploadFile(req.file.path, {
      mimeType: req.file.mimetype || 'application/pdf',
      displayName: req.file.originalname || 'uploaded_file',
    });

    // Sunucudaki geçici dosyayı sil
    fs.unlinkSync(req.file.path);

    console.log(`Dosya yüklendi: ${uploadResponse.file.uri} (Yükleyen: ${uploadedBy})`);

    // Yüklenen dosyaları JSON dosyasına kaydet
    const uploadedFilesPath = path.join(__dirname, 'uploaded_files.json');
    let uploadedFiles = [];
    if (fs.existsSync(uploadedFilesPath)) {
      uploadedFiles = JSON.parse(fs.readFileSync(uploadedFilesPath, 'utf-8'));
    }
    
    uploadedFiles.push({
      fileUri: uploadResponse.file.uri,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      uploadedBy: uploadedBy,
      uploadedAt: new Date().toISOString(),
      fileSize: req.file.size
    });
    
    fs.writeFileSync(uploadedFilesPath, JSON.stringify(uploadedFiles, null, 2));

    res.json({ 
      fileUri: uploadResponse.file.uri,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      uploadedBy: uploadedBy
    });
  } catch (error) {
    // Hata durumunda geçici dosyayı temizle
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Yükleme hatası:', error);
    res.status(500).json({ error: 'Dosya yüklenirken hata oluştu.', details: String(error?.message || error) });
  }
});

// Yüklenen dosyaları listele (sadece admin)
app.get('/api/uploaded-files', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'] || 'user';
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Bu endpoint sadece Admin tarafından erişilebilir.' });
    }

    const uploadedFilesPath = path.join(__dirname, 'uploaded_files.json');
    if (!fs.existsSync(uploadedFilesPath)) {
      return res.json({ files: [] });
    }
    
    const uploadedFiles = JSON.parse(fs.readFileSync(uploadedFilesPath, 'utf-8'));
    res.json({ files: uploadedFiles });
  } catch (error) {
    console.error('Dosya listesi hatası:', error);
    res.status(500).json({ error: 'Dosya listesi alınırken hata oluştu.' });
  }
});

// Dosya silme endpoint'i (sadece admin)
app.delete('/api/delete-file', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'] || 'user';
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Bu endpoint sadece Admin tarafından erişilebilir.' });
    }

    const { index } = req.body;
    if (typeof index !== 'number') {
      return res.status(400).json({ error: 'Geçersiz dosya index' });
    }

    const uploadedFilesPath = path.join(__dirname, 'uploaded_files.json');
    if (!fs.existsSync(uploadedFilesPath)) {
      return res.status(404).json({ error: 'Dosya listesi bulunamadı' });
    }
    
    let uploadedFiles = JSON.parse(fs.readFileSync(uploadedFilesPath, 'utf-8'));
    
    if (index < 0 || index >= uploadedFiles.length) {
      return res.status(400).json({ error: 'Geçersiz index' });
    }
    
    // Dosyayı listeden kaldır
    uploadedFiles.splice(index, 1);
    fs.writeFileSync(uploadedFilesPath, JSON.stringify(uploadedFiles, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Dosya silme hatası:', error);
    res.status(500).json({ error: 'Dosya silinirken hata oluştu.' });
  }
});

// Chat silme endpoint'i (sadece admin)
app.delete('/api/delete-chat', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'] || 'user';
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Bu endpoint sadece Admin tarafından erişilebilir.' });
    }

    const { chatId, targetUsername } = req.body;
    if (!chatId || !targetUsername) {
      return res.status(400).json({ error: 'chatId ve targetUsername gerekli' });
    }

    // Not: Bu basit implementasyonda localStorage kullanıyoruz
    // Gerçek uygulamada veritabanından silinmeli
    res.json({ success: true, message: 'Chat localStorage\'dan silinmeli (client-side)' });
  } catch (error) {
    console.error('Chat silme hatası:', error);
    res.status(500).json({ error: 'Chat silinirken hata oluştu.' });
  }
});

// Döküman bazlı chat endpoint'i
app.post('/api/chat-with-doc', async (req, res) => {
  try {
    const { message, fileUri, mimeType, model } = req.body;

    if (!message || !fileUri) {
      return res.status(400).json({ error: 'Mesaj veya Dosya URI eksik.' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY missing on server' });
    }

    const gemModel = model || DEFAULT_MODEL;
    const fileMimeType = mimeType || 'application/pdf';

    // Model adını düzelt (2024 Aralık güncel modeller)
    const modelVariants = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-002',
      'gemini-1.5-pro',
      'gemini-1.5-pro-002',
      'gemini-pro',
      gemModel
    ];

    // Önce SDK ile dene
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const modelClient = genAI.getGenerativeModel({ model: gemModel });
      
      const result = await modelClient.generateContent([
        {
          fileData: {
            mimeType: fileMimeType,
            fileUri: fileUri
          }
        },
        { text: message }
      ]);

      const response = await result.response;
      const text = response.text();
      return res.json({ content: text });
    } catch (sdkError) {
      // SDK başarısız olursa REST API ile dene
      console.log('SDK hatası, REST API deneniyor...', sdkError?.message);
      
      let lastErr = sdkError;
      
      // Farklı model varyantlarını dene
      for (const modelVariant of modelVariants) {
        try {
          const contents = [
            {
              role: 'user',
              parts: [
                {
                  fileData: {
                    mimeType: fileMimeType,
                    fileUri: fileUri
                  }
                },
                { text: message }
              ]
            }
          ];

          // v1beta API'sini kullan
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelVariant)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents,
                generationConfig: { temperature: 0.7 }
              })
            }
          );

          if (!resp.ok) {
            const errorText = await resp.text();
            lastErr = new Error(errorText);
            continue;
          }

          const data = await resp.json();
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const text = parts.map(p => p?.text || '').join('\n').trim();
          
          if (text) {
            return res.json({ content: text });
          }
        } catch (err) {
          lastErr = err;
          continue;
        }
      }

      // Tüm denemeler başarısız oldu
      console.error('Döküman bazlı chat hatası:', lastErr);
      return res.status(502).json({
        error: 'Cevap üretilemedi.',
        details: String(lastErr?.message || lastErr)
      });
    }
  } catch (error) {
    console.error('Chat hatası:', error);
    res.status(500).json({
      error: 'Cevap üretilemedi.',
      details: String(error?.message || error)
    });
  }
});

app.get('/api/health', (req,res)=>{
  res.json({ ok: true, provider: PROVIDER, model: DEFAULT_MODEL });
});

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});

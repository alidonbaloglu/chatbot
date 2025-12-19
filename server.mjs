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

      // Prepare history + last message once
      const lastUserIndex = [...messages].reverse().findIndex(m => m.role === 'user');
      const splitIndex = lastUserIndex >= 0 ? messages.length - 1 - lastUserIndex : messages.length - 1;
      const historyMsgs = messages.slice(0, Math.max(0, splitIndex));
      const latest = messages[messages.length - 1] || { role: 'user', content: '' };
      const history = historyMsgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
      const latestText = String(latest.content || '');

      // Try SDK first; if model not found (404), fallback to REST v1beta with multiple model variants
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const modelClient = genAI.getGenerativeModel({ model: gemModel });
        const chat = modelClient.startChat({ history });
        const result = await chat.sendMessage(latestText);
        const text = result.response?.text?.() ?? '';
        return res.json({ content: text });
      } catch (e) {
        // Model varyantlarını dene (Free tier'da kullanılabilir modeller)
        const modelVariants = [
          gemModel,
          `${gemModel}-lite`,
          `${gemModel}-001`,
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite',
          'gemini-2.5-flash-001',
          'gemini-1.5-flash',
          'gemini-1.5-flash-001',
          'gemini-1.5-flash-latest'
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
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi.' });
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

    console.log(`Dosya yüklendi: ${uploadResponse.file.uri}`);

    res.json({ 
      fileUri: uploadResponse.file.uri,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype
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

    // Model adını düzelt (Free tier'da kullanılabilir modeller)
    const modelVariants = [
      gemModel,
      `${gemModel}-lite`,
      `${gemModel}-001`,
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash-001',
      'gemini-1.5-flash',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-latest'
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

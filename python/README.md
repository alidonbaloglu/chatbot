# Python RAG (Gemini + Chroma)

Bu Python klasörü, PDF dökümanlarından vektör veritabanı oluşturur ve Gemini ile RAG (Retrieval-Augmented Generation) sohbeti yapar.

## ✅ Kurulum Tamamlandı

Tüm Python paketleri yüklendi:
- ✅ `langchain` ve `langchain-google-genai`
- ✅ `langchain-chroma` ve `chromadb`
- ✅ `semantic-router` ve `semantic-chunkers`
- ✅ `pypdf` (PDF okuma)

## 📄 Kullanım

### 1. PDF Ekle

`documents/` klasörüne PDF dosyalarınızı ekleyin:

```
python/
├── documents/          👈 PDF'leri buraya
│   ├── dosya1.pdf
│   ├── dosya2.pdf
│   └── ...
```

### 2. Vektör Veritabanı Oluştur

```powershell
python python/rag_build.py
```

Bu komut:
- PDF'leri okur ve semantik chunking yapar
- ChromaDB vektör veritabanı oluşturur (`database_gemini/`)

### 3. RAG Sohbeti

```powershell
python python/rag_chat.py
```

Terminal'de dökümanlarınız hakkında sorular sorabilirsiniz.

## ⚙️ API Anahtarı

`.env` dosyasında (ana dizinde) Gemini API anahtarınızı ayarlayın:

```env
GOOGLE_API_KEY=YOUR_NEW_GEMINI_API_KEY
```

**Önemli**: Yeni bir API anahtarı alın: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

## 📊 Modeller

- **Embedding**: `models/text-embedding-004`
- **Chat**: `gemini-1.5-flash` (varsayılan)

## ⚠️ Notlar

- PDF'ler text-based olmalı (taranmış görüntü değil)
- Minimum 1 sayfa içermeli
- İlk çalıştırmada `documents/` klasörü otomatik oluşturulur


Ask questions; answers are grounded only in your documents, with sources preview.

## Notes
- Uses `models/text-embedding-004` for embeddings and Gemini chat for answers.
- Keep your API key out of the repo; use env vars or `.env` in local only.
- You can change the chat model (e.g., `gemini-1.5-pro`, `gemini-2.5-flash-lite`) if available to your account.

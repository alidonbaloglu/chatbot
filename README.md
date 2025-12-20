# ChatBot

Bu proje, ekran görüntüsüne benzeyen basit bir sohbet arayüzüdür. Sol üstte avatar alanı bulunur; tıklayıp görsel yükleyebilirsiniz. Sohbet geçmişi ve avatar tarayıcıda (localStorage) saklanır. Node.js proxy sunucusu ile OpenAI veya Gemini (Google) üzerinden yanıt üretebilir.

## ⚠️ Önemli: API Anahtarı

**Gemini API anahtarınız sızdırıldı olarak işaretlendi!** Yeni bir API anahtarı almanız gerekiyor:

1. 🔗 **Yeni API Anahtarı Al**: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. 🗑️ **Eski Anahtarı Sil**: Google AI Studio'da eski anahtarınızı silin
3. ✅ **Yeni Anahtarı Kullan**: `.env` dosyasına yeni anahtarı ekleyin
4. 🚫 **GitHub'a Yüklemeyin**: `.env` dosyasını asla commit etmeyin

> **Not**: Güncel modeller: `gemini-1.5-flash`, `gemini-1.5-flash-002`, `gemini-1.5-pro`

## Giriş Sistemi

Uygulamada iki farklı kullanıcı türü vardır:

### Kullanıcı Girişi
- **Kullanıcı Adı**: `user1`
- **Şifre**: `password123`
- Açıklama: Normal kullanıcı sohbet yapabilir

### Admin Girişi
- **Kullanıcı Adı**: `admin`
- **Şifre**: `admin123`
- Açıklama: Admin hesabı ile erişim (gelecekte admin özellikleri eklenebilir)

> **Not**: Demo amaçlıdır. Üretim ortamında şifreler şifrelenmiş olarak veritabanında saklanmalıdır.

## Kurulum ve Çalıştırma (Windows PowerShell)

1) Bağımlılıkları kurun
```powershell
npm install
```

2) Sağlayıcı ve anahtarları ayarlayın (anahtarları dosyalara yazmayın)
```powershell
# Geçerli oturum için (örnek: Gemini
$env:PROVIDER = "gemini"
$env:GEMINI_API_KEY = "YOUR_NEW_GEMINI_KEY"
# İsteğe bağlı: model
$env:GEMINI_MODEL = "gemini-1.5-flash"

# Alternatif: OpenAI kullanacaksanız
$env:PROVIDER = "openai"
$env:OPENAI_API_KEY = "YOUR_OPENAI_KEY"
$env:OPENAI_MODEL = "gpt-4o-mini"

# Alternatif: .env dosyası kullanın (kaydedilir, depoya eklemeyin)
Copy-Item .env.example .env
# ardından .env içindeki PROVIDER ve ilgili API_KEY değerini düzenleyin
```

3) Sunucuyu başlatın ve tarayıcıda açın (varsayılan port 5280)
```powershell
npm start
Start-Process http://localhost:5280/login.html
```

## Kullanım
- `http://localhost:5280/login.html` adresine gidin
- Kullanıcı veya Admin olarak giriş yapın
- Giriş yapıldıktan sonra chat sayfasına yönlendirilirsiniz
- Sol üst avatar alanına tıklayıp görsel seçin
- Mesaj yazıp Enter'a basın veya gönder tuşuna tıklayın
- `Yeni sohbet` geçmişi temizler
- Sağ üst köşedeki `Çıkış` butonu ile logout olabilirsiniz

### Logo ve ikon görselleri
- Arayüzdeki varsayılan avatar ve logo `assets/Medya.png` olarak ayarlanmıştır.
- Kendi görselinizi kullanmak için: `C:\Users\ali.donbaloglu\Desktop\ChatBot\Medya.png` dosyanızı proje içine `assets/Medya.png` olarak kopyalayın.
- Yerel tam Windows yolu (C:\...) tarayıcı tarafından doğrudan servis edilmez; bu yüzden görselin `assets` klasöründe bulunması gerekir.

## Nasıl Çalışır
- İstemci: `index.html`, `styles.css`, `app.js`
- Login sayfası: `login.html` - Kullanıcı ve Admin girişi
- Sunucu: `server.mjs` 
  - `/api/login` endpoint'i ile kimlik doğrulama
  - `/api/chat` endpoint'i ile sohbet iletişimi
  - İstekleri seçili sağlayıcıya (OpenAI/Gemini) iletir. Anahtar tarayıcıya sızmaz.
- Yapılandırma: `.env.example` örneğine göre `.env` oluşturabilirsiniz (repo, `.env` dosyasını `.gitignore` ile yok sayar).

## Önemli Not
Eğer README veya başka bir dosyada bir API anahtarı paylaştıysanız, güvenlik için o anahtarı derhal OpenAI panelinden iptal edin (revoke) ve yeni bir anahtar oluşturun.

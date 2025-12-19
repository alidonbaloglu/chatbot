# ChatBot

Bu proje, ekran görüntüsüne benzeyen basit bir sohbet arayüzüdür. Sol üstte avatar alanı bulunur; tıklayıp görsel yükleyebilirsiniz. Sohbet geçmişi ve avatar tarayıcıda (localStorage) saklanır. Node.js proxy sunucusu ile OpenAI veya Gemini (Google) üzerinden yanıt üretebilir.

## Kurulum ve Çalıştırma (Windows PowerShell)

1) Bağımlılıkları kurun
```powershell
npm install
```

2) Sağlayıcı ve anahtarları ayarlayın (anahtarları dosyalara yazmayın)
```powershell
# Geçerli oturum için (örnek: Gemini
$env:PROVIDER = "gemini"
$env:GEMINI_API_KEY = "YOUR_GEMINI_KEY"
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
Start-Process http://localhost:5280/index.html
```

## Kullanım
- Sol üst avatar alanına tıklayıp görsel seçin.
- Mesaj yazıp Enter’a basın veya gönder tuşuna tıklayın.
- `Yeni sohbet` geçmişi temizler.

### Logo ve ikon görselleri
- Arayüzdeki varsayılan avatar ve logo `assets/Medya.png` olarak ayarlanmıştır.
- Kendi görselinizi kullanmak için: `C:\Users\ali.donbaloglu\Desktop\ChatBot\Medya.png` dosyanızı proje içine `assets/Medya.png` olarak kopyalayın.
- Yerel tam Windows yolu (C:\...) tarayıcı tarafından doğrudan servis edilmez; bu yüzden görselin `assets` klasöründe bulunması gerekir.

## Nasıl Çalışır
- İstemci: `index.html`, `styles.css`, `app.js`
- Sunucu: `server.mjs` bir `/api/chat` endpoint’i sağlar ve istekleri seçili sağlayıcıya (OpenAI/Gemini) iletir. Anahtar tarayıcıya sızmaz.
- Yapılandırma: `.env.example` örneğine göre `.env` oluşturabilirsiniz (repo, `.env` dosyasını `.gitignore` ile yok sayar).

## Önemli Not
Eğer README veya başka bir dosyada bir API anahtarı paylaştıysanız, güvenlik için o anahtarı derhal OpenAI panelinden iptal edin (revoke) ve yeni bir anahtar oluşturun.

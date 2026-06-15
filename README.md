# Abonelik Takip

Firebase senkronizasyonlu iPhone + Mac uyumlu PWA.

## Lokal kurulum

```bash
cd abonelik-takip-firebase
cp .env.example .env
npm install
npm run dev
```

`.env` dosyasına Firebase config değerlerini yaz.

## Firebase ayarları

Authentication > Sign-in method > Google > Enable

Firestore Database > Create database > Production mode

Rules bölümüne `firestore.rules` içeriğini yapıştır.

## GitHub

```bash
git init
git add .
git commit -m "abonelik takip firebase"
git branch -M main
git remote add origin https://github.com/saidnumany-cpu/abonelik-takip.git
git push -u origin main
```

## Vercel

Project Settings > Environment Variables kısmına `.env` değerlerini ekle.
Sonra Deploy.

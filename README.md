# Nuvio Stream Providers

Bu repo, Nuvio icin uc dogrudan kaynak provider'i sunar:

- `Dizilla`
- `SelcukFlix`
- `WebDramaTurkey`

Provider'lar artik araya baska bir API koymadan dogrudan kaynak sitelerin arama, detay ve embed akislarini kullanir. Nuvio icinde katalog veya ana sayfa akisi olusturmaz; sadece `getStreams(tmdbId, mediaType, season, episode)` contract'ini uygular.

## Gelistirme

Bagimliliklari kur:

```bash
npm install
```

Bundle dosyalarini yeniden uret:

```bash
npm run build:all
```

Temel smoke testi calistir:

```bash
npm run smoke
```

## Nuvio'da Kullanim

Bu provider repository'sini Nuvio'ya iki farkli sekilde ekleyebilirsin.

### 1. GitHub uzerinden ekleme

Repo GitHub'a push edildikten sonra Nuvio icinde su akisi izle:

1. Nuvio uygulamasini ac.
2. `Settings` sayfasina git.
3. `Plugins` veya `Local Scrapers` bolumunu ac.
4. Yeni repository URL'i ekle.
5. Asagidaki `manifest.json` adresini gir:

```text
https://raw.githubusercontent.com/onurcvnoglu/nuvio-onrcvn-plugin/refs/heads/main/manifest.json
```

6. Repository yuklendikten sonra istedigin provider'lari etkinlestir.
7. Bir film veya dizi acip stream listesinde provider sonucunu kontrol et.

### 2. Yerelden ekleme

Gelistirme sirasinda yerel agdan test etmek icin:

1. Repo klasorunu statik bir HTTP server ile servis et.
2. Nuvio icinde yerel `manifest.json` adresini ekle.

Ornek yerel manifest adresi:

```text
http://<local-ip>:3000/manifest.json
```

`<local-ip>` degeri olarak ayni Wi-Fi agindaki bilgisayarinin IP adresini kullan.

Ornek statik servis komutu:

```bash
python3 -m http.server 3000
```

## Notlar

- `Dizilla` yalnizca `tv` tipi icin aciktir; kaynak site akisi dizi odaklidir.
- `SelcukFlix` ve `WebDramaTurkey` icin hem `movie` hem `tv` desteklenir.
- `Dizilla` ve `WebDramaTurkey` domainleri degisebildigi icin provider kodu guncel domain listesini oncelemeye calisir.
- Bazi hostlar zaman zaman Cloudflare veya benzeri korumalar gosterebilir; provider bu durumda hata firlatmak yerine bos sonuc dondurur.

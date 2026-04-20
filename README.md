# Nuvio Stream Providers

Bu repo, Nuvio icin uc provider sunar:

- `AnimeciX`
- `Dizilla`
- `HDFilmCehennemi`

Ilk surumde repo yalnizca stream discovery amacina odaklanir. Nuvio icinde katalog veya ana sayfa akisi olusturmaz; sadece `getStreams(tmdbId, mediaType, season, episode)` contract'ini uygular.

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

6. Repository yuklendikten sonra `AnimeciX`, `Dizilla` ve `HDFilmCehennemi` provider'larini etkinlestir.
7. Bir film veya dizi acip stream listesinde provider sonucunu kontrol et.

### 2. Yerelden ekleme

Gelistirme sirasinda yerel agdan test etmek icin:

1. Bu repoda bagimliliklari kur.
2. Provider bundle'larini build et.
3. Yerel HTTP server'i baslat.
4. Nuvio icinde yerel `manifest.json` adresini ekle.

Ornek yerel manifest adresi:

```text
http://<local-ip>:3000/manifest.json
```

`<local-ip>` degeri olarak ayni Wi-Fi agindaki bilgisayarinin IP adresini kullan.

## Kurulum

```bash
npm install
```

## Build

Tum provider'lari build etmek icin:

```bash
npm run build:all
```

Belirli provider'lari build etmek icin:

```bash
node build.js animecix dizilla
```

## Yerel Servis ve Test

Manifest ve bundle dosyalarini yerelde servis etmek icin:

```bash
npm start
```

Nuvio icinde asagidaki URL eklenir:

```text
http://<local-ip>:3000/manifest.json
```

Nuvio uygulamasi ile bilgisayarin ayni agda olmali.

## Smoke Test

Temel entegrasyon testi:

```bash
npm run smoke
```

Bu script:

- manifest parse kontrolu yapar
- built provider dosyalarini `require()` ile yukler
- AnimeciX ve HDFilmCehennemi icin pozitif smoke test dener
- Dizilla icin sonuc sayisini raporlar ama degisken kaynak davranisi nedeniyle bilgilendirici moda yakindir

## Mimari

- `src/common/`
  Provider istemcisi, TMDB resolver, normalize ve matching yardimcilari
- `src/providers/<provider>/index.js`
  Provider entrypoint
- `providers/`
  Nuvio'nun tukecegi build ciktilari

## Notlar

- TMDB metadata public HTML sayfalarindan cozulur; API key gerekmez.
- Kaynak API'den gelen `subtitles` alanlari ilk surumde Nuvio stream objesine tasinmaz.
- Kaynak API'den gelen URL alanlari bazen percent-encoded oldugu icin provider tarafinda normalize edilir.

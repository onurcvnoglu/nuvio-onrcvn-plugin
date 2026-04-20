var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/common/normalize.js
var require_normalize = __commonJS({
  "src/common/normalize.js"(exports2, module2) {
    function asciiFold(value) {
      return String(value || "").replace(/İ/g, "I").replace(/ı/g, "i").replace(/Ş/g, "S").replace(/ş/g, "s").replace(/Ğ/g, "G").replace(/ğ/g, "g").replace(/Ü/g, "U").replace(/ü/g, "u").replace(/Ö/g, "O").replace(/ö/g, "o").replace(/Ç/g, "C").replace(/ç/g, "c");
    }
    function normalizeText(value) {
      return asciiFold(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[“”"'`’]/g, "").replace(/\([^)]*\)/g, " ").replace(/\b(tv series|season|sezon|episode|bolum|bölüm|movie|film)\b/g, " ").replace(/[:/|._,-]+/g, " ").replace(/\s+/g, " ").trim();
    }
    function uniqueStrings2(values) {
      var seen = {};
      var result = [];
      var index;
      for (index = 0; index < (values || []).length; index += 1) {
        var item = String(values[index] || "").trim();
        if (!item || seen[item]) {
          continue;
        }
        seen[item] = true;
        result.push(item);
      }
      return result;
    }
    function splitTitleVariants(title) {
      const source = String(title || "").trim();
      if (!source) {
        return [];
      }
      const variants = [source];
      const dashParts = source.split(/\s+-\s+/g).map((part) => part.trim()).filter(Boolean);
      const colonParts = source.split(/\s*:\s*/g).map((part) => part.trim()).filter(Boolean);
      const slashParts = source.split(/\s*\/\s*/g).map((part) => part.trim()).filter(Boolean);
      const noParens = source.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
      variants.push(...dashParts, ...colonParts, ...slashParts, noParens);
      for (const part of dashParts) {
        variants.push(...part.split(/\s*:\s*/g).map((item) => item.trim()).filter(Boolean));
      }
      return uniqueStrings2(variants);
    }
    function buildQueryVariants(metadata) {
      const queries = [];
      for (const title of metadata.titles || []) {
        for (const variant of splitTitleVariants(title)) {
          queries.push(variant);
          queries.push(variant.replace(/\bthe\b/gi, "").replace(/\s+/g, " ").trim());
        }
      }
      return uniqueStrings2(queries).filter((value) => value.length >= 2).sort((left, right) => right.length - left.length).slice(0, 6);
    }
    function decodeHtml(value) {
      return String(value || "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    }
    function formatEpisodeTag(season, episode) {
      if (season == null || episode == null) {
        return "";
      }
      const seasonText = String(season).padStart(2, "0");
      const episodeText = String(episode).padStart(2, "0");
      return `S${seasonText}E${episodeText}`;
    }
    module2.exports = {
      buildQueryVariants,
      decodeHtml,
      formatEpisodeTag,
      normalizeText,
      splitTitleVariants,
      uniqueStrings: uniqueStrings2
    };
  }
});

// src/common/matcher.js
var require_matcher = __commonJS({
  "src/common/matcher.js"(exports2, module2) {
    var { normalizeText, splitTitleVariants } = require_normalize();
    function buildTokenObject(value) {
      var tokens = {};
      var parts = normalizeText(value).split(" ");
      var index;
      for (index = 0; index < parts.length; index += 1) {
        if (parts[index]) {
          tokens[parts[index]] = true;
        }
      }
      return tokens;
    }
    function objectSize(input) {
      var size = 0;
      var key;
      for (key in input) {
        size += 1;
      }
      return size;
    }
    function tokenSet(value) {
      return buildTokenObject(value);
    }
    function overlapScore(left, right) {
      var leftTokens = tokenSet(left);
      var rightTokens = tokenSet(right);
      var leftSize = objectSize(leftTokens);
      var rightSize = objectSize(rightTokens);
      var intersection = 0;
      var union = {};
      var token;
      if (leftSize === 0 || rightSize === 0) {
        return 0;
      }
      for (token in leftTokens) {
        union[token] = true;
        if (rightTokens[token]) {
          intersection += 1;
        }
      }
      for (token in rightTokens) {
        union[token] = true;
      }
      var coverage = intersection / Math.max(1, Math.min(leftSize, rightSize));
      var jaccard = intersection / Math.max(1, objectSize(union));
      return Math.max(jaccard, coverage * 0.92);
    }
    function variantSimilarity(left, right) {
      var normalizedLeft = normalizeText(left);
      var normalizedRight = normalizeText(right);
      if (!normalizedLeft || !normalizedRight) {
        return 0;
      }
      if (normalizedLeft === normalizedRight) {
        return 1;
      }
      if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
        var shortLength = Math.min(normalizedLeft.length, normalizedRight.length);
        var longLength = Math.max(normalizedLeft.length, normalizedRight.length);
        return 0.75 + shortLength / Math.max(1, longLength) * 0.25;
      }
      return overlapScore(normalizedLeft, normalizedRight);
    }
    function bestTitleSimilarity(candidateTitle, metadataTitles) {
      var candidateVariants = splitTitleVariants(candidateTitle);
      var best = 0;
      var candidateIndex;
      var titleIndex;
      var variantIndex;
      for (candidateIndex = 0; candidateIndex < candidateVariants.length; candidateIndex += 1) {
        for (titleIndex = 0; titleIndex < metadataTitles.length; titleIndex += 1) {
          var metadataVariants = splitTitleVariants(metadataTitles[titleIndex]);
          for (variantIndex = 0; variantIndex < metadataVariants.length; variantIndex += 1) {
            best = Math.max(best, variantSimilarity(candidateVariants[candidateIndex], metadataVariants[variantIndex]));
          }
        }
      }
      return best;
    }
    function rankSearchResults(results, metadata) {
      return results.map((result) => {
        var searchScore = bestTitleSimilarity(result.title, metadata.titles) * 100;
        return Object.assign({}, result, { searchScore });
      }).sort((left, right) => right.searchScore - left.searchScore);
    }
    function scoreLoadedItem(item, metadata, searchScore, mediaType, season, episode) {
      var score = searchScore + bestTitleSimilarity(item.title || "", metadata.titles) * 35;
      if (metadata.year && item.year) {
        var difference = Math.abs(Number(metadata.year) - Number(item.year));
        if (difference === 0) {
          score += 20;
        } else if (difference === 1) {
          score += 8;
        } else {
          score -= 20;
        }
      }
      var hasEpisodes = Array.isArray(item.episodes) && item.episodes.length > 0;
      if (mediaType === "tv") {
        score += hasEpisodes ? 15 : -15;
        if (season != null && episode != null) {
          var exactEpisode = findEpisode(item, season, episode);
          score += exactEpisode ? 40 : -30;
        }
      } else {
        score += hasEpisodes ? -15 : 15;
      }
      return score;
    }
    function findEpisode(item, season, episode) {
      if (!Array.isArray(item.episodes)) {
        return null;
      }
      return item.episodes.find((entry) => Number(entry.season) === Number(season) && Number(entry.episode) === Number(episode)) || null;
    }
    function extractQuality(name) {
      var match = String(name || "").match(/(2160p|1080p|720p|480p|360p|4k)/i);
      if (match) {
        return match[1].toUpperCase().replace("4K", "4K");
      }
      return "Auto";
    }
    module2.exports = {
      extractQuality,
      findEpisode,
      rankSearchResults,
      scoreLoadedItem
    };
  }
});

// src/common/constants.js
var require_constants = __commonJS({
  "src/common/constants.js"(exports2, module2) {
    module2.exports = {
      DEFAULT_HEADERS: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      DOMAIN_LIST_URL: "https://raw.githubusercontent.com/Kraptor123/domainListesi/refs/heads/main/eklenti_domainleri.txt",
      TMDB_API_BASE_URL: "https://api.themoviedb.org/3",
      TMDB_API_KEY: "4ef0d7355d9ffb5151e987764708ce96",
      TMDB_LANGUAGES: ["en-US", "tr-TR", "ja-JP"]
    };
  }
});

// src/common/http.js
var require_http = __commonJS({
  "src/common/http.js"(exports2, module2) {
    var { DEFAULT_HEADERS } = require_constants();
    function mergeHeaders(extraHeaders) {
      var merged = {};
      var key;
      for (key in DEFAULT_HEADERS) {
        merged[key] = DEFAULT_HEADERS[key];
      }
      if (extraHeaders) {
        for (key in extraHeaders) {
          merged[key] = extraHeaders[key];
        }
      }
      return merged;
    }
    function fetchText(url, options) {
      return fetch(url, {
        method: options && options.method ? options.method : "GET",
        headers: mergeHeaders(options && options.headers ? options.headers : null),
        body: options && options.body ? options.body : void 0
      }).then(function(response) {
        return response.text().then(function(text) {
          if (!response.ok) {
            var error = new Error("Request failed: " + response.status + " " + response.statusText);
            error.status = response.status;
            error.body = text;
            throw error;
          }
          return text;
        });
      });
    }
    function fetchTextWithResponse(url, options) {
      return fetch(url, {
        method: options && options.method ? options.method : "GET",
        headers: mergeHeaders(options && options.headers ? options.headers : null),
        body: options && options.body ? options.body : void 0
      }).then(function(response) {
        return response.text().then(function(text) {
          if (!response.ok) {
            var error = new Error("Request failed: " + response.status + " " + response.statusText);
            error.status = response.status;
            error.body = text;
            throw error;
          }
          return { text, response };
        });
      });
    }
    function fetchJson(url, options) {
      return fetchText(url, options).then(function(text) {
        try {
          return JSON.parse(text);
        } catch (error) {
          error.message = "JSON parse failed for " + url + ": " + error.message;
          throw error;
        }
      });
    }
    module2.exports = {
      fetchJson,
      fetchText,
      fetchTextWithResponse
    };
  }
});

// src/common/tmdb.js
var require_tmdb = __commonJS({
  "src/common/tmdb.js"(exports2, module2) {
    var { TMDB_API_BASE_URL, TMDB_API_KEY, TMDB_LANGUAGES } = require_constants();
    var { fetchJson } = require_http();
    var { uniqueStrings: uniqueStrings2 } = require_normalize();
    function extractYearFromDate(dateValue) {
      if (!dateValue || typeof dateValue !== "string") {
        return null;
      }
      return Number(dateValue.slice(0, 4)) || null;
    }
    function fetchLocalizedPage(tmdbId, mediaType, language) {
      var typeSegment = mediaType === "movie" ? "movie" : "tv";
      var url = TMDB_API_BASE_URL + "/" + typeSegment + "/" + encodeURIComponent(String(tmdbId)) + "?language=" + encodeURIComponent(language) + "&api_key=" + encodeURIComponent(TMDB_API_KEY);
      return fetchJson(url).then(function(payload) {
        return {
          language,
          title: payload.title || payload.name || "",
          year: extractYearFromDate(payload.release_date || payload.first_air_date),
          originalTitle: payload.original_title || payload.original_name || ""
        };
      });
    }
    function resolveMetadata(tmdbId, mediaType, options) {
      var languages = Array.isArray(options && options.languages) && options.languages.length ? options.languages : TMDB_LANGUAGES.filter(function(language) {
        if (language === "ja-JP") {
          return Boolean(options && options.includeJapaneseTitles);
        }
        return true;
      });
      return Promise.all(
        languages.map(function(language) {
          return fetchLocalizedPage(tmdbId, mediaType, language).catch(function() {
            return null;
          });
        })
      ).then(function(pages) {
        var validPages = pages.filter(Boolean);
        var titles = [];
        var year = null;
        var pageIndex;
        for (pageIndex = 0; pageIndex < validPages.length; pageIndex += 1) {
          if (validPages[pageIndex].title) {
            titles.push(validPages[pageIndex].title);
          }
          if (validPages[pageIndex].originalTitle) {
            titles.push(validPages[pageIndex].originalTitle);
          }
          if (!year && validPages[pageIndex].year) {
            year = validPages[pageIndex].year;
          }
        }
        var uniqueTitles = uniqueStrings2(titles);
        if (uniqueTitles.length === 0) {
          throw new Error("TMDB metadata cozulmedi: " + tmdbId);
        }
        return {
          tmdbId: String(tmdbId),
          mediaType,
          year,
          titles: uniqueTitles,
          displayTitle: uniqueTitles[0]
        };
      });
    }
    module2.exports = {
      resolveMetadata
    };
  }
});

// src/common/directShared.js
var require_directShared = __commonJS({
  "src/common/directShared.js"(exports2, module2) {
    var { DEFAULT_HEADERS, DOMAIN_LIST_URL } = require_constants();
    var { fetchText, fetchJson, fetchTextWithResponse } = require_http();
    var { uniqueStrings: uniqueStrings2, formatEpisodeTag } = require_normalize();
    var { extractQuality } = require_matcher();
    var domainCachePromise = null;
    function mergeHeaders(extraHeaders) {
      var merged = {};
      var key;
      for (key in DEFAULT_HEADERS) {
        merged[key] = DEFAULT_HEADERS[key];
      }
      for (key in extraHeaders || {}) {
        merged[key] = extraHeaders[key];
      }
      return merged;
    }
    function toAbsoluteUrl2(value, baseUrl) {
      if (!value) {
        return "";
      }
      if (String(value).indexOf("//") === 0) {
        return "https:" + value;
      }
      try {
        return new URL(value, baseUrl).href;
      } catch (_error) {
        return String(value);
      }
    }
    function getOrigin(url) {
      try {
        return new URL(url).origin;
      } catch (_error) {
        return "";
      }
    }
    function extractFirst2(text, regex, groupIndex) {
      var match = regex.exec(String(text || ""));
      return match ? match[groupIndex || 1] : "";
    }
    function extractAll2(text, regex, mapper) {
      var input = String(text || "");
      var result = [];
      var match;
      regex.lastIndex = 0;
      while (match = regex.exec(input)) {
        result.push(mapper ? mapper(match) : match[1]);
      }
      return result;
    }
    function htmlDecode(value) {
      return String(value || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    }
    function stripTags2(value) {
      return htmlDecode(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    }
    function extractYear2(value) {
      var match = String(value || "").match(/(19|20)\d{2}/);
      return match ? Number(match[0]) : null;
    }
    function unescapeUrl(value) {
      return String(value || "").replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/\\\\/g, "\\").replace(/\\x3D/g, "=").replace(/\\x26/g, "&").replace(/^"+|"+$/g, "");
    }
    function base64ToBytes(value) {
      var normalized = String(value || "").replace(/\s+/g, "");
      var decoded = atob(normalized);
      var bytes = new Uint8Array(decoded.length);
      var index;
      for (index = 0; index < decoded.length; index += 1) {
        bytes[index] = decoded.charCodeAt(index);
      }
      return bytes;
    }
    function hexToBytes(value) {
      var input = String(value || "").replace(/^"+|"+$/g, "");
      var bytes = new Uint8Array(input.length / 2);
      var index;
      for (index = 0; index < input.length; index += 2) {
        bytes[index / 2] = parseInt(input.slice(index, index + 2), 16);
      }
      return bytes;
    }
    function utf8Bytes(value) {
      return new TextEncoder().encode(String(value || ""));
    }
    function utf8String(value) {
      return new TextDecoder().decode(value);
    }
    function importAesKey(keyText) {
      if (!globalThis.crypto || !globalThis.crypto.subtle) {
        return Promise.reject(new Error("Web Crypto API unavailable"));
      }
      return globalThis.crypto.subtle.importKey("raw", utf8Bytes(keyText), { name: "AES-CBC" }, false, ["decrypt"]);
    }
    function decryptAesCbcBase642(payload, keyText) {
      return importAesKey(keyText).then(function(cryptoKey) {
        return globalThis.crypto.subtle.decrypt(
          { name: "AES-CBC", iv: new Uint8Array(16) },
          cryptoKey,
          base64ToBytes(payload)
        );
      }).then(function(buffer) {
        return utf8String(new Uint8Array(buffer));
      });
    }
    function decryptAesCbcHex(payload, keyText) {
      return importAesKey(keyText).then(function(cryptoKey) {
        return globalThis.crypto.subtle.decrypt(
          { name: "AES-CBC", iv: new Uint8Array(16) },
          cryptoKey,
          hexToBytes(payload)
        );
      }).then(function(buffer) {
        return utf8String(new Uint8Array(buffer));
      });
    }
    function decodeBase64Json2(payload) {
      try {
        return JSON.parse(utf8String(base64ToBytes(payload)));
      } catch (_error) {
        return null;
      }
    }
    function parseDirectMedia(text) {
      var mediaUrls = [];
      var patterns = [
        /sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)/ig,
        /file\s*:\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)/ig,
        /"file"\s*:\s*"([^"]+\.(?:m3u8|mp4)[^"]*)/ig,
        /(https?:\/\/[^"'\\\s<>]+\.(?:m3u8|mp4)[^"'\\\s<>]*)/ig
      ];
      patterns.forEach(function(pattern) {
        extractAll2(text, pattern).forEach(function(url) {
          mediaUrls.push(unescapeUrl(url));
        });
      });
      return uniqueStrings2(mediaUrls);
    }
    function extractNestedIframe(text, baseUrl) {
      var iframeUrl = extractFirst2(text, /id="main-iframe"[^>]+src="([^"]+)"/i) || extractFirst2(text, /<iframe[^>]+src="([^"]+)"/i);
      return iframeUrl ? toAbsoluteUrl2(iframeUrl, baseUrl) : "";
    }
    function parseCookie(response, cookieName) {
      var header = response && response.headers ? response.headers.get("set-cookie") : "";
      var match = String(header || "").match(new RegExp(cookieName + "=([^;]+)"));
      return match ? match[1] : "";
    }
    function createExternalFallback2(url, referer, label) {
      var fullUrl = toAbsoluteUrl2(url, referer || url);
      var sourceName = "External";
      try {
        sourceName = new URL(fullUrl).hostname.replace(/^www\./, "");
      } catch (_error) {
        sourceName = "External";
      }
      return {
        sourceName,
        label: label || "External",
        quality: label || "Auto",
        url: fullUrl,
        headers: referer ? { Referer: referer } : {}
      };
    }
    function resolveVidmoly(url, referer, label) {
      var fullUrl = toAbsoluteUrl2(url, referer || url);
      return fetchText(fullUrl, { headers: mergeHeaders({ Referer: referer || fullUrl }) }).then(function(html) {
        return parseDirectMedia(html).map(function(mediaUrl) {
          return {
            sourceName: "VidMoly",
            label: label || "VidMoly",
            quality: label || "Auto",
            url: mediaUrl,
            headers: { Referer: fullUrl }
          };
        });
      }).catch(function() {
        return [];
      });
    }
    function resolveDtpasn(url, referer, label) {
      var videoId = String(url).split("dtpasn.asia/video/")[1] || "";
      videoId = videoId.split("?")[0].split("/")[0];
      if (!videoId) {
        return Promise.resolve([]);
      }
      return fetchTextWithResponse(url, { headers: mergeHeaders({ Referer: referer || "https://dtpasn.asia/" }) }).then(function(result) {
        var cookieValue = parseCookie(result.response, "fireplayer_player") || "6qgq1bmrp7gisci61s2p7edgrr";
        return fetchJson("https://dtpasn.asia/player/index.php?data=" + encodeURIComponent(videoId) + "&do=getVideo", {
          method: "POST",
          headers: mergeHeaders({
            Referer: url,
            Origin: "https://dtpasn.asia",
            Cookie: "fireplayer_player=" + cookieValue,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Accept: "*/*"
          })
        }).then(function(payload) {
          var links = [];
          [payload.videoSource, payload.securedLink].forEach(function(mediaUrl) {
            if (!mediaUrl) {
              return;
            }
            links.push({
              sourceName: "WebDramaTurkey",
              label: label || "WDT",
              quality: label || "Auto",
              url: mediaUrl,
              headers: {
                Referer: "https://dtpasn.asia/",
                Origin: "https://dtpasn.asia",
                Cookie: "fireplayer_player=" + cookieValue
              }
            });
          });
          return links;
        });
      }).catch(function() {
        return [];
      });
    }
    function resolveVidstackVideo(baseUrl, videoId, siteOrigin, label) {
      var cleanBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
      var videoApiUrl = cleanBaseUrl + "/api/v1/video?id=" + encodeURIComponent(videoId) + "&w=1920&h=1080&r=" + encodeURIComponent(String(siteOrigin || "").replace(/^https?:\/\//, ""));
      return fetchText(videoApiUrl, {
        headers: mergeHeaders({
          Referer: cleanBaseUrl + "/",
          Accept: "*/*"
        })
      }).then(function(text) {
        var encoded = String(text || "").trim().replace(/^"+|"+$/g, "");
        if (!encoded || encoded.charAt(0) === "<") {
          return [];
        }
        return decryptAesCbcHex(encoded, "kiemtienmua911ca").then(function(decrypted) {
          var mediaUrl = unescapeUrl(extractFirst2(decrypted, /"source"\s*:\s*"([^"]+)"/i));
          if (!mediaUrl) {
            return [];
          }
          return [{
            sourceName: "Vidstack",
            label: label || "Vidstack",
            quality: label || "1080p",
            url: mediaUrl,
            headers: { Referer: cleanBaseUrl + "/" }
          }];
        });
      }).catch(function() {
        return [];
      });
    }
    function resolveVidstackHash(url, siteOrigin, label) {
      var hashIndex = String(url || "").lastIndexOf("#");
      var baseUrl = hashIndex >= 0 ? String(url).slice(0, hashIndex) : url;
      var videoId = hashIndex >= 0 ? String(url).slice(hashIndex + 1) : "";
      if (!videoId) {
        return Promise.resolve([]);
      }
      return resolveVidstackVideo(baseUrl, videoId, siteOrigin, label);
    }
    function resolveVidstackInfo(url, siteOrigin, label) {
      try {
        var parsed = new URL(url);
        var videoId = parsed.searchParams.get("id");
        return videoId ? resolveVidstackVideo(parsed.origin, videoId, siteOrigin, label) : Promise.resolve([]);
      } catch (_error) {
        return Promise.resolve([]);
      }
    }
    function resolveContentX(url, referer, label) {
      var fullUrl = toAbsoluteUrl2(url, referer || url);
      var origin = getOrigin(fullUrl);
      return fetchText(fullUrl, { headers: mergeHeaders({ Referer: referer || fullUrl }) }).then(function(iframeHtml) {
        var playerId = extractFirst2(iframeHtml, /window\.openPlayer\('([^']+)'/i);
        if (!playerId) {
          return parseDirectMedia(iframeHtml).map(function(mediaUrl) {
            return {
              sourceName: "ContentX",
              label: label || "ContentX",
              quality: label || "Auto",
              url: mediaUrl,
              headers: { Referer: fullUrl }
            };
          });
        }
        function fetchSourceVideo(sourceUrl, sourceLabel) {
          return fetchText(sourceUrl, { headers: mergeHeaders({ Referer: referer || fullUrl }) }).then(function(sourceText) {
            var mediaUrl = unescapeUrl(extractFirst2(sourceText, /"file":"([^"]+)"/i));
            return mediaUrl ? {
              sourceName: "ContentX",
              label: sourceLabel || label || "ContentX",
              quality: label || "Auto",
              url: mediaUrl,
              headers: {
                Referer: fullUrl,
                "User-Agent": DEFAULT_HEADERS["User-Agent"]
              }
            } : null;
          }).catch(function() {
            return null;
          });
        }
        return fetchSourceVideo(origin + "/source2.php?v=" + encodeURIComponent(playerId), label).then(function(primary) {
          var links = [];
          var dubId = extractFirst2(iframeHtml, /,"([^']+)","Türkçe/i);
          if (primary) {
            links.push(primary);
          }
          if (!dubId) {
            return links;
          }
          return fetchSourceVideo(origin + "/source2.php?v=" + encodeURIComponent(dubId), "Turkce").then(function(dub) {
            if (dub) {
              links.push(dub);
            }
            return links;
          });
        });
      }).catch(function() {
        return [];
      });
    }
    function resolveGenericMedia2(url, referer, label, depth, siteOrigin) {
      var fullUrl = toAbsoluteUrl2(url, referer || siteOrigin || url);
      if (!fullUrl || depth > 4) {
        return Promise.resolve([]);
      }
      if (/\.(m3u8|mp4)(\?|$)/i.test(fullUrl)) {
        return Promise.resolve([{
          sourceName: "Direct",
          label: label || "Direct",
          quality: label || "Auto",
          url: fullUrl,
          headers: referer ? { Referer: referer } : {}
        }]);
      }
      if (/vidmoly\./i.test(fullUrl)) {
        return resolveVidmoly(fullUrl, referer || siteOrigin || fullUrl, label);
      }
      if (/dtpasn\.asia\/video\//i.test(fullUrl)) {
        return resolveDtpasn(fullUrl, referer || siteOrigin || fullUrl, label);
      }
      if (/#/.test(fullUrl) && fullUrl.indexOf("/api/v1/info?id=") < 0) {
        return resolveVidstackHash(fullUrl, siteOrigin || referer || fullUrl, label);
      }
      if (/\/api\/v1\/info\?id=/i.test(fullUrl)) {
        return resolveVidstackInfo(fullUrl, siteOrigin || referer || fullUrl, label);
      }
      if (/video\.php\?hash=/i.test(fullUrl) || /playerp2p|upns\.online|webdramaturkey/i.test(fullUrl)) {
        return fetchText(fullUrl, { headers: mergeHeaders({ Referer: referer || siteOrigin || fullUrl }) }).then(function(text) {
          var nestedIframe = extractNestedIframe(text, fullUrl);
          return nestedIframe ? resolveGenericMedia2(nestedIframe, fullUrl, label, depth + 1, siteOrigin) : [];
        }).catch(function() {
          return [];
        });
      }
      if (/pichive|contentx|hotlinger|playru|dplayer/i.test(fullUrl)) {
        return resolveContentX(fullUrl, referer || siteOrigin || fullUrl, label);
      }
      return fetchText(fullUrl, { headers: mergeHeaders({ Referer: referer || siteOrigin || fullUrl }) }).then(function(text) {
        var directMedia = parseDirectMedia(text);
        if (directMedia.length) {
          return directMedia.map(function(mediaUrl) {
            return {
              sourceName: "Direct",
              label: label || "Direct",
              quality: label || "Auto",
              url: mediaUrl,
              headers: { Referer: fullUrl }
            };
          });
        }
        var nestedIframe = extractNestedIframe(text, fullUrl);
        return nestedIframe && nestedIframe !== fullUrl ? resolveGenericMedia2(nestedIframe, fullUrl, label, depth + 1, siteOrigin) : [];
      }).catch(function() {
        return [];
      });
    }
    function getDomainMap() {
      if (!domainCachePromise) {
        domainCachePromise = fetchText(DOMAIN_LIST_URL).then(function(text) {
          var output = {};
          text.split("|").forEach(function(line) {
            var trimmed = String(line || "").trim();
            var separatorIndex;
            var key;
            if (!trimmed) {
              return;
            }
            separatorIndex = trimmed.indexOf(":");
            if (separatorIndex < 0) {
              return;
            }
            key = trimmed.slice(0, separatorIndex).trim();
            if (!key) {
              return;
            }
            output[key] = trimmed.slice(separatorIndex + 1).trim();
          });
          return output;
        }).catch(function() {
          return {};
        });
      }
      return domainCachePromise;
    }
    function resolveBaseUrl(domainKey, fallbackUrl) {
      return getDomainMap().then(function(map) {
        return map[domainKey] || fallbackUrl;
      });
    }
    function buildStreams(config, metadata, links, season, episode) {
      var episodeTag = formatEpisodeTag(season, episode);
      return (links || []).filter(function(link) {
        return link && link.url;
      }).map(function(link) {
        var titleParts = [metadata.displayTitle];
        if (episodeTag) {
          titleParts.push(episodeTag);
        }
        if (link.label) {
          titleParts.push(link.label);
        }
        return {
          name: link.sourceName ? config.displayName + " - " + link.sourceName : config.displayName,
          title: titleParts.join(" - "),
          url: link.url,
          quality: extractQuality(link.quality || link.label || ""),
          headers: link.headers || {},
          provider: config.id
        };
      });
    }
    module2.exports = {
      buildStreams,
      createExternalFallback: createExternalFallback2,
      decodeBase64Json: decodeBase64Json2,
      decryptAesCbcBase64: decryptAesCbcBase642,
      decryptAesCbcHex,
      extractAll: extractAll2,
      extractFirst: extractFirst2,
      extractYear: extractYear2,
      htmlDecode,
      resolveBaseUrl,
      resolveGenericMedia: resolveGenericMedia2,
      stripTags: stripTags2,
      toAbsoluteUrl: toAbsoluteUrl2,
      uniqueStrings: uniqueStrings2
    };
  }
});

// src/common/providerFactory.js
var require_providerFactory = __commonJS({
  "src/common/providerFactory.js"(exports2, module2) {
    var { rankSearchResults, scoreLoadedItem, findEpisode } = require_matcher();
    var { buildQueryVariants } = require_normalize();
    var { resolveMetadata } = require_tmdb();
    var { resolveBaseUrl, buildStreams } = require_directShared();
    function dedupeCandidates(candidates) {
      var byUrl = {};
      var index;
      var candidate;
      for (index = 0; index < candidates.length; index += 1) {
        candidate = candidates[index];
        if (!candidate || !candidate.url) {
          continue;
        }
        if (!byUrl[candidate.url] || byUrl[candidate.url].searchScore < candidate.searchScore) {
          byUrl[candidate.url] = candidate;
        }
      }
      return Object.keys(byUrl).map(function(key) {
        return byUrl[key];
      }).sort(function(left, right) {
        return right.searchScore - left.searchScore;
      });
    }
    function searchCandidates(config, metadata, baseUrl) {
      var queries = buildQueryVariants(metadata);
      var aggregated = [];
      var chain = Promise.resolve();
      queries.forEach(function(query) {
        chain = chain.then(function() {
          if (aggregated.length >= 18) {
            return null;
          }
          return Promise.resolve(config.search(baseUrl, query, metadata)).then(function(results) {
            Array.prototype.push.apply(aggregated, results || []);
          }).catch(function(error) {
            console.warn("[" + config.displayName + "] search failed for '" + query + "': " + error.message);
          });
        });
      });
      return chain.then(function() {
        return dedupeCandidates(rankSearchResults(aggregated, metadata));
      });
    }
    function resolvePlayableTarget(config, metadata, baseUrl, candidates, season, episode) {
      var best = null;
      var chain = Promise.resolve();
      candidates.slice(0, 6).forEach(function(candidate) {
        chain = chain.then(function() {
          return Promise.resolve(config.loadItem(baseUrl, candidate.url, metadata, season, episode)).then(function(item) {
            if (!item || !item.url) {
              return null;
            }
            var itemScore = scoreLoadedItem(item, metadata, candidate.searchScore, metadata.mediaType, season, episode);
            var target = {
              item,
              targetUrl: item.url,
              itemScore
            };
            if (metadata.mediaType === "tv") {
              var episodeEntry = findEpisode(item, season, episode);
              if (!episodeEntry || !episodeEntry.url) {
                return null;
              }
              target.targetUrl = episodeEntry.url;
            }
            if (!best || target.itemScore > best.itemScore) {
              best = target;
            }
            return null;
          }).catch(function(error) {
            console.warn("[" + config.displayName + "] load failed for '" + candidate.url + "': " + error.message);
          });
        });
      });
      return chain.then(function() {
        return best;
      });
    }
    function createDirectProvider2(config) {
      function getStreams2(tmdbId, mediaType, season, episode) {
        if (mediaType === "movie" && config.supportedTypes.indexOf("movie") < 0) {
          return Promise.resolve([]);
        }
        if (mediaType === "tv" && config.supportedTypes.indexOf("tv") < 0) {
          return Promise.resolve([]);
        }
        return Promise.all([
          resolveBaseUrl(config.domainKey, config.baseUrl),
          resolveMetadata(tmdbId, mediaType, {
            languages: config.tmdbLanguages,
            includeJapaneseTitles: Boolean(config.includeJapaneseTitles)
          })
        ]).then(function(results) {
          var baseUrl = results[0];
          var metadata = results[1];
          return searchCandidates(config, metadata, baseUrl).then(function(candidates) {
            if (!candidates.length) {
              console.warn("[" + config.displayName + "] no candidates found for " + metadata.displayTitle);
              return [];
            }
            return resolvePlayableTarget(config, metadata, baseUrl, candidates, season, episode).then(function(resolved) {
              if (!resolved || !resolved.targetUrl) {
                console.warn("[" + config.displayName + "] no playable target resolved for " + metadata.displayTitle);
                return [];
              }
              return Promise.resolve(config.getLinks(baseUrl, resolved.targetUrl, metadata, season, episode, resolved.item)).then(function(links) {
                if (!links || !links.length) {
                  console.warn("[" + config.displayName + "] no links returned for " + resolved.targetUrl);
                  return [];
                }
                return buildStreams(config, metadata, links, season, episode);
              });
            });
          });
        }).catch(function(error) {
          console.error("[" + config.displayName + "] provider error: " + error.message);
          return [];
        });
      }
      return getStreams2;
    }
    module2.exports = {
      createDirectProvider: createDirectProvider2
    };
  }
});

// src/providers/dizilla/index.js
var { createDirectProvider } = require_providerFactory();
var {
  createExternalFallback,
  decodeBase64Json,
  decryptAesCbcBase64,
  extractAll,
  extractFirst,
  extractYear,
  resolveGenericMedia,
  stripTags,
  toAbsoluteUrl,
  uniqueStrings
} = require_directShared();
var AES_KEY = "9bYMCNQiWsXIYFWYAu7EkdsSbmGBTyUI";
var REQUEST_HEADERS = {
  Referer: "https://dizilla.to/",
  Accept: "application/json,text/plain,*/*"
};
function parseSearchResponse(payload) {
  return decryptAesCbcBase64(payload.response || "", AES_KEY).then(function(decrypted) {
    return JSON.parse(decrypted);
  });
}
function parseNextSecureData(html) {
  var script = extractFirst(html, /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  var nextData = script ? JSON.parse(script) : null;
  var secureData = nextData && nextData.props && nextData.props.pageProps ? nextData.props.pageProps.secureData : "";
  if (!secureData) {
    return Promise.resolve(null);
  }
  return decryptAesCbcBase64(secureData, AES_KEY).then(function(decrypted) {
    return JSON.parse(decrypted);
  });
}
function parseSeriesUrl(html, pageUrl, baseUrl) {
  var direct = extractFirst(html, /href="([^"]*\/dizi\/[^"]+)"/i);
  var canonical = extractFirst(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  var value = direct || canonical || pageUrl;
  return toAbsoluteUrl(value, baseUrl + "/");
}
function parseSeasonUrls(html, baseUrl) {
  return uniqueStrings(
    extractAll(html, /href="([^"]*?-sezon[^"]*)"/gi, function(match) {
      return toAbsoluteUrl(match[1], baseUrl + "/");
    })
  ).filter(function(url) {
    return url.indexOf("-bolum") < 0;
  });
}
function parseEpisodes(html, baseUrl) {
  return uniqueStrings(
    extractAll(html, /href="([^"]*?-bolum[^"]*)"/gi, function(match) {
      return toAbsoluteUrl(match[1], baseUrl + "/");
    })
  ).map(function(url) {
    var seasonMatch = url.match(/-(\d+)-sezon/i);
    var episodeMatch = url.match(/-(\d+)-bolum/i);
    return {
      season: seasonMatch ? Number(seasonMatch[1]) : null,
      episode: episodeMatch ? Number(episodeMatch[1]) : null,
      url,
      name: "Bolum"
    };
  }).filter(function(entry) {
    return entry.season != null && entry.episode != null;
  });
}
var getStreams = createDirectProvider({
  id: "dizilla",
  displayName: "Dizilla",
  baseUrl: "https://dizilla.to",
  domainKey: "Dizilla",
  supportedTypes: ["tv"],
  search: function(baseUrl, query) {
    return fetch(baseUrl + "/api/bg/searchcontent?searchterm=" + encodeURIComponent(query), {
      method: "POST",
      headers: REQUEST_HEADERS
    }).then(function(response) {
      return response.json();
    }).then(function(payload) {
      return parseSearchResponse(payload);
    }).then(function(data) {
      return (data.result || []).map(function(entry) {
        return {
          title: entry.object_name || "",
          url: toAbsoluteUrl(entry.used_slug || "", baseUrl + "/"),
          type: "tv",
          year: entry.object_release_year || null
        };
      }).filter(function(entry) {
        return entry.title && entry.url && entry.url.indexOf("/dizi/") >= 0;
      });
    });
  },
  loadItem: function(baseUrl, url) {
    return fetch(url, {
      headers: { Referer: baseUrl + "/" }
    }).then(function(response) {
      return response.text();
    }).then(function(initialHtml) {
      var seriesUrl = parseSeriesUrl(initialHtml, url, baseUrl);
      var htmlPromise = seriesUrl !== url ? fetch(seriesUrl, { headers: { Referer: url } }).then(function(response) {
        return response.text();
      }) : Promise.resolve(initialHtml);
      return htmlPromise.then(function(seriesHtml) {
        var title = stripTags(extractFirst(seriesHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i));
        var year = extractYear(seriesHtml);
        var seasonUrls = parseSeasonUrls(seriesHtml, baseUrl);
        var episodes = [];
        var chain = Promise.resolve();
        seasonUrls.forEach(function(seasonUrl) {
          chain = chain.then(function() {
            return fetch(seasonUrl, { headers: { Referer: seriesUrl } }).then(function(response) {
              return response.text();
            }).then(function(seasonHtml) {
              episodes = episodes.concat(parseEpisodes(seasonHtml, baseUrl));
            }).catch(function() {
              return null;
            });
          });
        });
        return chain.then(function() {
          return {
            title: title || "",
            url: seriesUrl,
            year,
            type: "tv",
            episodes
          };
        });
      });
    });
  },
  getLinks: function(baseUrl, targetUrl) {
    return fetch(targetUrl, {
      headers: { Referer: baseUrl + "/" }
    }).then(function(response) {
      return response.text();
    }).then(function(html) {
      return parseNextSecureData(html);
    }).then(function(details) {
      var sources = details && details.RelatedResults && details.RelatedResults.getEpisodeSources ? details.RelatedResults.getEpisodeSources.result || [] : [];
      var links = [];
      var chain = Promise.resolve();
      sources.forEach(function(source) {
        chain = chain.then(function() {
          var iframeUrl = extractFirst(source.source_content || "", /src="([^"]+)"/i);
          if (!iframeUrl) {
            return null;
          }
          if (iframeUrl.indexOf("sn.dplayer74.site") >= 0) {
            iframeUrl = iframeUrl.replace("sn.dplayer74.site", "sn.hotlinger.com");
          }
          return resolveGenericMedia(iframeUrl, baseUrl + "/", source.quality_name || "Auto", 0, baseUrl).then(function(resolved) {
            if (resolved.length) {
              links = links.concat(resolved);
            } else {
              links.push(createExternalFallback(iframeUrl, baseUrl + "/", source.quality_name || "External"));
            }
          });
        });
      });
      return chain.then(function() {
        return links;
      });
    });
  }
});
if (typeof globalThis !== "undefined") {
  globalThis.getStreams = getStreams;
} else if (typeof global !== "undefined") {
  global.getStreams = getStreams;
}
module.exports = { getStreams };

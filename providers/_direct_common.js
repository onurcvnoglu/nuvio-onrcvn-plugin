var crypto = require("crypto");

var DOMAIN_LIST_URL = "https://raw.githubusercontent.com/Kraptor123/domainListesi/refs/heads/main/eklenti_domainleri.txt";
var TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
var TMDB_API_KEY = "4ef0d7355d9ffb5151e987764708ce96";
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
};

var domainCachePromise = null;

function mergeObjects(base, extra) {
  var result = {};
  var key;
  for (key in (base || {})) result[key] = base[key];
  for (key in (extra || {})) result[key] = extra[key];
  return result;
}

function fetchText(url, options) {
  var headers = mergeObjects(DEFAULT_HEADERS, options && options.headers);
  return fetch(url, {
    method: options && options.method ? options.method : "GET",
    headers: headers,
    body: options && options.body ? options.body : void 0
  }).then(function(response) {
    return response.text().then(function(text) {
      if (!response.ok) {
        throw new Error("Request failed: " + response.status + " " + response.statusText + " for " + url);
      }
      return { text: text, response: response };
    });
  });
}

function fetchJson(url, options) {
  return fetchText(url, options).then(function(result) {
    try {
      return JSON.parse(result.text);
    } catch (error) {
      throw new Error("JSON parse failed for " + url + ": " + error.message);
    }
  });
}

function postForm(url, bodyMap, headers) {
  return fetchText(url, {
    method: "POST",
    headers: mergeObjects({
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest"
    }, headers),
    body: new URLSearchParams(bodyMap).toString()
  });
}

function toAbsoluteUrl(value, baseUrl) {
  if (!value) return "";
  if (value.indexOf("//") === 0) return "https:" + value;
  try {
    return new URL(value, baseUrl).href;
  } catch (_error) {
    return value;
  }
}

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch (_error) {
    return "";
  }
}

function uniqueStrings(values) {
  var seen = {};
  var result = [];
  var index;
  for (index = 0; index < (values || []).length; index += 1) {
    var item = String(values[index] || "").trim();
    if (!item || seen[item]) continue;
    seen[item] = true;
    result.push(item);
  }
  return result;
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return htmlDecode(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractFirst(text, regex, groupIndex) {
  var match = regex.exec(String(text || ""));
  return match ? match[groupIndex || 1] : "";
}

function extractAll(text, regex, mapper) {
  var input = String(text || "");
  var result = [];
  var match;
  regex.lastIndex = 0;
  while ((match = regex.exec(input))) {
    result.push(mapper ? mapper(match) : match[1]);
  }
  return result;
}

function extractYear(value) {
  var match = String(value || "").match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function padNumber(value) {
  var text = String(value);
  return text.length < 2 ? "0" + text : text;
}

function unescapeUrl(value) {
  return String(value || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\")
    .replace(/\\x3D/g, "=")
    .replace(/\\x26/g, "&")
    .replace(/^"+|"+$/g, "");
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function asciiFold(value) {
  return String(value || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
}

function normalizeText(value) {
  var text = asciiFold(value);
  if (text.normalize) {
    text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  }
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[“”"'`’]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(tv series|tv|series|season|sezon|episode|bolum|bölüm|movie|film|izle)\b/g, " ")
    .replace(/[:/|._,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTitleVariants(title) {
  var source = String(title || "").trim();
  var variants;
  var parts;
  var index;
  if (!source) return [];
  variants = [source, source.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()];
  parts = source.split(/\s+-\s+|\s*:\s*|\s*\/\s*/g);
  for (index = 0; index < parts.length; index += 1) {
    if (parts[index]) variants.push(parts[index].trim());
  }
  return uniqueStrings(variants);
}

function buildQueryVariants(metadata) {
  var queries = [];
  metadata.titles.forEach(function(title) {
    splitTitleVariants(title).forEach(function(variant) {
      if (!variant) return;
      queries.push(variant);
      queries.push(variant.replace(/\bthe\b/gi, "").replace(/\s+/g, " ").trim());
    });
  });
  return uniqueStrings(queries)
    .filter(function(value) { return value.length >= 2; })
    .sort(function(left, right) { return right.length - left.length; })
    .slice(0, 6);
}

function tokenObject(value) {
  var result = {};
  normalizeText(value).split(" ").forEach(function(token) {
    if (token) result[token] = true;
  });
  return result;
}

function objectSize(input) {
  var size = 0;
  var key;
  for (key in input) size += 1;
  return size;
}

function titleSimilarity(left, right) {
  var leftText = normalizeText(left);
  var rightText = normalizeText(right);
  var leftTokens;
  var rightTokens;
  var union = {};
  var token;
  var intersection = 0;

  if (!leftText || !rightText) return 0;
  if (leftText === rightText) return 1;
  if (leftText.indexOf(rightText) >= 0 || rightText.indexOf(leftText) >= 0) return 0.9;

  leftTokens = tokenObject(leftText);
  rightTokens = tokenObject(rightText);

  for (token in leftTokens) {
    union[token] = true;
    if (rightTokens[token]) intersection += 1;
  }
  for (token in rightTokens) {
    union[token] = true;
  }
  return intersection / Math.max(1, objectSize(union));
}

function bestSimilarity(candidateTitle, metadataTitles) {
  var best = 0;
  var candidateIndex;
  var titleIndex;
  var metadataVariants;
  var metadataIndex;
  var candidateVariants = splitTitleVariants(candidateTitle);

  for (candidateIndex = 0; candidateIndex < candidateVariants.length; candidateIndex += 1) {
    for (titleIndex = 0; titleIndex < metadataTitles.length; titleIndex += 1) {
      metadataVariants = splitTitleVariants(metadataTitles[titleIndex]);
      for (metadataIndex = 0; metadataIndex < metadataVariants.length; metadataIndex += 1) {
        best = Math.max(best, titleSimilarity(candidateVariants[candidateIndex], metadataVariants[metadataIndex]));
      }
    }
  }
  return best;
}

function normalizeQuality(value) {
  var match = String(value || "").match(/(2160p|1080p|720p|480p|360p|4k)/i);
  return match ? String(match[1]).toUpperCase() : "Auto";
}

function parseSetCookieCookie(response, cookieName) {
  var header = response.headers.get("set-cookie") || "";
  var match = header.match(new RegExp(cookieName + "=([^;]+)"));
  return match ? match[1] : "";
}

function decodeBase64Json(payload) {
  return safeJsonParse(Buffer.from(String(payload || ""), "base64").toString("utf8"));
}

function decryptAesCbcBase64(payload, key) {
  var decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "utf8"), Buffer.alloc(16));
  return decipher.update(String(payload || ""), "base64", "utf8") + decipher.final("utf8");
}

function decryptAesCbcHex(payload, key) {
  var decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.alloc(16));
  return decipher.update(Buffer.from(String(payload || "").replace(/^"+|"+$/g, ""), "hex")) + decipher.final();
}

function getDomainMap() {
  if (!domainCachePromise) {
    domainCachePromise = fetchText(DOMAIN_LIST_URL).then(function(result) {
      var output = {};
      result.text.split("|").forEach(function(line) {
        var trimmed = String(line || "").trim();
        var separatorIndex;
        var key;
        if (!trimmed) return;
        separatorIndex = trimmed.indexOf(":");
        if (separatorIndex < 0) return;
        key = trimmed.slice(0, separatorIndex).trim();
        if (!key) return;
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

function buildStreams(provider, metadata, links, season, episode) {
  var episodeTag = season != null && episode != null ? "S" + padNumber(season) + "E" + padNumber(episode) : "";
  return links.filter(function(link) {
    return link && link.url;
  }).map(function(link) {
    var titleParts = [metadata.displayTitle];
    var headers = mergeObjects({}, link.headers);
    if (episodeTag) titleParts.push(episodeTag);
    if (link.label) titleParts.push(link.label);
    return {
      name: link.sourceName ? provider.name + " - " + link.sourceName : provider.name,
      title: titleParts.join(" - "),
      url: link.url,
      quality: normalizeQuality(link.quality || link.label || ""),
      headers: headers,
      provider: provider.id
    };
  });
}

function createExternalFallback(url, referer, label) {
  var fullUrl = toAbsoluteUrl(url, referer || url);
  var host = "";
  try {
    host = new URL(fullUrl).hostname.replace(/^www\./, "");
  } catch (_error) {
    host = "External";
  }
  return {
    sourceName: host || "External",
    label: label || "External",
    quality: label || "Auto",
    url: fullUrl,
    headers: referer ? { Referer: referer } : {}
  };
}

function fetchTmdbMetadata(tmdbId, mediaType, extraLanguages) {
  var typeSegment = mediaType === "movie" ? "movie" : "tv";
  var languages = uniqueStrings(["tr-TR", "en-US"].concat(extraLanguages || []));

  return Promise.all(languages.map(function(language) {
    var url = TMDB_API_BASE_URL +
      "/" + typeSegment +
      "/" + encodeURIComponent(String(tmdbId)) +
      "?language=" + encodeURIComponent(language) +
      "&api_key=" + encodeURIComponent(TMDB_API_KEY);
    return fetchJson(url).catch(function() { return null; });
  })).then(function(results) {
    var titles = [];
    var year = null;
    results.forEach(function(entry) {
      if (!entry) return;
      if (entry.title) titles.push(entry.title);
      if (entry.name) titles.push(entry.name);
      if (entry.original_title) titles.push(entry.original_title);
      if (entry.original_name) titles.push(entry.original_name);
      if (!year) year = extractYear(entry.release_date || entry.first_air_date);
    });
    titles = uniqueStrings(titles);
    if (!titles.length) throw new Error("TMDB metadata could not be resolved for " + tmdbId);
    return {
      tmdbId: String(tmdbId),
      mediaType: mediaType,
      year: year,
      titles: titles,
      displayTitle: titles[0]
    };
  });
}

function findEpisode(item, season, episode) {
  var index;
  if (!item || !Array.isArray(item.episodes)) return null;
  for (index = 0; index < item.episodes.length; index += 1) {
    if (Number(item.episodes[index].season) === Number(season) && Number(item.episodes[index].episode) === Number(episode)) {
      return item.episodes[index];
    }
  }
  return null;
}

function searchCandidates(baseUrl, provider, metadata) {
  var queries = buildQueryVariants(metadata);
  var seen = {};
  var aggregated = [];
  var chain = Promise.resolve();

  queries.forEach(function(query) {
    chain = chain.then(function() {
      if (aggregated.length >= 18) return null;
      return provider.search(baseUrl, query, metadata).then(function(results) {
        (results || []).forEach(function(result) {
          var url = result.url;
          if (!url || seen[url]) return;
          seen[url] = true;
          result.searchScore = bestSimilarity(result.title, metadata.titles) * 100;
          aggregated.push(result);
        });
      }).catch(function(error) {
        console.warn("[" + provider.name + "] search failed for '" + query + "': " + error.message);
      });
    });
  });

  return chain.then(function() {
    return aggregated.sort(function(left, right) {
      return right.searchScore - left.searchScore;
    });
  });
}

function scoreItem(item, metadata, candidate, season, episode) {
  var score = candidate.searchScore + bestSimilarity(item.title || candidate.title || "", metadata.titles) * 35;
  var type = item.type || candidate.type || "";
  var yearDiff;

  if (metadata.mediaType === "movie") score += type === "movie" ? 20 : -20;
  if (metadata.mediaType === "tv") score += type === "tv" ? 20 : -20;

  if (metadata.year && item.year) {
    yearDiff = Math.abs(Number(metadata.year) - Number(item.year));
    if (yearDiff === 0) score += 20;
    else if (yearDiff === 1) score += 8;
    else score -= 20;
  }

  if (metadata.mediaType === "tv" && season != null && episode != null) {
    score += findEpisode(item, season, episode) ? 40 : -35;
  }

  if (metadata.mediaType === "movie") {
    score += item.episodes && item.episodes.length ? -10 : 10;
  }

  return score;
}

function resolveTarget(baseUrl, provider, metadata, candidates, season, episode) {
  var best = null;
  var chain = Promise.resolve();
  candidates.slice(0, 6).forEach(function(candidate) {
    chain = chain.then(function() {
      return provider.loadItem(baseUrl, candidate.url, metadata, season, episode).then(function(item) {
        var targetUrl;
        var score;
        var episodeEntry;
        if (!item || !item.url) return null;

        targetUrl = item.url;
        if (metadata.mediaType === "tv") {
          episodeEntry = findEpisode(item, season, episode);
          if (!episodeEntry || !episodeEntry.url) return null;
          targetUrl = episodeEntry.url;
        }

        score = scoreItem(item, metadata, candidate, season, episode);
        if (!best || score > best.score) {
          best = {
            item: item,
            targetUrl: targetUrl,
            score: score
          };
        }
        return null;
      }).catch(function(error) {
        console.warn("[" + provider.name + "] load failed for '" + candidate.url + "': " + error.message);
      });
    });
  });
  return chain.then(function() { return best; });
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
    extractAll(text, pattern).forEach(function(url) {
      mediaUrls.push(unescapeUrl(url));
    });
  });

  return uniqueStrings(mediaUrls);
}

function extractNestedIframe(text, baseUrl) {
  var iframe = extractFirst(text, /id="main-iframe"[^>]+src="([^"]+)"/i) ||
    extractFirst(text, /<iframe[^>]+src="([^"]+)"/i);
  return iframe ? toAbsoluteUrl(iframe, baseUrl) : "";
}

function resolveVidmoly(url, referer, label) {
  var fullUrl = toAbsoluteUrl(url, referer || url);
  return fetchText(fullUrl, {
    headers: { Referer: referer || fullUrl }
  }).then(function(result) {
    return parseDirectMedia(result.text).map(function(mediaUrl) {
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

function resolveGenericMedia(url, referer, label, depth, siteOrigin) {
  var fullUrl = toAbsoluteUrl(url, referer || siteOrigin || url);
  if (!fullUrl || depth > 4) return Promise.resolve([]);

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

  if (/#/.test(fullUrl) && !/\?.*#/.test(fullUrl)) {
    return resolveVidstackHash(fullUrl, siteOrigin || referer || fullUrl, label);
  }

  if (/\/api\/v1\/info\?id=/i.test(fullUrl)) {
    return resolveVidstackInfo(fullUrl, siteOrigin || referer || fullUrl, label);
  }

  if (/video\.php\?hash=/i.test(fullUrl) || /webdramaturkey|playerp2p|upns\.online/i.test(fullUrl)) {
    return fetchText(fullUrl, {
      headers: { Referer: referer || siteOrigin || fullUrl }
    }).then(function(result) {
      var nested = extractNestedIframe(result.text, fullUrl);
      if (!nested) return [];
      return resolveGenericMedia(nested, fullUrl, label, depth + 1, siteOrigin);
    }).catch(function() {
      return [];
    });
  }

  if (/pichive|contentx|hotlinger|playru|dplayer/i.test(fullUrl)) {
    return resolveContentX(fullUrl, referer || siteOrigin || fullUrl, label);
  }

  return fetchText(fullUrl, {
    headers: { Referer: referer || siteOrigin || fullUrl }
  }).then(function(result) {
    var media = parseDirectMedia(result.text);
    var nested;
    if (media.length) {
      return media.map(function(mediaUrl) {
        return {
          sourceName: "Direct",
          label: label || "Direct",
          quality: label || "Auto",
          url: mediaUrl,
          headers: { Referer: fullUrl }
        };
      });
    }
    nested = extractNestedIframe(result.text, fullUrl);
    if (nested && nested !== fullUrl) {
      return resolveGenericMedia(nested, fullUrl, label, depth + 1, siteOrigin);
    }
    return [];
  }).catch(function() {
    return [];
  });
}

function resolveContentX(url, referer, label) {
  var fullUrl = toAbsoluteUrl(url, referer || url);
  var origin = getOrigin(fullUrl);
  return fetchText(fullUrl, {
    headers: { Referer: referer || fullUrl }
  }).then(function(result) {
    var iframeHtml = result.text;
    var playerId = extractFirst(iframeHtml, /window\.openPlayer\('([^']+)'/i);
    var links = [];

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

    function buildLink(sourceUrl, linkLabel) {
      return fetchText(sourceUrl, {
        headers: { Referer: referer || fullUrl }
      }).then(function(sourceResult) {
        var mediaUrl = unescapeUrl(extractFirst(sourceResult.text, /"file":"([^"]+)"/i));
        if (!mediaUrl) return null;
        return {
          sourceName: "ContentX",
          label: linkLabel || label || "ContentX",
          quality: label || "Auto",
          url: mediaUrl,
          headers: {
            Referer: fullUrl,
            "User-Agent": DEFAULT_HEADERS["User-Agent"]
          }
        };
      }).catch(function() {
        return null;
      });
    }

    return buildLink(origin + "/source2.php?v=" + encodeURIComponent(playerId), label).then(function(primary) {
      if (primary) links.push(primary);
      var dubId = extractFirst(iframeHtml, /,"([^']+)","Türkçe/i);
      if (!dubId) return links;
      return buildLink(origin + "/source2.php?v=" + encodeURIComponent(dubId), "Turkce").then(function(dub) {
        if (dub) links.push(dub);
        return links;
      });
    });
  }).catch(function() {
    return [];
  });
}

function resolveDtpasn(url, referer, label) {
  var videoId = String(url).split("dtpasn.asia/video/")[1] || "";
  videoId = videoId.split("?")[0].split("/")[0];
  if (!videoId) return Promise.resolve([]);

  return fetchText(url, {
    headers: { Referer: referer || "https://dtpasn.asia/" }
  }).then(function(initial) {
    var fireCookie = parseSetCookieCookie(initial.response, "fireplayer_player") || "6qgq1bmrp7gisci61s2p7edgrr";
    return fetchJson("https://dtpasn.asia/player/index.php?data=" + encodeURIComponent(videoId) + "&do=getVideo", {
      method: "POST",
      headers: {
        Referer: url,
        Origin: "https://dtpasn.asia",
        Cookie: "fireplayer_player=" + fireCookie,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "*/*"
      }
    }).then(function(payload) {
      var links = [];
      [payload.videoSource, payload.securedLink].forEach(function(mediaUrl) {
        if (!mediaUrl) return;
        links.push({
          sourceName: "WebDramaTurkey",
          label: label || "WDT",
          quality: label || "Auto",
          url: mediaUrl,
          headers: {
            Referer: "https://dtpasn.asia/",
            Origin: "https://dtpasn.asia",
            Cookie: "fireplayer_player=" + fireCookie
          }
        });
      });
      return links;
    });
  }).catch(function() {
    return [];
  });
}

function resolveVidstackHash(url, siteOrigin, label) {
  var hashIndex = url.lastIndexOf("#");
  var baseUrl = hashIndex >= 0 ? url.slice(0, hashIndex).replace(/\/+$/, "") : url;
  var videoId = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  if (!videoId) return Promise.resolve([]);
  return resolveVidstackVideo(baseUrl, videoId, siteOrigin, label);
}

function resolveVidstackInfo(url, siteOrigin, label) {
  var fullUrl = toAbsoluteUrl(url, siteOrigin || url);
  var parsed = new URL(fullUrl);
  var baseUrl = parsed.origin;
  var videoId = parsed.searchParams.get("id");
  if (!videoId) return Promise.resolve([]);
  return resolveVidstackVideo(baseUrl, videoId, siteOrigin, label);
}

function resolveVidstackVideo(baseUrl, videoId, siteOrigin, label) {
  var apiUrl = baseUrl.replace(/\/+$/, "") +
    "/api/v1/video?id=" + encodeURIComponent(videoId) +
    "&w=1920&h=1080&r=" + encodeURIComponent((siteOrigin || "").replace(/^https?:\/\//, ""));

  return fetchText(apiUrl, {
    headers: {
      Referer: baseUrl + "/",
      Accept: "*/*"
    }
  }).then(function(result) {
    var encoded = result.text.trim().replace(/^"+|"+$/g, "");
    var decrypted;
    var mediaUrl;
    if (!encoded || encoded.charAt(0) === "<") return [];
    decrypted = decryptAesCbcHex(encoded, "kiemtienmua911ca").toString("utf8");
    mediaUrl = unescapeUrl(extractFirst(decrypted, /"source"\s*:\s*"([^"]+)"/i));
    if (!mediaUrl) return [];
    return [{
      sourceName: "Vidstack",
      label: label || "Vidstack",
      quality: label || "1080p",
      url: mediaUrl,
      headers: { Referer: baseUrl + "/" }
    }];
  }).catch(function() {
    return [];
  });
}

function createProvider(provider) {
  function getStreams(tmdbId, mediaType, season, episode) {
    if (mediaType === "movie" && provider.supportedTypes.indexOf("movie") < 0) return Promise.resolve([]);
    if (mediaType === "tv" && provider.supportedTypes.indexOf("tv") < 0) return Promise.resolve([]);

    return Promise.all([
      resolveBaseUrl(provider.domainKey, provider.baseUrl),
      fetchTmdbMetadata(tmdbId, mediaType, provider.tmdbLanguages || [])
    ]).then(function(results) {
      var baseUrl = results[0];
      var metadata = results[1];
      return searchCandidates(baseUrl, provider, metadata).then(function(candidates) {
        if (!candidates.length) {
          console.warn("[" + provider.name + "] no candidates for " + metadata.displayTitle);
          return [];
        }
        return resolveTarget(baseUrl, provider, metadata, candidates, season, episode).then(function(target) {
          if (!target || !target.targetUrl) {
            console.warn("[" + provider.name + "] no playable target for " + metadata.displayTitle);
            return [];
          }
          return provider.getLinks(baseUrl, target.targetUrl, metadata, season, episode, target.item).then(function(links) {
            if (!links || !links.length) {
              console.warn("[" + provider.name + "] no stream links for " + target.targetUrl);
              return [];
            }
            return buildStreams(provider, metadata, links, season, episode);
          });
        });
      });
    }).catch(function(error) {
      console.error("[" + provider.name + "] provider error: " + error.message);
      return [];
    });
  }

  return { getStreams: getStreams };
}

module.exports = {
  createProvider: createProvider,
  createExternalFallback: createExternalFallback,
  decryptAesCbcBase64: decryptAesCbcBase64,
  decodeBase64Json: decodeBase64Json,
  resolveGenericMedia: resolveGenericMedia,
  toAbsoluteUrl: toAbsoluteUrl,
  extractFirst: extractFirst,
  extractAll: extractAll,
  extractYear: extractYear,
  stripTags: stripTags,
  htmlDecode: htmlDecode,
  uniqueStrings: uniqueStrings
};

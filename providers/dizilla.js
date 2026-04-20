var common = require("./_direct_common");

var AES_KEY = "9bYMCNQiWsXIYFWYAu7EkdsSbmGBTyUI";
var REQUEST_HEADERS = {
  Referer: "https://dizilla.to/",
  Accept: "application/json,text/plain,*/*"
};

function parseSearchResponse(payload) {
  var decrypted = common.decryptAesCbcBase64(payload.response || "", AES_KEY);
  return JSON.parse(decrypted);
}

function parseNextSecureData(html) {
  var script = common.extractFirst(html, /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  var nextData = script ? JSON.parse(script) : null;
  var secureData = nextData && nextData.props && nextData.props.pageProps ? nextData.props.pageProps.secureData : "";
  return secureData ? JSON.parse(common.decryptAesCbcBase64(secureData, AES_KEY)) : null;
}

function parseSeriesUrl(html, pageUrl, baseUrl) {
  var direct = common.extractFirst(html, /href="([^"]*\/dizi\/[^"]+)"/i);
  var canonical = common.extractFirst(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  var value = direct || canonical || pageUrl;
  return common.toAbsoluteUrl(value, baseUrl + "/");
}

function parseSeasonUrls(html, baseUrl) {
  return common.uniqueStrings(
    common.extractAll(html, /href="([^"]*?-sezon[^"]*)"/gi, function(match) {
      return common.toAbsoluteUrl(match[1], baseUrl + "/");
    })
  ).filter(function(url) {
    return url.indexOf("-bolum") < 0;
  });
}

function parseEpisodes(html, baseUrl) {
  return common.uniqueStrings(
    common.extractAll(html, /href="([^"]*?-bolum[^"]*)"/gi, function(match) {
      return common.toAbsoluteUrl(match[1], baseUrl + "/");
    })
  ).map(function(url) {
    var seasonMatch = url.match(/-(\d+)-sezon/i);
    var episodeMatch = url.match(/-(\d+)-bolum/i);
    return {
      season: seasonMatch ? Number(seasonMatch[1]) : null,
      episode: episodeMatch ? Number(episodeMatch[1]) : null,
      url: url,
      name: "Bolum"
    };
  }).filter(function(entry) {
    return entry.season != null && entry.episode != null;
  });
}

module.exports = common.createProvider({
  id: "dizilla",
  name: "Dizilla",
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
      var data = parseSearchResponse(payload);
      return (data.result || []).map(function(entry) {
        return {
          title: entry.object_name || "",
          url: common.toAbsoluteUrl(entry.used_slug || "", baseUrl + "/"),
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
      var htmlPromise = seriesUrl !== url ? fetch(seriesUrl, { headers: { Referer: url } }).then(function(response) { return response.text(); }) : Promise.resolve(initialHtml);
      return htmlPromise.then(function(seriesHtml) {
        var title = common.stripTags(common.extractFirst(seriesHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i));
        var year = common.extractYear(seriesHtml);
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
            year: year,
            type: "tv",
            episodes: episodes
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
      var details = parseNextSecureData(html);
      var sources = details && details.RelatedResults && details.RelatedResults.getEpisodeSources ? details.RelatedResults.getEpisodeSources.result || [] : [];
      var links = [];
      var chain = Promise.resolve();

      sources.forEach(function(source) {
        chain = chain.then(function() {
          var iframeUrl = common.extractFirst(source.source_content || "", /src="([^"]+)"/i);
          if (!iframeUrl) return null;
          if (iframeUrl.indexOf("sn.dplayer74.site") >= 0) {
            iframeUrl = iframeUrl.replace("sn.dplayer74.site", "sn.hotlinger.com");
          }
          return common.resolveGenericMedia(iframeUrl, baseUrl + "/", source.quality_name || "Auto", 0, baseUrl).then(function(resolved) {
            if (resolved.length) {
              links = links.concat(resolved);
            } else {
              links.push(common.createExternalFallback(iframeUrl, baseUrl + "/", source.quality_name || "External"));
            }
          });
        });
      });

      return chain.then(function() { return links; });
    });
  }
});

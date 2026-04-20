var common = require("./_direct_common");

function parseSearchResults(html, baseUrl) {
  return common.extractAll(
    html,
    /<a href="([^"]+)" class="list-title">\s*([\s\S]*?)\s*<\/a>/gi,
    function(match) {
      var url = common.toAbsoluteUrl(match[1], baseUrl + "/");
      var type = url.indexOf("/film/") >= 0 ? "movie" : (url.indexOf("/dizi/") >= 0 || url.indexOf("/anime/") >= 0 ? "tv" : "");
      return {
        title: common.stripTags(match[2]),
        url: url,
        type: type
      };
    }
  ).filter(function(entry) {
    return entry.title && entry.url && entry.type;
  });
}

function parseEpisodes(html, pageUrl, baseUrl) {
  return common.uniqueStrings(
    common.extractAll(html, /href="([^"]*\/\d+-sezon\/\d+-bolum[^"]*)"/gi, function(match) {
      return common.toAbsoluteUrl(match[1], baseUrl + "/");
    })
  ).map(function(url) {
    var seasonMatch = url.match(/\/(\d+)-sezon\//i);
    var episodeMatch = url.match(/\/(\d+)-bolum/i);
    return {
      season: seasonMatch ? Number(seasonMatch[1]) : null,
      episode: episodeMatch ? Number(episodeMatch[1]) : null,
      url: url || pageUrl,
      name: "Bolum"
    };
  }).filter(function(entry) {
    return entry.season != null && entry.episode != null;
  });
}

module.exports = common.createProvider({
  id: "webdramaturkey",
  name: "WebDramaTurkey",
  baseUrl: "https://webdramaturkey2.com",
  domainKey: "WebDramaTurkey",
  supportedTypes: ["movie", "tv"],
  tmdbLanguages: ["ja-JP", "ko-KR", "zh-CN"],
  search: function(baseUrl, query) {
    return fetch(baseUrl + "/arama/" + encodeURIComponent(query), {
      headers: { Referer: baseUrl + "/" }
    }).then(function(response) {
      return response.text();
    }).then(function(html) {
      return parseSearchResults(html, baseUrl);
    });
  },
  loadItem: function(baseUrl, url) {
    return fetch(url, {
      headers: { Referer: baseUrl + "/" }
    }).then(function(response) {
      return response.text();
    }).then(function(html) {
      var title = common.stripTags(common.extractFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
      var episodes = parseEpisodes(html, url, baseUrl);
      return {
        title: title || "",
        url: url,
        year: common.extractYear(html),
        type: episodes.length ? "tv" : "movie",
        episodes: episodes
      };
    });
  },
  getLinks: function(baseUrl, targetUrl) {
    return fetch(targetUrl, {
      headers: { Referer: baseUrl + "/" }
    }).then(function(response) {
      return response.text();
    }).then(function(html) {
      var embedIds = common.uniqueStrings(common.extractAll(html, /data-embed="([^"]+)"/gi));
      var links = [];
      var chain = Promise.resolve();

      embedIds.forEach(function(embedId) {
        chain = chain.then(function() {
          return fetch(baseUrl + "/ajax/embed", {
            method: "POST",
            headers: {
              Referer: targetUrl,
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest"
            },
            body: new URLSearchParams({ id: embedId }).toString()
          }).then(function(response) {
            return response.text();
          }).then(function(embedHtml) {
            var iframeUrl = common.extractFirst(embedHtml, /<iframe[^>]+src="([^"]+)"/i);
            if (!iframeUrl) return null;
            return common.resolveGenericMedia(iframeUrl, targetUrl, "Auto", 0, baseUrl).then(function(resolved) {
              links = links.concat(resolved);
            });
          }).catch(function() {
            return null;
          });
        });
      });

      return chain.then(function() { return links; });
    });
  }
});

var common = require("./_direct_common");

var REQUEST_HEADERS = {
  Referer: "https://selcukflix.net/",
  Accept: "application/json,text/plain,*/*"
};

function parseSecureData(html) {
  var script = common.extractFirst(html, /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  var nextData = script ? JSON.parse(script) : null;
  var secureData = nextData && nextData.props && nextData.props.pageProps ? nextData.props.pageProps.secureData : "";
  return secureData ? common.decodeBase64Json(secureData) : null;
}

function pickMovieSourceBlocks(details) {
  var related = details && details.RelatedResults ? details.RelatedResults : {};
  var parts = related.getMoviePartsById && related.getMoviePartsById.result ? related.getMoviePartsById.result : [];
  var sources = [];

  parts.forEach(function(part) {
    var key = "getMoviePartSourcesById_" + part.id;
    if (related[key] && Array.isArray(related[key].result)) {
      sources = sources.concat(related[key].result);
    }
  });

  return sources;
}

module.exports = common.createProvider({
  id: "selcukflix",
  name: "SelcukFlix",
  baseUrl: "https://selcukflix.net",
  domainKey: "SelcukFlix",
  supportedTypes: ["movie", "tv"],
  search: function(baseUrl, query) {
    return fetch(baseUrl + "/api/bg/searchcontent?searchterm=" + encodeURIComponent(query), {
      method: "POST",
      headers: REQUEST_HEADERS
    }).then(function(response) {
      return response.json();
    }).then(function(payload) {
      var data = common.decodeBase64Json(payload.response || "");
      return ((data && data.result) || []).map(function(entry) {
        var type = String(entry.used_type || "").toLowerCase().indexOf("movie") >= 0 ? "movie" : "tv";
        return {
          title: entry.object_name || entry.title || "",
          url: common.toAbsoluteUrl(entry.used_slug || "", baseUrl + "/"),
          type: type,
          year: entry.object_release_year || null
        };
      }).filter(function(entry) {
        return entry.title && entry.url && entry.url.indexOf("/seri-filmler/") < 0;
      });
    });
  },
  loadItem: function(baseUrl, url) {
    return fetch(url, {
      headers: { Referer: baseUrl + "/" }
    }).then(function(response) {
      return response.text();
    }).then(function(html) {
      var details = parseSecureData(html);
      var item = details ? details.contentItem || {} : {};
      var related = details ? details.RelatedResults || {} : {};
      var series = related.getSerieSeasonAndEpisodes && related.getSerieSeasonAndEpisodes.result ? related.getSerieSeasonAndEpisodes.result : [];
      var episodes = [];

      series.forEach(function(seasonBlock) {
        (seasonBlock.episodes || []).forEach(function(episode) {
          episodes.push({
            season: seasonBlock.season_no,
            episode: episode.episode_no,
            url: common.toAbsoluteUrl(episode.used_slug || "", baseUrl + "/"),
            name: episode.episode_text || "Bolum"
          });
        });
      });

      return {
        title: item.original_title || "",
        url: url,
        year: item.release_year || null,
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
      var details = parseSecureData(html);
      var related = details ? details.RelatedResults || {} : {};
      var rawSources = [];
      var links = [];
      var chain = Promise.resolve();

      if (targetUrl.indexOf("/dizi/") >= 0 && related.getEpisodeSources && Array.isArray(related.getEpisodeSources.result)) {
        rawSources = related.getEpisodeSources.result;
      } else {
        rawSources = pickMovieSourceBlocks(details);
      }

      rawSources.forEach(function(source) {
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

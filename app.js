var restler = require('restler')
    , _s = require('underscore.string');

process.on('uncaughtException', function (err) {
  console.log(err);
})

//var webtoonId = process.argv[2];
var webtoonId = "471283";

restler.get('http://comic.naver.com/webtoon/list.nhn?titleId=' + webtoonId).once('complete', function (mainHtml) {
  // 마지막 에피소드를 알아내기 위해 html을 다운로드 합니다.
  var $ = jQuery(mainHtml);

  var lastestTitleLink = $('.title a').attr('href'); // selector를 이용하여 마지막 에피소드 링크를 추출합니다.
  var lastestEpisodeNoRegexp = /no=(\d+).*&/;
  if (!lastestEpisodeNoRegexp.test(lastestTitleLink)) {
    console.log('웹툰 아이디를 찾을 수 없습니다.')
    return;
  }
  console.log('Download...' + $('title').text())

  require('mkdirp')(webtoonId, function (err) {
    // 디렉토리를 만듭니다.
    if (err) {
      console.error(err)
    } else {
      var lastestEpisodeNo = lastestTitleLink.match(lastestEpisodeNoRegexp)[1];
      var workers = [];
      for (var titleId = 1; titleId <= lastestEpisodeNo; titleId++) {
        // 에피소드별 url을 생성합니다.
        var pageUrl = "http://comic.naver.com/webtoon/detail.nhn?titleId=" + webtoonId + "&no=" + titleId;
        // 다운로드 함수를 생성합니다.
        workers.push(makeEpisodeDownloader(titleId, pageUrl));
      }

      // 생성된 함수들을 순차적으로 실행합니다.
      require('async').series(workers,
          function (err) {
            if (!err) {
              console.log("완료!");
            }
          });
    }
  });
});

function makeEpisodeDownloader(titleId, pageUrl) {
  return function (callback) {
    restler.get(pageUrl).once('complete', function (episodeHtml) {
      var $ = jQuery(episodeHtml);
      var episodeName = $('.tit_area h3').text();
      console.log("다운로드: " + episodeName);

      var workers = [];
      $('.wt_viewer img').each(function (idx, el) {
        var fileName = _s.sprintf("%04d", titleId) + '_' + episodeName.replace(' ', '_').replace(/[/:*?\\"<>|]/, '') + "_" + _s.sprintf("%04d", idx) + ".jpg";
        workers.push(makeImagesDownloader({uri: el.attribs.src, headers: {'Referer': pageUrl}}, fileName));
      });
      require('async').series(workers,
          function (err) {
            if (!err) {
              callback(); // next 함수 호출.
            }
          });

    });
  };
}

function makeImagesDownloader(options, filename) {
  return function (callback) {
    var writeStream = require('fs').createWriteStream(webtoonId + '/' + filename);
    new require('request')(options).pipe(writeStream).on('close', callback);
  }
};

function jQuery(html) {
  return require('cheerio').load(html);
}
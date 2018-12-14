'use strict';

angular.module('human.share', [])

.constant('SHARE_CONFIG', {
  modes: ['link', 'email', 'embed', 'facebook', 'twitter', 'googleplus'],

  embedCode: [
    '<iframe',
    'id="embeddedHuman"',
    'frameBorder="0"',
    'width="800"',
    'height="600"',
    'allowFullScreen="true"',
    'src="{{ src }}"></iframe>'
  ].join(' '),

  windowConfig: {
    menubar: 'no',
    toolbar: 'no',
    resizable: 'yes',
    scrollbars: 'yes',
    height: 600,
    width: 600
  },

  url: '/social-share.html?share_data={{ data }}',

  twitter: {
    url: 'https://twitter.com/intent/tweet?via=biodigitalhuman&hashtags=bdhuman&text={{ text }}&url={{ url }}',
    urlProp: 'short_link',
    text: 'Check out this interactive 3D view I made using the BioDigital Human Platform!'
  },

  googleplus: {
    url: 'https://plus.google.com/share?url={{ url }}',
    urlProp: 'short_link',
    text: null
  }
})

.factory('HumanShims', function ($window) {
  var shims = {};
  var humanObjects = ['Human_user', 'Human_utility', 'Human_services'];

  angular.forEach(humanObjects, function (object) {
    $window[object] = $window[object] || {};
    shims[object] = $window[object];
  });

  if(!shims['Human_services'].hasOwnProperty('user')) {
    shims['Human_services']['user'] = { get: function () { return {}; } };

    if(!shims['Human_services']['user'].hasOwnProperty('profile')) {
      shims['Human_services']['user']['profile'] = {
        get: function () { return {}; }
      };
    }
  }

  if(!shims['Human_utility'].hasOwnProperty('utf8_to_b64')) {
    shims['Human_utility']['utf8_to_b64'] = function (input) {
      return !!$window.btoa ? $window.btoa(input) : null;
    };
  }

  if(!shims['Human_utility'].hasOwnProperty('b64_to_utf8')) {
    shims['Human_utility']['b64_to_utf8'] = function (input) {
      return !!$window.btoa ? $window.atob(input) : null;
    }
  };

  var closeModalMethod = 'sendUserClosesModalDialogBoxMessage';

  shims['Human_user'][closeModalMethod] = function () {
    angular.element($window).triggerHandler('frameModal.close');
  };

  return shims;
})

.factory('Bitly', function ($http, $q) {
  var END_POINT = 'https://api-ssl.bitly.com/v3/shorten';
  var ACCESS_TOKEN = '0679b577a4e00e250d5ac0f32760aa1ff0a4928d';

  var responseData = {}; // will store responses under mode

  return {
    getUrl: function (url, mode) {
      if(!!responseData[mode]) {
        return $q(function (resolve) {
          resolve(responseData[mode]);
        });
      }

      var params = {
        'access_token': ACCESS_TOKEN,
        'longUrl': url
      };

      return $http.get(END_POINT, { params: params }).then(function (response) {
        return responseData[mode] = {
          'regular_link': response.data.data['long_url'],
          'short_link': response.data.data.url
        };
      });
    }
  };
})

.factory('HumanShare',
  function (
    $window, $location, $q, $interpolate,
    SHARE_CONFIG, HumanShims, Bitly
  ) {

    var modeIds = {}; // For cacheing mode uaids
    var uaidRe = /([\?\&])uaid=(\w+)/;
    var updatedUaids = [];

    var contentData = $window.HumanWidget.data.content;
    var analytics = $window.HumanWidget.analytics;

    return {
      modes: SHARE_CONFIG.modes,

      curMode: null,
      curSrc: null,

      utf8Tob64: HumanShims['Human_utility']['utf8_to_b64'],
      b64Toutf8: HumanShims['Human_utility']['b64_to_utf8'],

      getContentData: function (params) {
        var id, title;

        if(!!contentData.bookmark) {
          id = params.be || params.b;
        } else {
          id = contentData.id;
        }

        if(!!contentData.bookmark && !!contentData.bookmark.title) {
          title = contentData.bookmark.title;
        } else {
          title = Human.modules.activeModules[contentData.id].displayName;
        }

        return {
          id: id,
          title: title,
          gender: contentData.gender || 'male',
          bookmark: contentData.bookmark
        };
      },

      getThumbnailData: function (params) {
        var host = $location.host();
        var contentData = this.getContentData(params);

        var url;

        if(!!contentData.bookmark) {
          var encoded = params.hasOwnProperty('be');
          var param = encoded ? 'be' : 'b';

          url = '//' + host + '/thumbnails/bookmarks?';
          url = url + (encoded ? 'eid' : 'id') + '=' + params[param];
        } else {
          var dn = contentData.title.toLowerCase().replace(/\s/g, '+');

          url = '//' + host + '/thumbnails?';
          url = url + 's=' + contentData.gender + '&dn=' + dn;
        }

        return { title: contentData.title, url: url };
      },

      getEmbedCode: function (url) {
        var deferred = $q.defer();

        deferred.resolve({
          'regular_link': $interpolate(SHARE_CONFIG.embedCode)({ src: url }),
          'short_link': ''
        });

        return deferred.promise;
      },

      getWindowConfig: function (data, _windowConfig) {
        var _window = [];

        angular.forEach(SHARE_CONFIG.windowConfig, function (value, key) {
          _window.push([key, value].join('='));
        });

        return {
          template: _windowConfig.url,
          context: {
            url: $window.encodeURIComponent(data[_windowConfig.urlProp]),
            text: _windowConfig.text
          },
          window: _window.join(',')
        };
      },

      // Build an analytic for the share event
      buildAnalytic: function (url, params, mode, contentData) {
        var type = null;

        var categoryMap = {
          bookmark: 'Bookmarks',
          condition: 'Conditions',
          anatomy: 'Anatomy'
        };

        if (params.hasOwnProperty('m')) {
          type = 'condition';
        } else if(params.hasOwnProperty('o')) {
          type = 'anatomy';
        } else if(params.hasOwnProperty('b') || params.hasOwnProperty('be')) {
          type = 'bookmark';
        }

        var customProps = {
          'analytic_type': [type, 'share', mode].join('.'),
          'analytic_description': [type, 'share'].join(' '),
        };

        if (!contentData.bookmark) { // Convert to '.' format
          var id = ['Condition', 'content'].concat(contentData.id.split('/'));
          contentData.id = id.join('.');
        }

        var analytic = analytics.buildAnalytic(customProps);

        if (params.uaid) {
          analytics.setAnalyticParent(analytic, params.uaid, 0);
        }

        return analytic;
      },

      updateUrl: function (url, uaid) {
        return uaidRe.test(url) ?
          url.replace(uaidRe, '$1uaid=' + uaid) : url + '&uaid=' + uaid;
      },

      checkUrl: function (url, params, mode, contentData) {
        var humanShare = this;

        return $q(function (resolve) {
          if (!params.dk) {

            if(modeIds[mode]) { // From cache
              resolve(humanShare.updateUrl(url, modeIds[mode]));
            } else {
              var analytic =
                humanShare.buildAnalytic(url, params, mode, contentData);

              analytics.postAnalytic(analytic, function (response) {
                modeIds[mode] = response.data.id;
                resolve(humanShare.updateUrl(url, modeIds[mode]));
              });
            }
          } else {
            resolve(url);
          }
        });
      },

      getData: function (mode) {
        var humanShare = this;

        var url = $location.absUrl();
        var params = Human.request.getSearchParams();
        var contentData = humanShare.getContentData(params);

        var method = mode === 'embed' ? humanShare.getEmbedCode : Bitly.getUrl;

        return humanShare.checkUrl(url, params, mode, contentData)
          .then(function (url) {
            return method(url, mode);
          })
          .then(function (data) {
            var config;

            // Update analytic previously created in checkUrl
            if(!params.dk) {
              var match = data['regular_link'].match(uaidRe);

              if(match && match[2] && updatedUaids.indexOf(match[2]) === -1) {

                var analytic = {
                  'analytic_id': match[2],
                  'analytic_platform': 'widget',
                  'analytic_data': {
                    'url': data['regular_link'],
                    'url_encoded': data['short_link']
                  }
                };

                analytics.postAnalytic(analytic, function () {
                  updatedUaids.push(match[2]);
                });
              }
            }

            data = angular.extend({}, data, {
              thumbnailObj: humanShare.getThumbnailData(params),
              mode: mode
            });

            if(SHARE_CONFIG.hasOwnProperty(mode)) {
              config = humanShare.getWindowConfig(data, SHARE_CONFIG[mode]);
            } else {
              data = humanShare.utf8Tob64(angular.toJson(data));

              config = {
                template: SHARE_CONFIG.url,
                context: { data: data },
                window: null
              };
            }

            humanShare.curSrc = $interpolate(config.template)(config.context);
            humanShare.curMode = mode;

            return {
              src: humanShare.curSrc,
              window: config.window
            };
          });
      }
    };
  }
)

.directive('shareModes', function ($window, HumanShare) {
  var $$window = angular.element($window);

  var template = [
    '<ul>',
    '  <li',
    '    ga-event="[\'Share 3D View\', titleCase(mode)]"',
    '    ng-click="getShareFrame(mode)"',
    '    ng-attr-title="{{ titleCase(mode) }}"',
    '    ng-class="setListClasses(mode)"',
    '    ng-repeat="mode in modes">',
    '  </li>',
    '</ul>'
  ].join('\n');

  return {
    restrict: 'E',
    template: template,
    scope: true,
    link: function (scope, element) {
      scope.modes = HumanShare.modes;

      scope.titleCase = function (input) {
        return input[0].toUpperCase() + input.slice(1);
      };

      scope.setListClasses = function (mode) {
        return [mode, scope.loading === mode ? 'loading' : ''].join(' ');
      };

      scope.getShareFrame = function (mode) {
        scope.loading = mode;

        HumanShare.getData(mode).then(function (data) {

          if(!!data.window) {
            $window.open(data.src, '', data.window);
            scope.src = null;
          } else {
            $$window.triggerHandler('frameModal.open', {
              src: data.src,
              className: mode
            });
          }

          scope.loading = null;
          element.addClass('ng-hide');
        });
      };
    }
  };
});
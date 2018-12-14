/* Human Widget 8.1.0
 *
 * (c) 2018 BioDigital, Inc.
 *
 */

(function (window, angular) { 'use strict';

(function (window, angular) {

  var HumanWidget = window.HumanWidget = {};

  var dashNormalize = HumanWidget.dashNormalize = function (input) {
    if(/^[a-z]+([_[A-Z])[a-z]+/.test(input)) {
      return input.replace(/([a-z])([A-Z])/g, '$1-$2')
                  .replace(/([a-zA-Z])_/g, '$1-')
                  .toLowerCase();
    }

    return input;
  };

  // Build widget params
  var params = HumanWidget.params = {};

  // Decode any HTML encoded ampersands
  var _href = window.location.href.replace(/&amp;/g, '&');

  var re = /[?&]+([^=&]+)=([^&]*)/gi;

  _href.replace(re, function (m, key, value) {
    // Normalize keys to dash case
    params[dashNormalize(key)] = window.decodeURIComponent(value);
  });

  var getParentUrl = function (embedded) {
    var parentUrl = {};

    if (embedded) {
      parentUrl.full = window.document.referrer;

      var match = parentUrl.full.match(/:\/\/(.[^/]+)/);

      parentUrl.domain = (match && match[1]) ? match[1] : parentUrl.full;
    } else {
      parentUrl.full = window.location.href;
      parentUrl.domain = window.document.domain || window.location.host;
    }

    return parentUrl;
  };

  // This function will remove any subdomains from the full domain name
  // Not really second level domain
  var getSecondLevelDomain = function (domain) {
    var parts = domain.split('.').reverse();
    var tldExp = /^(com|edu|gov|net|mil|org|nom|co|name|info|biz)$/i;

    var secondLevelDomain = '';

    if (parts.length >= 3 && tldExp.test(parts[1])) {
      secondLevelDomain = [parts[2], parts[1], parts[0]].join('.');
    } else {
      secondLevelDomain = [parts[1], parts[0]].join('.');
    }

    return secondLevelDomain;
  };

  var embedded = window.top !== window;
  var parentUrl = getParentUrl(embedded);

  parentUrl.slDomain = getSecondLevelDomain(parentUrl.domain);

  // Build widget data
  // Consolidates embedded state, user info, query params and parent url info
  HumanWidget.data = {
    parentUrl: parentUrl,
    embedded: embedded,
    initialDisplay: {},
    support: null,
    params: HumanWidget.params,
    content: {},
    developerKey: HumanWidget.params.dk || null,
    userAnalyticId: HumanWidget.params.uaid || null
  };

  // Unfortunately iOS sizes iframes based on inner content.
  // This prevents run away growth of the iframe when elements animate off the
  // Screen during the 'userInteracting.start' event
  var patchIOS = function () {
    var body = window.document.body;
    var device = HumanWidget.getDevice(window.navigator.userAgent);

    var setBodyHeight = function () {
      body.style.position = 'absolute';
      body.style.top = '0px';
      body.style.left = '0px';
      body.style.right = '0px';
      body.style.bottom = '0px';

      body.style.height = window.innerHeight + 'px';
    };

    if (
      (device === 'iPhone' || device === 'iPad') && HumanWidget.data.embedded
    ) {
      window.addEventListener('resize', setBodyHeight, true);
      setBodyHeight();
    }
  };

  // Default engine and content initialization sequence
  var defaultInitSequence = function (config) {
    var events = config.EVENTS || {};

    var onInit  = events.onInit  || function () {};
    var onReady = events.onReady || function () {};
    var onError = events.onError || function () {};

    var HumanScene = window.HumanScene;

    HumanScene.initEngine(function () {
      onInit();

      HumanScene.content.set(
        function (content) {
          HumanWidget.extend(HumanWidget.data.content, content);

          HumanScene.load(content,
            function () {
              HumanScene.startEngine();
              onReady(content);
            },
            onError
          );

          // Bootstrap while loading module definition
          angular.bootstrap(window.document, [config.NAME]);
        },
        function (error) {
          // Bootstrap the app if bookmark loading failed
          angular.bootstrap(window.document, [config.NAME]);
          onError(error);
        }
      );

    });

  };

  HumanWidget.getDevice = function (ua) {
    var devices = ['iPad', 'iPhone', 'iPod', 'Android'];
    var device = ua.match(new RegExp(devices.join('|'), 'i'));

    return device && device[0];
  };

  HumanWidget.serializeRequest = function (data) {
    var _data = [];

    for(var key in data) {
      if(data.hasOwnProperty(key)) {
        _data.push([
          window.encodeURIComponent(key),
          window.encodeURIComponent(data[key])
        ].join('='));
      }
    }

    return _data.join('&');
  };

  HumanWidget.extend = function () {
    var args = Array.prototype.slice.call(arguments, 0);
    var obj1 = args[0];
    var extendObjs = args.slice(1);
    var extendObj, key, i;

    for (i = 0; i < extendObjs.length; i++) {
      extendObj = extendObjs[i];

      for(key in extendObj) {
        if(extendObj.hasOwnProperty(key)) {
          obj1[key] = extendObj[key];
        }
      }
    }

    return obj1;
  };

  HumanWidget.init = function (config) {
    HumanWidget.support = HumanWidget.webgl.runTest(config.WEB_GL.device);
    HumanWidget.data.support = HumanWidget.support; // Expose here as well

    var manifest =
      HumanWidget.buildManifest(config.DEPENDENCIES, config.ENVIRONMENT.files);

    HumanWidget.loadScripts(manifest.scripts, function () {

      if(HumanWidget.support.pass) {
        HumanWidget.webgl.handleError(config.WEB_GL.error);

        Human.properties.set({ assetDomain: config.ENVIRONMENT.assetDomain });

        var initSequence = config.INIT_SEQUENCE || defaultInitSequence;
        initSequence(config);
      } else {
        // Bootstrap rest of app if engine not supported
        angular.bootstrap(window.document, [config.NAME]);
      }

    });

    HumanWidget.loadStyles(manifest.styles);
  };

  patchIOS();

  // -- Angular --

  angular.module('humanWidget', [
    'ngTouch',
    'ui.bootstrap',

    'humanUI',

    'humanWidget.pass',
    'humanWidget.fail',
    'humanWidget.analytics',
    'humanWidget.backgroundColor',
    'humanWidget.backgroundImage',
    'humanWidget.templates'
  ])

  .constant('EMBEDDED', embedded)

  .config(['$uibTooltipProvider', 'BASE_CONFIG', 'CONFIG_ALIASES', function ($uibTooltipProvider, BASE_CONFIG, CONFIG_ALIASES) {

    // Extend the UI library's config definition
    angular.extend(BASE_CONFIG, {
      help: false,
      infoExpand: false, // Have the info panel initially expanded
      menuExpand: false // Have the menu buttons initially expanded
    });

    angular.extend(CONFIG_ALIASES, { keys: 'help' });

    // Quick and dirty disabling of uib tooltips on touch devices
    if(Modernizr.touch) {
      var triggerAttr = 'tooltip-trigger';
      var tooltips = document.body.querySelectorAll('[' + triggerAttr + ']');

      angular.element(tooltips).attr(triggerAttr, 'none');

      $uibTooltipProvider.options({ trigger: 'none' });
    }
  }])

  .run(['WindowDimensions', function (WindowDimensions) {
    WindowDimensions.init();
  }])

  .value('widgetParams', HumanWidget.params)
  .value('widgetData', HumanWidget.data)

  .provider('WindowDimensions', function () {

    var config = { breakPoints: [480, 768, 991] };

    var $get = function ($window, $document, $rootScope, $timeout) {

      var $body = angular.element($document[0].body);

      var breakPoints = config.breakPoints.concat($window.Infinity);
      var breakPointClasses = [];

      for (var i = 0; i < breakPoints.length; i++) {
        breakPointClasses.push([ 'lte', breakPoints[i] ].join('-'));
      }

      var curBreakPoint = null;

      var setBreakPoint = function (breakPoint, breakPointClass) {
        curBreakPoint = breakPoint;

        $body.removeClass(breakPointClasses.join(' '));
        $body.addClass(breakPointClass);

        $rootScope.$broadcast('window.breakpoint', curBreakPoint);
        $rootScope.$apply();
      };

      var checkBreakPoint = function () {
        for (var i = 0; i < breakPoints.length; i++) {
          if($window.innerWidth <= breakPoints[i]) {
            if(curBreakPoint !== breakPoints[i]) {
              setBreakPoint(breakPoints[i], breakPointClasses[i]);
            }

            return;
          }
        }
      };

      return {
        init: function () {
          angular.element($window).on('resize', checkBreakPoint);
          $timeout(checkBreakPoint);
        }
      };

    };
    $get.$inject = ['$window', '$document', '$rootScope', '$timeout'];

    return {
      $get: $get,
      config: function (extensions) {
        angular.extend(config, extensions);
      }
    };

  })

  .filter('dashNormalize', function () {
    return HumanWidget.dashNormalize;
  })

  .filter('serializeRequest', function () {
    return HumanWidget.serializeRequest;
  })

  .controller('MainController', ['$scope', 'widgetData', function ($scope, widgetData) {

    $scope.widgetData   = widgetData;
    $scope.widgetParams = widgetData.params;

    $scope.embedded     = widgetData.embedded;
    $scope.pass         = widgetData.support.pass;
    $scope.result       = widgetData.support.fullResult;

    $scope.backgroundImage = {};

    $scope.$on('human.moduleData', function (e, moduleData) {
      $scope.moduleData = moduleData;
    });

    $scope.$on('human.fallbackTour', function (e, fallbackTour) {
      $scope.fallbackTour   = fallbackTour;
      $scope.noFallbackTour = !fallbackTour; // Need to define this for classes
    });

    // Put backgroundImage state & data on the scope
    $scope.$on('backgroundImage.show', function () {
      $scope.backgroundImage.show = true;
    });

    $scope.$on('backgroundImage.remove', function () {
      $scope.backgroundImage.remove = true;
    });

    $scope.$on('backgroundImage.image', function (e, data) {
      $scope.backgroundImage.load  = !!data; // Successful or not
      $scope.backgroundImage.image = data || null; // Actual image data
    });

  }])

  .directive('uiBd', ['widgetParams', function (widgetParams) {
    return {
      restrict: 'A',
      priority: 900,
      link: function (scope, element) {

        if(widgetParams['ui-bd'] === 'false') {
          element.addClass('ng-hide');
        }

        if(
          widgetParams['ui-bd'] === 'no-link' ||
          widgetParams['ui-bd.link'] === 'false'
        ) {
          element.removeAttr('href');
          element.removeAttr('target');
          element.removeAttr('ga-event');
        }

        if(widgetParams['ui-bd.class']) {
          element.addClass(widgetParams['ui-bd.class']);
        }

      }
    };
  }])

  .directive('moduleError', ['Human', function (Human) {
    return {
      restrict: 'E',
      templateUrl: 'templates/module_error.html',
      scope: true,
      link: function (scope) {
        Human.events.on('net.error', function () {
          scope.show = true;
          scope.$apply();
        });
      }
    };
  }])

  .directive('bindTrustedHtml', function () {
    return {
      restrict: 'A',
      link: function (scope, element, attr) {
        scope.$watch(attr.bindTrustedHtml, function (value) {
          element.html(value || '');
        });
      }
    };
  })

  .directive('broadcastUserInteraction',
    ['$document', '$rootScope', '$timeout', function ($document, $rootScope, $timeout) {
      var startEvents = 'touchstart mousedown';
      var moveEvents = 'touchmove mousemove';
      var endEvents = 'touchend touchcancel mouseup mouseleave';

      var $body = angular.element($document[0].body);

      return {
        restrict: 'A',
        link: function (scope, element) {
          var interactingStart = false;
          var interacting = false;
          var notificationDelay;

          var notifyChange = function (state) {
            interacting = state;

            $body[interacting ? 'addClass' : 'removeClass']('user-interacting');

            var eventName = 'userInteracting.';
            eventName += interacting ? 'start' : 'finish';

            $rootScope.$broadcast(eventName);
          };

          var onInteracting = function () {
            if(!interactingStart) {
              interactingStart = true;

              $timeout.cancel(notificationDelay);
              notificationDelay = undefined;

              notificationDelay = $timeout(function () {
                notifyChange(true);
              }, 500);
            }

            element.css('cursor', 'default'); // Override Chrome's text cursor
          };

          var offInteracting = function () {
            if(interactingStart) {
              interactingStart = false;

              $timeout.cancel(notificationDelay);
              notificationDelay = undefined;

              if(interacting) {
                notificationDelay = $timeout(function () {
                  notifyChange(false);
                }, 500);
              }
            }

            element.css('cursor', 'auto');

            angular.forEach(moveEvents.split(' '), function (moveEvent) {
              $document[0].removeEventListener(moveEvent, onInteracting, true);
            });

            angular.forEach(endEvents.split(' '), function (endEvent) {
              $document[0].removeEventListener(endEvent, offInteracting, true);
            });
          };

          angular.forEach(startEvents.split(' '), function (startEvent) {
            element[0].addEventListener(startEvent, function () {

              angular.forEach(moveEvents.split(' '), function (moveEvent) {
                $document[0].addEventListener(moveEvent, onInteracting, true);
              });

              angular.forEach(endEvents.split(' '), function (endEvent) {
                $document[0].addEventListener(endEvent, offInteracting, true);
              });
            }, true);
          });
        }
      };
    }]
  )

  // UI Utility Directives

  .directive('toggleElement', ['$document', '$timeout', function ($document, $timeout) {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        var target = $document[0].querySelector(attrs.toggleElement);
        var $target = angular.element(target);

        var closeElement = function (e) {
          if(!target.contains(e.target)) {

            if(!element[0].contains(e.target)) {
              $target.addClass('ng-hide');
            }

            $document[0].removeEventListener('touchstart', closeElement, true);
            $document[0].removeEventListener('click', closeElement, true);
          }
        };

        var globalClose = function () {
          $timeout(function () {
            if($target.hasClass('ng-hide')) {
              $document[0]
                .removeEventListener('touchstart', closeElement, true);

              $document[0].removeEventListener('click', closeElement, true);
            } else {
              $document[0].addEventListener('touchstart', closeElement, true);
              $document[0].addEventListener('click', closeElement, true);
            }
          });
        };

        element.on('click', function () {
          $target.toggleClass('ng-hide');

          if(attrs.hasOwnProperty('globalClose')) {
            globalClose();
          }
        });
      }
    };
  }])

  .directive('openFrameModal', ['$window', function ($window) {
    var $$window = angular.element($window);

    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        element.on('click', function () {
          $$window.triggerHandler('frameModal.open', {
            src: attrs.openFrameModal,
            className: attrs.frameModalClass
          });
        });
      }
    };
  }])

  .directive('frameModal', ['$window', '$sce', function ($window, $sce) {
    var $$window = angular.element($window);

    var template = [
      '<div id="frame-container" ng-class="setFrameClasses()">',
      '  <button class="close" ng-click="closeFrame()">&times;</button>',
      '  <iframe ng-if="src" ng-src="{{ src }}"></iframe>',
      '</div>'
    ].join('\n');

    return {
      restrict: 'E',
      scope: true,
      template: template,
      link: function (scope, element) {
        var frameContainer = $window.document.getElementById('frame-container');
        var $frameContainer = angular.element(frameContainer);

        var frame;

        var calcMaxHeight = function () {
          var frameRect = frameContainer.getBoundingClientRect();
          var maxHeight = $window.innerHeight - frameRect.top - 70;

          frameContainer.style['max-height'] = maxHeight + 'px';

          if(frame) {
            frame.style['max-height'] = maxHeight + 'px';
          }
        };

        scope.closeFrame = function () {
          $$window.off('click', scope.closeFrame);

          element.removeClass('open');
          $frameContainer.removeClass();

          scope.src = null;
          scope.$applyAsync();
        };

        scope.$watch('src', function (src) {
          if(src) {
            frame = frameContainer.querySelector('iframe');
            calcMaxHeight();
          } else {
            frame = null;
          }
        });

        $$window.on('frameModal.open', function (e, data) {
          scope.$applyAsync(function () {
            element.addClass('open');

            if(data.className) {
              $frameContainer.addClass(data.className);
            }

            scope.src = $sce.trustAsResourceUrl(data.src);
            angular.element($window).one('click', scope.closeFrame);
          });
        });

        $$window.on('frameModal.close', scope.closeFrame);

        $$window.on('resize', function () {
          if(!!scope.src) {
            calcMaxHeight();
          }
        });
      }
    };
  }])

  .directive('windowBreakpoint', ['$parse', function ($parse) {
    return {
      restrict: 'A',
      scope: true,
      link: function (scope, element, attrs) {
        scope.$on('window.breakpoint', function (e, breakpoint) {
          scope.breakpoint = breakpoint;
          $parse(attrs.windowBreakpoint)(scope);
        });
      }
    };
  }]);


}(window, angular));

(function (window) {

  var HumanWidget = window.HumanWidget;
  var analytics = HumanWidget.analytics = {};

  var widgetData = HumanWidget.data;

  // DEVELOPER

  var DEVELOPER_ACTIVITY_ROUTE = '/ws/developer/apps/access/key';

  // NOTE WELL: If 'widget_is_fullscreen' is 'False' and 'app_domain_path'
  // is not recognized, the request will be rejected
  var BASE_ACTIVITY = {
    'app_apikey': widgetData.developerKey || '',
    'app_domain': widgetData.parentUrl.domain,
    'app_domain_sld': widgetData.parentUrl.slDomain,
    'app_domain_path': widgetData.parentUrl.full,
    'app_activity': 'load',
    'app_activity_status': '',
    'app_activity_data': {},
    'platform': 'widget',
    'widget_is_fullscreen': widgetData.embedded ? 'False' : 'True'
  };

  for(var key in widgetData.params) {
    if(widgetData.params.hasOwnProperty(key)) {
      if(key !== 'dk') {
        var value = widgetData.params[key];
        BASE_ACTIVITY['app_activity_data']['url_param_' + key] = value;
      }
    }
  }

  analytics.buildDeveloperActivity = function (customProps, customDataProps) {
    customProps = customProps || {};
    customDataProps = customDataProps || {};

    var activity = HumanWidget.extend({}, BASE_ACTIVITY, customProps);
    var activityData = activity['app_activity_data'];

    HumanWidget.extend(activityData, customDataProps);

    return activity;
  };

  analytics.postDeveloperActivity = function (activity, success, failure) {
    var request = new XMLHttpRequest();

    success = success || function () {};
    failure = failure || function () {};

    request.onreadystatechange = function () {
      if(request.readyState === XMLHttpRequest.DONE) {

        var data = window.JSON.parse(request.responseText);
        var response = { status: request.status, data: data };

        if(request.status === 200) {
          success(response);
        } else {
          failure(response);
        }

      }
    };

    request.open('POST', DEVELOPER_ACTIVITY_ROUTE);
    request.setRequestHeader(
      'Content-type', 'application/x-www-form-urlencoded; charset=UTF-8'
    );

    // Manually serialize data
    var activityData = activity['app_activity_data'];

    activity['app_activity_data'] = window.JSON.stringify(activityData);
    activity = HumanWidget.serializeRequest(activity);

    request.send(activity);
  };

  // USER

  var USER_ANALYTICS_ROUTE = '/ws/user/analytics';

  var BASE_ANALYTIC = {
    'analytic_id': '',
    'analytic_type': '',
    'analytic_description': '',
    'analytic_data': {},
    'analytic_platform': 'widget',
    'analytic_app_name': ''
  };

  var BASE_ANALYTIC_DATA = {
    'category': '',
    'label': '',
    'identifier': '',
    'gender': '',
    'url': '',
    'url_encoded': ''
  };

  analytics.buildAnalytic = function (customProps, customDataProps) {
    customProps = customProps || {};
    customDataProps = customDataProps || {};

    var analytic = HumanWidget.extend({}, BASE_ANALYTIC, customProps);
    var analyticData = analytic['analytic_data'];

    HumanWidget.extend(analyticData, BASE_ANALYTIC_DATA, customDataProps);

    return analytic;
  };

  analytics.addRefererData = function (analytic) {
    var analyticData = analytic['analytic_data'];

    analyticData['referer_domain'] = widgetData.parentUrl.domain;
    analyticData['referer_sldomain'] = widgetData.parentUrl.slDomain;
    analyticData['referer_domainpath'] = widgetData.parentUrl.full;
  };

  analytics.setAnalyticParent = function (analytic, parentId, isOwner) {
    var analyticData = analytic['analytic_data'];

    analyticData['parent_analytic_identifier'] = parentId;

    if(typeof isOwner !== 'undefined') {
      analyticData['parent_is_owner'] = isOwner;
    }

    return analytic;
  };

  analytics.getAnalytic = function (analyticId, success, failure) {
    var request = new XMLHttpRequest();

    success = success || function () {};
    failure = failure || function () {};

    request.onreadystatechange = function () {
      if(request.readyState === XMLHttpRequest.DONE) {

        var data = window.JSON.parse(request.responseText);
        var response = { status: request.status, data: data };

        if(request.status === 200) {
          success(response);
        } else {
          failure(response);
        }

      }
    };

    var params = HumanWidget.serializeRequest({ 'analytic_id': analyticId });

    request.open('GET', [USER_ANALYTICS_ROUTE, params].join('?'));
    request.send();
  };

  analytics.postAnalytic = function (analytic, success, failure) {
    var request = new XMLHttpRequest();

    success = success || function () {};
    failure = failure || function () {};

    request.onreadystatechange = function () {
      if(request.readyState === XMLHttpRequest.DONE) {

        var data = window.JSON.parse(request.responseText);
        var response = { status: request.status, data: data };

        if(request.status === 200) {
          success(response);
        } else {
          failure(response);
        }

      }
    };

    request.open('POST', USER_ANALYTICS_ROUTE);
    request.setRequestHeader(
      'Content-type', 'application/x-www-form-urlencoded; charset=UTF-8'
    );

    // Manually serialize data
    var analyticData = analytic['analytic_data'];

    analytic['analytic_data'] = window.JSON.stringify(analyticData);
    analytic = HumanWidget.serializeRequest(analytic);

    request.send(analytic);
  };

  // GA

  analytics.ga = {};

  var EVENT_CATEGORIES = {
    content: 'Content'
  };

  var EVENT_ACTIONS = {
    load: 'Load',
    loadChapter: 'Load Chapter'
  };

  var DIMENSIONS_MAP = {
    contentName: 0,
    chapterName: 1,
    contentId: 2,
    contentType: 3,
    developerKey: 4,
    appDomain: 5,
    userId: 6,
    platformType: 7,
    appName: 8,
    uaId: 9
  };

  var eventDimensions = new Array(Object.keys(DIMENSIONS_MAP).length);

  var sendLoadChapterEvent = function (displayName, newIndex) {
    var chapterName = [newIndex + 1, displayName || 'unknown'].join(' ');

    var eventCategory = EVENT_CATEGORIES.content;
    var eventAction = EVENT_ACTIONS.loadChapter;
    var eventLabel = '';

    // Set Chapter Name dimension
    eventDimensions[DIMENSIONS_MAP.chapterName] = chapterName;
    eventLabel = eventDimensions[DIMENSIONS_MAP.contentName] +
      ':' + chapterName;

    analytics.ga.sendEvent(eventCategory, eventAction, eventLabel);
  };

  // Build content name for undefined module content name
  var buildUndefinedContentName = function(contentId) {
    var altContentName = contentId.split('/');
    return '[unspecified] ' + altContentName[altContentName.length -
       1].replace('.json', '');
  };

  analytics.ga.customTracker = null;

  // Get event dimensions object to pass along to ga
  analytics.ga.getEventDimensionsObject = function () {
    var eventDimensionsObject = {};
    for (var i = 0; i < eventDimensions.length; i++) {
      eventDimensionsObject['dimension' + (i + 1)] = eventDimensions[i];
    }
    return eventDimensionsObject;
  };


  analytics.ga.init = function (dimensionValues) {
    // Log 'Load' event
    var eventCategory = EVENT_CATEGORIES.content;
    var eventAction = EVENT_ACTIONS.load;
    var eventLabel = '';

    var contentType = widgetData.content.bookmark ? 'bookmark' : 'module';
    var contentId, contentName;

    if(contentType === 'module') {
      contentName =
        Human.modules.activeModules[widgetData.content.id].displayName;
      contentId = widgetData.content.id;

      if(!contentName || contentName === '') {
        contentName = buildUndefinedContentName(contentId);
      }

    } else {
      contentName = widgetData.content.bookmark.title;
      contentId = widgetData.params.be;
    }

    eventLabel = contentName;

    // Set eventDimensions
    eventDimensions[DIMENSIONS_MAP.contentName] = contentName;
    eventDimensions[DIMENSIONS_MAP.chapterName] = null;
    eventDimensions[DIMENSIONS_MAP.contentId] = contentId;
    eventDimensions[DIMENSIONS_MAP.contentType] = contentType;
    eventDimensions[DIMENSIONS_MAP.developerKey] = widgetData.developerKey;
    eventDimensions[DIMENSIONS_MAP.appDomain] = widgetData.parentUrl.domain;
    eventDimensions[DIMENSIONS_MAP.platformType] = 'Web Widget';
    eventDimensions[DIMENSIONS_MAP.uaId] = widgetData.userAnalyticId;

    dimensionValues = dimensionValues || {};

    // Overwrite with any values provided at initialization
    for(var key in dimensionValues) {
      if(dimensionValues.hasOwnProperty(key)) {
        eventDimensions[ DIMENSIONS_MAP[key] ] = dimensionValues[key];
      }
    }

    // Log initial 'Load' event
    analytics.ga.sendEvent(eventCategory, eventAction, eventLabel);

    // Log 'Load Chapter' event for modules only
    Human.events.on('timeline.chapters.activated', function(params) {
      // Skip bookmarks
      if (widgetData.content.bookmark) {
        return;
      }

      var index = params.newChapterIndex;
      var chapters, displayName;

      // Get engine-agnostic chapter data
      if (Human.timeline.activeRoot) {
        chapters = Human.timeline.activeRoot._chapters;
        displayName = chapters[index].info.displayName;
      } else {
        chapters = Human.timeline.chapterList;
        displayName = chapters[index].displayName;
      }

      // Only fire for content with more than one chapter
      if (chapters && chapters.length > 1) {
        sendLoadChapterEvent(displayName, index);
      }

    });
  };

  var buildGaCommand = function (commandName, customTracker) {
    var command;

    if(customTracker) {
      command = [customTracker, commandName].join('.');
    } else if(analytics.ga.customTracker) {
      command = [analytics.ga.customTracker, commandName].join('.');
    } else {
      command = commandName;
    }

    return command;
  };

  // Send GA event to new tracker
  analytics.ga.sendEvent = function(eCategory, eAction, eLabel, customTracker) {
    var eventDimensionsObj = analytics.ga.getEventDimensionsObject();

    window.ga(buildGaCommand('set', customTracker), eventDimensionsObj);

    window.ga(buildGaCommand('send', customTracker), {
      hitType: 'event',
      eventCategory: eCategory,
      eventAction: eAction,
      eventLabel: eLabel
    });
  };

  angular.module('humanWidget.analytics', [])

  .factory('GaAnalytics', function () {
    return analytics.ga;
  })

  .directive('gaEvent', ['$parse', '$timeout', 'GaAnalytics', function ($parse, $timeout, GaAnalytics) {

    return {
      restrict: 'A',
      scope: false,
      link: function (scope, element, attrs) {
        var target;

        var customTracker = attrs.gaEventTracker;
        var eCategory = attrs.gaEventCategory || 'UI';
        var useCapture = attrs.hasOwnProperty('gaUseCapture');

        var _sendEvent = function (data) {
          $timeout(function () {
            GaAnalytics.sendEvent(eCategory, data[0], data[1], customTracker);
          });
        };

        var sendEvent = function (e) {
          var args = $parse(attrs.gaEvent)(scope);

          if(angular.isObject(args) && !angular.isArray(args)) {
            angular.forEach(args, function (_args, selector) {
              target = element[0].querySelector(selector);

              if(target === e.target || target.contains(e.target)) {
                _sendEvent(_args);
              }
            });
          } else {
            _sendEvent(args);
          }
        };

        // Guard against possible directive re-compilation
        element[0].removeEventListener('click', sendEvent, useCapture);
        element[0].addEventListener('click', sendEvent, useCapture);
      }
    };
  }]);

})(window);

angular.module('humanWidget.backgroundColor', [])

.run(['$window', function ($window) {
  if(!$window.HumanBackground) {
    return;
  }

  $window.HumanBackground.input.enableContentConfig();
  $window.HumanBackground.synchEngine();
}]);

angular.module('humanWidget.backgroundImage', [])

.constant('IMAGE_PARAMS', {
  'large':  {
    threshold: 800,
    'default': {
      width:  1200,
      height: 800
    }
  },
  'medium': {
    threshold: 600,
    'default': {
      width:  800,
      height: 600
    }
  },
  'small': {
    'default': {
      width:  400,
      height: 400
    }
  }
})

.constant('SCREENSHOT_SERVICE', '/i')
.constant('BOOKMARK_SERVICE', '/thumbnails/bookmarks')

.run(['widgetData', 'BackgroundImage', function (widgetData, BackgroundImage) {
  // Decide when and if to initialize Background image
  var pass = widgetData.support.pass;

  if ((pass && widgetData.initialDisplay.image) || !pass) {
    BackgroundImage.init();
  }
}])

.factory('BackgroundImage',
  ['$window', '$timeout', '$rootScope', 'Human', 'widgetParams', function ($window, $timeout, $rootScope, Human, widgetParams) {
    return {
      _store: {
        container: null,
        image: null
      },

      'get': function (prop) {
        return this._store[prop];
      },

      'set': function (prop, val) {
        this._store[prop] = val;
        $rootScope.$broadcast(['backgroundImage', prop].join('.'), val);
      },

      show: function (imageSrc) {
        $rootScope.$broadcast('backgroundImage.show', imageSrc);
      },

      hide: function () {
        $rootScope.$broadcast('backgroundImage.hide');
      },

      remove: function () {
        $rootScope.$broadcast('backgroundImage.remove');
      },

      init: function () {
        var backgroundImage = this;

        var gender     = widgetParams['s']  || 'male';
        var moduleName = widgetParams['m']  || widgetParams['a'];
        var bookmarkId = widgetParams['be'] || widgetParams['b'];

        var imageSrc   =
          widgetParams['load-image-src'] || widgetParams['image-src'];

        var initialImageParam = widgetParams['initial.image'];

        if (initialImageParam && initialImageParam !== 'true') {
          imageSrc = initialImageParam;
        }

        $timeout(function () { // Allow link phase to occur before firing
          var baseImageSrc;

          if (moduleName || bookmarkId) {
            // It's a module or bookmark, get base image data for service.
            baseImageSrc = { s: gender };

            if(moduleName) { // Module

              if(/\//.test(moduleName)) {
                baseImageSrc.src = moduleName.replace(/\.json$/, '');
              } else {
                baseImageSrc.src = [
                  'production',
                  gender + 'Adult',
                  moduleName
                ].join('/');
              }

            } else { // Bookmark
              var key = widgetParams['be'] ? 'eid' : 'id';
              baseImageSrc[key] = bookmarkId;
            }
            // Allow base to be overriden by string from widget parameters,
            // Otherwise imageSrc will be the same
            if(!imageSrc) {
              imageSrc = angular.copy(baseImageSrc);
            }
          }

          // Broadcast initialization with image data
          $rootScope.$broadcast('backgroundImage.init', {
            src:  imageSrc,
            base: baseImageSrc
          });

          $timeout(function () {
            // Remove if loading anatomy object w/o imageSrc param specified
            // Execute this after code relating to 'backgroundImage.init' event
            if(imageSrc) {
              backgroundImage.show(imageSrc);
            } else {
              backgroundImage.remove();
            }
          });

        });
      }

    };
  }]
)

.directive('sizeBackgroundImage', ['IMAGE_PARAMS', 'BackgroundImage', function (IMAGE_PARAMS, BackgroundImage) {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope) {
      var image, imageOrientation;

      var onContainerUpdate = function (container) {
        if(!image && !imageOrientation) {
          return;
        }

        // Provide css hooks via scope for aspect ratio here
        scope.landscape = container.width > container.height;
        scope.portrait  = container.width < container.height;
        scope.square    = container.width === container.height;

        // Keep image from stretching beyond its natural dimensions
        if(scope.widgetParams['image-size'] === 'initial' ||
          scope.widgetParams['load-image-size'] === 'initial') {
          var exceedsMax = container.size === 'large' &&
            (container.width  > image[imageOrientation] ||
             container.height > image[imageOrientation]);

          scope.cover = !exceedsMax;
        } else {
          scope.cover = true;
        }
      };

      var onImageUpdate = function (_image) {
        if(_image) {
          var container = BackgroundImage.get('container');
          var _default = IMAGE_PARAMS[container.size || 'small'].default;

          image = {
            width:  _image.width  || _default.width,
            height: _image.height || _default.height
          };

          imageOrientation = image.width >= image.height ? 'width' : 'height';
          onContainerUpdate(container);
        } else {
          image = null;
          imageOrientation = null;
        }
      };

      scope.$watch('backgroundImage.image', onImageUpdate);

      scope.$on('backgroundImage.container', function (e, data) {
        onContainerUpdate(data);
        scope.$apply();
      });
    }
  };
}])

.directive('backgroundImage',
  ['$document', '$timeout', 'BackgroundImage', 'backgroundImageUrlFilter', function ($document, $timeout, BackgroundImage, backgroundImageUrlFilter) {
    return {
      restrict: 'A',
      scope: true,
      link: function (scope, element) {
        var currentSrc, ensure;
        scope.show = false;

        // Apply background property to element
        var _apply = function (image) {
          var bgProp, msFilter, css;

          if(image) {
            // Old IE background backup
            msFilter = [
              'progid:DXImageTransform',
              'Microsoft',
              'AlphaImageLoader(src="' + image.src + '", sizingMethod="scale")'
            ].join('.');

            bgProp = 'url(' + image.src + ')';
          } else {
            bgProp = msFilter = 'none';
          }

          css = {
            'background-image': bgProp,
            '-ms-filter': msFilter,
            'filter': msFilter
          };

          scope.hasContent = !!image;
          element.css(css);

          return css;
        };

        var clearImage = function () {
          _apply(null);
          // Clears image data without triggering load failure
          BackgroundImage.set('image', {});
        };

        var show = function (imageSrc) {
          var $image = $(new Image());
          var error = false;
          var loaded = false;

          scope.loading = true;

          $image.load(function () {
            // Only handle if this image is the currently requested one
            if(this.src.indexOf(currentSrc) >= 0 && !loaded) {
              loaded = true;

              BackgroundImage.set('image', {
                css:    _apply(this),
                src:    this.src,
                width:  this.width,
                height: this.height
              });

              scope.loading = false;
              scope.$apply();
            }
          });

          $image.error(function () {
            if(this.src.indexOf(currentSrc) >= 0) {
              error = true;

              _apply(null);
              BackgroundImage.set('image', null);

              scope.show = false;
              scope.loading = false;
              scope.$apply();
            }
          });

          var containerSize = BackgroundImage.get('container').size;

          currentSrc = backgroundImageUrlFilter(imageSrc, containerSize);
          $image[0].src = currentSrc; // Triggers request

          if($image[0].complete) { // Ensure trigger for cached
            $timeout(function () {
              if(!loaded) {
                $image.trigger('load');
              }
            });
          }

          if(ensure) {
            $timeout.cancel(ensure);
          }

          // Ensure load gets called after 3 secs
          ensure = $timeout(function () {
            if(!loaded && !error) {
              $image.trigger('load');
            }
          }, 3000);
        };

        scope.$on('backgroundImage.show', function (e, imageSrc) {
          show(imageSrc);
          scope.show = true;
        });

        scope.$on('backgroundImage.hide', function () {
          clearImage(); // Clears background property
          scope.show = false;
        });

        scope.$on('backgroundImage.remove', function () {
          element.remove();
        });

      }
    };
  }]
)

.directive('captureSize', ['$window', 'IMAGE_PARAMS', 'BackgroundImage', function ($window, IMAGE_PARAMS, BackgroundImage) {
  return {
    restrict: 'A',
    link: function (scope, element) {
      var $$window = angular.element($window);

      var setContainer = function () {

        var container = {
          width: element.outerWidth(),
          height: element.outerHeight()
        };

        for(var key in IMAGE_PARAMS) {
          if(IMAGE_PARAMS.hasOwnProperty(key)) {
            var threshold = IMAGE_PARAMS[key].threshold;
            // If either dimension is greater than threshold, assign size
            // As 'small' is not needed in url request, it will not be assigned
            if(container.width >= threshold || container.height >= threshold) {
              container.size = key;
              break;
            }
          }
        }

        BackgroundImage.set('container', container);
      };

      scope.$on('backgroundImage.init', setContainer);

      scope.$watch('backgroundImage.load', function (n) {
        if(n) {
          $$window.off('resize.backgroundImage'); // Ensure only set once
          $$window.on('resize.backgroundImage', setContainer);
        }
      });

      scope.$watch('backgroundImage.remove', function (n) {
        if(n) {
          $$window.off('resize.backgroundImage');
        }
      });

    }
  };
}])

// Larger filter, delegates to more focused subfilters
.filter('backgroundImageUrl',
  ['_moduleUrlFilter', '_bookmarkUrlFilter', '_customUrlFilter', function (_moduleUrlFilter, _bookmarkUrlFilter, _customUrlFilter) {
    return function (imageSrc, containerSize) {
      var fullUrl;

      if(imageSrc.s) {
        // Build a url from provided object
        var filter = imageSrc.src ? _moduleUrlFilter : _bookmarkUrlFilter;
        fullUrl = filter(imageSrc, containerSize);
      } else { // We are provided a string via imageSrc param
        fullUrl = _customUrlFilter(imageSrc);
      }

      return fullUrl;
    };
  }]
)

.filter('_moduleUrl', ['SCREENSHOT_SERVICE', function (SCREENSHOT_SERVICE) {
  return function (imageSrc) {
    return SCREENSHOT_SERVICE + '/' + imageSrc.src + '.jpg';
  };
}])

.filter('_bookmarkUrl', ['BOOKMARK_SERVICE', function (BOOKMARK_SERVICE) {
  return function (imageSrc, containerSize) {
    var size = containerSize ? '&size=' + containerSize : '';
    var srcProp = imageSrc.eid ? 'eid' : 'id';
    // Insert gender, source property / value, and size
    var paramStr = [
      's=' + imageSrc.s,
      srcProp + '=' + imageSrc[srcProp] + size
    ].join('&');

    return [BOOKMARK_SERVICE, paramStr].join('?');
  };
}])

.filter('_customUrl', ['$document', 'SCREENSHOT_SERVICE', function ($document, SCREENSHOT_SERVICE) {

  var hostName = (function () {
    var _document = $document[0];
    var a = _document.createElement('a');
    a.href = _document.referrer;
    return a.hostname;
  })();

  return function (imageSrc) {
    var basePath;

    if(imageSrc[0] === '!') { // Indicates to get from site's own files
      basePath = '//' + hostName;
      imageSrc = imageSrc.slice(1);
    } else {
      basePath = SCREENSHOT_SERVICE;
    }
    // Allow a full url from anywhere
    return /^(http(s)?:)?\/\//.test(imageSrc) ?
      imageSrc : [basePath, imageSrc].join('/');
  };
}]);

angular.module('humanWidget.fail', [])

.run(['$rootScope', 'Module', 'widgetData', function ($rootScope, Module, widgetData) {

  var _broadcast = function (response) {
    $rootScope.$broadcast('human.moduleData', response ? response.data : null);
  };

  if(!widgetData.support.pass) {
    Module.get().then(_broadcast, _broadcast.bind(null, null));
  }

}])

.factory('Module', ['$http', 'widgetParams', function ($http, widgetParams) {
  return {
    'get': function () {
      var gender     = widgetParams['s'] || 'male';
      var moduleName = widgetParams['m'] || widgetParams['a'];

      // Insert moduleName into fullProduction path if no forward slashes found
      var modulePath = /\//.test(moduleName) ?
        moduleName : 'production/' + gender + 'Adult/' + moduleName + '.json';

      return $http.get('/content/modules/' + modulePath);
    }
  };
}])

.factory('cacheAssets', ['backgroundImageUrlFilter', '$timeout', function (backgroundImageUrlFilter, $timeout) {
  return function () {
    var assets = [];
    var imgs = [];
    var input = arguments[0];
    var length = arguments[1];

    if(angular.isObject(input) && angular.isDefined(length)) {
      var base = backgroundImageUrlFilter(input);

      for(var i = 1; i < length; i++) {
        assets.push(base.replace(/(\.(\w{3}))$/, ['_', '.$2'].join(i)));
      }
    } else if(angular.isArray(input)) {
      assets = input;
    }

    angular.forEach(assets, function (asset) {
      if(
        angular.isString(asset) ||
        (angular.isObject(asset) && asset.type === 'image')
      ) {
        var src = angular.isString(asset) ? asset : asset.url;
        imgs.push(new Image().src = src);
      }
    });

    $timeout(function () { imgs = undefined; });
  };
}])

.factory('FallbackVideo', ['$rootScope', function ($rootScope) {
  return {
    show: function (videoSrc) {
      $rootScope.$broadcast('fallbackVideo.show', videoSrc);
    },
    hide: function () {
      $rootScope.$broadcast('fallbackVideo.hide');
    }
  };
}])

.directive('fallbackVideo', function () {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope, element) {
      scope.show = false;

      var iframe;

      var remove = function () {
        if(iframe) {
          iframe.remove();
        }

        iframe = null;
      };

      scope.$on('fallbackVideo.show', function (e, videoSrc) {
        remove(); // Remake iframe every time
        element.append('<iframe></iframe>');
        iframe = element.children('iframe')[0];
        iframe.contentWindow.location.replace(videoSrc);

        scope.show = true;
      });

      scope.$on('fallbackVideo.hide', function () {
        remove();
        scope.show = false;
      });

    }
  };
})

.directive('defaultBackground', function () {
  return {
    restrict: 'A',
    link: function (scope, element) {
      var isFail = function (variable) {
        return typeof variable === 'boolean' && !variable;
      };

      var loadTileBackground = function () {
        element.css({
          'background-image': 'url("img/tiles_layer_50.jpg")',
          'background-size':  'cover'
        });
      };

      scope.$watch('backgroundImage.load', function (n) {
        // Unsuccessful image load after human test failed
        if(isFail(n) && isFail(scope.pass)) {
          loadTileBackground();
        }
      });

      scope.$watch('pass', function (n) {
        // Human test fails after an unsuccessful image load
        if(isFail(n) && isFail(scope.backgroundImage.load)) {
          loadTileBackground();
        }
      });
    }
  };
})

.directive('fallbackTour',
  ['$rootScope', 'BackgroundImage', 'FallbackVideo', 'cacheAssets', function ($rootScope, BackgroundImage, FallbackVideo, cacheAssets) {
    return {
      restrict: 'E',
      scope: true,
      template: '<fallback-tour-controls></fallback-tour-controls>',
      link: function (scope) {
        var baseImageSrc, assetSrc, assets, asset, type;

        var initTour = function (fallback) {
          if(fallback.hasOwnProperty('length')) {
            scope.length = fallback.length; // Build asset paths

            if(!!baseImageSrc) {
              cacheAssets(baseImageSrc, fallback.length);
            }
          } else if(angular.isArray(fallback.assets)) {
            // Assets are given
            assets = fallback.assets;
            scope.length = assets.length;

            cacheAssets(assets);

            // Clobber the default image if it's there
            scope.showAsset(scope.getAsset(0));
          }

          if(scope.length > 1) {
            scope.show = true;
          }
        };

        scope.show = false;

        scope.getAsset = function (i) {
          type = 'image'; // Assume image

          if(assets) {
            asset = assets[i];

            if(angular.isObject(asset)) {
              assetSrc = asset.url;
              type = asset.type || type;
            } else {
              assetSrc = assets[i];
            }
          } else {
            assetSrc = angular.copy(baseImageSrc);

            if(i > 0) {
              assetSrc.src = [assetSrc.src, i].join('_');
            }
          }

          return { src: assetSrc, type: type };
        };

        scope.showAsset = function (asset) {
          if(asset.type === 'image') {
            BackgroundImage.show(asset.src);
            FallbackVideo.hide();
          } else {
            FallbackVideo.show(asset.src);
            BackgroundImage.hide();
          }

          scope.curAsset = asset;
        };

        // Only doing tours on modules right now
        scope.$on('human.moduleData', function (e, data) {
          var fallbackTour = data && angular.isObject(data.fallback);

          if(fallbackTour) {
            initTour(data.fallback);
          }

          $rootScope.$broadcast('human.fallbackTour', fallbackTour);
        });

        scope.$on('backgroundImage.init', function (e, data) {
          baseImageSrc = data.base;
        });
      }
    };
  }]
)

.directive('fallbackTourControls', function () {
  return {
    restrict: 'E',
    template: '\
      <div class="arrow arrow-left"\
        ng-class="{ disabled: checkLimits(-1) === \'start\' }"\
        ng-click="step(-1)">\
      </div>\
      <div class="arrow arrow-right"\
        ng-class="{ disabled: checkLimits(1) === \'finish\' }"\
        ng-click="step(1)">\
      </div>\
    ',
    link: function (scope) {
      var i = 0;

      scope.checkLimits = function (dir) {
        return (i === 0 && dir === -1) ? 'start' :
        (i === scope.length - 1 && dir === 1) ? 'finish' : false;
      };

      scope.step = function (dir) {
        if(!!scope.checkLimits(dir)) {
          return;
        }

        i = i + dir;

        scope.showAsset(scope.getAsset(i));
      };
    }
  };
})

.directive('failModuleInfo', ['$sce', function ($sce) {
  return {
    restrict: 'E',
    scope: true,
    template: '\
      <button ng-show="!!description" ng-click="toggleInfo()"></button>\
      <h1>{{ displayName }}</h1>\
      <p ng-bind-html="description"></p>\
    ',
    link: function (scope, element) {
      scope.toggleInfo = function () {
        element.toggleClass('open');
      };

      scope.$watch('moduleData', function (n) {
        if(n) {
          scope.displayName = n.displayName;
          scope.description = $sce.trustAsHtml(n.description);
        }
      });

    }
  };
}])

.directive('failMessage', function () {
  var android =
    'play.google.com/store/apps/details?id=com.biodigitalhuman.humanAndroid';

  var itunes =
    'itunes.apple.com/us/app/biodigital-human-anatomy-health/id771825569';

  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/fail_message.html',
    link: function (scope) {

      var displayDeviceInfo = function (device) {
        if(device) { // Get android / ios info
          var _device = /android/i.test(device) ? 'android' : 'ios';

          scope.deviceName = _device === 'android' ? 'Android' : device;

          scope.deviceLink = _device === 'android' ? android : itunes;
          scope.deviceLink = 'https://' + scope.deviceLink;

          scope.imgSrc = _device === 'android' ?
            'Android_App_Store_Get_Badge.png':
            'Download_on_the_App_Store_Badge_US-UK_135x40.png';
        }
      };

      scope.$watch('result.device', displayDeviceInfo);
    }
  };
});

(function (window) {
  var HumanWidget = window.HumanWidget;

  var defaultConfig = { min: false, allowParams: false, basePath: 'scripts' };

  var relinkCss = function () {
    var stylesheets = window.document.querySelectorAll('[ie-relink-css]');
    var stylesheet, href;

    for (var i = 0; i < stylesheets.length; i++) {
      stylesheet = stylesheets[i];
      href = stylesheet.href;

      stylesheet.href = '';
      stylesheet.href = href;
    }
  };

  var getJsPath = function (libPath, lib, version, mode) {
    return [libPath, lib + '-' + version + mode + '.js'].join('/');
  };

  var getCssPath = function (libPath, lib, version, mode) {
    var styleSheet;

    if(/engine/.test(lib)) {
      styleSheet = [libPath, 'css', 'engine.css'].join('/');
    } else {
      styleSheet = [libPath, 'css', lib + '-' + version + mode + '.css']
        .join('/');
    }

    return styleSheet;
  };

  HumanWidget.loadScripts = function (scripts, ok) {
    var scriptsToLoad = scripts.length;

    if(scriptsToLoad === 0) {
      window.setTimeout(ok, 0);
      return;
    }

    var onLoad = function () {
      if(--scriptsToLoad === 0) {
        if(ok) {
          ok();
        }
      }
    };

    var appendScriptTag = function (src) {
      var scriptTag = window.document.createElement('script');

      scriptTag.async = false;
      scriptTag.src = src;
      scriptTag.onload = onLoad;
      scriptTag.onerror = onLoad;

      window.document.head.appendChild(scriptTag);
    };

    for(var i = 0; i < scripts.length; i++) {
      appendScriptTag(scripts[i]);
    }
  };

  HumanWidget.loadStyles = function (styles, ok) {
    var element = window.document.getElementsByTagName('link-human-css')[0];

    if(element) {
      var stylesToLoad = styles.length;

      var onLoad = function () {
        if(--stylesToLoad === 0) {
          // Hack to re-link subsequent styles for IE
          if('ActiveXObject' in window) {
            relinkCss();
          }

          if(ok) {
            ok();
          }
        }
      };

      var linkStyleSheet = function (src) {
        var link = window.document.createElement('link');

        link.onload = onLoad;
        link.onerror = onLoad;

        link.href = src;
        link.rel  = 'stylesheet';
        link.type = 'text/css';

        element.parentNode.insertBefore(link, element.nextSibling);
      };

      for (var i = styles.length - 1; i >= 0; i--) {
        linkStyleSheet(styles[i]);
      }

      element.parentNode.removeChild(element);
    }
  };

  HumanWidget.buildManifest = function (_dependencies, _config) {
    var dependencyPaths = {};
    var dependency, version, dir, lib, libPath;

    var dependencies = HumanWidget.extend({}, _dependencies);
    var config = HumanWidget.extend({}, defaultConfig, _config || {});

    if(config.allowParams) {
      if(HumanWidget.params['engine-version']) {
        dependencies.humanEngine = HumanWidget.params['engine-version'];
      }

      if(HumanWidget.params['ui-version']) {
        dependencies.humanUI = HumanWidget.params['ui-version'];
      }
    }

    var mode = config.min ? '.min' : '';

    for(dependency in dependencies) {
      if(dependencies.hasOwnProperty(dependency)) {
        version = dependencies[dependency];
        dir = dependency.replace('human', '').toLowerCase();
        lib = dependency.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

        libPath = [config.basePath, dir, version].join('/');

        dependencyPaths[dir] = {
          lib: libPath,
          files: {
            js: getJsPath(libPath, lib, version, mode),
            css: getCssPath(libPath, lib, version, mode)
          }
        };

      }
    }

    var humanScripts, humanStyles;

    if(config.humanScripts) {
      humanScripts = config.humanScripts;
    } else {
      humanScripts = [];

      humanScripts.push(dependencyPaths.engine.files.js);
      humanScripts.push(dependencyPaths.ui.files.js);
    }

    // Add optional plugins
    if(HumanWidget.params.plugins) {
      var base = [config.basePath, 'plugins'].join('/');
      var plugins = HumanWidget.params.plugins.split(',');

      for (var i = 0; i < plugins.length; i++) {
        plugins[i] = [base].concat(plugins[i].split('.')).join('/') + '.js';
      }

      humanScripts = humanScripts.concat(plugins);
    }

    if(config.humanStyles) {
      humanStyles = config.humanStyles;
    } else {
      humanStyles = [
        dependencyPaths.engine.files.css,
        dependencyPaths.ui.files.css
      ];
    }

    return { scripts: humanScripts, styles:  humanStyles };
  };

}(window));

angular.module('humanWidget.pass', [])

.run(['widgetParams', 'widgetData', 'HumanSnapshot', function (widgetParams, widgetData, HumanSnapshot) {

  var initialParam = widgetParams['initial'];
  var initialButtonParam = widgetParams['initial.button'];
  var initialHandHintParam = widgetParams['initial.hand-hint'];
  var initialImageParam = widgetParams['initial.image'];

  var imageSrc = widgetParams['load-image-src'] || widgetParams['image-src'];

  // Incorporating the already used 'load-hint-hand' as well
  var hintHandParam = widgetParams['load-hint-hand'];

  var mode, image;

  // Backwards compatibility
  if (hintHandParam) {
    mode = hintHandParam === 'fade' ? 'hand-hint-fade' : 'hand-hint';
  }

  if (initialImageParam || imageSrc) {
    mode = 'default';
    image = true;
  }

  if (initialParam === 'true') {
    mode = 'default';
  }

  if (initialButtonParam === 'true') {
    mode = 'default';
  }

  if (initialHandHintParam === 'true') {
    mode = 'hand-hint';
  }

  widgetData.initialDisplay.mode    = mode;
  widgetData.initialDisplay.image   = image;
  widgetData.initialDisplay.enabled = angular.isDefined(mode);
  widgetData.initialDisplay.initial = angular.isDefined(mode);

  if (widgetData.support.pass) {
    HumanSnapshot.config({
      copyrightImagePath: 'img/bhuman-logo-powered.png' // Default path
    });

    HumanSnapshot.loadCopyrightImage();
  }

}])

.factory('ObjectTreeDisplay', ['$document', '$rootScope', function ($document, $rootScope) {
  // Backwards compatibility
  var directiveNames = ['human-object-tree', 'object-tree'];
  var objectTree;

  for (var i = 0; i < directiveNames.length; i++) {
    objectTree = $document[0].querySelector(directiveNames[i]);

    if(objectTree) {
      break;
    }
  }

  var $objectTree = angular.element(objectTree);
  var display = false;

  var setDisplay = function (action) {
    if(typeof action === 'boolean') {
      display = action;
    } else {
      display = !display;
    }

    $objectTree[display ? 'removeClass' : 'addClass']('ng-hide');
  };

  $rootScope.$on('window.breakpoint', function (e, breakPoint) {
    if(breakPoint <= 480) {
      setDisplay(false);
    }
  });

  return {
    setDisplay: setDisplay
  };
}])

.directive('humanLoadProgress', ['$timeout', function ($timeout) {

  var STATIC_TYPES = ['material', 'geometry', 'transform'];
  var DYNAMIC_TYPES = ['tweens', 'morph'];

  return {
    restrict: 'E',
    scope: true,
    link: function (scope) {
      var loadSessions = [];
      var show = true;

      scope.show = show;
      scope.currentAssetType = null;

      Human.events.on('assets.load.start', function () {
        loadSessions.push(null);
      });

      Human.events.on('assets.load.progress', function (data) {

        if (!loadSessions[ loadSessions.length - 1 ]) {
          var sessionNumber = loadSessions.length - 1;

          if (STATIC_TYPES.indexOf(data.assetType) >= 0) {
            loadSessions[sessionNumber] = 'static';
          } else if (DYNAMIC_TYPES.indexOf(data.assetType) >= 0) {
            loadSessions[sessionNumber] = 'dynamic';
          }

          scope.currentAssetType = loadSessions[sessionNumber];
          scope.show = show;

          if (
            sessionNumber > 1 ||
            (sessionNumber === 1 && loadSessions[sessionNumber] === 'static')
          ) {
            scope.show = false;
          }

          scope.$digest();
        }

      });

      Human.events.on('assets.load.finish', function () {
        $timeout(function () { // Let them see 100
          scope.show = false;
        });
      });

      scope.$watch('uiComponents.config.loadProgress', function (loadProgress) {
        show = !angular.isDefined(loadProgress) || loadProgress;
      });

    }
  };
}])

.directive('initialDisplayClass', ['$timeout', 'widgetData', function ($timeout, widgetData) {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope, element) {

      if (widgetData.initialDisplay.mode) {
        element.addClass(widgetData.initialDisplay.mode);
      }

      if (widgetData.initialDisplay.mode === 'hand-hint-fade') {
        scope.initialDisplay = widgetData.initialDisplay;

        scope.$watch('initialDisplay.enabled', function (enabled) {
          if (enabled) {

            $timeout(function () {
              widgetData.initialDisplay.enabled = false;
            }, 5000);

          }
        });
      }

    }
  };
}])

.directive('initialDisplay', ['widgetData', function (widgetData) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {

      element.on('click', function () {
        var value = attrs.initialDisplay;

        if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else {
          value = !widgetData.initialDisplay.enabled;
        }

        widgetData.initialDisplay.enabled = value;
        scope.$apply();
      });

    }
  };
}])

.directive('mousewheelInfo', ['$window', '$timeout', 'Human', 'widgetData', function ($window, $timeout, Human, widgetData) {

  var disableScrollParam = widgetData.params['disable-scroll'];
  var disableScrollAlertParam = widgetData.params['disable-scroll.alert'];
  var disableScrollOverlayParam = widgetData.params['disable-scroll.overlay'];

  var disableAlert =
    (disableScrollAlertParam && disableScrollAlertParam !== 'false');

  var disableOverlay =
    (disableScrollOverlayParam && disableScrollOverlayParam !== 'false');

  var disableScroll =
    (disableScrollParam && disableScrollParam !== 'false') ||
    disableAlert || disableOverlay;

  return {
    restrict: 'A',
    link: function (scope, element) {

      if (widgetData.embedded && disableScroll) {

        Human.input.mouseZoomCtrlKey = true;

        if (disableOverlay) {
          element.addClass('overlay');
        }

        var mouseWheelCapturing = true;
        var mousewheelInfoInitted = false;

        var fadeIn = function () {
          element[0].style.display = 'block';

          $timeout(function () {
            element[0].style.opacity = 1;
          }, 0);
        };

        var fadeOut = function () {
          element[0].style.opacity = 0;

          $timeout(function () {
            element[0].style.display = 'none';
            mousewheelInfoInitted = false;
          }, 1500);
        };

        var containerEl = $window.document.getElementById('container');

        angular.element(containerEl).on('mousewheel', function (e) {

          if (e.ctrlKey && !mouseWheelCapturing) {
            mouseWheelCapturing = true;
            Human.properties.set({'ui.mouseWheel.capture': true });
          }

          if (!e.ctrlKey && mouseWheelCapturing) {
            mouseWheelCapturing = false;
            Human.properties.set({'ui.mouseWheel.capture': false });
          }

          if (!e.ctrlKey && !mousewheelInfoInitted) {

            mousewheelInfoInitted = true;

            if (disableOverlay || disableAlert) {
              fadeIn();
            }

            $timeout(fadeOut, 3000);
          }

        });


      }

    }
  };

}])

// TODO: Should be more configurable...
.directive('globalInfo', ['widgetData', 'Info', function (widgetData, Info) {
  return {
    restrict: 'A',
    scope: false,
    link: function (scope) {
      var infoEnabled = false;
      var hasInfo = false;

      var current;

      var setInfoEnabled = function (configInfo) {
        if(widgetData.embedded) {
          infoEnabled = configInfo;
        } else {
          infoEnabled =
            widgetData.params['ui-info'] !== 'false' &&
            widgetData.params['ui-panel'] !== 'false' &&
            widgetData.params['ui-all'] !== 'false';
        }
      };

      var setHasInfo = function (sceneInfo) {
        current = Info.state.current;
        hasInfo = sceneInfo && current && sceneInfo[current];
      };

      scope.sceneInfo = Info.state.info;

      scope.$watchCollection('sceneInfo', function (sceneInfo) {
        setHasInfo(sceneInfo);
        scope.infoEnabled = !!(hasInfo && infoEnabled);
      });

      scope.$watch('uiComponents.config.info', function (checkInfo) {
        setInfoEnabled(checkInfo);
        scope.infoEnabled = !!(hasInfo && infoEnabled);
      });

      scope.$watch('uiComponents.config.infoExpand', function (infoExpand) {
        scope.infoExpanded = infoExpand;
      });

    }
  };
}])

.directive('expandInfo', ['$document', function ($document) {

  var $humanInfo = angular.element($document[0].querySelector('[human-info]'));

  return {
    restrict: 'A',
    scope: false,
    link: function (scope, element) {

      var toggleExpanded = function (e) {
        // Only current way...
        if (!$humanInfo.hasClass('has-description')) {
          return;
        }

        e.stopPropagation();

        scope.uiComponents.config.infoExpand =
          !scope.uiComponents.config.infoExpand;

        scope.$apply();
      };

      element.on('mouseup', toggleExpanded);
    }
  };
}])

.directive('objectTreeDisplay', ['ObjectTreeDisplay', function (ObjectTreeDisplay) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var action = attrs.objectTreeDisplay || 'toggle';
      action = action === 'on' ? true : (action === 'off' ? false : undefined);

      element.on('click', function () {
        ObjectTreeDisplay.setDisplay(action);
      });
    }
  };
}])

.directive('timelineTouch', ['$timeout', 'Human', function ($timeout, Human) {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope) {
      scope.step = function (dir) {
        $timeout(function () {
          Human.timeline[dir === 1 ? 'next' : 'prev']();
        });
      };
    }
  };
}]);

(function (window) {

  var HumanWidget = window.HumanWidget;
  var activity = HumanWidget.activity = {};

  var analytics = HumanWidget.analytics;
  var widgetData = HumanWidget.data;

  // Default verification callbacks

  var apiSuccess = function () {
    var Human = window.Human;

    if(typeof Human.rpc.log !== 'function') {
      return;
    }

    Human.rpc.windowClientEnabled = true;

    window.setInterval(function () {
      if (Human.rpc.logPending()) {
        var fullLog = Human.rpc.getLog();
        var seen = {};
        var log = [];

        for (var i = 0; i < fullLog.length; i++) {
          var identifier = fullLog[i].identifier;

          if(!seen[identifier]) {
            log.push(fullLog[i]);
            seen[identifier] = true;
          }
        }

        var customProps = {
          'platform': 'widgetapi',
          'app_activity': 'call',
          'app_activity_data': log
        };

        var devActivity = analytics.buildDeveloperActivity(customProps);

        analytics.postDeveloperActivity(devActivity, Human.rpc.resetLog);
      }
    }, 2000);
  };

  var apiFailure = function (response) {
    var Human = window.Human;

    if (response.status === 401 || response.status === 403) {

      var data = response.data || {};
      var error = data.error || {};
      var message = error.message || '';

      Human.log.error([
        'Error initializing BioDigital Human API: ' + message,
        'API functionality unavailable for this session.',
        'Please ensure that the developer key parameter (dk)',
        'in your iframe src is correct and registered to this',
        'domain in your BioDigital developer account:',
        'https://developer.biodigital.com/account/apps'
      ].join('\n'));

      Human.rpc.windowClientEnabled = false;
    }
  };

  var domainSuccess = function () {};

  var domainFailure = function (response) {
    if(!widgetData.embedded) {
      return;
    }

    var statusCode = response.status;
    var hasUaid = widgetData.userAnalyticId;

    var errorData = {
      401: {
        error: 'INVALID_CLIENTID',
        message: (hasUaid ? 'Uaid' : 'Client id') + ' missing or invalid'
      },
      403: {
        error: 'DOMAIN_UNREGISTERED',
        message: 'Domain unregistered or not allowed'
      }
    };

    var makeRedirectUrl = function (error, message) {
      var path = '/widget-auth-error.html';
      var encodedMessage = window.encodeURIComponent(message);
      var params = 'error=' + error + '&message=' + encodedMessage;

      return [path, params].join('?');
    };

    var data = response.data || {};
    var error = data.error || {};
    var message = error.message || '';

    switch (statusCode) {
      case 401:
      case 403: {
        errorData = errorData[statusCode];
        message = message || errorData.message;

        window.location.replace(makeRedirectUrl(errorData.error, message));
      }
    }
  };

  // These build functions map status and message to the proper params
  // For 'analytic' and 'activity' items
  var buildChildAnalytic = function (parentAnalytic, config) {
    var type = [parentAnalytic.type, 'viewed', config.status].join('.');

    var description = [
      config.status,
      window.JSON.stringify(widgetData.params)
    ].join(' ');

    var customProps = {
      'analytic_type': type,
      'analytic_description': description
    };

    var childAnalytic =
      analytics.buildAnalytic(customProps, parentAnalytic.data);

    analytics.addRefererData(childAnalytic);
    analytics.setAnalyticParent(childAnalytic, parentAnalytic.id);

    return childAnalytic;
  };

  var buildActivity = function (config) {
    var customProps = {
      'app_activity_status': config.status,
      'app_activity': config.message
    };

    return analytics.buildDeveloperActivity(customProps);
  };

  var buildAPIActivity = function () {
    var Human = window.Human;

    var customProps = {
      'platform': 'widgetapi',
      'app_activity': 'init',
      'app_activity_data': {
        'engine_version': Human.VERSION,
        'api_version': Human.API_VERSION
      }
    };

    return analytics.buildDeveloperActivity(customProps);
  };

  // Build HumanWidget.activity object

  activity._config = {
    success: function () {},
    failure: function () {},
    status:  'success',
    message: 'load'
  };

  activity.record = function (_config) {
    _config = _config || {};
    var config = HumanWidget.extend({}, activity._config, _config);

    if(widgetData.userAnalyticId) { // The user analytic id route

      analytics.getAnalytic(widgetData.userAnalyticId,
        function (response) {
          // Post child analytic but don't include in promise chain
          var childAnalytic = buildChildAnalytic(response.data, config);
          analytics.postAnalytic(childAnalytic);

          config.success(response);
        },
        config.failure
      );

    } else { // Otherwise we go the route of the developer

      analytics.postDeveloperActivity(
        buildActivity(config), config.success, config.failure
      );
    }
  };

  activity.logError = function (message) {
    activity.record({ status: 'error', message: message });
  };

  activity.logModuleError = function () {
    activity.logError('loadScene - Human.init.step - module = undefined');
  };

  activity.verifyDomain = function (config) {
    config = config || {};

    var success = config.success || domainSuccess;
    var failure = config.failure || domainFailure;

    activity.record({ success: success, failure: failure });
  };

  // Slightly different than record:
  // Not checking for uaid and posting different data
  activity.verifyAPI = function (config) {
    if(!widgetData.embedded) {
      return;
    }

    config = config || {};

    var success = config.success || apiSuccess;
    var failure = config.failure || apiFailure;

    analytics.postDeveloperActivity(buildAPIActivity(), success, failure);
  };

  activity.verify = function () { // Convienance shorthand without options
    // Verify domain
    activity.verifyDomain();
    // Independantly verify developer key for API usage
    activity.verifyAPI();
  };

})(window);

(function (window, Modernizr) {

  var HumanWidget = window.HumanWidget;
  var webgl = HumanWidget.webgl = {};

  var defaultConfig = {
    device: { ios: true, android: true },
    error: { post: true, log: false, redirect: false }
  };

  var evaluateResult = function (result, config) {

    var allowDevice = function (param, expression) {
      return (HumanWidget.params['_' + param] === 'true' || config[param]) &&
        new RegExp('^' + expression, 'i').test(result.device);
    };

    var allowIOS = allowDevice('ios', 'iP');
    var allowAndroid = allowDevice('android', 'Android');

    var deviceResult = !result.device || allowIOS || allowAndroid;

    var pass = result.html5 && result.webgl && result.human && deviceResult;

    return { pass: pass, fullResult: result };
  };

  var supportsHTML5 = function () {
    return Modernizr.applicationcache &&
           Modernizr.canvas &&
           Modernizr.hashchange &&
           Modernizr.postmessage;
  };

  var supportsWebGL = function () {
    var contextNames =
      'webgl experimental-webgl webkit-3d moz-webgl "moz-glweb20';

    var contexts = contextNames.split(' ');
    var canvas = window.document.createElement('canvas');

    for (var i = 0; i < contexts.length; i++) {
      try {
        if (canvas.getContext(contexts[i])) {
          return true;
        }
      }
      catch (e) {}
    }

    return false;
  };

  webgl.runTest = function (_config) {
    var config = HumanWidget.extend({}, defaultConfig.device, _config || {});

    var html5 = supportsHTML5();
    var webgl = html5 && supportsWebGL();
    var human = html5 && webgl;

    var result = {
      html5: html5,
      webgl: webgl,
      human: human,
      device: HumanWidget.getDevice(window.navigator.userAgent)
    };

    return evaluateResult(result, config);
  };

  // Error handling

  webgl.handleError = function (_config) {
    var config;

    if(HumanWidget.params['no-error-redirect'] === 'true') {
      config = { post: false, log: true, redirect: false };
    } else {
      config = HumanWidget.extend({}, defaultConfig.error, _config || {});
    }

    Human.events.once('error', function (error) {
      if(config.log) {
        window.console.log(error);
      }

      var log = {
        log: error.log,
        stack: error.stack,
        webglInfo: error.webglInfo
      };

      if(config.post) {

        var data = HumanWidget.serializeRequest({
          category: error.name,
          log: JSON.stringify(log),
          message: error.message
        });

        var url = '/ws/human-error';
        var contentType = 'application/x-www-form-urlencoded; charset=UTF-8';

        var request = new XMLHttpRequest();

        request.open('POST', url);
        request.setRequestHeader('Content-Type', contentType);
        request.send(data);
      }

      if(config.redirect) {

        var redirectUrl = [
          'webgl-error.html?error=',
          error.name,
          '&message=[' + error.type + ']',
          error.message
        ].join('');

        window.location.replace(redirectUrl);
      }

    });

  };

}(window, Modernizr));

angular.module('humanWidget.templates', ['templates/fail_message.html', 'templates/keypress_modal.html', 'templates/module_error.html']);

angular.module('templates/fail_message.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/fail_message.html',
    '<a ng-if="!!result.device" href="{{ deviceLink }}">\n' +
    '  <p>Now freely available on {{ deviceName }}</p>\n' +
    '  <img ng-src="{{ \'/img/\' + imgSrc }}">\n' +
    '</a>\n' +
    '\n' +
    '<div ng-if="!result.device">\n' +
    '  <div class="logo-image"></div>\n' +
    '  <p class="error-generic">Sorry, it looks like your browser does not currently support the Human. Give us a try on Chrome or Firefox for your desktop.</p>\n' +
    '  <div class="error-details" ng-show="!!result">\n' +
    '      <h5><b>Details</b></h5>\n' +
    '      <p id="support-webgl"><b>WebGL: {{ result.webgl }}</b><span></span></p>\n' +
    '      <p id="support-html5"><b>HTML5: {{ result.html5 }}</b><span></span></p>\n' +
    '      <p id="support-human"><b>Human: {{ result.human }}</b><span></span></p>\n' +
    '  </div>\n' +
    '</div>');
}]);

angular.module('templates/keypress_modal.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/keypress_modal.html',
    '<div class="content">\n' +
    '  <div class="header">\n' +
    '   <h1>Human Keypresses</h1>\n' +
    '     <button>\n' +
    '       <img\n' +
    '         src="img/shim.gif"\n' +
    '         alt="Close"\n' +
    '         title="Close"\n' +
    '         class="icon-close"\n' +
    '         ng-click="in = false">\n' +
    '     </button>\n' +
    '  </div>\n' +
    '  <iframe\n' +
    '   id="keypress-frame"\n' +
    '   class="modal-frame normal-scroll"\n' +
    '   frameborder="0"\n' +
    '   scrolling="auto">\n' +
    '  </iframe>\n' +
    '</div>');
}]);

angular.module('templates/module_error.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/module_error.html',
    '<div class="logo-image"></div>\n' +
    '<p>Sorry, it looks like the module you\'re looking for was not found.</p>');
}]);

})(window, angular);
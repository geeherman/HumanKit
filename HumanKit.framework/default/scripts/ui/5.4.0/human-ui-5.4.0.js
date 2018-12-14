/* Human UI 5.4.0
 *
 * (c) 2016 BioDigital, Inc.
 *
 */
 
(function (angular) { 'use strict';

angular.module('humanUI', [
  'humanUI.config',
  'humanUI.tree',
  'humanUI.load',
  'humanUI.camera',
  'humanUI.timeline',
  'humanUI.crossSection',
  'humanUI.annotations',
  'humanUI.dissect',
  'humanUI.modes',
  'humanUI.info',
  'humanUI.media',
  'humanUI.scene',
  'humanUI.bookmark',
  'humanUI.fullscreen',
  'humanUI.templates'
])

.run(['$rootScope', 'Human', function ($rootScope, Human) {
  Human.properties.subscribe({
    propId: 'locale',
    callback: function (locale) {
      $rootScope.$broadcast('human.locale', locale);
    }
  });

  // Put global components data for all directives to access
  $rootScope.uiComponents = {};
}])

.constant('MIN_HUMAN_VERSION', '6.0.1')

.factory('Human', ['$window', 'MIN_HUMAN_VERSION', function ($window, MIN_HUMAN_VERSION) {
  var versions = [];
  var current, min, label;

  angular.forEach([Human.VERSION, MIN_HUMAN_VERSION], function (version) {
    version.replace(/^(\d+)\.(\d+)\.(\d+)-?(\w+)?$/,
      function (m, major, minor, patch, client) {
        versions.push({
          major: major,
          minor: minor,
          patch: patch,
          client: client || null
        });
      }
    );
  });

  var warning = [
    'Human',
    Human.VERSION,
    'is not reliably supported! Use', MIN_HUMAN_VERSION, 'or higher.'
  ].join(' ');

  var compare = function (labels) {
    if(labels.length === 0) { return; }

    label = labels.shift();
    current = versions[0][label];
    min = versions[1][label];

    if(current < min) {
      $window.console.warn(warning);
    } else if(current === min) {
      compare(labels);
    }
  };

  // Throw warning if Human version is below current supported
  if(versions.length === 2) {
    compare(['major', 'minor', 'patch']);
  } else {
    $window.console.warn(warning);
  }

  return Human;
}])

/* Wrap 'loaded' event in a promise, ensuring we can use it
   if it's already been fired */
.factory('humanLoaded', ['$q', 'Human', function ($q, Human) {
  var deferred = $q.defer();

  Human.events.on('loaded', function () {
    deferred.resolve();
  });

  return deferred.promise;
}])

.factory('destroyInterval', ['$interval', function ($interval) {
  return function (interval) {
    if(angular.isDefined(interval)) {
      $interval.cancel(interval);
      interval = undefined;
    }
  };
}])

.factory('checkModule', function () {
  return function (module) {
    try {
      angular.module(module);
    } catch(e) {
      return false;
    }

    return true;
  };
})

.factory('isBaseAnatomy', function () {
  return function (module) {
    return angular.isObject(module) ?
      /(fe)?maleAdult\.json$/.test(module.moduleId) :
      false;
  };
})

.filter('excludeBaseAnatomy', ['isBaseAnatomy', function (isBaseAnatomy) {
  return function (module) {
    return isBaseAnatomy(module) ? null : module;
  };
}])

// Should only be used on trusted sources
.filter('parseActions', ['$sce', 'Human', function ($sce, Human) {
  return function (input) {
    return angular.isString(input) ?
      // Parsing will produce anchor tags, so allow html here
      $sce.trustAsHtml(Human.actions.parse(input)) : '';
  };
}])

.filter('translate', function () {
  return function (obj, prop, locale) {
    var _value = obj[prop];

    if(locale && obj.translations && obj.translations[locale]) {
      // Will return original value if translation not found
      _value = obj.translations[locale][prop] || _value;
    }

    return _value;
  };
})

.filter('getOffset', ['$window', function ($window) {
  /* FF doesn't have offset properties on mouse events */
  return function(e) {
    e = e || $window.event;

    var target  = e.target || e.srcElement;
    var rect    = target.getBoundingClientRect();
    var offsetX = e.clientX - rect.left;
    var offsetY = e.clientY - rect.top;

    return {
      x: offsetX,
      y: offsetY
    };
  };
}])

.directive('toggleButton', function () {
  return {
    restrict: 'A',
    scope: {
      config: '=toggleButton'
    },
    link: function (scope, element, attrs) {
      var on = (attrs.toggleDefault === 'on');
      var method;

      var setState = function (state) {
        if(angular.isDefined(state)) {
          on = !!state;
          element[on ? 'addClass' : 'removeClass']('on');
        }
      };

      if(on) { element.addClass('on'); }

      element.on('click', function () {
        on = !on;
        method = on ? 'on' : 'off';

        if(angular.isFunction(scope.config[method])) { scope.config[method](); }

        scope.$apply();
      });

      scope.$watch('config.model', function (n, o) {
        if(n !== o) { setState(n); }
      });

    }
  };
})

.directive('humanSlider', ['$document', '$timeout', '$filter', function ($document, $timeout, $filter) {
  return {
    restrict: 'E',
    scope: {
      config: '='
    },
    templateUrl: 'templates/ui/slider.html',
    link: function (scope, element) {
      var startX = 0;
      var x = 0;
      var config = { min: 0, max: 1, range: 1 }; // Config defaults

      var offsetX, fraction, percent;

      var $track    = element.children();
      var $children = $track.children();
      var $progress = $children.eq(0);
      var $handle   = $children.eq(1);

      var track = $track[0];

      var setHandle = function () {
        percent = (fraction * 100) + '%';

        $handle.css('left', percent);
        $progress.css('width', percent);

        // Display returned value in progress label
        if(scope.config.label) { scope.label = scope.config.label(); }
      };

      // Update internal config with scope.config[min|max]
      var updateConfig = function (key, value) {
        if(angular.isNumber(value)) {
          config[key] = value;
          config.range = config.max - config.min;
        }
      };

      // Called when slider is changed directly, out of $digest
      var updateValue = function (x) {
        // Derive config.value from x
        fraction = x / track.offsetWidth;
        scope.config.value = (fraction * config.range) + config.min;

        if(scope.config.change) {
          scope.config.change({ x: x, fraction: fraction });
        }

        scope.$apply();
      };

      var onMove = function (e) {
        x = e.clientX - startX;

        if(x < 0) {
          x = 0;
        } else if (x > track.offsetWidth) {
          x = track.offsetWidth;
        }

        updateValue(x);
      };

      var onUp = function () {
        $document.off('mousemove', onMove);
        $document.off('mouseup', onUp);
      };

      $handle.on('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation(); // Do not trigger $track handler

        startX = e.clientX - x;

        $document.on('mousemove', onMove);
        $document.on('mouseup', onUp);
      });

      $track.on('mousedown', function (e) {
        offsetX = e.offsetX || $filter('getOffset')(e).x;

        updateValue(x = offsetX);
      });

      scope.$watch('config.min', function (n) { updateConfig('min', n); });
      scope.$watch('config.max', function (n) { updateConfig('max', n); });

      scope.$watch('config.value', function (n) {
        if(angular.isNumber(n)) {
          // Derive x from config.value
          fraction = (n - config.min) / config.range;
          x = fraction * track.offsetWidth;

          setHandle();
        }
      });

    }
  };
}])

.directive('draggable', ['$document', '$window', function ($document, $window) {
  return {
    restrict: 'A',
    link: function(scope, element) {
      var startX = 0;
      var startY = 0;
      var dimensions, dimension, max, x, y;

      var handle = element.find('drag-handle');
      if(!handle.length) { handle = element; }

      var setCoords = function () {
        dimensions = element[0].getBoundingClientRect();
        x = dimensions.left;
        y = dimensions.top;
      };

      var constrain = function (value, axis) {
        max = axis === 'x' ? $window.innerWidth : $window.innerHeight;
        dimension = axis === 'x' ? 'width' : 'height';

        if(value < 0) { value = 0; }

        if(value + dimensions[dimension] > max) {
          value = max - dimensions[dimension];
        }

        return value;
      };

      handle.on('mousedown', function(e) {
        e.preventDefault();

        if(x === 0 && y === 0) { setCoords(); }

        startX = e.pageX - x;
        startY = e.pageY - y;

        dimensions = element[0].getBoundingClientRect();

        $document.on('mousemove', mousemove);
        $document.on('mouseup', mouseup);
      });

      var mousemove = function (e) {
        x = constrain(e.pageX - startX, 'x');
        y = constrain(e.pageY - startY, 'y');

        element.css({
          left:  x + 'px',
          top: y + 'px'
        });
      };

      var mouseup = function () {
        $document.off('mousemove', mousemove);
        $document.off('mouseup', mouseup);
      };

      setCoords();
    }
  };
}]);

angular.module('humanUI.annotations', [])

.directive('humanAnnotations', ['Human', function (Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/annotations/panel.html',
    link: function (scope) {
      var annotations = Human.view.annotations;

      scope.toggleAnnotations = {
        on: annotations.setShown.bind(annotations, true),
        off: annotations.setShown.bind(annotations, false)
      };

      Human.events.on('annotations.shown', function (data) {
        scope.toggleAnnotations.model = data.shown;
        scope.$apply();
      });

      scope.$watch('uiComponents.config.annotations', function (n) {
        scope.show = !!n;
      });
    }
  };
}]);

angular.module('humanUI.bookmark', [])

.constant('THUMBNAIL_URL', 'thumbnails/bookmarks?eid')

.filter('BookmarkTour', ['THUMBNAIL_URL', function (THUMBNAIL_URL) {
  return function (data) {
    var tmpCaptures = data.tour;

    delete data.tour;

    tmpCaptures.unshift(data);

    angular.forEach(tmpCaptures, function (capture) {
      capture.tourMember = true;
      capture.thumbnailSrc = [THUMBNAIL_URL, capture.eid].join('=');
    });

    return tmpCaptures;
  };
}])

.constant('BOOKMARK_TOUR_BASE_STATE', {
  isTour: false, // Is the new bookmark a tour?
  isTourMember: false, // Does the new bookmark belong to a tour?

  bookmarkRestoring: false, // States from engine events
  dbLoading: false,

  captures: [], // Internal bookmarks of a bookmark tour
  curCapture: null,
  curCaptureIndex: null
})

.provider('BookmarkTour', ['BOOKMARK_TOUR_BASE_STATE', function (BOOKMARK_TOUR_BASE_STATE) {

  var _config = {
    reloadBaseAnatomy: false
  };

  var state = angular.extend({}, BOOKMARK_TOUR_BASE_STATE);

  var $get = function ($filter, $timeout, $q, Human) {

    var setCurCapture = function (i) {
      state.curCapture = state.captures[i] || null;
      state.curCaptureIndex = state.curCapture ? i : null;
    };

    var oldActiveModules = null;
    var newActiveModules = null;
    var newModules = false;

    var _objectCache = {};
    var _restoring = false;

    var _getStreamObjects = function (objects) {
      var streamObjects = {};

      for (var id in objects) {
        if(objects.hasOwnProperty(id) && /^(fe)?maleAdult/.test(id)) {
          if(objects[id].selected || objects[id].enabled) {
            streamObjects[id] = true;
          }
        }
      }

      return streamObjects;
    };

    var _needsNewBase = function (streamObjects) {
      for (var id in streamObjects) {
        if(streamObjects.hasOwnProperty(id)) {
          if(!Human.scene.objects.hasOwnProperty(id)) {
            return true;
          }
        }
      }

      return false;
    };

    var _reloadBaseAnatomy = function (id, streamObjects) {
      var deferred = $q.defer();
      var libId = ['embedded', id].join('_');

      Human.modules.deactivateModules({ moduleId: id });

      Human.modules.db.loadModuleDefinitions(libId, [id], function () {
        var module = Human.modules.modules[id];

        module.streamObjects = streamObjects;
        module.showObjects = {};

        Human.modules.activateModules({ moduleId: id }, deferred.resolve);
      });

      return deferred.promise;
    };

    var _setModules = function (modules) {
      oldActiveModules = angular.copy(newActiveModules);

      newActiveModules = {};

      for (var i = 0; i < modules.length; i++) {
        newActiveModules[ modules[i] ] = true;
      }

      newModules = !angular.equals(newActiveModules, oldActiveModules);
    };

    var _tempMaskScene = function () {
      // Collect the current enabled & selected leaf objects
      var objectStates = ['enabledObjects', 'selectedObjects'];
      var objects = {};

      angular.forEach(objectStates, function (state) {
        var stateObjects = Human.scene[state];
        objects[state] = {};

        for (var id in stateObjects) {
          if(stateObjects.hasOwnProperty(id)) {
            var object = Human.scene.objects[id];

            if(object.objects.length === 0) {
              objects[state][id] = true;
            }
          }
        }
      });

      // This is a cosmetic hack, as there appears to be a single rendered frame
      // After the bookmark is restored where the camera pos is out of synch
      Human.scene.setEnabledObjects({ replace: true });

      // Now reveal the objects in the scene, in the next execution context
      $timeout(function () {
        angular.forEach(objectStates, function (state) {
          var method = 'set' + state[0].toUpperCase() + state.slice(1);
          Human.scene[method]({ objectIds: objects[state] });
        });
      });
    };

    var _hideModuleObjects = function (data) {
      var module = Human.modules.modules[data.moduleId];

      if(!!module && _restoring) {
        _objectCache[data.moduleId] = {};

        _objectCache[data.moduleId].showObjects = module.showObjects;
        _objectCache[data.moduleId].selectObjects = module.selectObjects;

        module.showObjects = {};
        module.selectObjects = {};
      }
    };

    var _restoreModuleObjects = function () {
      angular.forEach(_objectCache, function (_module, moduleId) {
        if(Human.modules.activeModules.hasOwnProperty(moduleId)) {
          var module = Human.modules.activeModules[moduleId];
          // Restore to original just in case
          module.showObjects = _module.showObjects;
          module.selectObjects = _module.selectObjects;

          delete _objectCache[moduleId];
        }
      });
    };

    var _preRestore = function (capture) {
      var deferred = $q.defer();

      var streamObjects = _getStreamObjects(capture.objects);
      var hasStreamObjects = Object.keys(streamObjects).length > 0;
      var needsNewBase = _needsNewBase(streamObjects);

      _restoring = true;

      if(newModules) { // Mask current scene when restoring new modules
        Human.scene.setEnabledObjects({ replace: true });
      }

      if(hasStreamObjects && _config.reloadBaseAnatomy && needsNewBase) {
        var id = capture.modules.activeModules[0];

        $timeout(function () {
          _reloadBaseAnatomy(id, streamObjects).then(deferred.resolve);
        });
      } else {
        deferred.resolve();
      }

      return deferred.promise;
    };

    var _postRestore = function () {
      _restoring = false;

      _restoreModuleObjects();

      // It is necessary to continue the masking after the bookmark is restored
      if(newModules) {
        _tempMaskScene();
      }
    };

    state.reset = function () {
      angular.extend(state, BOOKMARK_TOUR_BASE_STATE);
    };

    state.restore = function (i, callback) {
      var capture = state.captures[i];

      if(capture) {
        setCurCapture(i);

        _setModules(capture.modules.activeModules);

        _preRestore(capture).then(function () {
          $timeout(function () {
            Human.bookmarks.restore(capture, function () {
              _postRestore();
              if(angular.isFunction(callback)) { callback(); }
            });
          });
        });
      }
    };

    // Configurable handlers
    state.onLoaded = angular.noop;

    // Unload captures when restoring a non-tour or tour-member bookmark
    // This can be overridden
    state.onRestored = function () {
      if(!state.isTour && !state.isTourMember) {
        state.captures = [];
      }
    };

    // Human Events
    Human.events.on('modules.activating', _hideModuleObjects);

    Human.events.on('modules.activated', _hideModuleObjects);

    Human.events.on('bookmarks.restoring', function () {
      state.bookmarkRestoring = true;
    });

    Human.events.on('bookmarks.restored', function (data) {
      state.bookmarkRestoring = false;
      state.isTour = !!(data.tour && data.tour.length);
      state.isTourMember = !!data.tourMember;

      if(state.isTour) {
        state.captures = $filter('BookmarkTour')(data);
        setCurCapture(0); // Initialize

        _setModules(data.modules.activeModules);
      }

      state.onRestored(data);
    });

    Human.events.on('bookmarks.db.loading', function () {
      state.dbLoading = true;
    });

    Human.events.on('bookmarks.db.loaded', function (data) {
      state.dbLoading = false;

      state.onLoaded(data);
    });

    return {
      state: state
    };

  };
  $get.$inject = ['$filter', '$timeout', '$q', 'Human'];

  return {
    $get: $get,
    config: function (object) {
      angular.extend(_config, object);
    },
    extend: function (extension) {
      angular.extend(state, extension);
    }
  };

}])

.directive('updateScroll', ['$timeout', function ($timeout) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var expression = attrs.updateScroll;
      var offsetWidth, scrollWidth, unitWidth, diff;

      var update = function (n) {
        // Allow a browser paint before calc
        $timeout(function () {
          offsetWidth = element[0].offsetWidth;
          scrollWidth = element[0].scrollWidth;

          if(scrollWidth > offsetWidth) {
            unitWidth = scrollWidth / element.children().length;
            diff = scrollWidth - offsetWidth;

            element[0].scrollLeft = unitWidth * (n + 1) - diff;
          }

        });
      };

      scope.$watch(expression, update);
    }
  };
}])

.directive('prevNextBookmark', ['Human', 'BookmarkTour', function (Human, BookmarkTour) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var dir = attrs.prevNextBookmark === 'next' ? 1 : -1;
      var _disabled;

      scope.state = BookmarkTour.state;

      element.on('click', function () {
        if(!_disabled) {
          BookmarkTour.state.restore(scope.state.curCaptureIndex + dir);
        }
      });

      // Define how disabled is set
      var disabled = {
        expressions: ['state.curCaptureIndex', 'state.captures.length'],
        callback: function (n) {
          _disabled = !!(
            (dir === 1 && n[0] === n[1] - 1) ||
            (dir === -1 && n[0] === 0)
          );

          element[_disabled ? 'addClass' : 'removeClass']('disabled');
        }
      };

      scope.$watchGroup(disabled.expressions, disabled.callback);
    }
  };
}])

.directive('humanBookmarkTour',
  ['$timeout', '$document', 'Human', 'BookmarkTour', function ($timeout, $document, Human, BookmarkTour) {

    return {
      restrict: 'E',
      templateUrl: 'templates/bookmark/tour.html',
      scope: true,
      link: function (scope) {
        var show;

        scope.state = BookmarkTour.state;
        scope.show = false;

        scope.restore = function (i) {
          BookmarkTour.state.restore(i);
        };

        scope.reset = function () {
          BookmarkTour.state.reset();
        };

        // Define how show property is set
        var showConfig = {
          expressions: ['state.isTour', 'state.isTourMember', 'state.captures'],
          callback: function (n) {
            var hasCaptures = angular.isArray(n[2]) && !!n[2].length;
            scope.show = show && (!!n[0] || !!n[1]) && hasCaptures;
          }
        };

        scope.$watchGroup(showConfig.expressions, showConfig.callback);

        scope.$watch('uiComponents.config.bookmarkTour', function (n) {
          show = !!n;
        });
      }
    };
  }]
);

angular.module('humanUI.camera', [])

.constant('PAN_PARAMS', { interval: 10 })
.constant('PAN_KEYS', { up: 'W', down: 'S', left: 'D', right: 'A' })

.factory('getPanRate', ['Human', function (Human) {
  var eyeVec = new Float64Array(3);
  var lookVec = new Float64Array(3);
  var diffVec = new Float64Array(3);

  var coordToVec = function (coord, vec) {
    vec[0] = coord.x;
    vec[1] = coord.y;
    vec[2] = coord.z;
  };

  return function () {
    coordToVec(Human.view.camera.getEye(), eyeVec);
    coordToVec(Human.view.camera.getLook(), lookVec);

    diffVec = Human.math.subVec3(eyeVec, lookVec, diffVec);

    return Human.math.lenVec3(diffVec) * 0.12;
  };
}])

.directive('centerCamera', ['Human', function (Human) {
  return {
    restrict: 'A',
    link: function (scope, element) {
      element.on('click', function () {
        Human.init.resetCamera();
      });
    }
  };
}])

.directive('panCamera',
  ['$interval', 'PAN_PARAMS', 'Human', 'getPanRate', 'destroyInterval', function ($interval, PAN_PARAMS, Human, getPanRate, destroyInterval) {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        var dir = attrs.panCamera || 'up';
        var x, y, z, delta, clear;

        element.on('mousedown', function () {
          delta = PAN_PARAMS.interval / 1000 * getPanRate();

          clear = $interval(function() {
            x = 0;
            y = 0;
            z = 0;

            switch (dir) {
              case 'up': {
                y = -delta;
                break;
              }
              case 'down': {
                y = delta;
                break;
              }
              case 'left': {
                x = -delta;
                break;
              }
              case 'right': {
                x = delta;
                break;
              }
            }

            Human.view.camera.pan({x: x, y: y, z: z});
          }, PAN_PARAMS.interval);

        });

        element.on('mouseup', function () {
          destroyInterval(clear);
        });

        element.on('mouseleave', function () {
          destroyInterval(clear);
        });
      }
    };
  }]
)

.directive('humanCameraPan', ['PAN_KEYS', function (PAN_KEYS) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/camera/pan.html',
    link: function (scope) {
      scope.keys = PAN_KEYS;

      scope.$watch('uiComponents.config.pan', function (n) {
        scope.show = !!n;
      });
    }
  };
}])

.constant('ZOOM_PARAMS', { step: 0.05, interval: 10 })

.directive('zoomCamera',
  ['$interval', 'ZOOM_PARAMS', 'Human', 'destroyInterval', function ($interval, ZOOM_PARAMS, Human, destroyInterval) {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        var clear;
        var dir = attrs.zoomCamera === 'out' ? 1 : -1;

        element.on('mousedown', function () {
          clear = $interval(function() {
            Human.view.camera.zoom(ZOOM_PARAMS.step * dir);
          }, ZOOM_PARAMS.interval);
        });

        element.on('mouseup', function () {
          destroyInterval(clear);
        });

        element.on('mouseleave', function () {
          destroyInterval(clear);
        });

      }
    };
  }]
)

.directive('humanCameraZoom', function () {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/camera/zoom.html',
    link: function (scope) {
      scope.$watch('uiComponents.config.zoom', function (n) {
        scope.show = !!n;
      });
    }
  };
});

angular.module('humanUI.config', [])

.constant('BASE_CONFIG', {

  // Bookmark
  bookmarkTour: true,

  // Misc
  annotations: false,
  audio: false,
  info: false,
  loadProgress: true,
  fullscreen: true,

  // Navigation
  pan: true,
  zoom: true,

  // Scene
  objectTree: false,

  // Timeline
  playPause: false,
  scrubber: false,
  tour: false,

  // Tools
  crossSection: false,
  dissect: false,

  // View Modes
  isolate: false,
  xray: false
})

.constant('CONFIG_GROUPS', {
  nav: ['pan', 'zoom'],
  scene: ['objectTree'],
  tools: ['crossSection', 'dissect', 'isolate', 'xray'],
  modes: ['isolate', 'xray']
})

// Backwards compatibility mappings
.constant('CONFIG_ALIASES', {
  loader: 'loadProgress',
  panel: 'info',
  tree: 'objectTree',
  fs: 'fullscreen'
})

.constant('EXPANDABLE_UI_COMPONENTS', {
  components: {
    scrubber: {
      chapters: false,
      tour: false
    },
    tour: {
      chapters: false
    },
    playPause: {
      tour: false
    }
  },
  notes: {
    'scrubber.chapters': 'Display chapters for scrubber',
    'scrubber.tour': 'Play one chapter at a time',
    'tour.chapters': 'Display chapters for tours',
    'playPause.tour': 'Play one chapter at a time'
  }
})

// Rules for converting module tags to UI config
.filter('convertTags', function () {
  return function (dest, tags) {

    if(angular.isArray(tags) && tags.length > 0) {

      tags.has = function (item) { // Sugar
        return this.indexOf(item) > -1;
      };

      if(tags.has('scrubber') || tags.has('scrubber-chapters')) {
        dest.scrubber = true;

        if(tags.has('scrubber-chapters')) {
          dest.scrubber = { chapters: true };
          // Used to play chapters one at a time
          if(tags.has('tour')) { dest.scrubber.tour = true; }
        }

      } else {

        if(tags.has('play-controls')) { dest.playPause = true; }
        if(tags.has('tour')) { dest.tour = true; }

      }

      delete tags.has;
    }

    return dest;
  };
})

.filter('extendConfig', ['CONFIG_ALIASES', 'CONFIG_GROUPS', function (CONFIG_ALIASES, CONFIG_GROUPS) {
  return function (dest, src) {

    if(src.hasOwnProperty('all')) {

      angular.forEach(dest, function (_value, key) {
        dest[key] = src.all;
      });

    } else {

      // Convert group config to individual component config
      angular.forEach(CONFIG_GROUPS, function (props, key) {
        if(src.hasOwnProperty(key)) {
          angular.forEach(props, function (prop) {
            dest[prop] = src[key];
          });
        }
      });

      // Extend individual properties (overwriting group and advanced settings)
      angular.extend(dest, src);

      // Remove group properties from dest
      angular.forEach(CONFIG_GROUPS, function (_value, key) {
        if(dest.hasOwnProperty(key)) { delete dest[key]; }
      });

      // Convert config aliases
      angular.forEach(CONFIG_ALIASES, function (value, key) {
        if(dest.hasOwnProperty(key)) {
          dest[value] = dest[key];
          delete dest[key]; // Remove property's alias
        }
      });

    }

    return dest;
  };
}])

.filter('uiParams', ['CONFIG_ALIASES', function (CONFIG_ALIASES) {
  var uiExp = /^ui-/;
  var _key, keyArr;

  var booleanize = function (value) {
    if(value === 'true') {
      return true;
    } else if(value === 'false' || value === '') {
      return false;
    } else {
      return value;
    }
  };

  return function (params) {
    var uiParams = {};
    var object;

    // Filter by ui- prefix, strip it, convert 'true'/'false' to booleans
    angular.forEach(params, function (value, key) {
      if(uiExp.test(key) || CONFIG_ALIASES.hasOwnProperty(key)) {

        keyArr = key
          .replace(uiExp, '')
          .replace(/-([a-z])/g, function (match) { // To camelCase
            return match[1].toUpperCase();
          })
          .split('.');

        value = booleanize(value);

        // Support nesting params one level deep
        if(keyArr.length > 1) {
          _key = keyArr.shift();
          uiParams[_key] = uiParams[_key] || {};

          object = uiParams[_key];
        } else {
          object = uiParams;
        }

        object[ keyArr.shift() ] = value;
      }
    });

    return uiParams;
  };
}])

.provider('ConfigCreator', function () {

  var extended = {};
  var postModule = false;

  var $get = function ($rootScope, BASE_CONFIG, Human,
            extendConfigFilter, convertTagsFilter, uiParamsFilter) {

    return {

      params: uiParamsFilter(Human.request.getSearchParams()),

      init: function () {
        var configCreator = this;

        // Extend every time a new module is activating
        Human.events.on('modules.activating', function (params) {
          configCreator._extend(params);
          $rootScope.$apply();
        });
      },

      _extend: function (params) {
        var config = angular.extend({}, BASE_CONFIG);

        var module = Human.modules.modules[params.moduleId];

        // Backwards compatibility with tags for module
        var moduleConfig = convertTagsFilter({}, module.tags);
        // Extend with module's ui prop to get final module config
        extendConfigFilter(moduleConfig, module.ui || {});

        // Extend with module's config and app provided config, in desired order
        var configs = [moduleConfig];
        configs[postModule ? 'push' : 'unshift'](extended);

        for (var i = 0; i < configs.length; i++) {
          extendConfigFilter(config, configs[i]);
        }

        // Finally extend config with search params in url
        extendConfigFilter(config, this.params);

        // Make globally available
        $rootScope.uiComponents.config = config;
      }

    };

  };
  $get.$inject = ['$rootScope', 'BASE_CONFIG', 'Human', 'extendConfigFilter', 'convertTagsFilter', 'uiParamsFilter'];

  return {
    $get: $get,
    // Allow an app to extend BASE_CONFIG, before or after module extension
    extendBase: function (config, _postModule) {
      extended = config;
      postModule = !!_postModule;
    }
  };

})

.run(['ConfigCreator', function (ConfigCreator) {
  ConfigCreator.init();
}]);

angular.module('humanUI.crossSection', [])

.factory('Clip', ['Human', function (Human) {
  return {
    MAP: [ // Ordered clip planes with display names
      { view: 'Anterior', clip: Human.view.clip.FRONT },
      { view: 'Posterior', clip: Human.view.clip.BACK },
      { view: 'Top', clip: Human.view.clip.TOP },
      { view: 'Right', clip: Human.view.clip.RIGHT },
      { view: 'Bottom', clip: Human.view.clip.BOTTOM },
      { view: 'Left', clip: Human.view.clip.LEFT }
    ],
    show: function (clip) {
      // Invisible until further input
      Human.view.clip.setClip({ state: 'clipping' });
      Human.view.clip.selectClip(clip);
      Human.view.clip.setClip({ state: 'visible' }); // Reset input
    },
    reset: Human.view.clip.reset.bind(Human.view.clip)
  };
}])

.directive('cycleSectionPlane', ['Clip', function (Clip) {
  return {
    restrict: 'A',
    scope: {
      curPlane: '=plane'
    },
    link: function (scope, element) {
      var i = 0;

      element.on('click', function () {
        i = i === Clip.MAP.length - 1 ? 0 : i + 1;
        scope.curPlane = Clip.MAP[i];

        Clip.show(scope.curPlane.clip);
        scope.$apply();
      });
    }
  };
}])

.directive('resetSectionPlane', ['Clip', function (Clip) {
  return {
    restrict: 'A',
    scope: {
      curPlane: '=plane'
    },
    link: function (scope, element) {
      element.on('click', function () {
        scope.curPlane = Clip.MAP[0];

        Clip.reset();

        Clip.show(scope.curPlane.clip);
        scope.$apply();
      });
    }
  };
}])

.directive('humanCrossSectionSlider', ['Human', function (Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/cross-section/slider.html',
    link: function (scope) {

      scope.config = {
        value: 0,
        change: function (data) {
          Human.view.clip.setClip({
            state: 'visible',
            progress: data.fraction
          });
        }
      };

      Human.events.on('clip.updated', function(params) {
        scope.config.value = params.progress || 0;
        scope.$apply();
      });

    }
  };
}])

.directive('humanCrossSection', ['Clip', 'Human', function (Clip, Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/cross-section/panel.html',
    link: function (scope) {
      scope.curPlane = Clip.MAP[0];

      var setState = function (state) {
        Human.view.clip.setClip({
          clipId: Human.view.clip.selectedClip.clipId,
          state: state
        });
      };

      scope.callbacks = {
        on: function () {
          setState('visible');
          scope.showControls = scope.callbacks.model = true;
        },
        off: function () {
          setState('clipping');
          scope.showControls = scope.callbacks.model = false;
        }
      };

      scope.$watch('uiComponents.config.crossSection', function (n) {
        scope.show = !!n;
      });
    }
  };
}]);

angular.module('humanUI.dissect', [])

.directive('undoDissect', ['Human', function (Human) {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope, element) {
      var disabled = true;
      element.addClass('disabled'); // Setup

      element.on('click', function () {
        if(!disabled) { Human.view.dissect.undo(); }
      });

      Human.events.on('dissect.toggled', function (data) {
        disabled = !data.enabled;
        element[disabled ? 'addClass' : 'removeClass']('disabled');
      });
    }
  };
}])

.directive('humanDissect', ['Human', function (Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/dissect/panel.html',
    link: function (scope) {

      var setDissect = function (enabled) {
        /* Still using rpc as it is the only place that has logic to update
           other view states */
        Human.rpc.call(null, 'dissect.setEnabled', { enabled: enabled });
      };

      scope.toggleDissect = {
        on: setDissect.bind(null, true),
        off: setDissect.bind(null, false)
      };

      Human.events.on('dissect.toggled', function (data) {
        scope.toggleDissect.model = data.enabled;
        scope.$apply();
      });

      scope.$watch('uiComponents.config.dissect', function (n) {
        scope.show = !!n;
      });
    }
  };
}]);

angular.module('humanUI.fullscreen', [])

.factory('Fullscreen', ['$document', '$rootScope', function ($document, $rootScope) {
  var $$document = $document[0];
  var body = $$document.body;

  var candidates = {
    request: [
      body.requestFullscreen,
      body.webkitRequestFullscreen,
      body.mozRequestFullScreen,
      body.msRequestFullscreen
    ],
    exit: [
      $$document.exitFullscreen,
      $$document.webkitExitFullscreen,
      $$document.mozCancelFullScreen,
      $$document.msExitFullscreen
    ]
  };

  var _fsElement;

  return {
    VENDOR_PREFIXES: ['', 'webkit', 'moz', 'ms'], // 0 index is the standard

    setMethods: function () {
      var methods;
      var fullScreen = {};

      for (var key in candidates) {
        if(candidates.hasOwnProperty(key)) {
          methods = candidates[key];

          for(var i = 0; i < methods.length; i++) {

            if(angular.isFunction(methods[i])) {
              fullScreen[key] = methods[i];
              break;
            }
          }

          if(!fullScreen[key]) { return false; }
        }
      }

      // Assign methods to object bound to proper contexts
      this.request = fullScreen.request.bind(body);
      this.exit    = fullScreen.exit.bind($$document);

      return true; // Success
    },

    isActive: function () {
      _fsElement = $$document.fullscreenElement ||
        $$document.webkitFullscreenElement ||
        $$document.mozFullScreenElement ||
        $$document.msFullscreenElement ||
        undefined;
      return !!_fsElement;
    },

    bindHandlers: function () {
      var fullScreen = this;
      var active;

      $document.on('keypress', function (e) { // SHIFT + F
        if(e.which === 70 && e.shiftKey) { fullScreen.toggle(); }
      });

      angular.forEach(this.VENDOR_PREFIXES, function (prefix) {
        var eventName = prefix + 'fullscreenchange';

        $$document.addEventListener(eventName, function () {
          active = fullScreen.isActive();

          $rootScope.$broadcast('fullscreen.change', {
            active: active,
            fromUI: fullScreen._fromUI
          });

          fullScreen._fromUI = false;

        }, false);
      });

    },

    _fromUI: false, // Used to track how we got to fullscreen

    toggle: function () {
      this._fromUI = true;
      this[this.isActive() ? 'exit' : 'request']();
    }

  };
}])

.directive('humanFullscreen', ['$window', 'Fullscreen', function ($window, Fullscreen) {
  var topWindow = $window === $window.top;

  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/fullscreen/panel.html',
    link: function (scope) {

      scope.toggleFullscreen = {
        on: Fullscreen.toggle.bind(Fullscreen),
        off: Fullscreen.toggle.bind(Fullscreen)
      };

      scope.$on('fullscreen.change', function (e, data) {
        scope.toggleFullscreen.model = data.active;
        scope.$digest();
      });

      scope.$watch('uiComponents.config.fullscreen', function (n) {
        scope.show = topWindow && !!n;
      });
    }
  };
}])

.run(['Fullscreen', function (Fullscreen) {
  var success = Fullscreen.setMethods();
  if(success) {
    Fullscreen.bindHandlers();
  }
}]);

angular.module('humanUI.info', [])

.run(['Info', function (Info) {
  // Ensures instantiation of Info at run time
  Info._instantiated = true;
}])

.provider('Info', function () {

  var config = {
    baseAnatomy: false,
    modifyLinks: true,
    props: ['title', 'displayName', 'description'] // Props we want to store
  };

  var info = { // Objects we want to keep track of
    bookmark: null,
    chapter: null,
    module: null
  };

  var $get = function ($filter, Human) {

    var makeObject = function (input) {
      if(!input) {
        return null;
      }

      var output = {};

      for (var id in input) {
        if(input.hasOwnProperty(id) && config.props.indexOf(id) >= 0) {
          var value = input[id];

          // Normalize to title property
          if(id === 'displayName') { id = 'title'; }

          if(config.modifyLinks) {
            value = $filter('modifyLinks')(value);
          }

          output[id] = value;
        }
      }

      return output;
    };

    var clearInfo = function () {
      for (var id in info) {
        if(info.hasOwnProperty(id)) {
          info[id] = null;
        }
      }
    };

    Human.events.on('bookmarks.restored', function (bookmark) {
      info.bookmark = makeObject(bookmark);
    });

    Human.events.on('timeline.chapters.activated', function (params) {
      var chapter = Human.timeline.chapterList[params.newChapterIndex];
      info.chapter = makeObject(chapter);
    });

    Human.events.on('modules.activated', function (params) {
      var module = Human.modules.activeModules[params.moduleId];

      if(!config.baseAnatomy) {
        module = $filter('excludeBaseAnatomy')(module);
      }

      info.module = makeObject(module);
    });

    Human.events.on('modules.deactivated', clearInfo);

    return info;
  };
  $get.$inject = ['$filter', 'Human'];

  return {
    $get: $get,
    config: function (_config) {
      config.baseAnatomy = !!_config.baseAnatomy;

      if(angular.isArray(_config.props)) {
        config.props = _config.props;
      }
    }
  };
})

.filter('modifyLinks', ['$document', function ($document) {
  var $$document = $document[0];

  return function (input) {
    var div = $$document.createElement('div');
    div.innerHTML = input;

    var links = div.querySelectorAll('a');

    angular.forEach(links, function (link) {
      // Only modify external links
      if(/^(http)|(\/\/)/.test(link.href)) {
        link.setAttribute('target', '_blank');
      }
    });

    return div.innerHTML;
  };
}])

.directive('humanInfo', ['$parse', '$filter', 'Info', function ($parse, $filter, Info) {
  var PRECEDENCE = ['bookmark', 'chapter', 'module'];

  return {
    restrict: 'A',
    scope: true,
    link: function (scope, element, attrs) {
      var _precedence = $parse(attrs.precedence)({});
      var precedence  = angular.isArray(_precedence) ? _precedence : PRECEDENCE;

      var setInfo = function (_info) {
        var info;

        for (var i = 0; i < precedence.length; i++) {
          info = angular.copy(_info[ precedence[i] ]);

          if(angular.isObject(info)) {
            if(!!info.title || !!info.description) {
              // Allow human actions / HTML in description
              info.description = $filter('parseActions')(info.description);
              scope.info = info;
              return;
            }
          }
        }

        scope.info = null; // Clear info if none found
      };

      scope._info = Info;
      scope.info = null;

      scope.show = false;

      scope.$watchCollection('_info', setInfo);

      scope.$watch('info', function (n) {
        scope.show = !!n;
      });
    }
  };
}])

// Deprecated
.directive('humanInfoPanel', ['$parse', function ($parse) {
  return {
    restrict: 'E',
    templateUrl: 'templates/info/panel.html',
    scope: {
      info: '='
    },
    transclude: true,
    link: function (scope, element, attrs) {
      var propMap = { title: 'title', description: 'description' };

      if(attrs.infoProperties) {
        var parsedMap = $parse(attrs.infoProperties)({});
        propMap = angular.extend(propMap, parsedMap);
      }

      scope.$watch('info', function (n) {
        if(n) {
          scope.infoTitle = n[propMap.title];
          scope.infoDescription = n[propMap.description];
        }
      });

    }
  };
}]);

angular.module('humanUI.load', [])

.constant('DEFAULT_STATUS_TEXT', 'Loading, please wait...')

.factory('Process', ['DEFAULT_STATUS_TEXT', function (DEFAULT_STATUS_TEXT) {
  var processes = {};
  var processStack = [];
  var process;

  return {
    get: function (processId) {
      return processes[processId];
    },

    create: function (params, parentProcess) {
      process = {
        parentProcess: parentProcess,
        statusText: params.statusText || DEFAULT_STATUS_TEXT,
        progress: params.progress || 0
      };

      // Update stores
      processes[params.processId] = process;
      processStack.push(process);

      return process;
    },

    destroy: function (processId) {
      delete processes[processId];
      processStack.pop();

      return processStack.length;
    }
  };
}])

.filter('progressPercent', function () {
  return function (progress) {
    // Band-aid for inaccurate progress calculation in the engine
    progress = Math.max(0, Math.min(100, Math.floor(progress || 0)));
    return Math.round(progress) + '%'; // Avoid NaN
  };
})

.directive('humanLoadProgress',
  ['$timeout', 'Human', 'Process', function ($timeout, Human, Process) {

    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'templates/load/progress.html',
      link: function (scope, element) {
        var process = null;
        var curProcess = null;

        var show;

        // This will hide for file mode, where progress does not increment
        scope.showProgress = function (progress) {
          return angular.isNumber(progress) && progress > 0;
        };

        Human.events.on('processes.started', function (params) {
          // Put in $timeout to ensure being called after 'modules.activating'
          $timeout(function () {
            scope.curProcess = curProcess = Process.create(params, curProcess);
            // Wait until processes.started to assign to scope
            scope.show = show;

            scope.$apply();
          });
        });

        Human.events.on('processes.updated', function (params) {
          // Should always be curProcess
          process = Process.get(params.processId);

          // Make updates to process object
          if(process) {
            // Possibly overwrite statusText
            if(params.statusText) { process.statusText = params.statusText; }
            // -1 when no progress available, such as when no XHR
            // Content-Length header is sent with a requested AJAX resource
            if(params.progress) { process.progress = params.progress; }
          }

          scope.$apply();
        });

        var finishProcess = function (params) {
          // Put in $timeout to ensure being called after 'process.started'
          $timeout(function () {
            Process.destroy(params.processId);
            scope.curProcess = curProcess = curProcess.parentProcess;

            if(!curProcess) { scope.show = false; }

            scope.$apply();
          });
        };

        Human.events.on('processes.finished', finishProcess);
        Human.events.on('processes.failed', finishProcess);

        scope.$watch('uiComponents.config.loadProgress', function (n) {
          // Allow a custom class to be applied via config
          if(angular.isString(n) && !element.hasClass(n)) {
            element.addClass(n);
          }

          show = !!n;
        });
      }
    };

  }]
);

angular.module('humanUI.media', [])

.constant('AUDIO_TYPES', {
  ogg: 'audio/ogg;codecs="vorbis"',
  mp3: 'audio/mpeg;'
})

.constant('AUDIO_PATH', '/content/states/{{ modelId }}/audio/sounds/{{ src }}')

.factory('Media', ['$document', '$interpolate', 'AUDIO_TYPES', 'AUDIO_PATH', function ($document, $interpolate, AUDIO_TYPES, AUDIO_PATH) {
  var supportCache = {};
  var pathCache    = {};

  return {

    supportTest: function (type) { // Only testing audio for now...
      if(supportCache.hasOwnProperty(type)) {
        return supportCache[type];
      } else if(!type && supportCache.hasOwnProperty('audio')) {
        return supportCache.audio;
      }

      var audioEl = $document[0].createElement('audio');
      var canPlay = !!audioEl.canPlayType;

      if(type) {
        canPlay = canPlay && !!audioEl.canPlayType(AUDIO_TYPES[type] || type);
        supportCache[type] = canPlay;
      } else {
        supportCache.audio = canPlay;
      }

      return canPlay;
    },

    getSupportedSrc: function (clip) {
      if(pathCache[clip.clipId]) { return pathCache[clip.clipId]; }

      var context = { modelId: clip.modelId, src: clip.src };
      var path = $interpolate(AUDIO_PATH)(context);

      var type = clip.src.match(/\.(\w+)$/);
      type = type && type[1];

      // Create a complete array of all available types of this clip
      var types = [type].concat(clip.alternatives || []);

      for (var i = 0; i < types.length; i++) {
        if(this.supportTest(types[i])) {
          pathCache[clip.clipId] = path.replace(/\.\w+$/, '.' + types[i]);
          return pathCache[clip.clipId];
        }
      }

      return false;
    }
  };
}])

.directive('muteReplayAudio', function () {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope, element) {

      element.on('click', function () {
        scope[scope.states.ended ? 'replay' : 'toggleMute']();
        scope.$apply();
      });

      scope.$watch('states', function (n) {
        angular.forEach(['ended', 'muted'], function (state) {
          element[n[state] ? 'addClass' : 'removeClass'](state);
        });
      }, true);
    }
  };
})

.directive('humanAudio', ['$q', 'Human', 'Media', function ($q, Human, Media) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/media/audio.html',
    link: function (scope, element) {
      var audioEl = element.find('audio')[0];
      var clips, clip, configShow, suggestedShow;

      var setShown = function () {
        scope.show = !!configShow && !!suggestedShow;
      };

      scope.states = { ended: false, muted: false };

      scope.replay = function () {
        audioEl.currentTime = 0;
        audioEl.play();
        scope.states.ended = false;
      };

      scope.toggleMute = function () {
        audioEl.muted = !audioEl.muted;
        scope.states.muted = audioEl.muted;
      };

      audioEl.addEventListener('ended', function () {
        scope.states.ended = true;
        scope.$apply();
      });

      audioEl.addEventListener('playing', function () {
        scope.states.ended = false;
        scope.$apply();
      });

      Human.events.on('audio.clips', function () {
        clips = Human.media.audio.clips; // Object is easier than array here
      });

      Human.events.on('audio.suggestedClips', function (clipIds) {
        if(clipIds.length === 0 || !clips) {
          suggestedShow = false;
        } else {
          suggestedShow = true;

          if(configShow) {
            clip = clips[ clipIds[0] ]; // Only using first at this point
            audioEl.src = Media.getSupportedSrc(clip);
          }
        }

        setShown();
        scope.$apply();
      });

      scope.$watch('uiComponents.config.audio', function (n) {
        configShow = !!n;
        setShown();
      });
    }
  };
}]);

angular.module('humanUI.modes', [])

.directive('humanXray', ['Human', function (Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/modes/xray.html',
    link: function (scope) {

      scope.toggleXray = {
        on: Human.view.setModeEnabled.bind(Human.view, 'xray'),
        off: Human.view.setModeEnabled.bind(Human.view, 'highlight')
      };

      Human.events.on('xray.toggled', function (data) {
        scope.toggleXray.model = data.enabled;
        scope.$apply();
      });

      scope.$watch('uiComponents.config.xray', function (n) {
        scope.show = !!n;
      });
    }
  };
}])

.directive('humanIsolate', ['Human', function (Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/modes/isolate.html',
    link: function (scope) {

      scope.toggleIsolate = {
        on: Human.view.setModeEnabled.bind(Human.view, 'isolate'),
        off: Human.view.setModeEnabled.bind(Human.view, 'highlight')
      };

      Human.events.on('isolate.toggled', function (data) {
        scope.toggleIsolate.model = data.enabled;
        scope.$apply();
      });

      scope.$watch('uiComponents.config.isolate', function (n) {
        scope.show = !!n;
      });
    }
  };
}]);

angular.module('humanUI.scene', [])

.filter('escapeHtml', function () {
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#x27;',
    '`': '&#x60;'
  };

  var keys = [];

  angular.forEach(escapeMap, function (value, key) {
    keys.push(key);
  });

  var escapeRE = new RegExp('(?:' + keys.join('|') + ')', 'g');

  return function (input) {
    return input.replace(escapeRE, function (match) {
      return escapeMap[match];
    });
  };
})

.factory('ObjectTree', ['escapeHtmlFilter', function (escapeHtmlFilter) {
  return {

    isBase: function (id, module) {
      var exp = module ? /(fe)?maleAdult\.json$/ : /(fe)?maleAdult/;
      return exp.test(id);
    },

    getRootObjects: function (objects) {
      var objectTree = this;
      var _objects = [];

      angular.forEach(objects, function (object) {
        if(objectTree.isBase(object.objectId)) {
          _objects.push(object);
        } else {
          // Make custom root object's children root objects
          _objects = _objects.concat(object.objects);
        }
      });

      return _objects;
    },

    build: function (objects) {
      var rootObjects = this.getRootObjects(objects);

      var _buildTree = function (_objects) {
        var level = [];
        var object, _object;

        for (var i = 0; i < _objects.length; i++) {
          _object = _objects[i];

          object = {
            objectId: escapeHtmlFilter(_object.objectId),
            displayName: escapeHtmlFilter(_object.displayName),
            selected: _object.selected,
            shown: _object.shown
          };

          object.objects = _buildTree(_object.objects);
          level.push(object);
        }

        return level;
      };

      return _buildTree(rootObjects);
    }

  };
}])

.directive('objectEnabled', ['$timeout', 'Tree', function ($timeout, Tree) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var parentLi;

      var toggleEnabledAnatomy = function (state) {
        var object = {};
        object[attrs.objectEnabled] = state;

        Human.scene.setEnabledObjects({ objects: object });
      };

      var updateEnabled = function (enabled, objectId) {
        parentLi = Tree.getLi(objectId);

        if(parentLi) {
          parentLi[enabled ? 'addClass' : 'removeClass']('anatomy-enabled');
        }
      };

      if(attrs.objectEnabled) {
        parentLi = element.parent().parent();

        element.on('click', function (e) {
          e.stopPropagation();

          parentLi.toggleClass('anatomy-enabled');
          toggleEnabledAnatomy(parentLi.hasClass('anatomy-enabled'));
        });
      } else { // Global state: listen for Human updates
        Human.events.on('scene.objectsShown', function (params) {
          var updatedSet = params['enabledObjectsUpdate'];

          $timeout(function () { // Update async
            Tree.updateState(updatedSet, updateEnabled);
          });
        });
      }
    }
  };
}])

.directive('objectSelected', ['$timeout', 'Human', 'Tree', 'ObjectTree', function ($timeout, Human, Tree, ObjectTree) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var parentLi, firstChild;

      var triggerCollapse = function (_parentLi, config) {
        firstChild = _parentLi.children()[0];

        // Trigger opening via collapse directive
        if(firstChild && firstChild.hasAttribute('collapse')) {
          angular.element(firstChild).triggerHandler('click', config);
        }
      };

      var selectAnatomy = function () {
        var multiPickEnabled = Human.view.pick.getMultiPickEnabled();

        Human.view.focus.focusObject({
          objectId: attrs.objectSelected,
          replace: !multiPickEnabled,
          flyTo: multiPickEnabled ? 'none' : 'newSelected'
        }, function () {
          ObjectTree.throttle = false;
        });
      };

      var updateSelected = function (selected, objectId) {
        parentLi = Tree.getLi(objectId);

        if(parentLi) {
          parentLi[selected ? 'addClass' : 'removeClass']('anatomy-selected');

          // Open all childLists in hierarchy when selecting directly from scene
          if(selected && !ObjectTree.throttle) {
            triggerCollapse(parentLi, { state: 'show', animate: false });
          }

          if(!selected) {
            triggerCollapse(parentLi, { state: 'collapse', animate: false });
          }
        }
      };

      if(attrs.objectSelected) {
        element.on('click', function (e) {
          e.preventDefault();

          ObjectTree.throttle = true;
          selectAnatomy();

          triggerCollapse(element.parent(), { state: 'show' });
        });
      } else { // Global state: listen for Human updates
        Human.events.on('scene.objectsSelected', function (params) {
          var updatedSet = params['selectedObjectsUpdate'];

          $timeout(function () { // Update async
            Tree.updateState(updatedSet, updateSelected);
          });
        });
      }

    }
  };
}])

.directive('objectTree', ['Human', 'ObjectTree', function (Human, ObjectTree) {
  return {
    restrict: 'E',
    templateUrl: 'templates/scene/object-tree.html',
    scope: true,
    transclude: true,
    link: function (scope) {

      var setShown = function (show) {
        scope.show = hasRootObjects() && show;
      };

      var hasRootObjects = function () {
        var objects = scope.rootObjects;
        return angular.isArray(objects) && objects.length > 0;
      };

      scope.objectTreeConfig = {
        itemId: '{{ objectId }}',
        itemClasses: function (object) {
          return {
            'anatomy-enabled': object.shown,
            'anatomy-selected': object.selected
          };
        }
      };

      scope.rootObjects = Human.scene.rootObjects;

      scope.$watchCollection('rootObjects', function (n) {
        var show;

        if(hasRootObjects) {
          scope.sceneObjects = ObjectTree.build(n);
        }

        if(angular.isObject(scope.uiComponents.config)) {
          show = !!scope.uiComponents.config.objectTree;
        } else {
          show = false;
        }

        setShown(show);
      });

      scope.$watch('uiComponents.config.objectTree', function (n) {
        setShown(!!n);
      });
    }
  };
}]);

angular.module('humanUI.timeline', [])

.factory('hasTimeFrame', function () {
  return function (timeFrame) {
    var hasLength = timeFrame.firstTime < timeFrame.lastTime;

    return angular.isObject(timeFrame) && hasLength;
  };
})

.directive('playPauseTimeline', ['Human', function (Human) {
  return {
    restrict: 'A',
    scope: {
      config: '='
    },
    link: function (scope, element) {
      var playParams, loop, chapterLoop;

      var play = function () {
        playParams = { startTime: Human.timeline.time };
        chapterLoop = !!Human.timeline.activeRoot._nowBranch.animation.loop;

        if(loop || chapterLoop) {
          playParams.loop = true;
        }

        var isTour = angular.isObject(scope.config) && scope.config.tour;

        if(isTour || chapterLoop) {
          // Play configured tours / looping chapters one chapter at a time
          playParams.numChapters = 1;
        }

        Human.timeline.play(playParams);
      };

      element.on('click', function () {
        if (!Human.timeline.playing) {
          play();
        } else {
          Human.timeline.stop();
        }
      });

      var events = { // Events that affect the internal playing state
        played: true,
        stopped: false,
        scrubbed: false
      };

      angular.forEach(events, function (value, eventName) {
        Human.events.on('timeline.' + eventName, function () {
          element[value ? 'addClass' : 'removeClass']('playing');
        });
      });

      Human.events.on('modules.activating', function (params) {
        var module = Human.modules.modules[params.moduleId];

        if(!!module) {
          loop = !!(module.animation && module.animation.loop);
        }
      });
    }
  };
}])

.directive('humanPlayPause', function () {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/timeline/play-pause.html',
    link: function (scope) {
      var configShow, timelineShow;

      var setShown = function () {
        scope.show = !!configShow && !!timelineShow;
      };

      Human.events.on('timeline.timeFrame.updated', function () {
        timelineShow = true;
        setShown();
        scope.$apply();
      });

      Human.events.on('modules.deactivated', function () {
        scope.show = false;
        scope.$apply();
      });

      scope.$watch('uiComponents.config.playPause', function (n) {
        if(scope.uiComponents.config) {
          // Defer to scrubber first
          configShow = !scope.uiComponents.config.scrubber && !!n;
          setShown();

          if(angular.isObject(n)) { // Send config to playPauseTimeline
            scope.config = n;
          }
        }
      }, true);
    }
  };
})

.directive('humanChapters', ['Human', 'checkModule', 'translateFilter', function (Human, checkModule, translateFilter) {
  return {
    restrict: 'E',
    scope: {
      config: '=?'
    },
    templateUrl: 'templates/timeline/chapters.html',
    link: function (scope, element, attrs) {
      var timeFrame, locale;

      var mode = attrs.chaptersMode || 'scrubber';

      var titleDisplay = function (chapter) {
        return translateFilter(chapter, 'displayName', locale);
      };

      scope.getOffset = function (time) {
        return mode === 'scrubber' ?
          ((time / timeFrame.lastTime) * 100) + '%' : 'auto';
      };

      var init = function (chapters) {
        if(!!chapters && chapters.length > 1) {
          timeFrame = Human.timeline.getTimeFrame();
          scope.chapters = chapters;

          if(angular.isObject(scope.config) && !!scope.config.titleDisplay) {
            scope.titleDisplay = scope.config.titleDisplay;
          } else {
            scope.titleDisplay = titleDisplay;
          }

          // Tooltips from ui.bootstrap do not build off of title attribute,
          // So only show title if we don't have them
          scope.showTitles = !checkModule('ui.bootstrap');
          scope.toolTipPos = mode === 'scrubber' ? 'left' : 'top';
        }
      };

      element.on('click', function (e) {
        if(/chapter/.test(e.target.className)) {
          var targetChapter = Human.timeline.chapters[e.target.id];

          var _playChapter = function () {
            Human.timeline.play({
              startChapterId: targetChapter.chapterId,
              loop: !!targetChapter.loop,
              numChapters: 1
            });
          };

          if(mode === 'scrubber') { // Scrubber
            _playChapter();
          } else { // Tour
            var targetIndex = scope.chapters.indexOf(targetChapter);
            var diff = targetIndex - scope.curIndex;

            if(Math.abs(diff) === 1) {
              Human.timeline[diff === 1 ? 'next' : 'prev']();
            } else if(!!targetChapter.loop) {
              _playChapter();
            } else {
              Human.timeline.scrub({
                chapterId: targetChapter.chapterId
              });
            }
          }
        }
      });

      scope.$on('human.locale', function (e, _locale) {
        locale = _locale;
      });

      Human.events.on('timeline.chapters.updated', init);

      Human.events.on('timeline.timeFrame.updated', function (_timeFrame) {
        timeFrame = _timeFrame;
      });

      Human.events.on('timeline.chapters.activated', function (data) {
        scope.curIndex = data.newChapterIndex;
        scope.$apply();
      });
    }
  };
}])

.directive('humanScrubber', ['$filter', 'Human', function ($filter, Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/timeline/scrubber.html',
    link: function (scope, element) {
      var initialized = false;

      var timeFrame, curTime, totalTime, configShow;

      var setShown = function () {
        scope.show = !!configShow && !!initialized;
      };

      var setUIConfig = function (configScrubber) {
        scope.uiConfig = configScrubber;

        var hasChapters =
          angular.isObject(scope.uiConfig) && scope.uiConfig.chapters;

        element[hasChapters ? 'addClass' : 'removeClass']('chapters');
      };

      var labelText = function () {
        curTime   = $filter('date')(Human.timeline.time * 1000, 'mm:ss');
        totalTime = $filter('date')(timeFrame.lastTime * 1000, 'mm:ss');

        return curTime + ' / ' + totalTime;
      };

      var scrubTime = function (fraction) {
        return timeFrame.firstTime +
               (timeFrame.lastTime - timeFrame.firstTime) * fraction;
      };

      var init = function (_timeFrame) {
        timeFrame = _timeFrame;
        // Initialize slider config params
        scope.config.value = Human.timeline.time;
        scope.config.max   = timeFrame.lastTime;

        if(!initialized) {
          initialized = true;

          Human.events.on('timeline.playing', function (params) {
            scope.config.value = params.time;
            scope.$digest(); // For performance
          });
        }

        setShown();
      };

      scope.config = {
        change: function (data) { // Callback on scrubber change
          Human.timeline.scrub({
            time: scrubTime(data.fraction)
          });
        },
        label: labelText // Text to display in progress label
      };

      Human.events.on('modules.deactivated', function () {
        scope.show = false;
        scope.$apply();
      });

      Human.events.on('timeline.timeFrame.updated', function (_timeFrame) {
        init(_timeFrame);
        scope.$apply();
      });

      scope.$watch('uiComponents.config.scrubber', function (n) {
        configShow = !!n;

        setShown();
        setUIConfig(n); // Send config to playPauseTimeline / humanChapters
      }, true);
    }
  };
}])

.directive('prevNextChapter', ['Human', function (Human) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var dir = attrs.prevNextChapter || 'next';
      var chapters, disabled;

      var setDisabled = function (i) {
        disabled = !!((dir === 'next' && i === chapters.length - 1) ||
        (dir === 'prev' && i === 0));

        element[disabled ? 'addClass' : 'removeClass']('disabled');
      };

      element.on('click', function () {
        if(!disabled) { Human.timeline[dir](); }
      });

      Human.events.on('timeline.chapters.updated', function (_chapters) {
        chapters = _chapters;
      });

      Human.events.on('timeline.chapters.activated', function (params) {
        setDisabled(params.newChapterIndex);
      });
    }
  };
}])

.directive('humanTour', ['$q', '$timeout', 'Human', function ($q, $timeout, Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/timeline/tour.html',
    link: function (scope, element) {
      var configShow, timelineShow;

      var setShown = function () {
        scope.show = !!configShow && !!timelineShow;
      };

      var setUIConfig = function (configTour) {
        scope.uiConfig = configTour;

        var hasChapters =
          angular.isObject(scope.uiConfig) && scope.uiConfig.chapters;

        element[hasChapters ? 'addClass' : 'removeClass']('chapters');
      };

      Human.events.on('modules.deactivated', function () {
        scope.show = false;
        scope.$apply();
      });

      Human.events.on('timeline.chapters.updated', function (chapters) {
        // Allow humanChapters rendering to happen first
        $timeout(function () {
          timelineShow = chapters.length > 1;

          setShown();
          scope.$apply();
        });
      });

      scope.$watch('uiComponents.config.tour', function (n) {
        if(angular.isObject(scope.uiComponents.config)) {
          var config = scope.uiComponents.config;

          // Defer to scrubber and playPause first
          configShow = !config.scrubber && !config.playPause && !!n;

          setShown();
          setUIConfig(n); // Send configuration to humanChapters
        }
      }, true);
    }
  };
}]);

angular.module('humanUI.tree', [])

.factory('Tree', ['$interpolate', function ($interpolate) {
  var collapseTemplate = '<span collapse></span>';
  var liClasses, classConfig;

  return {

    buildClasses: function (object, treeLeaf, itemClasses) {
      liClasses = [];

      classConfig = itemClasses ? itemClasses(object) : {};
      angular.extend({ 'tree-leaf': treeLeaf }, classConfig);

      angular.forEach(classConfig, function (value, key) {
        if(value) { liClasses.push(key); }
      });

      return liClasses.join(' ');
    },

    buildDOMString: function (template, objects, config) {
      var tree = this;
      var str = '<ul>';
      var itemId = config.itemId ? ' id="' + config.itemId + '"' : '';
      var liTemplate = '<li' + itemId + ' class="{{ classes }}">';
      var hasChildren, liStr, itemClasses;

      angular.forEach(objects, function (object) {
        hasChildren = object.objects && object.objects.length > 0;
        itemClasses = config.itemClasses;
        object.classes = tree.buildClasses(object, !hasChildren, itemClasses);

        liStr = liTemplate + (hasChildren ? collapseTemplate : '') + template;
        liStr = $interpolate(liStr)(object);

        if(hasChildren) {
          liStr += tree.buildDOMString(template, object.objects, config);
        }

        str += '</li>' + liStr;
      });

      return str += '</ul>';
    },

    lis: null,

    getLi: function (id) {
      if(this.lis && this.lis.length) {
        for (var i = 0; i < this.lis.length; i++) {
          if(this.lis[i].id === id) {
            return angular.element(this.lis[i]);
          }
        }
      }
    },

    updateState: function (updatedSet, callback) {
      angular.forEach(updatedSet, callback);
    }
  };
}])

.directive('collapse', ['$timeout', function ($timeout) {
  return {
    restrict: 'A',
    link: function (scope, element) {
      var parentLi = element.parent();
      var siblings = parentLi.children();
      var childList = angular.element(siblings[ siblings.length - 1 ]);
      var transitioning = false;
      var collapsed = true;
      var liHeight, alreadyShown, alreadyCollapsed;

      childList.css('height', '0px');
      parentLi.addClass('collapsed');

      element.on('click', function (e, data) {
        e.stopPropagation();

        if(!data) { data = {}; }

        alreadyShown = !!(data.state === 'show' && !collapsed);
        alreadyCollapsed = !!(data.state === 'collapse' && collapsed);

        if(transitioning || !childList || alreadyShown || alreadyCollapsed) {
          return;
        }

        transitioning = true;
        if(data.animate !== false) { childList.addClass('animating'); }

        childList.css('height', childList[0].scrollHeight + 'px');
        // Toggling this before actual state change, so it's the opposite...
        parentLi[collapsed ? 'removeClass' : 'addClass']('collapsed');

        if(!collapsed) {
          liHeight = childList[0].offsetHeight; // Force browser rendering first
          childList.css('height', '0px');
        }

        $timeout(function () {
          collapsed = !collapsed;
          transitioning = false;

          if(!collapsed) { childList.css('height', 'auto'); }
          childList.removeClass('animating');
        }, 350);

      });

    }
  };
}])

.directive('humanTree', ['$compile', 'Tree', function ($compile, Tree) {
  return {
    restrict: 'E',
    scope: {
      treeData: '=',
      treeConfig: '='
    },
    compile: function (scope, tElement) {
      var _element = tElement.$$element;
      var template = _element[0].innerHTML;
      angular.element(_element).empty();

      var postLink = function (scope, element) {
        scope.$watch('treeData', function (n) {
          if(n) {
            var config = scope.treeConfig || {};
            element.empty().append(Tree.buildDOMString(template, n, config));
            $compile(element.contents())(scope);
            Tree.lis = element.find('li'); // Store li elements for getting
          }
        });
      };

      return postLink;
    }
  };
}]);

angular.module('humanUI.templates', ['templates/annotations/panel.html', 'templates/bookmark/tour.html', 'templates/camera/pan.html', 'templates/camera/zoom.html', 'templates/cross-section/panel.html', 'templates/cross-section/slider.html', 'templates/dissect/panel.html', 'templates/fullscreen/panel.html', 'templates/info/panel.html', 'templates/load/progress.html', 'templates/media/audio.html', 'templates/modes/isolate.html', 'templates/modes/xray.html', 'templates/scene/object-tree.html', 'templates/timeline/chapters.html', 'templates/timeline/play-pause.html', 'templates/timeline/scrubber.html', 'templates/timeline/tour.html', 'templates/ui/slider.html']);

angular.module('templates/annotations/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/annotations/panel.html',
    '<button\n' +
    '  class="tool annotations"\n' +
    '  toggle-button="toggleAnnotations"\n' +
    '  tooltip="Toggle Annotations"></button>');
}]);

angular.module('templates/bookmark/tour.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/bookmark/tour.html',
    '<div>\n' +
    '  <button prev-next-bookmark="prev"></button>\n' +
    '\n' +
    '  <div id=\'bookmark-tour-captures\' update-scroll="state.curCaptureIndex">\n' +
    '    <div class="bookmark-tour-capture"\n' +
    '      ng-repeat="capture in state.captures"\n' +
    '      ng-class="{ on: $index === state.curCaptureIndex }"\n' +
    '      ng-click="restore($index)">\n' +
    '\n' +
    '      <img ng-src="/{{ capture.thumbnailSrc }}">\n' +
    '    </div>\n' +
    '  </div>\n' +
    '\n' +
    '  <button prev-next-bookmark="next"></button>\n' +
    '</div>');
}]);

angular.module('templates/camera/pan.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/camera/pan.html',
    '<div pan-camera="up" title="Pan Up [{{ keys.up }}]"></div>\n' +
    '<div pan-camera="right" title="Pan Right [{{ keys.right }}]"></div>\n' +
    '<div pan-camera="down" title="Pan Down [{{ keys.down }}]"></div>\n' +
    '<div pan-camera="left" title="Pan Left [{{ keys.left }}]"></div>\n' +
    '\n' +
    '<div center-camera title="Center"></div>');
}]);

angular.module('templates/camera/zoom.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/camera/zoom.html',
    '<div zoom-camera="out">-</div>\n' +
    '<div zoom-camera="in">+</div>');
}]);

angular.module('templates/cross-section/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/cross-section/panel.html',
    '<button\n' +
    '  class="cross-section tool"\n' +
    '  toggle-button="callbacks"\n' +
    '  tooltip-append-to-body="true"\n' +
    '  tooltip="Cross Section"></button>\n' +
    '\n' +
    '<div class="controls" ng-show="showControls">\n' +
    '  <button\n' +
    '    class="tool"\n' +
    '    cycle-section-plane plane="curPlane"\n' +
    '    tooltip="Select Plane"></button>\n' +
    '\n' +
    '  <human-cross-section-slider></human-cross-section-slider>\n' +
    '  <span class="view">{{ curPlane.view }}</span>\n' +
    '\n' +
    '  <button\n' +
    '    class="tool"\n' +
    '    reset-section-plane\n' +
    '    plane="curPlane"\n' +
    '    tooltip="Reset"></button>\n' +
    '</div>');
}]);

angular.module('templates/cross-section/slider.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/cross-section/slider.html',
    '<human-slider config="config"></human-slider>');
}]);

angular.module('templates/dissect/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/dissect/panel.html',
    '<button\n' +
    '  class="tool dissect"\n' +
    '  toggle-button="toggleDissect"\n' +
    '  toggle-model="shown"\n' +
    '  tooltip="Dissect [Ctrl + X]"></button>\n' +
    '\n' +
    '<button\n' +
    '  class="tool dissect-undo"\n' +
    '  undo-dissect\n' +
    '  tooltip="Undo Dissect [Ctrl + Z]"></button>');
}]);

angular.module('templates/fullscreen/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/fullscreen/panel.html',
    '<button\n' +
    '  class="tool fullscreen"\n' +
    '  toggle-button="toggleFullscreen"></button>');
}]);

angular.module('templates/info/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/info/panel.html',
    '<h1 class="title">{{ infoTitle }}</h1>\n' +
    '<div class="description" ng-bind-html="infoDescription | parseActions"></div>\n' +
    '<ng-transclude class="custom-content"></ng-transclude>');
}]);

angular.module('templates/load/progress.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/load/progress.html',
    '<div class="progress-indicator">\n' +
    '  <span ng-show="showProgress(curProcess.progress)">{{ curProcess.progress | progressPercent }}</span>\n' +
    '</div>\n' +
    '\n' +
    '<div class="status-text">\n' +
    '  <span>{{ curProcess.statusText }}</span>\n' +
    '</div>');
}]);

angular.module('templates/media/audio.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/media/audio.html',
    '<audio autoplay></audio>\n' +
    '<button mute-replay-audio class="tool"></button>');
}]);

angular.module('templates/modes/isolate.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/modes/isolate.html',
    '<button\n' +
    '  class="tool isolate"\n' +
    '  toggle-button="toggleIsolate"\n' +
    '  tooltip="Isolate Mode [I]"></button>');
}]);

angular.module('templates/modes/xray.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/modes/xray.html',
    '<button\n' +
    '  class="tool xray"\n' +
    '  toggle-button="toggleXray"\n' +
    '  tooltip="Transparency Mode [T]"></button>');
}]);

angular.module('templates/scene/object-tree.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/scene/object-tree.html',
    '<ng-transclude></ng-transclude>\n' +
    '<human-tree\n' +
    '  tree-data="sceneObjects"\n' +
    '  tree-config="objectTreeConfig"\n' +
    '  object-selected\n' +
    '  object-enabled>\n' +
    '    <a\n' +
    '      object-selected="{{ objectId }}"\n' +
    '      title="{{ displayName }}"\n' +
    '      class="tree-item">\n' +
    '      <span\n' +
    '        object-enabled="{{ objectId }}"\n' +
    '        class="anatomy-check-icon"></span>{{ displayName }}\n' +
    '    </a>\n' +
    '</human-tree>');
}]);

angular.module('templates/timeline/chapters.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/timeline/chapters.html',
    '<button\n' +
    '  ng-repeat="chapter in chapters"\n' +
    '  id="{{ chapter.chapterId }}"\n' +
    '  class="chapter"\n' +
    '  ng-class="{ on: $index === curIndex}"\n' +
    '  tooltip-html-unsafe="{{ titleDisplay(chapter) }}"\n' +
    '  tooltip-placement="{{ toolTipPos }}"\n' +
    '  title="{{ showTitles && titleDisplay(chapter) }}"\n' +
    '  ng-style="{ left: getOffset(chapter.time) }">{{ $index + 1 }}</button>');
}]);

angular.module('templates/timeline/play-pause.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/timeline/play-pause.html',
    '<button play-pause-timeline config="config"></button>');
}]);

angular.module('templates/timeline/scrubber.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/timeline/scrubber.html',
    '<button play-pause-timeline config="uiConfig"></button>\n' +
    '\n' +
    '<human-chapters chapters-mode="scrubber" config="uiConfig"></human-chapters>\n' +
    '<human-slider config="config"></human-slider>');
}]);

angular.module('templates/timeline/tour.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/timeline/tour.html',
    '<div>\n' +
    '  <button prev-next-chapter="prev"></button><human-chapters chapters-mode="tour" config="uiConfig"></human-chapters><button prev-next-chapter="next"></button>\n' +
    '</div>');
}]);

angular.module('templates/ui/slider.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/ui/slider.html',
    '<div class="track">\n' +
    '  <div class="progress"></div>\n' +
    '  <div class="handle"\n' +
    '    ng-mouseover="showLabel = !!config.label"\n' +
    '    ng-mouseleave="showLabel = false">\n' +
    '    <div class="progress-label" ng-show="showLabel">{{ label }}</div>\n' +
    '  </div>\n' +
    '</div>');
}]);

})(angular);
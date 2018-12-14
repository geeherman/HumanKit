/* Human UI 6.3.1
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
  $rootScope.uiComponents = {
    config: {}
  };
}])

.constant('MIN_HUMAN_VERSION', '8.0.0')

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
  return function (input) {
    var moduleId = angular.isObject(input) ? input.moduleId : input;
    return moduleId ? Human.modules.isBaseModule(moduleId) : false;
  };
})

.filter('excludeBaseAnatomy', ['isBaseAnatomy', function (isBaseAnatomy) {
  return function (module) {
    return isBaseAnatomy(module) ? null : module;
  };
}])

.factory('touchTarget', ['$document', function ($document) {
  return function (element, callback) {
    element.addEventListener('touchmove', function (e) {
      var touch = e.changedTouches[0];
      var target = $document[0].elementFromPoint(touch.pageX, touch.pageY);

      callback(target);
    });
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

.factory('Draggable', ['$window', '$document', function ($window, $document) {
  var startEvents = 'touchstart mousedown';
  var moveEvents = 'touchmove mousemove';
  var endEvents = 'touchend touchcancel mouseup';

  var draggables = [];

  var min, max, marginLeft, marginTop, bounds;

  var buildConstraints = function (_constraints, element) {
    // DEFAULTS
    var constraints = { element: $window, axis: false, elementBounds: false };

    if(angular.isString(_constraints.element)) {
      var parts = _constraints.element.split('.');

      if(parts[0] === 'parent') {
        constraints.element = element.parent()[0];
      }

      if(parts[1] === 'width' || parts[1] === 'height') {
        constraints.elementBounds = parts[1];
      }

    } else if(typeof _constraints.element === 'boolean') {
      if(!_constraints.element) {
        constraints.element = false;
      }
    }

    if(_constraints.axis === 'x' || _constraints.axis === 'y') {
      constraints.axis = _constraints.axis;
    }

    return constraints;
  };

  var Draggable = function (config) {
    this.element = config.element;
    this.handle = config.handle || config.element;

    this.constraints = buildConstraints(config.constraints || {}, this.element);

    this.callbacks = {
      onStart: config.onStart || angular.noop,
      onMove: config.onMove || angular.noop,
      onEnd: config.onEnd || angular.noop,
    };

    angular.forEach(startEvents.split(' '), function (event) {
      this.handle.on(event + '.draggable', this.onStart.bind(this));
    }, this);
  };

  Draggable.prototype.setElCoords = function () {
    this.width = this.element[0].offsetWidth;
    this.height = this.element[0].offsetHeight;

    marginLeft = $window.parseInt(this.element.css('margin-left'));
    marginTop = $window.parseInt(this.element.css('margin-top'));

    // Remove margins from calculation
    this.x = this.element[0].offsetLeft - marginLeft;
    this.y = this.element[0].offsetTop - marginTop;

    this.parentX = this.element[0].offsetParent.offsetLeft;
    this.parentY = this.element[0].offsetParent.offsetTop;
  };

  Draggable.prototype.setEventCoords = function (e) {
    e = e.originalEvent || e;
    e = e.changedTouches ? e.changedTouches[0] : e;

    this.deltaX = e.clientX - this.eventX || 0;
    this.deltaY = e.clientY - this.eventY || 0;

    this.eventX = e.clientX;
    this.eventY = e.clientY;
  };

  Draggable.prototype.constrainX = function (value) {
    if(this.constraints.element) {

      if(this.constraints.element === $window) {
        min = 0 - this.parentX;
        max = $window.innerWidth - this.parentX;
      } else {
        min = 0;
        max = this.constraints.element.offsetWidth;
      }

      if(value < min) {
        value = min;
      }

      bounds = this.constraints.elementBounds === 'width' ? 0 : this.width;

      if(value + bounds > max) {
        value = max - bounds;
      }

    }

    if(this.constraints.axis === 'y') {
      value = this.x;
    }

    return value;
  };

  Draggable.prototype.constrainY = function (value) {
    if(this.constraints.element) {

      if(this.constraints.element === $window) {
        min = 0 - this.parentY;
        max = $window.innerHeight - this.parentY;
      } else {
        min = 0;
        max = this.constraints.element.offsetHeight;
      }

      if(value < min) {
        value = min;
      }

      bounds = this.constraints.elementBounds === 'height' ? 0 : this.height;

      if(value + bounds > max) {
        value = max - bounds;
      }

    }

    if(this.constraints.axis === 'x') {
      value = this.y;
    }

    return value;
  };

  Draggable.prototype.onStart = function (e) {
    e.stopPropagation();
    e.preventDefault();

    this.setElCoords();
    this.setEventCoords(e);

    angular.forEach(moveEvents.split(' '), function (event) {
      $document.on(event + '.draggable', this.onMove.bind(this));
    }, this);

    angular.forEach(endEvents.split(' '), function (event) {
      $document.on(event + '.draggable', this.onEnd.bind(this));
    }, this);

    this.callbacks.onStart(this.x, this.y);
  };

  Draggable.prototype.onMove = function (e) {
    e.stopPropagation();
    e.preventDefault();

    this.setEventCoords(e);

    this.x = this.constrainX(this.x + this.deltaX);
    this.y = this.constrainY(this.y + this.deltaY);

    this.element.css({
      left:  this.x + 'px',
      top: this.y + 'px'
    });

    this.callbacks.onMove(this.x, this.y);
  };

  Draggable.prototype.onEnd = function () {
    angular.forEach(moveEvents.split(' '), function (event) {
      $document.off(event + '.draggable');
    }, this);

    angular.forEach(endEvents.split(' '), function (event) {
      $document.off(event + '.draggable');
    }, this);

    this.callbacks.onEnd();
  };

  return {
    create: function (config) {
      var draggable = new Draggable(config);

      draggables.push(draggable);
    }
  };

}])

.directive('humanSlider', ['Draggable', function (Draggable) {
  return {
    restrict: 'E',
    scope: {
      config: '='
    },
    templateUrl: 'templates/ui/slider.html',
    link: function (scope, element) {
      var x = 0;
      var config = { min: 0, max: 1, range: 1 }; // Config defaults

      var fraction, percent;

      var $track    = element.children();
      var $children = $track.children();
      var $progress = $children.eq(0);
      var $handle   = $children.eq(1);

      var track = $track[0];

      var setCSS = function () {
        percent = (fraction * 100) + '%';

        $handle.css('left', percent);
        $progress.css('width', percent);

        if(scope.config.label) { // Display returned value in progress label
          scope.label = scope.config.label();
        }
      };

      // Update internal config with scope.config[min|max]
      var updateConfig = function (key, value) {
        if(angular.isNumber(value)) {
          config[key] = value;
          config.range = config.max - config.min;
        }
      };

      // Called when slider is changed out of $digest cycle
      var updateValue = function (x) {
        // Derive config.value from x
        fraction = x / track.offsetWidth;
        scope.config.value = (fraction * config.range) + config.min;

        if(scope.config.change) {
          scope.config.change({ x: x, fraction: fraction });
        }

        scope.$apply();
      };

      $track.on('mousedown', function (e) {
        x = e.clientX - e.target.getBoundingClientRect().left;
        updateValue(x);
      });

      Draggable.create({
        element: $handle,
        constraints: { element: 'parent.width', axis: 'x' },
        onMove: updateValue
      });

      scope.$watch('config.min', function (n) { updateConfig('min', n); });
      scope.$watch('config.max', function (n) { updateConfig('max', n); });

      scope.$watch('config.value', function (n) {
        if(angular.isNumber(n)) {
          // Derive x from config.value
          fraction = (n - config.min) / config.range;
          x = fraction * track.offsetWidth;
          // TODO: Can you make this better?
          setCSS(); // Will override Draggable css with percent value
        }
      });

    }
  };
}])

.directive('draggable', ['Draggable', function (Draggable) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var handle = element.find('drag-handle');

      var constrainEl, constrainAxis;

      if(attrs.constrainElement === 'false') {
        constrainEl = false;
      } else if(/^parent/.test(attrs.constrainElement)) {
        constrainEl = attrs.constrainElement;
      } else {
        constrainEl = 'window';
      }

      if(attrs.constrainAxis === 'x' || attrs.constrainAxis === 'y') {
        constrainAxis = attrs.constrainAxis;
      }

      Draggable.create({
        element: element,
        handle: handle.length ? handle : element,
        constraints: { element: constrainEl, axis: constrainAxis }
      });
    }
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
});

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

  restoring: false,

  captures: [], // Internal bookmarks of a bookmark tour
  curCapture: null,
  curCaptureIndex: null
})

.provider('BookmarkTour', ['BOOKMARK_TOUR_BASE_STATE', function (BOOKMARK_TOUR_BASE_STATE) {

  var _config = { compare: false };

  var state = angular.extend({}, BOOKMARK_TOUR_BASE_STATE);

  var bookmarkModules = { newModules: null, oldModules: null };

  var $get = function ($rootScope, $filter, $timeout, $q, Human) {
    var cached = {};

    var tourModules, moduleParts, stateId;

    var cacheBaseIndices = function (modules) {
      angular.forEach(modules, function (module) {
        if(Human.modules.isBaseModule(module)) {
          moduleParts = module.split('/');
          stateId = moduleParts[ moduleParts.length - 1 ]
            .replace(/\.json$/, '');

          if(!cached[stateId]) {
            Human.assets.server.cacheStateIndex(stateId);
          }
        }
      });
    };

    var setTourModules = function (captures) {
      tourModules = [];

      // Restoring a bookmark can modify the activeModules data
      // So keeping a pristine copy here for comparison purposes
      angular.forEach(captures, function (capture) {
        cacheBaseIndices(capture.modules.activeModules);
        tourModules.push(angular.copy(capture.modules.activeModules));
      });
    };

    var setCurCapture = function (i) {
      state.curCapture = state.captures[i] || null;
      state.curCaptureIndex = state.curCapture ? i : null;
    };

    var clearModules = function () {
      var activeModules = Object.keys(Human.modules.activeModules);

      angular.forEach(activeModules, function (moduleId) {
        if (Human.modules.isBaseModule(moduleId)) {
          Human.modules.deactivateModules({ moduleId: moduleId });
        } else {
          Human.modules.destroyModules({ moduleId: moduleId });
        }
      });
    };

    var deactivateOldModules = function () {
      // Deactivate if active modules are not equal
      if(!angular.equals(
          bookmarkModules.oldModules,
          bookmarkModules.newModules
        )
      ) {
        Human.modules.deactivateModules();
      }
    };

    var compareModules = function (i) {
      bookmarkModules.oldModules = bookmarkModules.newModules;
      bookmarkModules.newModules = tourModules[i];

      if(_config.compare) {
        deactivateOldModules();
      } else {
        clearModules();
      }
    };

    state.reset = function () {
      angular.extend(state, BOOKMARK_TOUR_BASE_STATE);
    };

    state.restore = function (i, callback) {
      var capture = state.captures[i];

      if(capture) {
        state.restoring = true;
        setCurCapture(i);

        $timeout(function () {
          compareModules(i);

          Human.bookmarks.restore(capture, function () {
            if(angular.isFunction(callback)) {
              callback();
            }
          });
        });
      }
    };

    // Unload captures when restoring a non-tour or tour-member bookmark
    // This can be overridden
    state.onRestored = function () {
      if(!state.isTour && !state.isTourMember) {
        state.captures = [];
      }
    };

    // Human Events
    Human.events.on('bookmarks.restored', function (data) {
      state.restoring = false;

      state.isTour = !!(data.tour && data.tour.length);
      state.isTourMember = !!data.tourMember;

      if(state.isTour) {
        state.captures = $filter('BookmarkTour')(data);
        setTourModules(state.captures);

        setCurCapture(0); // Initialize
      }

      var hasCaptures =
        angular.isArray(state.captures) && !!state.captures.length;

      state.bookmarkTour = (state.isTour || state.isTourMember) && hasCaptures;

      state.onRestored(data);
      $rootScope.$broadcast('bookmarkTour.state', state);
    });

    return {
      state: state
    };

  };
  $get.$inject = ['$rootScope', '$filter', '$timeout', '$q', 'Human'];

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
        scope.show = false;

        var configShown, bookmarkTour;

        var setShown = function () {
          scope.show = configShown && bookmarkTour;
        };

        scope.restore = function (i) {
          BookmarkTour.state.restore(i);
        };

        scope.reset = function () {
          BookmarkTour.state.reset();
        };

        scope.$on('bookmarkTour.state', function (e, state) {
          bookmarkTour = state.bookmarkTour;
          setShown();
        });

        scope.$watch('uiComponents.config.bookmarkTour', function (n) {
          configShown = !!n;
          setShown();
        });
      }
    };
  }]
);

angular.module('humanUI.camera', [])

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

.directive('humanCameraCenter', function () {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/camera/center.html',
    link: function (scope) {
      scope.$watch('uiComponents.config.center', function (n) {
        scope.show = !!n;
      });
    }
  };
})

.directive('panCamera',
  ['$interval', 'Human', 'getPanRate', 'touchTarget', 'destroyInterval', function ($interval, Human, getPanRate, touchTarget, destroyInterval) {

    var PAN_PARAMS = { interval: 10 };

    var startEvents = 'touchstart mousedown';
    var endEvents = 'touchend touchcancel mouseleave mouseup';

    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        var dir = attrs.panCamera || 'up';
        var x, y, z, delta, clear;

        var pan = function () {
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
        };

        touchTarget(element[0], function (target) {
          if(element[0] !== target) {
            destroyInterval(clear);
          }
        });

        angular.forEach(startEvents.split(' '), function (event) {
          element.on(event, function (e) {
            e.preventDefault();

            pan();
          });
        });

        angular.forEach(endEvents.split(' '), function (event) {
          element.on(event, function () {

            destroyInterval(clear);
          });
        });

      }
    };
  }]
)

.directive('humanCameraPan', function () {
  var PAN_KEYS = { up: 'W', down: 'S', left: 'D', right: 'A' };

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
})

.directive('zoomCamera',
  ['$interval', 'Human', 'touchTarget', 'destroyInterval', function ($interval, Human, touchTarget, destroyInterval) {
    var ZOOM_PARAMS = { step: 0.05, interval: 10 };

    var startEvents = 'touchstart mousedown';
    var endEvents = 'touchend touchcancel mouseleave mouseup';

    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        var dir = attrs.zoomCamera === 'out' ? 1 : -1;
        var clear;

        touchTarget(element[0], function (target) {
          if(element[0] !== target) {
            destroyInterval(clear);
          }
        });

        angular.forEach(startEvents.split(' '), function (event) {
          element.on(event, function (e) {
            e.preventDefault();

            clear = $interval(function() {
              Human.view.camera.zoom(ZOOM_PARAMS.step * dir);
            }, ZOOM_PARAMS.interval);
          });
        });

        angular.forEach(endEvents.split(' '), function (event) {
          element.on(event, function () {

            destroyInterval(clear);
          });
        });

      }
    };
  }]
)

.directive('humanCameraZoomIn', function () {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/camera/zoom-in.html',
    link: function (scope) {
      scope.$watch('uiComponents.config.zoomIn', function (n) {
        scope.show = !!n;
      });
    }
  };
})

.directive('humanCameraZoomOut', function () {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/camera/zoom-out.html',
    link: function (scope) {
      scope.$watch('uiComponents.config.zoomOut', function (n) {
        scope.show = !!n;
      });
    }
  };
})

.directive('humanCameraZoom', function () {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/camera/zoom.html',
    link: function (scope) {
      var group = ['uiComponents.config.zoomOut', 'uiComponents.config.zoomIn'];

      scope.$watchGroup(group, function (n) {
        scope.show = !!n[0] && !!n[1];
      });
    }
  };
})

.directive('humanCameraMode', ['$timeout', 'Human', function ($timeout, Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/camera/mode.html',
    link: function (scope, element) {
      var properties = Human.properties;
      var propId = 'input.mouseOrbitPan';
      var config = {};

      scope.cameraMode = {
        on: function () {
          config[propId] = 'orbit';
          properties.set(config);
        },
        off: function () {
          config[propId] = 'pan';
          properties.set(config);
        }
      };

      var subId = properties.subscribe({
        propId: propId,
        callback: function (mode) {
          $timeout(function () {
            element.attr('mode', mode);

            scope.cameraMode.model = mode === 'orbit';
            scope.mode = mode;

            scope.$apply();
          });
        }
      });

      // Engine forces us to resubscribe if we want our callback fired
      properties.resubscribe(subId, propId);

      scope.$watch('uiComponents.config.cameraMode', function (n) {
        scope.show = !!n;
      });
    }
  };
}]);

angular.module('humanUI.config', [])

.constant('BASE_CONFIG', {

  // Bookmark
  bookmarkTour: false,

  // Misc
  annotations: false,
  audio: false,
  info: false,
  loadProgress: true,
  fullscreen: true,

  // Navigation
  pan: true,
  zoomIn: true,
  zoomOut: true,
  center: true,
  cameraMode: true,

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
  nav: ['pan', 'zoomIn', 'zoomOut', 'center', 'cameraMode'],
  zoom: ['zoomIn', 'zoomOut'],
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
  var postContent = false;

  var $get = function ($rootScope, BASE_CONFIG, Human,
            extendConfigFilter, convertTagsFilter, uiParamsFilter) {

    return {

      urlConfig: uiParamsFilter(Human.request.getSearchParams()),
      bookmarkConfig: {},
      contentConfig: {},

      init: function () {
        var configCreator = this;

        // Extend every time a new module is activating
        Human.events.on('modules.activating', function (params) {
          var module = Human.modules.modules[params.moduleId];

          configCreator._buildContentConfig(module);
          configCreator._extend();
          $rootScope.$apply();
        });

        var bookmarkTour = false;
        // Extend when a bookmark tour is restored
        $rootScope.$on('bookmarkTour.state', function (e, state) {
          // Only create config when different
          if(state.bookmarkTour !== bookmarkTour) {
            bookmarkTour = state.bookmarkTour;

            configCreator.bookmarkConfig.bookmarkTour = state.bookmarkTour;
            configCreator._extend();
            $rootScope.$apply();
          }
        });

      },

      _buildContentConfig: function (content) {
        // Backwards compatibility with tags
        var config = convertTagsFilter({}, content.tags);
        // Extend with content's ui prop to get final content config
        extendConfigFilter(config, content.ui || {});
        this.contentConfig = config;
      },

      _extend: function () {
        var config = angular.extend({}, BASE_CONFIG);

        // Extend with content configs and app provided config, in desired order
        var configs = [this.contentConfig, this.bookmarkConfig];
        configs[postContent ? 'push' : 'unshift'](extended);

        for (var i = 0; i < configs.length; i++) {
          extendConfigFilter(config, configs[i]);
        }

        // Finally extend config with search params in url
        extendConfigFilter(config, this.urlConfig);

        // Make globally available
        $rootScope.uiComponents.config = config;
      }

    };

  };
  $get.$inject = ['$rootScope', 'BASE_CONFIG', 'Human', 'extendConfigFilter', 'convertTagsFilter', 'uiParamsFilter'];

  return {
    $get: $get,
    // Allow an app to extend BASE_CONFIG, before or after module extension
    extendBase: function (config, _postContent) {
      extended = config;
      postContent = !!_postContent;
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

.directive('humanCameraClip', ['Human', function (Human) {
  var eyeVec = Human.math.vec3();
  var lookVec = Human.math.vec3();
  var tempVec3 = Human.math.vec3();

  var camera = Human.view.camera;
  var startNear = camera.near;

  var getLookDistance = function () {
    eyeVec[0] = camera.eye.x;
    eyeVec[1] = camera.eye.y;
    eyeVec[2] = camera.eye.z;

    lookVec[0] = camera.look.x;
    lookVec[1] = camera.look.y;
    lookVec[2] = camera.look.z;

    Human.math.subVec3(eyeVec, lookVec, tempVec3);

    return Math.abs(Human.math.lenVec3(tempVec3));
  };

  var updateNearPlane = function () {
    Human.properties.set({ 'camera.optics.near': getLookDistance() * 0.75 });
  };

  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/cross-section/camera-clip.html',
    link: function (scope) {
      var setModel = function (value) {
        scope.toggleCameraClip.model = value;
        scope.$apply();
      };

      scope.toggleCameraClip = {
        on: function () {
          Human.events.on('camera.updated', updateNearPlane);
          updateNearPlane();
          setModel(true);
        },
        off: function () {
          Human.events.off('camera.updated', updateNearPlane);
          Human.properties.set({ 'camera.optics.near': startNear });
          setModel(false);
        }
      };

    }
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
        var tag = e.target.nodeName.toLowerCase();
        // Don't trigger if input is in focus
        if (tag !== 'input' && tag !== 'textarea') {
          if(e.which === 70 && e.shiftKey) { fullScreen.toggle(); }
        }
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
        scope.mode = data.active ? 'fullscreen' : 'normalscreen';

        scope.$digest();
      });

      scope.$watch('uiComponents.config.fullscreen', function (n) {
        scope.show = topWindow && !!n;
      });
    }
  };
}])

.directive('windowLink', ['$window', function ($window) {
  return {
    restrict: 'A',
    link: function (scope, element) {
      element.attr('href', $window.location.href);
    }
  };
}])

// HumanWindowLink is grouped with humanFullscreen for historical reasons
// It is the embedded equivalent of humanFullscreen
.directive('humanWindowLink', ['$window', function ($window) {
  var topWindow = $window === $window.top;

  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/fullscreen/window-link.html',
    link: function (scope) {
      scope.$watch('uiComponents.config.fullscreen', function (n) {
        scope.show = !topWindow && !!n;
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

.directive('humanLoadProgress', ['Human', '$timeout', function (Human, $timeout) {
  var DEFAULT_ASSET_TYPES = 'geometry material transform';

  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/load/progress.html',
    link: function (scope, element, attrs) {
      var showAssetTypes = attrs.showAssetTypes || DEFAULT_ASSET_TYPES;

      var show;

      scope.statusText = 'Loading...';
      scope.progressPercent = '0%';

      Human.events.on('modules.activating', function (params) {
        var module = Human.modules.modules[params.moduleId];
        scope.statusText = 'Loading ' + module.displayName + '...';
      });

      Human.events.on('assets.load.start', function () {
        scope.show = show;
        scope.$digest();
      });

      Human.events.on('assets.load.progress', function (data) {
        var ratio = data.receivedAssets / data.requestedAssets;

        scope.progressPercent = Math.floor(ratio * 100) + '%';
        scope.show = show && showAssetTypes.indexOf(data.assetType) >= 0;

        scope.$digest();
      });

      Human.events.on('assets.load.finish', function () {
        $timeout(function () { // Let them see 100
          scope.progressPercent = '0%';
          scope.statusText = '';
          scope.show = false;

          scope.$digest();
        });
      });

      scope.$watch('uiComponents.config.loadProgress', function (n) {
        // Allow a custom class to be applied via config
        if(angular.isString(n) && !element.hasClass(n)) {
          element.addClass(n);
        }

        show = !!n;
      });
    }
  };

}]);

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

.factory('ObjectTree',
  ['ObjectTreeEnabled', 'ObjectTreeSelected', 'ObjectTreeRendered', function (ObjectTreeEnabled, ObjectTreeSelected, ObjectTreeRendered) {
    return {
      getSceneObjects: function (objects) {
        var _objects = [];

        angular.forEach(objects, function (object) {
          _objects = _objects.concat(object.objects);
        });

        return _objects;
      },

      init: function (tree) {
        ObjectTreeRendered.init();
        ObjectTreeEnabled.init(tree);
        ObjectTreeSelected.init(tree);
      }
    };
  }]
)

.factory('ObjectTreeRendered', ['$timeout', 'Tree', 'Human', function ($timeout, Tree, Human) {

  var flagged = {};
  var liQueue = [];
  var assetCount = 0;
  var maxQueueLength = 1;

  var li;

  var paintAndReset = function () {
    for (var i = 0; i < liQueue.length; i++) {
      liQueue[i].addClass('anatomy-rendered');
    }

    liQueue.length = 0;
  };

  var setMaxQueueLength = function () {
    maxQueueLength = Math.floor(assetCount / 100);

    if(maxQueueLength < 1) {
      maxQueueLength = 1;
    }

    if(maxQueueLength > 20) {
      maxQueueLength = 20;
    }
  };

  var updateRenderable = function (object) {
    while(object) {
      if(flagged[object.objectId]) {
        break;
      }

      li = Tree.getLi(object.objectId);

      if(li) {
        liQueue.push(li);

        if(liQueue.length === maxQueueLength) {
          paintAndReset();
        }

        flagged[object.objectId] = true;
      }

      object = object.parent;
    }
  };

  var ObjectTreeRendered = {

    onAssetLoadProgress: function (data) {
      if(assetCount === 0) {
        assetCount = data.requestedAssets;
        setMaxQueueLength();
      }
    },

    onObjectRenderable: function (data) {
      $timeout(function () {
        updateRenderable(Human.scene.objects[ data.objectId ]);
      });
    },

    onAssetAttachFinish: function () {
      paintAndReset(); // Finish outstanding lis
      flagged = {};
      assetCount = 0;
    },

    init: function () {
      Human.events.off('assets.load.progress', this.onAssetLoadProgress);
      Human.events.on('assets.load.progress', this.onAssetLoadProgress);

      Human.events.off('scene.objectRenderable', this.onObjectRenderable);
      Human.events.on('scene.objectRenderable', this.onObjectRenderable);

      Human.events.off('graph.assetAttach.finish', this.onAssetAttachFinish);
      Human.events.on('graph.assetAttach.finish', this.onAssetAttachFinish);
    }
  };

  return ObjectTreeRendered;
}])

.factory('ObjectTreeEnabled', ['$timeout', 'Tree', 'Human', function ($timeout, Tree, Human) {

  var ObjectTreeEnabled = {
    onObjectsShown: function (params) {
      var updatedSet = params['enabledObjectsUpdate'];

      $timeout(function () { // Update async
        Tree.updateState(updatedSet, ObjectTreeEnabled.update);
      });
    },

    update: function (enabled, objectId) {
      var parentLi = Tree.getLi(objectId);

      if(parentLi) {
        parentLi[enabled ? 'addClass' : 'removeClass']('anatomy-enabled');
      }
    },

    onObjectShow: function (e) {
      if(e.target.hasAttribute('object-enabled')) {
        e.stopPropagation();

        var objectId = e.target.getAttribute('object-enabled');

        var parentLi = Tree.getLi(objectId);
        parentLi.toggleClass('anatomy-enabled');

        var enabled = parentLi.hasClass('anatomy-enabled');
        ObjectTreeEnabled.toggleEnabledAnatomy(enabled, objectId);
      }
    },

    toggleEnabledAnatomy: function (enabled, objectId) {
      var object = {};
      object[objectId] = enabled;

      Human.scene.setEnabledObjects({ objects: object });
    },

    init: function (tree) {
      tree.off('click.objectShow', this.onObjectShow);
      tree.on('click.objectShow', this.onObjectShow);

      Human.events.off('scene.objectsShown', this.onObjectsShown);
      Human.events.on('scene.objectsShown', this.onObjectsShown);
    }
  };

  return ObjectTreeEnabled;
}])

.provider('ObjectTreeSelected', function () {

  var _config = { selectOpen: true, deselectClose: true };

  var $get = function ($timeout, Human, Tree, TreeCollapse) {

    var ObjectTreeSelected = {
      throttle: false,

      onObjectsSelected: function (params) { // From Human.events
        var updatedSet = params['selectedObjectsUpdate'];

        $timeout(function () { // Update async
          Tree.updateState(updatedSet, ObjectTreeSelected.update);
        });
      },

      update: function (selected, objectId) {
        var parentLi = Tree.getLi(objectId);
        var target = TreeCollapse.getTarget(parentLi);

        if(parentLi) {
          parentLi[selected ? 'addClass' : 'removeClass']('anatomy-selected');

          if(target) {
            // Open / close all child lists in tree when selecting from scene
            if(_config.selectOpen && selected && !ObjectTreeSelected.throttle) {
              TreeCollapse.show(target, { animate: false });
            }

            if(_config.deselectClose && !selected) {
              TreeCollapse.hide(target, { animate: false });
            }
          }

        }
      },

      onObjectSelect: function (e) { // From UI interaction
        if(e.target.hasAttribute('object-selected')) {
          e.stopPropagation();
          var objectId = e.target.getAttribute('object-selected');
          var parentLi = Tree.getLi(objectId);

          ObjectTreeSelected.throttle = true;
          ObjectTreeSelected.selectAnatomy(objectId);

          var target = TreeCollapse.getTarget(parentLi);

          if(target) {
            TreeCollapse.show(target);
          }
        }
      },

      selectAnatomy: function (objectId) {
        var multiPickEnabled = Human.view.pick.getMultiPickEnabled();

        Human.view.focus.focusObject({
          objectId: objectId,
          replace: !multiPickEnabled,
          flyTo: multiPickEnabled ? 'none' : 'newSelected'
        }, function () {
          ObjectTreeSelected.throttle = false;
        });
      },

      init: function (tree) {
        tree.off('click.objectSelect', this.onObjectSelect);
        tree.on('click.objectSelect', this.onObjectSelect);

        Human.events.off('scene.objectsSelected', this.onObjectsSelected);
        Human.events.on('scene.objectsSelected', this.onObjectsSelected);
      }
    };

    return ObjectTreeSelected;
  };
  $get.$inject = ['$timeout', 'Human', 'Tree', 'TreeCollapse'];

  return {
    $get: $get,
    config: function (extensions) {
      angular.extend(_config, extensions);
    }
  };
})

.directive('objectTree', ['$timeout', 'Human', 'ObjectTree', function ($timeout, Human, ObjectTree) {
  return {
    restrict: 'E',
    templateUrl: 'templates/scene/object-tree.html',
    scope: true,
    transclude: true,
    link: function (scope, element) {
      var tree = element.find('human-tree');

      var setShown = function (show) {
        scope.show = hasRootObjects() && show;
      };

      var hasRootObjects = function () {
        var objects = scope.rootObjects;
        return angular.isArray(objects) && objects.length > 0;
      };

      scope.objectTreeConfig = {
        compile: false,
        compare: true,

        itemId: 'objectId',
        itemClasses: function (object) {
          return {
            'anatomy-enabled': object.shown,
            'anatomy-selected': object.selected
          };
        },

        isLeaf: function (object) {
          return object.isLeaf();
        }
      };

      scope.rootObjects = Human.scene.rootObjects;

      scope.$watchCollection('rootObjects', function (rootObjects) {
        var show;

        if(hasRootObjects()) {
          $timeout(function () { // Init async to not interfere with engine
            scope.sceneObjects = ObjectTree.getSceneObjects(rootObjects);
            ObjectTree.init(tree);
          });
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

.factory('hasAnimations', function () {
  return function () {
    var activeRoot = Human.timeline.activeRoot;

    if(activeRoot) {
      var maps, map, key;

      for (var i = 0; i < activeRoot._chapters.length; i++) {
        maps = activeRoot._chapters[i].maps;

        if(Object.keys(maps).length) {

          for(key in maps) {
            if(maps.hasOwnProperty(key)) {
              map = maps[key];
              if(map.data.timeline !== 'dummy') {
                return true;
              }
            }
          }

        } else {
          return false;
        }

      }
    }

    return false;
  };
})

.factory('hasPlayableTimeline', ['hasAnimations', function (hasAnimations) {
  return function (timeFrame) {
    if(hasAnimations()) {
      return true;
    } else {
      var hasChapters = Object.keys(Human.timeline.chapters).length > 1;
      var hasTimeFrame = timeFrame && timeFrame.lastTime > timeFrame.firstTime;

      return hasChapters && hasTimeFrame;
    }
  };
}])

.factory('assetAttachClass', function () {
  return function (element) {
    Human.events.on('graph.assetAttach.start', function () {
      element.addClass('asset-attach');
    });

    Human.events.on('graph.assetAttach.finish', function () {
      element.removeClass('asset-attach');
    });
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

.directive('humanPlayPause',
  ['$timeout', 'assetAttachClass', 'hasPlayableTimeline', function ($timeout, assetAttachClass, hasPlayableTimeline) {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'templates/timeline/play-pause.html',
      link: function (scope, element) {
        var configShow, timelineShow;

        var setShown = function () {
          scope.show = !!configShow && !!timelineShow;
        };

        assetAttachClass(element);

        // Need to call hasPlayableTimeline async here
        Human.events.on('timeline.timeFrame.updated', function (timeFrame) {
          $timeout(function () {
            timelineShow = hasPlayableTimeline(timeFrame);
            setShown();

            scope.$apply();
          });
        });

        Human.events.on('modules.deactivated', function () {
          scope.show = false;
          scope.$apply();
        });

        scope.$watch('uiComponents.config.playPause', function (n) {
          var config = scope.uiComponents.config;

          // Defer to scrubber and tour first
          configShow = !config.scrubber && !config.tour && !!n;
          setShown();

          if(angular.isObject(n)) { // Send config to playPauseTimeline
            scope.config = n;
          }
        }, true);

      }
    };
  }]
)

.directive('humanChapters',
  ['$window', '$sce', '$timeout', 'Human', 'checkModule', 'translateFilter', function ($window, $sce, $timeout, Human, checkModule, translateFilter) {

    var $$window = angular.element($window);

    return {
      restrict: 'E',
      scope: {
        config: '=?'
      },
      templateUrl: 'templates/timeline/chapters.html',
      link: function (scope, element, attrs) {
        var timeFrame, locale, overflow;

        var mode = attrs.chaptersMode || 'scrubber';

        var checkOverflow = function () {
          overflow = element[0].scrollWidth > element[0].clientWidth;
          element[overflow ? 'addClass' : 'removeClass']('overflow');
        };

        var titleDisplay = function (chapter) {
          if(!scope.titles.hasOwnProperty(chapter.chapterId)) {
            var result = translateFilter(chapter, 'displayName', locale);
            scope.titles[chapter.chapterId] = $sce.trustAsHtml(result);
          }

          return scope.titles[chapter.chapterId];
        };

        scope.titles = {};

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

            $timeout(checkOverflow);

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

        $$window.on('resize', function () {
          $timeout(checkOverflow);
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
  }]
)

.directive('humanScrubber',
  ['$filter', '$timeout', 'Human', 'assetAttachClass', 'hasPlayableTimeline', function ($filter, $timeout, Human, assetAttachClass, hasPlayableTimeline) {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'templates/timeline/scrubber.html',
      link: function (scope, element) {
        var listening = false;

        var timeFrame, curTime, totalTime, configShow, timelineShow;

        var setShown = function () {
          scope.show = !!configShow && !!timelineShow;
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

        var update = function (_timeFrame) {
          timeFrame = _timeFrame;

          // Update slider config params
          scope.config.value = Human.timeline.time;
          scope.config.max   = timeFrame.lastTime;

          if(!listening) {
            listening = true;

            Human.events.on('timeline.playing', function (params) {
              scope.config.value = params.time;
              scope.$digest(); // For performance
            });
          }
        };

        scope.config = {
          change: function (data) { // Callback on scrubber change
            Human.timeline.scrub({
              time: scrubTime(data.fraction)
            });
          },
          label: labelText // Text to display in progress label
        };

        assetAttachClass(element);

        Human.events.on('modules.deactivated', function () {
          scope.show = false;
          scope.$apply();
        });

        // Need to call hasPlayableTimeline async here
        Human.events.on('timeline.timeFrame.updated', function (_timeFrame) {
          $timeout(function () {
            timelineShow = hasPlayableTimeline(_timeFrame);

            if(timelineShow) {
              update(_timeFrame);
            }

            setShown();
            scope.$apply();
          });
        });

        Human.events.on('timeline.chapters.updated', function (chapters) {
          var config = scope.uiComponents.config;

          // When both scrubber and tour configs are true, check chapter length
          if(config.scrubber && config.tour) {
            configShow = chapters.length === 1;
            setShown();
            scope.$apply();
          }
        });

        scope.$watch('uiComponents.config.scrubber', function (n) {
          if(!n || (n && !scope.uiComponents.config.tour)) {
            configShow = !!n;
            setShown();
          }

          setUIConfig(n); // Send config to playPauseTimeline / humanChapters
        }, true);
      }
    };
  }]
)

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

.directive('humanTour', ['$q', '$timeout', 'Human', 'assetAttachClass', function ($q, $timeout, Human, assetAttachClass) {
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

      assetAttachClass(element);

      Human.events.on('modules.deactivated', function () {
        scope.show = false;
        scope.$apply();
      });

      Human.events.on('timeline.chapters.updated', function (chapters) {
        var config = scope.uiComponents.config;

        // Allow humanChapters rendering to happen first
        $timeout(function () {
          timelineShow = chapters.length > 1;

          // When both scrubber and tour configs are true, check chapter length
          if(config.scrubber && config.tour) {
            configShow = timelineShow;
          }

          setShown();
          scope.$apply();
        });
      });

      scope.$watch('uiComponents.config.tour', function (n) {
        if(!n || (n && !scope.uiComponents.config.scrubber)) {
          configShow = !!n;
          setShown();
        }

        setUIConfig(n); // Send configuration to humanChapters
      }, true);
    }
  };
}]);

angular.module('humanUI.tree', [])

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

  var escapeFunc = function (match) {
    return escapeMap[match];
  };

  return function (input) {
    return input.replace(escapeRE, escapeFunc);
  };
})

.factory('Tree', ['$interpolate', function ($interpolate) {
  var object, liClasses, classConfig;

  return {
    collapseTemplate: '<span collapse></span>',

    compare: function (newData, oldData, compare) {
      var toAdd = [];
      var toRemove = [];

      var newIds = {};
      var oldIds = {};

      var i, key, result;

      if(!oldData) {
        result = { toAdd: newData, toRemove: toRemove };
      } else {

        for (i = 0; i < newData.length; i++) {
          newIds[ newData[i][compare] ] = newData[i];
        }

        for (i = 0; i < oldData.length; i++) {
          oldIds[ oldData[i][compare] ] = oldData[i];
        }

        // Add that which is in the new and not in the old
        for(key in newIds) {
          if(newIds.hasOwnProperty(key) && !oldIds.hasOwnProperty(key)) {
            toAdd.push(newIds[key]);
          }
        }

        // Remove that which is in the old and not in the new
        for(key in oldIds) {
          if(oldIds.hasOwnProperty(key) && !newIds.hasOwnProperty(key)) {
            toRemove.push(oldIds[key]);
          }
        }

        result = { toAdd: toAdd, toRemove: toRemove };
      }

      return result;
    },

    buildClasses: function (object, isLeaf, itemClasses) {
      var key;

      liClasses = [];

      classConfig = itemClasses ? itemClasses(object) : {};

      if(isLeaf) {
        classConfig['tree-leaf'] = true;
      }

      for(key in classConfig) {
        if(classConfig.hasOwnProperty(key) && classConfig[key]) {
          liClasses.push(key);
        }
      }

      return liClasses.join(' ');
    },

    _buildDOMString: function (template, objects, config, wrapUl) {
      var str = wrapUl ? '<ul>' : '';
      var isLeaf, liStr, itemId, itemClasses, i;

      if(config.itemId) {
        itemId = ' id="{{' + config.itemId + ' | escapeHtml }}"';
      } else {
        itemId = '';
      }

      var liTemplate = '<li' + itemId + ' class="{{ classes }}">';

      for (i = 0; i < objects.length; i++) {
        object = objects[i];

        isLeaf = config.isLeaf ? config.isLeaf(object) : false;
        itemClasses = config.itemClasses;
        object.classes = this.buildClasses(object, isLeaf, itemClasses);

        liStr = liTemplate + (isLeaf ? '' : this.collapseTemplate) + template;
        liStr = $interpolate(liStr)(object);

        delete object.classes; // Cleanup

        if(!isLeaf) {
          liStr +=
            this._buildDOMString(template, object.objects, config, true);
        }

        str += '</li>' + liStr;
      }

      return str += (wrapUl ? '</ul>' : '');
    },

    buildDOMString: function (template, objects, config, wrapUl) {
      return this._buildDOMString(template, objects, config, wrapUl);
    },

    lis: {},

    buildLis: function (lis) {
      if(lis && lis.length) {
        for (var i = 0; i < lis.length; i++) {
          this.lis[ lis[i].id ] = lis[i];
        }
      }
    },

    emptyLis: function () {
      for(var id in this.lis) {
        if(this.lis.hasOwnProperty(id)) {
          delete this.lis[id];
        }
      }
    },

    getLi: function (id) {
      if(this.lis[id]) {
        return angular.element(this.lis[id]);
      }
    },

    removeLi: function (id) {
      if(this.lis[id]) {
        this.lis[id].remove();

        delete this.lis[id];
      }
    },

    updateState: function (updatedSet, callback) {
      angular.forEach(updatedSet, callback);
    }
  };
}])

// Adopted from bootstrap.js
.factory('TreeCollapse', ['$timeout', function ($timeout) {
  var DEFAULT_OPTIONS = { animate: true };

  return {
    show: function (target, options) {

      if(target.data('transitioning')) {
        return;
      }

      var parentLi = target.parent();

      options = angular.extend({}, DEFAULT_OPTIONS, options);
      var animate = options.animate;

      parentLi.removeClass('collapsed').addClass('opening');

      if(animate) {
        target.addClass('transitioning');
      }

      target.css('height', 0);

      target.data('transitioning', true);
      parentLi.data('collapsed', false);

      var complete = function () {
        if(animate) {
          target.removeClass('transitioning');
        }

        parentLi.addClass('open').removeClass('opening');
        target.css('height', 'auto');

        target.data('transitioning', false);
      };

      if(animate) {
        $timeout(complete, 350);
      } else {
        $timeout(complete);
      }

      target.css('height', target[0].scrollHeight + 'px');
    },

    hide: function (target, options) {
      var _o;

      if(target.data('transitioning')) {
        return;
      }

      var parentLi = target.parent();

      options = angular.extend({}, DEFAULT_OPTIONS, options);
      var animate = options.animate;

      // Force browser calc and paint
      _o = target.css('height', target[0].offsetHeight + 'px')[0].offsetHeight;

      if(animate) {
        target.addClass('transitioning');
      }

      parentLi.removeClass('open').addClass('collapsing');

      target.data('transitioning', true);

      var complete = function () {
        target.data('transitioning', false);

        if(animate) {
          target.removeClass('transitioning');
        }

        parentLi.addClass('collapsed').removeClass('collapsing');
        parentLi.data('collapsed', true);
      };

      target.css('height', 0);

      if(animate) {
        $timeout(complete, 350);
      } else {
        $timeout(complete);
      }
    },

    toggle: function (target) {
      this[target.parent().data('collapsed') ? 'show' : 'hide'](target);
    },

    getTarget: function (parentLi) {
      if(!parentLi) {
        return;
      }

      var siblings = parentLi.children();

      for (var i = 0; i < siblings.length; i++) {
        if(siblings[i].tagName.toLowerCase() === 'ul') {
          return angular.element(siblings[i]);
        }
      }
    },

    globalBind: function (tree) {
      var treeCollapse = this;

      tree.off('click.collapseToggle');

      tree.on('click.collapseToggle', function (e) {
        if(e.target.hasAttribute('collapse')) {
          e.stopPropagation();

          var element = angular.element(e.target);
          var parentLi = element.parent();

          treeCollapse.toggle(treeCollapse.getTarget(parentLi));
        }
      });
    },

    init: function (element) {
      element.find('li').addClass('collapsed').data('collapsed', true);
      element.children().find('ul').css('height', '0px');
    }
  };
}])

.directive('collapse', ['TreeCollapse', function (TreeCollapse) {
  return {
    restrict: 'A',
    link: function (_, element) {
      element.off('click.collapseToggle');

      element.on('click.collapseToggle', function (e) {
        e.stopPropagation();

        var parentLi = element.parent();
        TreeCollapse.toggle(TreeCollapse.getTarget(parentLi));
      });
    }
  };
}])

.directive('humanTree', ['$compile', 'Tree', 'TreeCollapse', function ($compile, Tree, TreeCollapse) {
  return {
    restrict: 'E',
    scope: {
      treeData: '=',
      treeConfig: '='
    },
    compile: function (tElement) {
      var template = tElement[0].innerHTML;
      tElement.empty();

      var postLink = function (scope, element) {

        var buildTree = function (treeData, oldTreeData) {
          var config = scope.treeConfig || {};

          // Compare new and old tree objects based on itemId
          if(config.compare && config.itemId) {
            var result = Tree.compare(treeData, oldTreeData, config.itemId);

            var firstChild, topUl, $root, tree;

            for (var i = 0; i < result.toRemove.length; i++) {
              Tree.removeLi(result.toRemove[i][config.itemId]);
            }

            firstChild = element[0].firstChild;
            topUl = firstChild && firstChild.tagName.toLowerCase() === 'ul';
            $root = topUl ? angular.element(firstChild) : element;

            tree = Tree.buildDOMString(template, result.toAdd, config, !topUl);
            $root.append(tree);
          } else {
            tree = Tree.buildDOMString(template, treeData, config, true);
            element.empty().append(tree);
          }

          // Tree DOM is in place
          if(config.compile === false) {
            TreeCollapse.globalBind(element);
          } else {
            $compile(element.contents())(scope);
          }

          TreeCollapse.init(element);

          Tree.emptyLis();
          Tree.buildLis(element.find('li')); // Store li elements for getting
        };

        scope.$watch('treeData', function (treeData, oldTreeData) {
          if(treeData) {
            buildTree(treeData, oldTreeData);
          }
        });
      };

      return postLink;
    }
  };
}]);

angular.module('humanUI.templates', ['templates/annotations/panel.html', 'templates/bookmark/tour.html', 'templates/camera/center.html', 'templates/camera/mode.html', 'templates/camera/pan.html', 'templates/camera/zoom-in.html', 'templates/camera/zoom-out.html', 'templates/camera/zoom.html', 'templates/cross-section/camera-clip.html', 'templates/cross-section/panel.html', 'templates/cross-section/slider.html', 'templates/dissect/panel.html', 'templates/fullscreen/panel.html', 'templates/fullscreen/window-link.html', 'templates/info/panel.html', 'templates/load/progress.html', 'templates/media/audio.html', 'templates/modes/isolate.html', 'templates/modes/xray.html', 'templates/scene/object-tree.html', 'templates/timeline/chapters.html', 'templates/timeline/play-pause.html', 'templates/timeline/scrubber.html', 'templates/timeline/tour.html', 'templates/ui/slider.html']);

angular.module('templates/annotations/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/annotations/panel.html',
    '<button\n' +
    '  class="tool annotations"\n' +
    '  toggle-button="toggleAnnotations"\n' +
    '  uib-tooltip="Toggle Annotations"\n' +
    '  tooltip-append-to-body="true"></button>');
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

angular.module('templates/camera/center.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/camera/center.html',
    '<div center-camera></div>');
}]);

angular.module('templates/camera/mode.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/camera/mode.html',
    '<div toggle-button="cameraMode"></div>');
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

angular.module('templates/camera/zoom-in.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/camera/zoom-in.html',
    '<div zoom-camera="in">+</div>');
}]);

angular.module('templates/camera/zoom-out.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/camera/zoom-out.html',
    '<div zoom-camera="out">-</div>');
}]);

angular.module('templates/camera/zoom.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/camera/zoom.html',
    '<div zoom-camera="out">-</div>\n' +
    '<div zoom-camera="in">+</div>');
}]);

angular.module('templates/cross-section/camera-clip.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/cross-section/camera-clip.html',
    '<button\n' +
    '  class="tool camera-clip"\n' +
    '  toggle-button="toggleCameraClip"></button>');
}]);

angular.module('templates/cross-section/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/cross-section/panel.html',
    '<button\n' +
    '  class="cross-section tool"\n' +
    '  toggle-button="callbacks"\n' +
    '  tooltip-append-to-body="true"\n' +
    '  uib-tooltip="Cross Section"></button>\n' +
    '\n' +
    '<div class="controls" ng-show="showControls">\n' +
    '  <button\n' +
    '    class="tool"\n' +
    '    cycle-section-plane plane="curPlane"\n' +
    '    uib-tooltip="Select Plane"></button>\n' +
    '\n' +
    '  <human-cross-section-slider></human-cross-section-slider>\n' +
    '  <span class="view">{{ curPlane.view }}</span>\n' +
    '\n' +
    '  <button\n' +
    '    class="tool"\n' +
    '    reset-section-plane\n' +
    '    plane="curPlane"\n' +
    '    uib-tooltip="Reset"></button>\n' +
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
    '  uib-tooltip="Dissect [Ctrl + X]"></button>\n' +
    '\n' +
    '<button\n' +
    '  class="tool dissect-undo"\n' +
    '  undo-dissect\n' +
    '  uib-tooltip="Undo Dissect [Ctrl + Z]"></button>');
}]);

angular.module('templates/fullscreen/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/fullscreen/panel.html',
    '<div toggle-button="toggleFullscreen"></div>');
}]);

angular.module('templates/fullscreen/window-link.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/fullscreen/window-link.html',
    '<a window-link target="_blank"></a>');
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
    '  <span>{{ progressPercent }}</span>\n' +
    '</div>\n' +
    '\n' +
    '<div class="status-text">\n' +
    '  <span>{{ statusText }}</span>\n' +
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
    '  uib-tooltip="Isolate Mode [I]"></button>');
}]);

angular.module('templates/modes/xray.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/modes/xray.html',
    '<button\n' +
    '  class="tool xray"\n' +
    '  toggle-button="toggleXray"\n' +
    '  uib-tooltip="Transparency Mode [T]"></button>');
}]);

angular.module('templates/scene/object-tree.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/scene/object-tree.html',
    '<ng-transclude></ng-transclude>\n' +
    '<human-tree\n' +
    '  tree-data="sceneObjects"\n' +
    '  tree-config="objectTreeConfig">\n' +
    '    <a\n' +
    '      object-selected="{{ objectId | escapeHtml }}"\n' +
    '      title="{{ displayName | escapeHtml }}"\n' +
    '      class="tree-item">\n' +
    '      <span\n' +
    '        object-enabled="{{ objectId | escapeHtml }}"\n' +
    '        class="anatomy-check-icon"></span>{{ displayName | escapeHtml }}\n' +
    '    </a>\n' +
    '</human-tree>');
}]);

angular.module('templates/timeline/chapters.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/timeline/chapters.html',
    '<button\n' +
    '  ng-repeat="chapter in chapters"\n' +
    '  id="{{ chapter.chapterId }}"\n' +
    '  class="chapter"\n' +
    '  ng-class="{ on: $index === curIndex }"\n' +
    '  uib-tooltip-html="titleDisplay(chapter)"\n' +
    '  tooltip-placement="{{ toolTipPos }}"\n' +
    '  title="{{ (showTitles && titleDisplay(chapter)) || \'\' }}"\n' +
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
    '<div><button prev-next-chapter="prev"></button><human-chapters chapters-mode="tour" config="uiConfig"></human-chapters><button prev-next-chapter="next"></button></div>');
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
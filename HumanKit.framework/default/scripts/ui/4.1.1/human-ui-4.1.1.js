/* Human UI 4.1.1
 *
 * (c) 2015 BioDigital, Inc.
 *
 */
 
(function (angular) { 'use strict';

angular.module('humanUI', [
  'humanUI.tree',
  'humanUI.load',
  'humanUI.camera',
  'humanUI.timeline',
  'humanUI.crossSection',
  'humanUI.annotations',
  'humanUI.dissect',
  'humanUI.info',
  'humanUI.media',
  'humanUI.scene',
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
}])

.factory('Human', function () {
  return Human;
})

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
      $sce.trustAsHtml(Human.actions.parse(input)) :
      '';
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
        on = angular.isDefined(state) ? state : !on;
        element[on ? 'addClass' : 'removeClass']('on');
      };

      if(on) { element.addClass('on'); }

      element.on('click', function () {
        setState();

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

      var offsetX, factor, percent;

      var $track    = element.children();
      var $children = $track.children();
      var $progress = $children.eq(0);
      var $handle   = $children.eq(1);

      var track = $track[0];

      var setHandle = function (x, change) {
        factor  = (x / track.offsetWidth);
        percent = (factor * 100) + '%';
        $handle.css('left', percent);
        $progress.css('width', percent);

        // Display returned value in progress label
        if(scope.config.label) { scope.label = scope.config.label(); }

        // Callback fired when slider is changed directly, out of $digest loop
        if(change && scope.config.change) {
          scope.config.change({ x: x, factor: factor });
          scope.config.value = factor * scope.config.max; // Sync config.value
          scope.$apply();
        }
      };

      var onMove = function (e) {
        x = e.clientX - startX;

        if(x < 0) {
          x = 0;
        } else if (x > track.offsetWidth) {
          x = track.offsetWidth;
        }

        setHandle(x, true);
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

        setHandle(x = offsetX, true);
      });

      scope.$watch('config.value', function (n) {
        if(angular.isNumber(n) && angular.isNumber(scope.config.max)) {
          x = (n / scope.config.max) * track.offsetWidth;
          setHandle(x); // TODO: prevent redundant calls
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
    }
  };
}]);

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
    templateUrl: 'templates/camera/zoom.html'
  };
});

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
        max: 1,
        change: function (data) {
          Human.view.clip.setClip({
            state: 'visible',
            progress: data.factor
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
          scope.show = true;
        },
        off: function () {
          setState('clipping');
          scope.show = false;
        }
      };

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

      $document.on('keypress', function (e) {
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

.run(['Fullscreen', function (Fullscreen) {
  var success = Fullscreen.setMethods();
  if(success) { Fullscreen.bindHandlers(); }
}]);

angular.module('humanUI.info', [])

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

.directive('humanLoadProgress', ['Human', 'Process', function (Human, Process) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/load/progress.html',
    link: function (scope) {
      var process = null;
      var curProcess = null;

      scope.show = false;

      // This will hide for file mode, where progress does not increment
      scope.showProgress = function (progress) {
        return angular.isNumber(progress) && progress > 0;
      };

      Human.events.on('processes.started', function (params) {
        scope.curProcess = curProcess = Process.create(params, curProcess);
        if(!scope.show) { scope.show = true; }

        scope.$apply();
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
        Process.destroy(params.processId);
        scope.curProcess = curProcess = curProcess.parentProcess;

        if(!curProcess) { scope.show = false; }

        scope.$apply();
      };

      Human.events.on('processes.finished', finishProcess);
      Human.events.on('processes.failed', finishProcess);
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

    getSupportedSrc: function (clip, modelId) {
      if(pathCache[clip.clipId]) { return pathCache[clip.clipId]; }

      var path = $interpolate(AUDIO_PATH)({ modelId: modelId, src: clip.src });

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
      var modelPromise = $q.defer();
      var module;
      var clips;
      var clip;

      scope.states = { ended: false, muted: false };
      scope.show   = false;

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
          scope.show = false;
        } else {
          clip = clips[ clipIds[0] ]; // Only using first at this point

          modelPromise.promise.then(function (modelId) {
            audioEl.src = Media.getSupportedSrc(clip, modelId);
          });

          scope.show = true;
        }
      });

      Human.events.on('modules.activated', function (_module) {
        module = Human.modules.modules[_module.moduleId];

        if(module.modelIds) {
          // Assuming the first model has the audio data.
          // TODO: This is flawed and brittle, needs state context from engine
          modelPromise.resolve(module.modelIds[0]);
        }
      });
    }
  };
}]);

angular.module('humanUI.scene', [])

.factory('ObjectTree', function () {
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
    }

  };
})

.directive('objectEnabled', ['Tree', function (Tree) {
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
        parentLi = Tree.getLi(element, objectId);

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
          Tree.updateState(updatedSet, updateEnabled);
        });
      }
    }
  };
}])

.directive('objectSelected', ['Human', 'Tree', 'ObjectTree', function (Human, Tree, ObjectTree) {
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
        parentLi = Tree.getLi(element, objectId);

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
          Tree.updateState(updatedSet, updateSelected);
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
      scope.show = false;

      scope.objectTreeConfig = {
        itemId: '{{ objectId }}',
        itemClasses: function (object) {
          return {
            'anatomy-enabled': object.shown,
            'anatomy-selected': object.selected
          };
        }
      };

      Human.events.on('started', function () {
        scope.rootObjects = ObjectTree.getRootObjects(Human.scene.rootObjects);
        scope.show = true;
      });
    }
  };
}]);

angular.module('humanUI.timeline', [])

.run(['$rootScope', 'Human', 'Timeline', function ($rootScope, Human, Timeline) {
  var config = Timeline.config;

  Human.events.on('modules.activated', function (params) {
    var module = Human.modules.activeModules[params.moduleId];

    if(!!module) {
      // Set timeline config based on module data
      angular.forEach(config, function (_value, key) {
        config[key] = module.tags.indexOf(key) > -1;
      });

      config.loop = !!(module.animation && module.animation.loop);
      config.timeFrame = Human.timeline.getTimeFrame();

      // Get and store ui params related to timeline directives
      var getParam = Human.request.getSearchParam;
      config['ui-scrubber'] = getParam('ui-scrubber');
      config['ui-tour'] = getParam('ui-tour');
    }

    $rootScope.$broadcast('timeline.config', config);
  });

  Human.events.on('timeline.chapters.activated', function (chapter) {
    config['chapter-loop'] = !!chapter.loop;
  });
}])

.factory('Timeline', function () {
  return {
    config: {
      'scrubber': null,
      'scrubber-chapters': null,
      'play-controls': null,
      'tour': null,
    },
    // Helper methods to determine directive initialization
    initScrubber: function () {
      var config = this.config;

      return config['ui-scrubber'] === 'true' ||
             config['scrubber'] ||
             config['scrubber-chapters'] ||
             config['play-controls'];
    },
    initTour: function () {
      var config = this.config;

      return !this.initScrubber() &&
              config['ui-tour'] !== 'false' &&
              config['tour'];
    }
  };
})

.directive('playPauseTimeline', ['Human', 'Timeline', function (Human, Timeline) {
  return {
    restrict: 'A',
    scope: {},
    link: function (scope, element) {
      var config = Timeline.config;
      var playing = false; // Need to keep an internal playing state for now.

      var isFinished = function () {
        var msTime = toMs(Human.timeline.time);

        return config.timeFrame !== null &&
          Human.timeline.time !== null &&
          // Allow padding of one frame length to decide if finished
          msTime >= config.timeFrame.lastTime - Human.timeline.FRAME_LENGTH;
      };

      var toMs = function (time) {
        return Math.round(time * 1000) / 1000;
      };

      var play = function () {
        var timeFrame = config.timeFrame;
        var currentTime = Human.timeline.time;
        // Determine if to replay, once last frame reached
        var startTime = isFinished() ? timeFrame.firstTime : currentTime;

        // Need to unpause if timeline/chapters are looping
        if(config.loop || config['chapter-loop']) {
          Human.timeline.unpause();
        } else {
          var playParams = { startTime: startTime, loop: false };
          // Play tours one chapter at a time
          if(config.tour) { playParams.numChapters = 1; }
          Human.timeline.play(playParams);
        }
      };

      element.on('click', function () {
        if (!playing) {
          play();
        } else {
          // Always pause
          Human.timeline.pause();
        }
      });

      var events = { // Events that affect the internal playing state
        played: true,
        playing: true,
        unpaused: true,
        stopped: false,
        paused: false,
        scrubbed: false
      };

      angular.forEach(events, function (value, eventName) {
        Human.events.on('timeline.' + eventName, function () {
          playing = value;
          element[playing ? 'addClass' : 'removeClass']('playing');
        });
      });

    }
  };
}])

.directive('humanScrubberChapters', ['Human', 'checkModule', 'Timeline', function (Human, checkModule, Timeline) {
  return {
    restrict: 'E',
    templateUrl: 'templates/timeline/scrubber-chapters.html',
    link: function (scope, element) {
      var config = Timeline.config;
      var chapters;

      scope.getOffset = function (time) {
        return ((time / config.timeFrame.lastTime) * 100) + '%';
      };

      var init = function () {
        if(!chapters || !config['scrubber-chapters']) { return; }
        scope.chapters = chapters;
        /* Tooltips from ui.bootstrap do not build off of title attribute,
           so only show title if we don't have them */
        scope.showTitles = !checkModule('ui.bootstrap');
      };

      element.on('click', function (e) {
        if(/chapter/.test(e.target.className)) {
          Human.timeline.play({
            startChapterId: e.target.id,
            loop: false,
            numChapters: 1
          });
        }
      });

      scope.$on('human.locale', function (e, locale) {
        scope.locale = locale;
        scope.$apply();
      });

      // Order of events uncertain, so both fire init
      scope.$on('timeline.scrubber-chapters', init);

      Human.events.on('timeline.chapters.updated', function (_chapters) {
        chapters = _chapters;
        init();
      });
    }
  };
}])

.directive('humanScrubber', ['$filter', 'Human', 'Timeline', function ($filter, Human, Timeline) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/timeline/scrubber.html',
    link: function (scope, element) {
      var timeFrame, curTime, totalTime;

      var labelText = function () {
        curTime   = $filter('date')(Human.timeline.time * 1000, 'mm:ss');
        totalTime = $filter('date')(timeFrame.lastTime * 1000, 'mm:ss');

        return curTime + ' / ' + totalTime;
      };

      var scrubTime = function (factor) {
        return timeFrame.firstTime +
               (timeFrame.lastTime - timeFrame.firstTime) * factor;
      };

      var init = function (data) {
        timeFrame = data.timeFrame;

        // Initialize slider config params
        scope.config.value = Human.timeline.time;
        scope.config.max   = timeFrame.lastTime;

        Human.events.on('timeline.playing', function (params) {
          scope.config.value = params.time;
          scope.$apply();
        });

        scope.show = true; // Hook for display
        scope.$apply();
      };

      scope.show = false;

      scope.config = {
        change: function (data) { // Callback on scrubber change
          Human.timeline.scrub({
            time: scrubTime(data.factor)
          });
        },
        label: labelText // Text to display in progress label
      };

      scope.$on('timeline.config', function (e, data) {
        if(Timeline.initScrubber()) {
          // Different scrubber states
          if(data['play-controls']) { element.addClass('play-controls'); }

          if(data['scrubber-chapters']) {
            element.addClass('chapters');
            scope.$broadcast('timeline.scrubber-chapters');
          }

          init(data);
        }
      });

      Human.events.on('modules.deactivated', function () {
        scope.show = false;
        scope.$apply();
      });

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

.directive('humanTour', ['$q', 'Human', 'Timeline', function ($q, Human, Timeline) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/timeline/tour.html',
    link: function (scope) {
      var initTour, newChapters;

      var hide = function () {
        scope.show = false;
        scope.$apply();
      };

      var init = function () {
        scope.show = true;
      };

      scope.show = false;

      scope.$on('timeline.config', function () {
        initTour[Timeline.initTour() ? 'resolve' : 'reject']();
      });

      Human.events.on('timeline.chapters.updated', function (chapters) {
        newChapters[chapters.length > 1 ? 'resolve' : 'reject']();
      });

      // Init promises
      Human.events.on('modules.activating', function () {
        initTour = $q.defer();
        newChapters = $q.defer();

        $q.all([initTour.promise, newChapters.promise]).then(init);
      });

      Human.events.on('modules.deactivated', hide);
    }
  };
}]);

angular.module('humanUI.tree', [])

.factory('Tree', ['$interpolate', function ($interpolate) {
  var collapseTemplate = '<span collapse></span>';
  var lis, liClasses, classConfig;

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

    getLi: function (element, id) {
      lis = element.find('li');
      for (var i = 0; i < lis.length; i++) {
        if(lis[i].id === id) {
          return angular.element(lis[i]);
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
            element.append(Tree.buildDOMString(template, n, config));
            $compile(element.contents())(scope);
          }
        });
      };

      return postLink;
    }
  };
}]);

angular.module('humanUI.templates', ['templates/annotations/panel.html', 'templates/camera/pan.html', 'templates/camera/zoom.html', 'templates/cross-section/panel.html', 'templates/cross-section/slider.html', 'templates/dissect/panel.html', 'templates/info/panel.html', 'templates/load/progress.html', 'templates/media/audio.html', 'templates/scene/object-tree.html', 'templates/timeline/scrubber-chapters.html', 'templates/timeline/scrubber.html', 'templates/timeline/tour.html', 'templates/ui/slider.html']);

angular.module('templates/annotations/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/annotations/panel.html',
    '<button\n' +
    '  class="tool annotations"\n' +
    '  toggle-button="toggleAnnotations"\n' +
    '  tooltip="Toggle Annotations"></button>');
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
    '<div class="controls" ng-show="show">\n' +
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

angular.module('templates/scene/object-tree.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/scene/object-tree.html',
    '<ng-transclude></ng-transclude>\n' +
    '<human-tree\n' +
    '  tree-data="rootObjects"\n' +
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

angular.module('templates/timeline/scrubber-chapters.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/timeline/scrubber-chapters.html',
    '<button\n' +
    '  ng-repeat="chapter in chapters"\n' +
    '  id="{{ chapter.chapterId }}"\n' +
    '  class="chapter"\n' +
    '  tooltip="{{ chapter | translate:\'displayName\':locale }}"\n' +
    '  tooltip-placement="left"\n' +
    '  title="{{ showTitles && chapter | translate:\'displayName\':locale }}"\n' +
    '  ng-style="{ left: getOffset(chapter.time) }">{{ $index + 1 }}</button>');
}]);

angular.module('templates/timeline/scrubber.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/timeline/scrubber.html',
    '<button play-pause-timeline></button>\n' +
    '\n' +
    '<human-scrubber-chapters></human-scrubber-chapters>\n' +
    '<human-slider config="config"></human-slider>');
}]);

angular.module('templates/timeline/tour.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/timeline/tour.html',
    '<button prev-next-chapter="prev"></button>\n' +
    '<button prev-next-chapter="next"></button>');
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
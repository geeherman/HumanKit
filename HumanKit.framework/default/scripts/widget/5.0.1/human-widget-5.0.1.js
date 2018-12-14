/* Human Widget 5.0.1
 *
 * (c) 2016 BioDigital, Inc.
 *
 */

(function (window, angular) { 'use strict';

angular.module('humanWidget', [
  'ngTouch',
  'oc.lazyLoad',

  'humanWidget.webgl',
  'humanWidget.pass',
  'humanWidget.fail',
  'humanWidget.files',
  'humanWidget.user',
  'humanWidget.backgroundColor',
  'humanWidget.backgroundImage'
])

.constant('EMBEDDED', window.top !== window)

.run(['$rootScope', 'WebGLTest', 'WindowDimensions', function ($rootScope, WebGLTest, WindowDimensions) {
  WindowDimensions.init();

  WebGLTest.run().then(function (result) {
    $rootScope.$broadcast('human.result', result);
  });
}])

.factory('widgetParams', ['$window', 'dashNormalizeFilter', function ($window, dashNormalizeFilter) {
  var params = {};
  var re = /[?&]+([^=&]+)=([^&]*)/gi;

  $window.location.href.replace(re, function (m, key, value) {
    // normalize keys to dash case
    params[dashNormalizeFilter(key)] = $window.decodeURIComponent(value);
  });

  return params;
}])

.factory('WindowDimensions',
  ['$window', '$document', '$rootScope', '$timeout', function ($window, $document, $rootScope, $timeout) {
    var BREAK_POINTS = [480, 768, 991, $window.Infinity];

    var $body = angular.element($document[0].body);
    var breakPointClasses = [];

    for (var i = 0; i < BREAK_POINTS.length; i++) {
      breakPointClasses.push([ 'lte', BREAK_POINTS[i] ].join('-'));
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
      for (var i = 0; i < BREAK_POINTS.length; i++) {
        if($window.innerWidth <= BREAK_POINTS[i]) {
          if(curBreakPoint !== BREAK_POINTS[i]) {
            setBreakPoint(BREAK_POINTS[i], breakPointClasses[i]);
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

  }]
)

.filter('versionObject', ['$window', function ($window) {
  var partNames = ['major', 'minor', 'patch'];

  return function (versionStr) {
    var parts = versionStr.split('.');
    var object = {};

    if(parts.length === 1) {
      object.custom = true;
      object.name = parts[0];
    }

    angular.forEach(partNames, function (partName, i) {
      object[partName] = object.custom ? null : $window.parseInt(parts[i], 10);

      if(partName === 'patch' && parts[i] && parts[i].split('-').length === 2) {
        object.custom = true;
      }
    });

    object.compareTo = function(maj, min, pat) {
      if (object.name === 'master' || object.name === 'qa') {
        return 1;
      }
      if (object.major > maj) {
        return 1;
      } else if (object.major < maj) {
        return -1;
      }
      if (object.minor > min) {
        return 1;
      } else if (object.minor < min) {
        return -1;
      }
      if (object.patch > pat) {
        return 1;
      } else if (object.patch < pat) {
        return -1;
      }
      return 0;
    };

    return object;
  };
}])

.filter('dashNormalize', function () {
  return function (input) {
    if(/^[a-z]+([_[A-Z])[a-z]+/.test(input)) {
      return input.replace(/([a-z])([A-Z])/g, '$1-$2')
                  .replace(/([a-zA-Z])_/g, '$1-')
                  .toLowerCase();
    } else {
      return input;
    }
  };
})

.controller('MainController', ['$scope', 'EMBEDDED', 'widgetParams', function ($scope, EMBEDDED, widgetParams) {
  $scope.widgetParams = widgetParams;
  $scope.backgroundImage = {};

  $scope.$on('human.result', function (e, result) {
    $scope.embedded = EMBEDDED;
    $scope.pass     = result.pass;
    $scope.result   = result.fullResult;
  });

  $scope.$on('human.moduleData', function (e, moduleData) {
    $scope.moduleData = moduleData;
  });

  $scope.$on('human.fallbackTour', function (e, fallbackTour) {
    $scope.fallbackTour   = fallbackTour;
    $scope.noFallbackTour = !fallbackTour; //need to define this for classes
  });

  //Put backgroundImage state & data on the scope
  $scope.$on('backgroundImage.show', function () {
    $scope.backgroundImage.show = true;
  });

  $scope.$on('backgroundImage.remove', function () {
    $scope.backgroundImage.remove = true;
  });

  $scope.$on('backgroundImage.image', function (e, data) {
    $scope.backgroundImage.load  = !!data; //successful or not
    $scope.backgroundImage.image = data || null; //image data
  });

}])

.directive('moduleError', function () {
  return {
    restrict: 'E',
    template: '<div class="logo-image"></div><p>Sorry, it looks like the module you\'re looking for was not found.</p>',
    scope: true,
    link: function (scope) {

      var init = function () {
        Human.events.on('net.error', function () {
          scope.show = true;
          scope.$apply();
        });
      };

      scope.$on('human.loaded', init);
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
            $document[0].removeEventListener('touchstart', closeElement, true);
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

// Tooltip Directives

.directive('windowTooltipPlacement', ['$parse', function ($parse) {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope, element, attrs) {
      scope.$on('window.breakpoint', function (e, breakpoint) {
        var context = { breakpoint: breakpoint };
        scope.tooltipPlacement = $parse(attrs.windowTooltipPlacement)(context);
      });
    }
  };
}]);

// Unfortunate consequence of lazy loading the UI and having to re-compile
// This is a workaround for tooltips so the uib-tooltip directives
// Won't get compiled twice
(function () {
  var TOOLTIP_DIRECTIVES = ['uibTooltip', 'tooltipPlacement', 'tooltipTrigger'];

  angular.forEach(TOOLTIP_DIRECTIVES, function (tooltipDirective) {

    var proxyDirective = [
      'proxy',
      tooltipDirective[0].toUpperCase() + tooltipDirective.slice(1)
    ].join('');

    angular.module('humanWidget')

    .directive(proxyDirective, ['$timeout', 'dashNormalizeFilter',
      function ($timeout, dashNormalizeFilter) {
        var compiledEls = [];
        var proxyAttr = dashNormalizeFilter(proxyDirective);

        return {
          restrict: 'A',
          compile: function (tElement, tAttrs) {
            if(compiledEls.indexOf(tElement[0]) > -1) {
              return;
            }

            var title = tAttrs[proxyDirective];

            $timeout(function () {
              tElement.removeAttr(proxyAttr);
            });

            compiledEls.push(tElement[0]);

            return function (scope) {
              scope.$on('human.loaded', function () {
                tElement.attr(dashNormalizeFilter(tooltipDirective), title);
              });
            };

          }
        };
      }
    ]);

  });

})();

//This is adapted from Human.renderer - that code will not be able
//to execute soon enough, so it is being done here, first...

//TODO: To avoid this duplication, part of the engine should be
//abstracted out to run immediately and regardless of whether webgl is supported

angular.module('humanWidget.backgroundColor', [])

.run(['BackgroundColor', function (BackgroundColor) {
  BackgroundColor.init();
}])

.provider('BackgroundColor', function () {

  var _config = {
    color: '0.13, 0.15, 0.17, 0.54, 0.58, 0.64',
    gradient: 'radial'
  };

  var config = function (object) {
    angular.extend(_config, object);
  };

  var $get = ['$document', 'widgetParams', function ($document, widgetParams) {
    return {

      _is256Scale: function (channels) {
        for (var i = 0; i < channels.length; i++) {
          if(parseFloat(channels[i]) > 1) return true;
        }

        return false;
      },

      _cssRGB: function (arr, multiply) {
        multiply = typeof multiply === 'boolean' ? multiply : true;
        var values = [];

        for(var i = 0; i < arr.length; i++) {
          values.push(Math.round(arr[i] * (multiply ? 255 : 1)));
        }

        return "rgb(" + values.join(',') + ")";
      },

      _getGradient: function (bgColor) {
        var colors = [],
            channels = bgColor.split(","),
            multiply = !this._is256Scale(channels);

        //backwards compatibility for 16 length arrays
        var endSlice = channels.length > 12 ? channels.length - 1 : channels.length;

        colors[0] = channels.slice(0,3);
        colors[1] = channels.slice(endSlice - 3, endSlice);

        //convert channels to css rgb value
        for (var i = 0; i < colors.length; i++) {
          colors[i] = this._cssRGB(colors[i], multiply);
        }

        return colors;
      },

      'get': function () {
        return this._bgColor;
      },

      getCSS: function () {
        return this._css;
      },

      'set': function (bgColor) {
        if(typeof bgColor !== 'string') return;

        var colors = [];

        this._bgColor = bgColor;

        //test for comma separated value; lengths between 3-16
        var csvMatch = bgColor.match(/([\d\.]+,){2,15}[\d\.]+/);

        if(!!csvMatch) {
          this._bgColor = 'custom'; //return 'custom' for future getting
          colors = this._getGradient(csvMatch[0]);
        }
        else if(bgColor === 'standard') {
          colors = this._getGradient(_config.color);
        }
        else {
          colors[0] = colors[1] = bgColor; //css color name
        }

        //store css rule
        this._css = _config.gradient === 'radial' ?
          'radial-gradient(ellipse at center, '  + colors[1] + ' 0%, ' + colors[0] + ' 100%)' :
          'linear-gradient(top, ' + colors[0] + ' 0%, ' + colors[1] + ' 100%)';
      },

      init: function () {
        var bgColor = widgetParams['bgstd'];

        if(!bgColor) {
          var bgCookie = $document[0].cookie.match(/background=([^;\s]*)/);
              bgColor  = bgCookie && bgCookie[1] ? bgCookie[1] : 'standard';
        }

        //bgColor will be from 1. params, 2. cookie, or 3. 'standard'
        this['set'](bgColor);
      }
    };
  }];

  return {
    config: config,
    $get: $get
  };

})

.directive('backgroundColor', ['BackgroundColor', function (BackgroundColor) {
  return {
    restrict: 'AC',
    link: function (scope, element, attrs) {
      //attribute behaviour
      if(angular.isDefined(attrs['backgroundColor'])) {
        var prefixes = ['-webkit-', '-moz-', '-ms-', '-o-', ''];
        var cssRule = BackgroundColor.getCSS();

        for(var i = 0; i < prefixes.length; i++) {
          element.css('background-image', prefixes[i] + cssRule);
        }
      }
      //class behaviour
      else if(element.hasClass('background-color')) {
        var className = ['bg', BackgroundColor.get()].join('-');
        element.addClass(className);
      }
    }
  };
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

.run(['$rootScope', 'widgetParams', 'BackgroundImage', function ($rootScope, widgetParams, BackgroundImage) {
  //decide when and if to initialize Background image
  if(widgetParams['image-display'] === 'fallback') {

    $rootScope.$on('human.result', function (e, data) {
      if(!data.pass) BackgroundImage.init();
    });

  } else {
    BackgroundImage.init();
  }
}])

.factory('BackgroundImage', ['$window', '$timeout', '$rootScope', 'widgetParams', function ($window, $timeout, $rootScope, widgetParams) {
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
      //broadcast new value to the scope
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

      var gender     = widgetParams['s']  || 'male',
          moduleName = widgetParams['m']  || widgetParams['a'],
          bookmarkId = widgetParams['be'] || widgetParams['b'],
          imageSrc   = widgetParams['image-src'];

      $timeout(function () { //allow link phase to occur before firing
        var baseImageSrc;

        if(moduleName || bookmarkId) {
          //it's a module or bookmark, get base image data for service.
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
          //allow base to be overriden by string from widget parameters,
          //otherwise imageSrc will be the same
          if(!imageSrc) imageSrc = angular.copy(baseImageSrc);
        }

        //broadcast initialization with image data
        $rootScope.$broadcast('backgroundImage.init', {
          src:  imageSrc,
          base: baseImageSrc
        });

        $timeout(function () {
          //remove if loading anatomy object w/o imageSrc param specified
          //execute this after code relating to 'backgroundImage.init' event
          if(imageSrc) {
            backgroundImage.show(imageSrc);
          } else {
            backgroundImage.remove();
          }
        });

      });
    }

  };
}])

.directive('sizeBackgroundImage', ['IMAGE_PARAMS', 'BackgroundImage', function (IMAGE_PARAMS, BackgroundImage) {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope) {
      var image, imageOrientation;

      var onContainerUpdate = function (container) {
        if(!image && !imageOrientation) return;

        //provide css hooks via scope for aspect ratio here
        scope.landscape = container.width > container.height;
        scope.portrait  = container.width < container.height;
        scope.square    = container.width === container.height;

        //keep image from stretching beyond its natural dimensions
        if(scope.widgetParams['image-size'] === 'initial') {
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

.directive('backgroundImage', ['$document', '$timeout', 'BackgroundImage', 'backgroundImageUrlFilter', function ($document, $timeout, BackgroundImage, backgroundImageUrlFilter) {
  return {
    restrict: 'A',
    scope: true,
    link: function (scope, element) {
      var currentSrc, ensure;
      scope.show = false;

      //apply background property to element
      var _apply = function (image) {
        var bgProp, msFilter, css;

        if(image) {
          //old IE background backup
          msFilter = "progid:DXImageTransform.Microsoft.AlphaImageLoader(src='" + image.src + "', sizingMethod='scale')";
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
        //clears image data without triggering load failure
        BackgroundImage.set('image', {});
      };

      var show = function (imageSrc) {
        var $image = $(new Image()), error = false, loaded = false;

        scope.loading = true;

        $image.load(function () {
          //only handle if this image is the currently requested one
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
        $image[0].src = currentSrc; //triggers request

        if($image[0].complete) { //ensure trigger for cached
          $timeout(function () {
            if(!loaded) $image.trigger('load');
          });
        }

        if(ensure) $timeout.cancel(ensure);

        ensure = $timeout(function () { //ensure load gets called after 3 secs
          if(!loaded && !error) $image.trigger('load');
        }, 3000);
      };

      scope.$on('backgroundImage.show', function (e, imageSrc) {
        show(imageSrc);
        scope.show = true;
      });

      scope.$on('backgroundImage.hide', function () {
        clearImage(); //clears background property
        scope.show = false;
      });

      scope.$on('backgroundImage.remove', function () {
        element.remove();
      });

    }
  };
}])

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
            //if either dimension is greater than threshold, assign size
            //as 'small' is not needed in url request, it will not be assigned
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
          $$window.off('resize.backgroundImage'); //ensure only set once
          $$window.on('resize.backgroundImage', setContainer);
        }
      });

      scope.$watch('backgroundImage.remove', function (n) {
        if(n) $$window.off('resize.backgroundImage');
      });

    }
  };
}])

.filter('backgroundImageUrl', ['_moduleUrlFilter', '_bookmarkUrlFilter', '_customUrlFilter', function (_moduleUrlFilter, _bookmarkUrlFilter, _customUrlFilter) {
  //Larger filter, delegates to more focused subfilters
  return function (imageSrc, containerSize) {
    var fullUrl;

    if(imageSrc.s) {
      //build a url from provided object
      var filter = imageSrc.src ? _moduleUrlFilter : _bookmarkUrlFilter;
      fullUrl = filter(imageSrc, containerSize);
    }
    else { //we are provided a string via imageSrc param
      fullUrl = _customUrlFilter(imageSrc);
    }

    return fullUrl;
  };
}])

.filter('_moduleUrl', ['SCREENSHOT_SERVICE', function (SCREENSHOT_SERVICE) {
  return function (imageSrc) {
    return SCREENSHOT_SERVICE + '/' + imageSrc.src + '.jpg';
  };
}])

.filter('_bookmarkUrl', ['BOOKMARK_SERVICE', function (BOOKMARK_SERVICE) {
  return function (imageSrc, containerSize) {
    var size = containerSize ? '&size=' + containerSize : '';
    var srcProp = imageSrc.eid ? 'eid' : 'id';
    //insert gender, source property / value, and size
    var paramStr = 's=' + imageSrc.s + '&' + srcProp + '=' + imageSrc[srcProp] + size;

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

    if(imageSrc[0] === '!') { //indicates to get from site's own files
      basePath = '//' + hostName;
      imageSrc = imageSrc.slice(1); //strip !
    } else {
      basePath = SCREENSHOT_SERVICE;
    }
    //allow a full url from anywhere
    return /^(http(s)?:)?\/\//.test(imageSrc) ? imageSrc : [basePath, imageSrc].join('/');
  };
}]);

angular.module('humanWidget.fail', [])

.run(['$rootScope', 'Module', function ($rootScope, Module) {
  
  var _broadcast = function (response) {
    $rootScope.$broadcast('human.moduleData', response ? response.data : null);
  };
  
  $rootScope.$on('human.result', function (e, data) {
    if(!data.pass) {
      Module.get().then(_broadcast, _broadcast.bind(null, null));
    }
  });

}])

.factory('Module', ['$http', 'widgetParams', function ($http, widgetParams) {
  return {
    'get': function () {
      var gender     = widgetParams['s'] || 'male';
      var moduleName = widgetParams['m'] || widgetParams['a'];
      //insert moduleName into fullProduction path if no forward slashes found
      var modulePath = /\//.test(moduleName) ? moduleName : 'production/' + gender + 'Adult/' + moduleName + '.json';

      return $http.get('/content/modules/' + modulePath);
    }
  };
}])

.factory('cacheAssets', ['backgroundImageUrlFilter', '$timeout', function (backgroundImageUrlFilter, $timeout) {
  return function () {
    var assets = [], imgs = [];
    var input = arguments[0];
    var length = arguments[1];

    if(angular.isObject(input) && angular.isDefined(length)) {
      var base = backgroundImageUrlFilter(input);

      for(var i = 1; i < length; i++) {
        assets.push(base.replace(/(\.(\w{3}))$/, ['_', '.$2'].join(i)));
      }
    }
    else if(angular.isArray(input)) {
      assets = input;
    }

		angular.forEach(assets, function (asset) {
			if(angular.isString(asset) || (angular.isObject(asset) && asset.type === 'image')) {
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
				if(iframe) iframe.remove();
				iframe = null;
			};

      scope.$on('fallbackVideo.show', function (e, videoSrc) {
				remove(); //remake iframe every time
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
        //unsuccessful image load after human test failed
        if(isFail(n) && isFail(scope.pass)) loadTileBackground();
      });

      scope.$watch('pass', function (n) {
        //human test fails after an unsuccessful image load
        if(isFail(n) && isFail(scope.backgroundImage.load)) {
          loadTileBackground();
        }
      });
    }
  };
})

.directive('fallbackTour', ['$rootScope', 'BackgroundImage', 'FallbackVideo', 'cacheAssets', function ($rootScope, BackgroundImage, FallbackVideo, cacheAssets) {
  return {
    restrict: 'E',
    scope: true,
    template: '<fallback-tour-controls></fallback-tour-controls>',
    link: function (scope) {
      var baseImageSrc, assetSrc, assets, asset, type;

      var initTour = function (fallback) {
        if(fallback.hasOwnProperty('length')) {
          scope.length = fallback.length; //build asset paths

          if(!!baseImageSrc) cacheAssets(baseImageSrc, fallback.length);
        }
        else if(angular.isArray(fallback.assets)) {
					//assets are given
          assets = fallback.assets;
          scope.length = assets.length;

					cacheAssets(assets);

					//clobber the default image if it's there
					scope.showAsset(scope.getAsset(0));
        }

        if(scope.length > 1) scope.show = true;
      };

      scope.show = false;

			scope.getAsset = function (i) {
				type = 'image'; //assume image

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
          if(i > 0) assetSrc.src = [assetSrc.src, i].join('_');
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

      //only doing tours on modules right now
      scope.$on('human.moduleData', function (e, data) {
				var fallbackTour = data && angular.isObject(data.fallback);
        if(fallbackTour) initTour(data.fallback);
        
				$rootScope.$broadcast('human.fallbackTour', fallbackTour);
      });

      scope.$on('backgroundImage.init', function (e, data) {
        baseImageSrc = data.base;
      });
    }
  };
}])

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
        if(!!scope.checkLimits(dir)) return;
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
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/fail_message.html',
    link: function (scope) {

      var displayDeviceInfo = function (device) {
        if(device) { //get android / ios info
          var _device = /android/i.test(device) ? 'android' : 'ios';

          scope.deviceName = _device === 'android' ? 'Android' : device;

          scope.deviceLink = _device === 'android' ? 'https://play.google.com/store/apps/details?id=com.biodigitalhuman.humanAndroid' : 'https://itunes.apple.com/us/app/biodigital-human-anatomy-health/id771825569';

          scope.imgSrc = _device === 'android' ? 'Android_App_Store_Get_Badge.png': 'Download_on_the_App_Store_Badge_US-UK_135x40.png';
        }
      };

      scope.$watch('result.device', displayDeviceInfo);
    }
  };
});

angular.module('humanWidget.files', [])

.provider('HumanFiles', function () {
  var dependencyPaths = {};
  var dir, lib, libPath, filePaths;

  var _config = { min: false, allowParams: false, basePath: 'scripts' };

  var config = function (object) {
    angular.extend(_config, object);
  };

  var $get = ['$filter', 'DEPENDENCIES', 'widgetParams'];

  var HumanFiles = function ($filter, DEPENDENCIES, widgetParams) {
    var mode = _config.min ? '.min' : '';
    var dependencies = angular.copy(DEPENDENCIES);

    if(_config.allowParams) {
      var overrides = {
        humanEngine: widgetParams['engine-version'] || dependencies.humanEngine,
        humanUI: widgetParams['ui-version'] || dependencies.humanUI
      };

      angular.extend(dependencies, overrides);
    }

    angular.forEach(dependencies, function (version, dependency) {
      dir = dependency.replace('human', '').toLowerCase();
      lib = dependency.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

      libPath   = [_config.basePath, dir, version].join('/');

      filePaths = {
        js:  [libPath, lib + '-' + version + mode + '.js'].join('/'),
        css: $filter('cssPath')({
          mode: mode,
          lib: lib,
          libPath: libPath,
          version: version
        })
      };

      dependencyPaths[dir] = { lib: libPath, files: filePaths };
    });

    var versionObject = $filter('versionObject')(dependencies.humanEngine);
    var humanScripts = [];

    // Engines starting at 5.2.1 have SceneJS in build
    if (versionObject.compareTo(5, 2, 0) < 0) {
      humanScripts.push([dependencyPaths.engine.lib, 'lib', 'scenejs' + mode + '.js'].join('/'));
    }

    // Add engine first
    humanScripts.push(dependencyPaths.engine.files.js);

    if(widgetParams.plugins) {
      var base = [_config.basePath, 'plugins'].join('/');
      var plugins = widgetParams.plugins.split(',');

      angular.forEach(plugins, function (plugin, i) {
        plugin = [base].concat(plugin.split('.')).join('/') + '.js';
        plugins[i] = plugin;
      });

      humanScripts = humanScripts.concat(plugins);
    }

    // Add human-user and ui lib last
    humanScripts.push(
      [_config.basePath, 'user', 'human-user.js'].join('/'),
      dependencyPaths.ui.files.js //keep human-ui last, uses ocLazyLoad
    );

    var humanStyles = [
      dependencyPaths.engine.files.css,
      dependencyPaths.ui.files.css
    ];

    return {
      scripts: _config.humanScripts || humanScripts,
      styles:  _config.humanStyles  || humanStyles
    };
  };

  $get.push(HumanFiles);

  return {
    config: config,
    $get: $get
  };

})

.filter('cssPath', ['versionObjectFilter', function (versionObjectFilter) {
  var DEFAULT = 'css/engine-default.css';
  var hasStylesheet, styleSheet, versionObject;

  return function (data) {
    if(/engine/.test(data.lib)) {
      versionObject = versionObjectFilter(data.version);

      // 4.0.1 is earliest engine with stylesheet
      hasStylesheet = versionObject.custom || versionObject.major > 4 || (versionObject.major === 4 && (versionObject.minor > 0 || versionObject.patch >= 1));
      styleSheet = hasStylesheet ?
        [data.libPath, 'css', 'engine.css'].join('/') :
        DEFAULT;
    } else {
      styleSheet = [data.libPath, 'css', data.lib + '-' + data.version + data.mode + '.css'].join('/');
    }

    return styleSheet;
  };
}]);

angular.module('humanWidget.pass', [])

.constant('INIT_FILE', 'scripts/init/init.js')

.run(['$rootScope', 'HumanBootstrap', function ($rootScope, HumanBootstrap) {

  $rootScope.$on('human.result', function (e, data) {
    if(data.pass) {
      HumanBootstrap.load().then(function () {
        $rootScope.$broadcast('human.ready'); //broadcast ready event on scope
      });
    }

  });
}])

.factory('HumanBootstrap', ['$document', '$q', '$rootScope', '$ocLazyLoad', 'INIT_FILE', 'BackgroundImage', 'HumanFiles', 'widgetParams', 'HumanScene', 'WebGLError', function ($document, $q, $rootScope, $ocLazyLoad, INIT_FILE, BackgroundImage, HumanFiles, widgetParams, HumanScene, WebGLError) {
  var loaded = $q.defer();

  var loadScripts = function (scripts, ok) {
    var humanUI = scripts.pop();
    var scriptsToLoad = scripts.length;

    var loadUI = function () {
      $ocLazyLoad.load(humanUI).then(function () { ok(); });
    };

    var onLoad = function () {
      if(--scriptsToLoad === 0) { loadUI(); }
    };

    var appendScriptTag = function (src) {
      var scriptTag = $document[0].createElement('script');
      scriptTag.async = false;
      scriptTag.src = src;
      scriptTag.onload = onLoad;
      scriptTag.onerror = onLoad;

      $document[0].head.appendChild(scriptTag);
    };

    for(var i = 0; i < scripts.length; i++) {
      appendScriptTag(scripts[i]);
    }
  };

  return {
    init: function () {
      //Engine is loaded by now, Human global is available
      $rootScope.$broadcast('human.loaded');

      //remove image container on start if we disable 'click to interact'
      if(widgetParams['pre'] === 'false') {
        Human.events.on('modules.activated', BackgroundImage.remove);
      }

      WebGLError.init();

      //Add scene loading as a step before firing the 'started' event
      Human.init.step(HumanScene.load.bind(HumanScene));

      //Start the engine, fire ready callback;
      Human.init.start(INIT_FILE, function () {
        loaded.resolve();
      });
    },
    load: function () {
      loadScripts(HumanFiles.scripts, this.init);

      return loaded.promise;
    }
  };
}])

.factory('ObjectTreeDisplay', ['$document', '$rootScope', function ($document, $rootScope) {
  var objectTree = $document[0].querySelector('object-tree');
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

.directive('uiComponent', ['$compile', function ($compile) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var event = attrs.uiComponent || 'ready';

      scope.$on(['human', event].join('.'), function () {
        $compile(element)(scope);
      });
    }
  };
}])

.directive('linkHumanCss', ['$document', 'HumanFiles', function ($document, HumanFiles) {
  return {
    restrict: 'A',
    link: function (scope, element) {
      var unloadedStyles;

      var linkStyleSheet = function (styleSheet) {
        var link = $document[0].createElement('link');

        link.onload = function () {
          unloadedStyles = unloadedStyles - 1;
          if(unloadedStyles === 0) scope.$broadcast('human.cssLinked');
        };

        link.href = styleSheet;
        link.rel  = 'stylesheet';
        link.type = 'text/css';

        element.after(link);
      };

      var linkHumanCss = function () {
        var styleSheets = HumanFiles.styles;
        unloadedStyles = styleSheets.length;

        for (var i = styleSheets.length - 1; i >= 0; i--) {
          linkStyleSheet(styleSheets[i]);
        }
      };

      scope.$on('human.result', function (e, data) {
        if(data.pass) linkHumanCss();
      });
    }
  };
}])

.directive('ieRelinkCss', ['$window', function ($window) {
  return {
    restrict: 'A',
    link: function (scope, element) {

      var relinkCss = function () {
        var _element = element[0];
        var href = _element.href;

        _element.href = '';
        _element.href = href;
      };

      scope.$on('human.cssLinked', function () {
        if('ActiveXObject' in $window) relinkCss();
      });
    }
  };
}])

.directive('clickContainer', ['widgetParams', 'BackgroundImage', function (widgetParams, BackgroundImage) {
  return {
    restrict: 'E',
    scope: true,
    template: '<button>Click to Interact</button>',
    link: function (scope, element) {

      var showInteractButton = function () {
        if(widgetParams['pre'] === 'false') return;

        scope.show = true;

        element.one('click', function () {
          element.remove();
          BackgroundImage.remove();
        });
      };

      scope.$watch('backgroundImage.load', function (n) {
        //successful image load with human test passed
        if(n && scope.pass) showInteractButton();
      });

      scope.$watch('pass', function (n) {
        //human test passed with successful image load
        if(n && scope.backgroundImage.load) showInteractButton();
      });
    }
  };
}])

.directive('expandInfo', ['$document', function ($document) {
  var compiledEls = [];
  var infoExpanded = false;

  var $body = angular.element($document[0].body);
  var $humanInfo = angular.element($document[0].querySelector('[human-info]'));

  return {
    restrict: 'A',
    scope: false,
    link: function (scope, element) {
      if(compiledEls.indexOf(element[0]) >= 0) {
        return;
      } else {
        compiledEls.push(element[0]);
      }

      var toggleExpanded = function (e) {
        // TODO: better way
        if(!$humanInfo.hasClass('has-description') && !infoExpanded) {
          return;
        }

        e.stopPropagation();

        infoExpanded = !infoExpanded;
        $body[infoExpanded ? 'addClass' : 'removeClass']('info-expanded');

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
      action = action === 'on' ? true : ( action === 'off' ? false : undefined);

      element.on('click', function () {
        ObjectTreeDisplay.setDisplay(action);
      });
    }
  };

}])

.directive('timelineTouch', ['$timeout', function ($timeout) {
  var compiled = false;

  return {
    restrict: 'A',
    scope: true,
    link: function (scope) {
      if(compiled) {
        return;
      }

      scope.step = function (dir) {
        $timeout(function () {
          Human.timeline[dir === 1 ? 'next' : 'prev']();
        });
      };

      compiled = true;
    }
  };
}]);

// Interfaces with scripts/human-user.js
angular.module('humanWidget.user', [])

.factory('WidgetActivity', ['$window', '$parse', function ($window, $parse) {

  var success = angular.noop;

  var failure = function (data, widgetMode) {
    var response = angular.fromJson(data.responseText);
    var statusCode = response.error.code;

    var errorData = {
      401: {
        error: 'INVALID_CLIENTID',
        message: (widgetMode['is_devleoper'] ?
        'Client id' : widgetMode['is_user_shared'] ?
          'Uaid' : 'Client/ua id is') + ' missing or invalid'
      },
      403: {
        error: 'DOMAIN_UNREGISTERED',
        message: 'Domain unregistered or not allowed'
      }
    };

    var message = (angular.isObject(response.error) && response.error.message) || null;
    message = $parse(message)({});

    if(angular.isArray(message)) {
      message = message.join(',');
    }

    var makeRedirectUrl = function (error, message) {
      var path = '/widget-auth-error.html';
      var params = 'error=' + error + '&message=' + $window.encodeURIComponent(message);

      return [path, params].join('?');
    };

    switch (statusCode) {
      case 401:
      case 403:
        if(!widgetMode.fullscreen) {
          errorData = errorData[statusCode];
          var redirectUrl = makeRedirectUrl(errorData.error, message || errorData.message);

          $window.location.replace(redirectUrl);
        }
    }
  };

  return {
    record: function (params) {
      if($window.hasOwnProperty('Human_widget_activity')) {
        $window['Human_widget_activity']['record_widget_activity'](params);
      }
    },
    logError: function (message) {
      this.record({ status: 'error', message: message });
    },
    logModuleError: function () {
      this.logError('loadScene - Human.init.step - module = undefined');
    },
    verify: function (config) {
      var _config = { success: success, failure: failure };

      this.record(angular.extend(_config, config || {}));
    }
  };

}]);

angular.module('humanWidget.webgl', [])

.provider('WebGLError', function () {
  var _config = { post: true, log: false, redirect: false };

  var WebGLError = function ($window, $http, widgetParams) {

    var serializeRequest = function (data) {
      var _data = [];

      angular.forEach(data, function (value, key) {
        _data.push([
          $window.encodeURIComponent(key),
          $window.encodeURIComponent(value)
        ].join('='));
      });

      return _data.join('&');
    };

    return {
      init: function () {
        if(widgetParams['no-error-redirect'] === 'true') {
          _config.log = true;
          _config.post = false;
          _config.redirect = false;
        }

        Human.events.once('error', function (error) {
          if(_config.log) {
            $window.console.log(error);
          }

          var log = {
            log: error.log,
            stack: error.stack,
            webglInfo: error.webglInfo
          };

          if(_config.post) {
            var data = {
              category: error.name,
              log: JSON.stringify(log),
              message: error.message
            };

            $http({
              method: 'POST',
              url: '/ws/human-error',
              data: data,
              transformRequest: serializeRequest,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
              }
            });
          }

          if(_config.redirect) {
            var url = 'webgl-error.html?error=' + error.name +
              '&message=[' + error.type + '] ' + error.message;

            $window.location.replace(url);
          }
        });

      }
    };
  };

  var $get = ['$window', '$http', 'widgetParams', WebGLError];

  return {
    $get: $get,
    config: function (object) {
      angular.extend(_config, object);
    }
  };
})

.provider('WebGLTest', function () {

  var _config = { ios: false, android: false };

  var $get = ['$window', '$document', '$q', 'widgetParams'];

  var WebGLTest = function ($window, $document, $q, widgetParams) {
    return {

      evaluateResult: function (result) {

        var allowDevice = function (param, expression) {
          return (widgetParams['_' + param] === 'true' || _config[param]) &&
            new RegExp('^' + expression, 'i').test(result.device);
        };

        var allowIOS = allowDevice('ios', 'iP');
        var allowAndroid = allowDevice('android', 'Android');

        var pass = result.html5 &&
                   result.webgl &&
                   result.human &&
                   (!result.device || allowIOS || allowAndroid);

        return {
          pass: pass,
          fullResult: result
        };
      },

      getDevice: function (ua) {
        var devices = ['iPad', 'iPhone', 'iPod', 'Android'];
        var device = ua.match(new RegExp(devices.join('|'), 'i'));

        return device && device[0];
      },

      supportsHTML5: function () {
        return Modernizr.applicationcache &&
               Modernizr.canvas &&
               Modernizr.hashchange &&
               Modernizr.postmessage;
      },

      supportsWebGL: function () {
        var contextNames = 'webgl experimental-webgl webkit-3d moz-webgl "moz-glweb20';

        var contexts = contextNames.split(' ');
        var canvas = $document[0].createElement('canvas');

        for (var i = 0; i < contexts.length; i++) {
          try {
            if (canvas.getContext(contexts[i])) { return true; }
          }
          catch (e) {}
        }

        return false;
      },

      run: function () {
        var result = $q.defer();

        var html5 = this.supportsHTML5();
        var webgl = html5 && this.supportsWebGL();
        var human = html5 && webgl;

        result.resolve({
          html5: html5,
          webgl: webgl,
          human: human,
          device: this.getDevice($window.navigator.userAgent)
        });

        return result.promise.then(this.evaluateResult);
      }

    };

  };

  $get.push(WebGLTest);

  return {
    $get: $get,
    config: function (object) {
      angular.extend(_config, object);
    }
  };
});


angular.module('humanWidget.templates', ['templates/fail_message.html', 'templates/keypress_modal.html']);

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

})(window, angular);
/* Human Widget 2.0.1
 *
 * (c) 2015 BioDigital, Inc.
 *
 */

(function (window, angular) { 'use strict';

angular.module('humanWidget', [
  'ngTouch',
  'oc.lazyLoad',

  'humanWidget.webglTest',
  'humanWidget.pass',
  'humanWidget.fail',
  'humanWidget.files',
  'humanWidget.user',
  'humanWidget.scene',
  'humanWidget.backgroundColor',
  'humanWidget.backgroundImage'
])

.constant('EMBEDDED', window.top !== window)

.factory('widgetParams', ['$window', 'dashNormalizeFilter', function ($window, dashNormalizeFilter) {
  var params = {};
  var re = /[?&]+([^=&]+)=([^&]*)/gi;

  $window.location.href.replace(re, function (m, key, value) {
    // normalize keys to dash case
    params[dashNormalizeFilter(key)] = $window.decodeURIComponent(value);
  });

  return params;
}])

.run(['$rootScope', 'humanTest', function ($rootScope, humanTest) {
  humanTest.run().then(function (result) {
    $rootScope.$broadcast('human.result', result);
  });
}])

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

.directive('addThisPanel', ['$document', 'widgetParams', function ($document, widgetParams) {
  var scriptSrc = '//s7.addthis.com/js/300/addthis_widget.js#pubid=ra-550aea82137ea04d';

  return {
    template: '\
      <div class="addthis_sharing_toolbox"></div>\
    ',
    link: function () {
      if(widgetParams['ui-share'] === 'true') {
        var scriptTag = $document[0].createElement('script');
        scriptTag.async = 1;
        scriptTag.src = scriptSrc;

        $document[0].body.appendChild(scriptTag);
      }
    }
  };
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

}]);

angular.module('humanScene', [
  'humanScene.moduleManager',
  'humanScene.chapterManager',
])

// Normalize old format to current format
.filter('legacyBookmarkData', ['moduleManager', function (moduleManager) {
  return function (bookmark) {

    bookmark.modules = {};
    bookmark.modules.activeModules = [];
    bookmark.modules.moduleLibs = [];

    if(!angular.isObject(bookmark.objects)) {
      bookmark.objects = {};
    }

    var genderModuleId = moduleManager.getGenderModule(bookmark.objects);

    if(!!genderModuleId) {
      bookmark.modules.activeModules.unshift(genderModuleId);
    }

    return bookmark;
  };
}])

// An attempt to harness some quirks
// To be used with /search/bookmarks/data
.filter('bookmarkData', ['moduleManager', 'legacyBookmarkDataFilter', function (moduleManager, legacyBookmarkDataFilter) {
  return function (data) {

    var bookmark = data.bookmark || null;
    var showObjects = {};
    var _showObjects = data.showObjects || {};
    var basePrefix = null;

    if(!!bookmark) {

      if(!angular.isObject(bookmark.modules)) {
        bookmark = legacyBookmarkDataFilter(bookmark);
      }

      var moduleIds = bookmark.modules.activeModules || [];
      var baseIndex;

      // Extract basePrefix and make sure baseAnatomy is first in array
      if(moduleIds.length) {
        for (var i = 0; i < moduleIds.length; i++) {
          basePrefix = moduleManager.getBase(moduleIds[i]);

          if(basePrefix) {
            baseIndex = i;
            break;
          }
        }

        if(moduleIds.length > 1 && baseIndex !== 0) {
          moduleIds.unshift( moduleIds.splice(baseIndex, 1)[0] );
        }
      }

      // Normalize showObjects to have baseAnatomy prefix.
      // Will need this to decide if the bookmark needs to load base anatomy
      if(Object.keys(_showObjects).length > 0 && basePrefix) {
        var baseExp = new RegExp('^' + basePrefix);
        var key;

        angular.forEach(_showObjects, function (_state, objectId) {
          key = !baseExp.test(objectId) ? [basePrefix, objectId].join('-') : objectId;
          showObjects[key] = true;
        });
      }
      // Make sure bookmark's activeModules synchs with empty showObjects
      else if(basePrefix && moduleIds.length > 0) {
        basePrefix = null;
        moduleIds.shift();
      }

      // Prevents restoring of uneccessary module libs
      if(bookmark.modules.moduleLibs) {
        bookmark.modules.moduleLibs = [];
      }
    }

    return {
      bookmark: bookmark,
      showObjects: showObjects,
      basePrefix: basePrefix
    };

  };
}])

// An attempt to harness some quirks
.filter('anatomySearch', function () {
  return function (results, genderModuleId) {
    var output = {};

    if(results.length) {
      for (var i = 0; i < results.length; i++) {
        if(results[i].groups.length) {
          output.id = results[i].id;

          var system = [
            genderModuleId,
            results[i].groups[0].replace(/\s/g, '_')
          ].join('-');

          if(!/system$/i.test(system)) {
            system += '_System';
          }

          // Ligaments are special!
          if(/ligaments/i.test(system)) {
            system = system.replace(/ligaments/i, 'Ligament');
            output.id = system;
          }

          output.system = system;
          break;
        }
      }
    }

    return output;
  };
})

.factory('humanScene', ['$window', '$q', '$timeout', 'moduleManager', function ($window, $q, $timeout, moduleManager) {

  var _config = {
    // Should return a promise that resolves with content object
    setContent: angular.noop,
    finish: angular.noop
  };

  var _getAncestor = function (objectId, generations, max) {
    var object = Human.scene.getObject(objectId);

    generations = $window.parseInt(generations);
    max = max || 100;

    if(!isNaN(generations)) {
      generations = Math.min(generations, max);

      for (var i = 0; object.parent && i < generations; i++) {
        object = object.parent;
      }
    }

    return object.objectId;
  };

  var setCamera = function (config) {
    var deferred = $q.defer();
    var cameraParams = null;

    if(angular.isString(config)) {
      var _cameraParams = config.split(',');

      if(angular.isArray(_cameraParams) && _cameraParams.length === 6) {
        cameraParams = {
          eye: {
            x: _cameraParams[0],
            y: _cameraParams[1],
            z: _cameraParams[2]
          },
          look: {
            x: _cameraParams[3],
            y: _cameraParams[4],
            z: _cameraParams[5]
          }
        };
      }
    }
    else if(config.selectedObject) {
      cameraParams = { selectedLeafObjects: true };
    }
    else if(config.primaryBase && !config.bookmark) {
      cameraParams = { enabledObjects: true };
    }

    if(angular.isObject(cameraParams)) {
      Human.view.camera.fly.flyTo(cameraParams, deferred.resolve);
    } else {
      deferred.resolve();
    }

    return deferred.promise;
  };

  return {
    config: function (object) {
      angular.extend(_config, object);
    },
    // Load content with configurable setContent
    // Should be added via Human.init.step
    load: function () {
      var scene = this;
      var args = Array.prototype.slice.call(arguments, 0);

      var contentPromise = _config.setContent.apply(scene, args);

      var _load = function (content) {
        if(!!content.id) {
          moduleManager.load(content.id, content.baseAnatomyObjects, !!content.bookmark)
          .then(function () {
            return $timeout(scene.stage.bind(scene, content));
          })
          .then(function () {
            _config.finish.apply(scene, args);
          });
        }
      };

      if(angular.isObject(contentPromise)) {
        contentPromise.then(_load);
      }
    },
    // Post-load scene staging
    stage: function (content) {
      var deferred = $q.defer();

      var resolve = function () {
        var cameraConfig = content.camera || {
          primaryBase: !!moduleManager.primaryBase,
          bookmark: !!content.bookmark,
          selectedObject: !!content.selectedObject
        };

        setCamera(cameraConfig);

        // Do not wait for camera to start engine
        deferred.resolve();
      };

      if(content.selectedObject) {
        Human.view.xray.setEnabled(true);

        var generations = content.generations;

        var selectedObject = !!generations ?
          _getAncestor(content.selectedObject, generations) : content.selectedObject;

        Human.scene.setSelectedObjects({
          objectId: selectedObject,
          select: true
        });

        resolve();
      } else if(content.bookmark) {
        Human.bookmarks.restore(content.bookmark, resolve, true);
      } else {
        resolve();
      }

      return deferred.promise;
    }
  };

}]);

angular.module('humanScene.chapterManager', [])

.factory('chapterManager', function () {

  // Will modify input
  var _stripBaseAnatomyObjects = function (objects) {
    for (var id in objects) {
      if(objects.hasOwnProperty(id)) {
        if(/^(fe)?maleAdult/.test(id)) {
          delete objects[id];
        }
      }
    }
  };

  // Analyze bookmark index to get the chapter we want to apply the bookmark to
  var _getTargetChapter = function (timeline) {
    var targetChapter = null;
    var hasTimeline = angular.isObject(timeline);
    var hasScrub = hasTimeline && angular.isObject(timeline.scrub);

    if(hasScrub) {
      var scrub = timeline.scrub;

      if(scrub.time === 0) {
        targetChapter = Human.timeline.chapterList[0];
      }
      else if(scrub.hasOwnProperty('chapterId')) {
        targetChapter = Human.timeline.chapters[scrub.chapterId];
      }
    }

    return targetChapter;
  };

  return {

    update: function (index, showObjects) {
      // Restore firstChapter to its original conditions
      this.firstChapter.showObjects = this._showObjects;
      this.firstChapter.selectObjects = this._selectObjects;

      var targetChapter = _getTargetChapter(index.timeline);

      if(targetChapter) {
        _stripBaseAnatomyObjects(targetChapter.showObjects);

        angular.extend(targetChapter.showObjects, showObjects);

        if(angular.isObject(index.camera)) {
          angular.forEach(['flyTo', 'jumpTo'], function (prop) {
            if(targetChapter.hasOwnProperty(prop)) {
              targetChapter[prop] = index.camera;
            }
          });
        }
      }
    },

    // Will only be called for bookmarks
    check: function (showObjects) {
      var chapterManager = this;

      Human.events.on('timeline.chapters.updated', function (chapters) {
        if(chapters.length > 0) {
          var firstChapter = chapterManager.firstChapter = chapters[0];

          // Cache for restoration
          chapterManager._showObjects = firstChapter.showObjects;
          chapterManager._selectObjects = firstChapter.selectObjects;

          // Clear for display purposes
          firstChapter.showObjects = {};
          firstChapter.selectObjects = {};

          var chaptersUpdated = false;

          Human.events.on('bookmarks.restored', function (index) {
            if(!chaptersUpdated) {
              chapterManager.update(index, showObjects);
              chaptersUpdated = true;
            }
          });
        }
      });
    }

  };

});

angular.module('humanScene.moduleManager', [])

.factory('moduleManager', ['$q', '$timeout', 'chapterManager', function ($q, $timeout, chapterManager) {

  var _config = {
    onError: angular.noop
  };

  var _mockPromise = function () {
    var deferred = $q.defer();
    deferred.resolve(null);

    return deferred.promise;
  };

  var _filterBaseAnatomyObjects = function (_objects, _exclude) {
    var objects = {};
    var include = !_exclude;

    for (var id in _objects) {
      if(_objects.hasOwnProperty(id)) {
        if(/^(fe)?maleAdult/.test(id) === include) {
          objects[id] = _objects[id];
        }
      }
    }

    return objects;
  };

  // Both base and custom modules use this method to get moduleDefinitions
  var _loadModule = function (id) {
    var deferred = $q.defer();
    var libId = ['embedded', id].join('_');

    Human.modules.db.loadModuleDefinitions(libId, [id], function () {
      var module = Human.modules.modules[id];

      if(!!module) {
        deferred.resolve(module);
      } else {
        _config.onError();
      }
    });

    return deferred.promise;
  };

  // Will trigger the actual loading of binary streams
  var _activateModules = function (moduleIds) {
    var deferred = $q.defer();
    var mode = Human.net.mode;

    // Ensures base anatomy is always streaming, no matter the mode
    var _checkMode = function (moduleId, _mode) {
      if(!!getBase(moduleId) && mode !== 'stream') {
        Human.net.setMode(_mode);
      }
    };

    var _activateModule = function () {
      if(moduleIds.length) {
        var moduleId = moduleIds.shift();

        _checkMode(moduleId, 'stream');

        Human.modules.activateModules({ moduleId: moduleId }, function () {
          _checkMode(moduleId, mode);
          _activateModule();
        });
      } else {
        deferred.resolve();
      }
    };

    $timeout(_activateModule);

    return deferred.promise;
  };

  var _isTour = function (module) {
    var uiConfig = module.ui;
    var tags = module.tags;
    var hasTourTag = tags.indexOf('tour') >= 0;

    return (angular.isObject(uiConfig) && !!uiConfig.tour) || hasTourTag;
  };

  var getBase = function (id) {
    var match = id.match(/((?:fe)?maleAdult)\.json$/);
    return (!!match && match[1]) || null;
  };

  // Analyze showObjects to determine if base anatomy needs to be loaded
  var getGenderModule = function (showObjects) {
    var genderModuleId = null;
    var match;

    for (var id in showObjects) {
      if(showObjects.hasOwnProperty(id)) {
        match = id.match(/^(fe)?maleAdult/);
        if(match) {
          genderModuleId = ['production', match[0], match[0] + '.json']
            .join('/');

          break;
        }
      }
    }

    return genderModuleId;
  };

  return {
    config: function (object) {
      angular.extend(_config, object);
    },
    getBase: getBase,
    getGenderModule: getGenderModule,
    // Public Interface for loading and activating modules,
    // Will handle combos of:
    // Custom module, custom module & base anatomy, base anatomy
    load: function (moduleId, showObjects, bookmark) {
      var deferred = $q.defer();

      var primaryBase = this.primaryBase = !!getBase(moduleId);
      // customShowObjects can come from bookmark or anatomy params
      var customShowObjects = Object.keys(showObjects).length > 0;
      var _streamObjects = {};

      var primaryModule, genderModule, moduleIds, secondaryObjects;

      _loadModule(moduleId)
        // After the primary module definition is loaded, which may be custom or base anatomy
        .then(function (_primaryModule) {
          primaryModule = _primaryModule;

          if(primaryBase) { genderModule = primaryModule; }

          // Set primaryModule's showObjects
          if(bookmark) {
            // Make sure bookmark overrides chapter show/selectObjects as well
            chapterManager.check(showObjects);

            if(_isTour(primaryModule)) {
              // For bookmarked tours we will be using these showObjects
              // As a base for the streamObjects
              _streamObjects = primaryModule.showObjects;
            }

            // This is done for initial display purposes
            // The bookmark restore will handle the display of everything
            primaryModule.showObjects = {};
            primaryModule.selectObjects = {};
          }
          else if(customShowObjects) {
            angular.extend(primaryModule.showObjects, showObjects);
          }

          secondaryObjects = bookmark ? showObjects : primaryModule.showObjects;
          // Ensure only base
          secondaryObjects = _filterBaseAnatomyObjects(secondaryObjects);

          // Determine if we need to load base anatomy as a secondary module
          var secondaryModuleId = primaryBase ?
            null : getGenderModule(secondaryObjects);

          var promise = !!secondaryModuleId ?
            _loadModule(secondaryModuleId) : _mockPromise();

          return promise;
        })
        // After the seconday module definition is loaded,
        // Which will either be base anatomy or nothing
        .then(function (secondaryModule) {
          moduleIds = [primaryModule.moduleId];

          if(!!secondaryModule) {
            genderModule = secondaryModule;
            // Using primary module's showObjects
            secondaryModule.showObjects = {};
            moduleIds.unshift(secondaryModule.moduleId);
          }

          // Decide stream objects for genderModule
          if(genderModule) {
            var streamObjects;

            if(primaryBase) {
              streamObjects = customShowObjects ? showObjects : {};
            } else {
              streamObjects = angular.extend(_streamObjects, secondaryObjects);
            }

            // This will affect the size of the stream file
            genderModule.streamObjects = streamObjects;
          }

          _activateModules(moduleIds).then(deferred.resolve);
        });

      return deferred.promise;
    }
  };
}]);

//This is adapted from Human.renderer - that code will not be able
//to execute soon enough, so it is being done here, first...

//TODO: To avoid this duplication, part of the engine should be
//abstracted out to run immediately and regardless of whether webgl is supported

angular.module('humanWidget.backgroundColor', [])

//Reference to old engine standard bg array
.constant('STANDARD_BG', '0.13, 0.15, 0.17, 0.54, 0.58, 0.64')

.run(['BackgroundColor', function (BackgroundColor) {
  BackgroundColor.init();
}])

.provider('BackgroundColor', ['STANDARD_BG', function (STANDARD_BG) {
  
  var _config = { gradient: 'radial' };

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
          colors = this._getGradient(STANDARD_BG);
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
  
}])

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

.constant('SCREENSHOT_SERVICE', '/screenshots/img')
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
          //it's a module or bookmark:
          //get base image data for service.
          baseImageSrc = { s: gender };

          if(moduleName) { //module
            baseImageSrc.src = moduleName
              .replace(/\//g, '_').replace(/\.json$/, '');

          } else { //bookmark
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

.filter('backgroundImageUrl', ['_conditionUrlFilter', '_bookmarkUrlFilter', '_customUrlFilter', function (_conditionUrlFilter, _bookmarkUrlFilter, _customUrlFilter) {
  //Larger filter, delegates to more focused subfilters
  return function (imageSrc, containerSize) {
    var fullUrl;

    if(imageSrc.s) {
      //build a url from provided object
      var filter = imageSrc.src ? _conditionUrlFilter : _bookmarkUrlFilter;
      fullUrl = filter(imageSrc, containerSize);
    }
    else { //we are provided a string via imageSrc param
      fullUrl = _customUrlFilter(imageSrc);
    }

    return fullUrl;
  };
}])

.filter('_conditionUrl', ['SCREENSHOT_SERVICE', function (SCREENSHOT_SERVICE) {
  return function (imageSrc, containerSize) {
    var size = containerSize ? '_' + containerSize : '';
    //insert gender, src path and size
    return SCREENSHOT_SERVICE + '/t_c_' + imageSrc.s[0] + '_' + imageSrc.src + size + '.jpg';
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

.provider('humanFiles', function () {
  var dependencyPaths = {};
  var dir, lib, libPath, filePaths;

  var _config = { min: false, allowParams: false };

  var config = function (object) {
    angular.extend(_config, object);
  };

  var $get = ['DEPENDENCIES', 'cssPathFilter', 'widgetParams', 'versionObjectFilter', function (DEPENDENCIES, cssPathFilter, widgetParams, versionObjectFilter) {
    var override = _config.allowParams && !!widgetParams['engine-version'];
    var mode = _config.min ? '.min' : '';

    angular.forEach(DEPENDENCIES, function (version, dependency) {
      dir = dependency.replace('human', '').toLowerCase();
      lib = dependency.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

      if(dependency === 'humanEngine' && override) {
        version = widgetParams['engine-version'];
      }

      libPath   = ['scripts', dir, version].join('/');
      filePaths = {
        js:  [libPath, lib + '-' + version + mode + '.js'].join('/'),
        css: cssPathFilter({
          mode: mode,
          lib: lib,
          libPath: libPath,
          version: version
        })
      };

      dependencyPaths[dir] = { lib: libPath, files: filePaths };
    });

    var version = override ? widgetParams['engine-version'] : DEPENDENCIES.humanEngine;
    var versionObject = versionObjectFilter(version);
    var humanScripts = [];

    if (versionObject.compareTo(5, 2, 0) < 0) {
      humanScripts.push([dependencyPaths.engine.lib, 'lib', 'scenejs' + mode + '.js'].join('/'));
    }

    humanScripts.push(
      dependencyPaths.engine.files.js,
      'scripts/user/human-user.js',
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
  }];

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

.factory('HumanBootstrap', ['$document', '$q', '$rootScope', '$ocLazyLoad', 'INIT_FILE', 'BackgroundImage', 'humanFiles', 'humanScene', 'widgetParams', function ($document, $q, $rootScope, $ocLazyLoad, INIT_FILE, BackgroundImage, humanFiles, humanScene, widgetParams) {
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

      //Add scene loading as a step before firing the 'started' event
      Human.init.step(humanScene.load.bind(humanScene));

      //Start the engine, fire ready callback;
      Human.init.start(INIT_FILE, function () {
        loaded.resolve();
      });
    },
    load: function () {
      loadScripts(humanFiles.scripts, this.init);

      return loaded.promise;
    }
  };
}])

.controller('moduleInfoController', ['$scope', '$filter', function ($scope, $filter) {

  var clearScope = function () {
    $scope.curModule   = null;
    $scope.curChapters = null;
    $scope.curChapter  = null;
  };

  clearScope();

  var bindHandlers = function () {
    Human.events.on('modules.activated', function (params) {
      $scope.$apply(function () {
        $scope.curModule = $filter('excludeBaseAnatomy')(Human.modules.activeModules[params.moduleId]) || null;
      });
    });

    Human.events.on('timeline.chapters.updated', function (chapters) {
      $scope.$apply(function () {
        $scope.curChapters = chapters;
      });
    });

    Human.events.on('timeline.chapters.activated', function (params) {
      $scope.$apply(function () {
        $scope.curChapter = $scope.curChapters[params.newChapterIndex] || null;
      });
    });

    Human.events.on('modules.deactivated', function () {
      $scope.$apply(clearScope);
    });
  };

  $scope.toggleHide = true;

  $scope.$on('human.loaded', bindHandlers);
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

.controller('ComponentsController', ['$scope', 'EMBEDDED', 'widgetParams', function ($scope, EMBEDDED, widgetParams) {
  $scope.components = {};

  //our widget specific components,
  //divided by the event that should trigger their display
  var componentsDisplay = {
    'human.result': {
      bd: true
    },
    'human.ready': {
      fs: true,
      keys: false
    }
  };

  var showAll = widgetParams['ui-all'];

  var setComponentsDisplay = function (e) {
    angular.forEach(componentsDisplay[e.name], function (value, key) {
      var show, paramKey = widgetParams['ui-' + key];

      if(showAll && /^(true|false)$/.test(showAll)) {
        show = showAll === 'true';
      } else {
        if(value) { //value is default display state
          show = paramKey !== 'false';
        } else {
          show = paramKey === 'true';
        }
      }

      $scope.components[key] = show;
    });
  };

  $scope.$on('human.result', setComponentsDisplay);
  $scope.$on('human.ready', setComponentsDisplay);
}])

.directive('linkHumanCss', ['$document', 'humanFiles', function ($document, humanFiles) {
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
        var styleSheets = humanFiles.styles;
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

.directive('windowLink', ['$window', function ($window) {
  return {
    restrict: 'A',
    link: function (scope, element) {
      element.attr('href', $window.location.href);
    }
  };
}])

.directive('keypressTrigger', ['$rootScope', function ($rootScope) {
  return {
    restrict: 'A',
    link: function (scope, element) {
      element.on('click', function () {
        $rootScope.$broadcast('keypress.trigger');
      });
    }
  };
}])

.directive('keypressModal', ['widgetParams', function (widgetParams) {
  var init = widgetParams['ui-keys'] === 'true' ||
						 widgetParams['ui-all']  === 'true';

  return {
    restrict: 'E',
    scope: true,
    templateUrl: init && 'templates/keypress_modal.html',
    link: init && function (scope, element) {
      document.getElementById('keypress-frame').src = '/help-keypress.html';

      scope.in = false;

      element.click(function (e) {
        if(e.target === e.currentTarget) {
          scope.in = false;
          scope.$apply();
        }
      });

      scope.$on('keypress.trigger', function () {
        scope.in = true;
        scope.$apply();
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
}]);

angular.module('humanWidget.scene', ['humanScene'])

// Default configuration for a widget's scene
.run(['widgetActivity', 'moduleManager', 'humanScene', 'humanContent', function (widgetActivity, moduleManager, humanScene, humanContent) {

  moduleManager.config({
    onError: widgetActivity.logModuleError.bind(widgetActivity)
  });

  humanScene.config({
    setContent: humanContent.setContent,
    finish: function (startEngine) {
      widgetActivity.verify();
      console.log('Battlestation fully operational.');
      startEngine();
    }
  });

}])

.provider('humanContent', function () {

  var CONTENT_PARAMS = ['a','b','be','m','o'];
  var PRODUCTION_PATH_TEMPLATE = 'production/{0}Adult';

  var _config = { // Default directory is production
    moduleDir: PRODUCTION_PATH_TEMPLATE
  };

  var _makeFullPath = function (id, gender, _path) {
    if(!_path) {
      _path = _config.moduleDir;
    }

    var path = _path.replace('{0}', gender);

    return [path, id + '.json'].join('/');
  };

  var $get = ['$q', '$http', '$filter', '$parse', 'widgetParams', 'widgetActivity'];

  var humanContent = function ($q, $http, $filter, $parse, widgetParams, widgetActivity) {

    var _setM = function (mInput, content) {
      var fullPath = mInput.indexOf('/') >= 0;
      //Construct full path if not entered
      content.id = fullPath ? mInput : _makeFullPath(mInput, content.gender);

      return content;
    };

    var _setO = function (oInput, content, genderModuleId) {
      var objects = oInput.split(',');

      angular.forEach(objects, function (object) {
        var key = object.indexOf('-') >= 0 ?
          object : [genderModuleId, object].join('-');

        content.baseAnatomyObjects[key] = true;
      });

      if(!content.id) {
        // make with production path no matter the configuration
        content.id = _makeFullPath(genderModuleId, content.gender, PRODUCTION_PATH_TEMPLATE);
      }

      return content;
    };

    var _setA = function (aInput, content, genderModuleId) {
      var deferred = $q.defer();

      content.id = _makeFullPath(genderModuleId, content.gender, PRODUCTION_PATH_TEMPLATE);
      //Always on
      var skinSystem = [genderModuleId, 'Integumentary_System'].join('-');
      content.baseAnatomyObjects[skinSystem] = true;

      var _terms = widgetParams.a.split("-");
      var terms = [];

      for (var i = 0; i < _terms.length; i++) {
        if (_terms[i].length > 2) { // Filter small words
          terms.push(_terms[i]);
        }
      }

      var url = '/search/anatomy?q=' + content.gender + '+' + terms.join('+');

      $http.get(url).success(function (data) {
        var results = $filter('anatomySearch')(data.results, genderModuleId);

        content.selectedObject = results.id;
        content.baseAnatomyObjects[results.system] = true;

        deferred.resolve(content);
      });

      return deferred.promise;
    };

    var _setB = function (bInput, bParam, content) {
      var deferred = $q.defer();

      var url = '/search/bookmarks/data?' + bParam + '=' + bInput;

      $http.get(url).success(function (data) {
        // Modify returned data
        data = $filter('bookmarkData')(data);

        if(!!data.bookmark) {
          var moduleIds = data.bookmark.modules.activeModules;
          var adultExp = /Adult$/;

          content.bookmark = data.bookmark;
          content.id = moduleIds[ moduleIds.length - 1];
          content.baseAnatomyObjects = data.showObjects;

          if(adultExp.test(data.basePrefix)) {
            content.gender = data.basePrefix.replace(adultExp, '');
          }

          deferred.resolve(content);
        } else {
          console.log('Bookmark was empty.');
        }

      });

      return deferred.promise;
    };

    // Translate widgetParams to content config object
    var setContent = function () {
      var deferred = $q.defer();

      var content = {
        gender: widgetParams.s === 'female' ? 'female' : 'male',
        baseAnatomyObjects: {},
        bookmark: null,
        camera: widgetParams.camera || null,
        selectedObject: null, // Used with widgetParams.a
        generations: null // Optionally used with selectedObject
      };

      var genderModuleId = content.gender + 'Adult';

      if(widgetParams.m || widgetParams.o) { // Allow m & o to be set together

        if(widgetParams.m) {
          content = _setM(widgetParams.m, content);
        }

        if(widgetParams.o) {
          content = _setO(widgetParams.o, content, genderModuleId);
        }

        deferred.resolve(content);
      }

      else if (widgetParams.a) {
        content.generations = widgetParams.parent || null;

        _setA(widgetParams.a, content, genderModuleId)
          .then(deferred.resolve.bind(deferred, content));
      }

      else if(widgetParams.b || widgetParams.be) {
        var param = !!widgetParams.b ? 'b' : 'be';

        _setB(widgetParams[param], param, content)
          .then(deferred.resolve.bind(deferred, content));
      }

      else {
        var message = 'URL param required: \'{0}\'';
        message = message.replace('{0}', CONTENT_PARAMS.join('|'));

        widgetActivity.logError(message);
        console.log(message);
      }

      return deferred.promise;
    };

    return {
      setContent: setContent
    };

  };

  $get.push(humanContent);

  return {
    $get: $get,
    config: function (object) {
      angular.extend(_config, object);
    }
  };

});

// Interfaces with scripts/human-user.js
angular.module('humanWidget.user', [])

.factory('widgetActivity', ['$window', '$parse', function ($window, $parse) {

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
      var path = 'widget-auth-error.html';
      var params = 'error=' + error + '&message=' + $window.encodeURIComponent(message);

      return [path, params].join('?');
    };

    widgetMode.fullscreen = false;

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

angular.module('humanWidget.webglTest', [])

.provider('humanTest', function () {

  var _config = { ios: false, android: false };

  var humanTest = function ($window, $document, $q, widgetParams) {
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

  var $get = ['$window', '$document', '$q', 'widgetParams', humanTest];

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
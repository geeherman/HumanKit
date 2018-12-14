/*
 * Human Scene Loader v-20
 * Built on 08.15.2018 05:24:31 PM
 * (c) 2018 BioDigital, Inc.
 */

(function (window) {

  var HumanScene = window.HumanScene = {};
  HumanScene.isObject = function (value) {
    return value !== null && typeof value === 'object';
  };

  HumanScene.extend = function () {
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

  HumanScene.isBase = function (id) {
    if('isBase' in window.Human.modules) {
      return window.Human.modules.isBase(id);
    }  else {
      var match = id.match(/^(femaleAdult|maleAdult)/);
      return match && match[0];
    }
  };

  HumanScene.isBaseModule = function (id) {
    if('isBaseModule' in window.Human.modules) {
      return window.Human.modules.isBaseModule(id);
    } else {
      var parts = id.split('/');
      return HumanScene.isBase(parts[parts.length - 1]) ? id : false;
    }
  };

  // Analyze objects to determine if base anatomy needs to be loaded
  HumanScene.getGenderModule = function (objects) {
    var genderModuleId = null;
    var match;

    for (var id in objects) {
      if(objects.hasOwnProperty(id)) {
        match = HumanScene.isBase(id);

        if(match) {
          genderModuleId = ['production', match, match + '.json'].join('/');
          break;
        }
      }
    }

    return genderModuleId;
  };

  HumanScene.getUrlParams = function () {
    var urlParams = {};
    var re = /[?&]+([^=&]+)=([^&]*)/gi;

    window.location.href.replace(re, function (m, key, value) {
      urlParams[key] = window.decodeURIComponent(value);
    });

    return urlParams;
  };

  // Load content with configurable setContent
  HumanScene.load = function (content, success, failure) {

    // Load module from scene graph
    HumanScene.sceneGraph.load(content, function () {
      HumanScene.sceneGraph.stage(content);
      success();
    }, failure);

  };

  /* Current Human.init.start Sequence

  // Load require scripts

  // Start asset server
  // Start renderer
  // Fire 'loaded' event

  // Execute any callbacks - 'steps' ie. HumanScene.load

  // Save reset bookmark
  // Fire 'started' event
  */

  // Deconstructs Human.init.start into two functions
  HumanScene.initEngine = function (callback) {
    window.Human.init.init(callback);
  };

  HumanScene.startEngine = function () {
    window.Human.init.start();
  };

})(window);


// TODO: Write tests
// https://qa.biodigital.com/ws/user/bookmark/public?eid=6sV service

// TODO: Convert Bookmark to first class Module Object
// Bookmark.convertToModule

(function (window) {

  var HumanScene = window.HumanScene;
  var Bookmark = HumanScene.bookmark = {};

  var _inferGender = function(moduleId) {
    if (moduleId.indexOf('/femaleAdult/') >= 0) {
      return 'female';
    } else {
      return 'male';
    }
  };

  var _normalize = function (bookmark) {
    // Normalize activeModules array
    var moduleIds = bookmark.modules.activeModules || [];
    // One and only one moduleId in the activeModules array
    if (moduleIds.length > 1) {
      // Take the first non base anatomy module
      var activeMod;
      var i;
      for (i = 0; i < moduleIds.length; i++) {
        if (!window.Human.modules.isBaseModule(moduleIds[i])) {
          activeMod = moduleIds[i];
          break;
        }
      }
      moduleIds = [activeMod];
    }

    // Prevents restoring of uneccessary module libs
    if(bookmark.modules.moduleLibs) {
      bookmark.modules.moduleLibs = [];
    }
  };

  // Normalize old format to current format
  Bookmark.normalizeLegacy = function (bookmark) {
    bookmark.modules = {};
    bookmark.modules.activeModules = [];
    bookmark.modules.moduleLibs = [];

    if(!HumanScene.isObject(bookmark.objects)) {
      bookmark.objects = {};
    }

    var genderModuleId = HumanScene.getGenderModule(bookmark.objects);

    if(!!genderModuleId) {
      bookmark.modules.activeModules.unshift(genderModuleId);
    }
  };

  // Normalize bookmark tours
  Bookmark.normalizeTour = function (tourCaptures) {
    var capture;
    for (var i = 0; i < tourCaptures.length; i++) {
      capture = tourCaptures[i];
      _normalize(capture);
    }
  };

  // An attempt to harness some quirks
  // To be used with /search/bookmarks/data
  // Only used for legacy, referential bookmarks.
  Bookmark.normalize = function (data) {
    var bookmark = data.bookmark || null;

    // We're not using data.showObjects for two reasons:
    // It's not smart enough for bookmark tours
    // It includes group objects which will most likely
    // result in a heavier base anatomy than necessary.
    var gender = null;

    if (bookmark) {
      // We have an oldie
      if(!HumanScene.isObject(bookmark.modules)) {
        Bookmark.normalizeLegacy(bookmark);
      }

      var isTour = Array.isArray(bookmark.tour) && bookmark.tour.length > 0;

      if(isTour) {
        var tourCaptures = [bookmark].concat(bookmark.tour);
        Bookmark.normalizeTour(tourCaptures);
      } else {
        _normalize(bookmark);
      }

      if (bookmark.modules.activeModules.length > 0) {
        gender = _inferGender(bookmark.modules.activeModules[0]);
      } else {
        gender = 'male'; // Default
      }

    }

    return {
      bookmark: bookmark,
      streamObjects: {},
      gender: gender
    };

  };

})(window);

'use strict';
// TODO: Write tests
(function (window) {

  var HumanScene = window.HumanScene;
  var Content = HumanScene.content = {};

  var DEFAULT_GENDER = 'male'; // :(
  var PRODUCTION_PATH_TEMPLATE = 'production/{0}Adult';

  // Lang specific cache of titles
  var langTitleCache = {};

  var _makeFullPath = function (id, gender, path) {
    path = path || PRODUCTION_PATH_TEMPLATE;
    path = path.replace('{0}', gender || DEFAULT_GENDER);

    return [path, id + '.json'].join('/');
  };

  // An attempt to harness some quirks
  var _anatomySearch = function (results, genderModuleId) {
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

  Content.setModule = function (input, gender) {
    var fullPath = input.indexOf('/') >= 0;

    return {
      id: fullPath ? input : _makeFullPath(input, gender)
    };
  };

  Content.setAnatomy = function (input, gender) {
    input = input || '';
    gender = gender || DEFAULT_GENDER;

    var objects = input.split(',');
    var genderModuleId = gender + 'Adult';
    var baseAnatomyObjects = {};
    var object;

    for (var i = 0; i < objects.length; i++) {
      object = objects[i];

      var key = object.indexOf('-') >= 0 ?
        object : [genderModuleId, object].join('-');

      baseAnatomyObjects[key] = true;
    }

    return { // Always use production path
      id: _makeFullPath(genderModuleId, gender),
      baseAnatomyObjects: baseAnatomyObjects
    };
  };

  Content.setPrettyAnatomy = function (config, success, failure) {
    var input = config.input || '';
    var gender = config.gender || DEFAULT_GENDER;
    var generations = config.generations || null;

    var _terms = input.split('-');
    var terms = [];
    var genderModuleId = gender + 'Adult';
    var baseAnatomyObjects = {};

    for (var i = 0; i < _terms.length; i++) {
      if (_terms[i].length > 2) { // Filter small words
        terms.push(_terms[i]);
      }
    }

    // Always on
    var skinSystem = [genderModuleId, 'Integumentary_System'].join('-');
    baseAnatomyObjects[skinSystem] = true;

    var url = '/search/anatomy?q=' + gender + '+' + terms.join('+');

    var request = new XMLHttpRequest();

    request.onreadystatechange = function () {
      if(request.readyState === XMLHttpRequest.DONE) {

        if(request.status === 200) {
          var response = JSON.parse(request.responseText);
          var results = _anatomySearch(response.results, genderModuleId);

          baseAnatomyObjects[results.system] = true;

          success({
            id: _makeFullPath(genderModuleId, gender),
            baseAnatomyObjects: baseAnatomyObjects,
            selectedObject: results.id,
            generations: generations
          });

        } else {
          failure({ message: 'Error searching anatomy', type: 'search'});
        }

      }
    };

    request.open('GET', url);
    request.send();
  };

  Content.setBookmark = function (param, input, success, failure) {

    var url = '/search/bookmarks/data?' + param + '=' + input;

    var request = new XMLHttpRequest();

    request.onreadystatechange = function () {
      if(request.readyState === XMLHttpRequest.DONE) {

        if(request.status === 200) {
          var response = JSON.parse(request.responseText);

          // Module data
          if (response && response.bookmark && response.bookmark.sceneGraph) {

            HumanScene.extend(contentConfig, {
              id: input,
              moduleData: response.bookmark
            });

            success(contentConfig);
            return;
          }

          // Modify returned data
          response = HumanScene.bookmark.normalize(response);

          if (response.bookmark) {
            var moduleIds = response.bookmark.modules.activeModules;

            success({
              id: moduleIds[ moduleIds.length - 1],
              gender: response.gender,
              baseAnatomyObjects: response.streamObjects,
              bookmark: response.bookmark
            });
          } else {
            failure({
              message: 'Bookmark was empty.',
              type: 'bookmark'
            });
          }

        } else {
          failure({
            message: 'Bookmark does not exist',
            type: 'bookmark'
          });
        }

      }
    };

    request.open('GET', url);
    request.send();
  };

  Content.setCamera = function (input) {
    var camera = null;

    input = input.split(',');

    if(Array.isArray(input) && input.length % 3 === 0) {
      var cameraProps = { 0: 'eye', 3: 'look', 6: 'up' };

      camera = {};

      for (var i = 0; i < input.length; i += 3) {
        if(cameraProps.hasOwnProperty(i)) {
          camera[ cameraProps[i] ] = {
            x: window.parseFloat(input[i]),
            y: window.parseFloat(input[i + 1]),
            z: window.parseFloat(input[i + 2])
          };
        }
      }
    }

    return {
      camera: camera
    };
  };

  var contentConfig = {
    id: null,
    gender: null,
    initialChapter: 0,
    baseAnatomyObjects: {},
    bookmark: null,
    camera: null,
    moduleData: null,
    // Used for pretty anatomy
    selectedObject: null,
    generations: null
  };

  Content.get = function () {
    return contentConfig;
  };

  // Default function, which uses search params to set content config object
  Content.set = function (success, failure) {
    var urlParams = HumanScene.getUrlParams();

    if(urlParams.s) {
      contentConfig.gender = urlParams.s;
    }

    if(urlParams.camera) {
      HumanScene.extend(contentConfig, Content.setCamera(urlParams.camera));
    }

    // Content Types
    if(urlParams.m || urlParams.o) {

      if(urlParams.o) {
        var anatomy = Content.setAnatomy(urlParams.o, contentConfig.gender);
        HumanScene.extend(contentConfig, anatomy);
      }

      // M after O
      if(urlParams.m) {
        var module = Content.setModule(urlParams.m, contentConfig.gender);
        HumanScene.extend(contentConfig, module);
      }

      // TODO: c OR chapter?
      if(urlParams.chapter) {
        // Param input starts from 1
        var initialChapter = window.parseInt(urlParams.chapter, 10) - 1;

        if (initialChapter === initialChapter) { // NaN check
          contentConfig.initialChapter = initialChapter;
        }
      }

      // Lang param
      if (urlParams.lang) {
        HumanScene.extend(contentConfig, { lang: urlParams.lang });
      }

      success(contentConfig);
    } else if (urlParams.a) {

      Content.setPrettyAnatomy({
        input: urlParams.a,
        gender: contentConfig.gender,
        generations: urlParams.parent
      }, function (_contentConfig) {
        success(contentConfig = _contentConfig);
      }, failure);

    } else if(urlParams.b || urlParams.be) {
      var param = !!urlParams.b ? 'b' : 'be';

      Content.setBookmark(param, urlParams[param], function (_contentConfig) {
        success(contentConfig = _contentConfig);
      }, failure);
    } else {
      success(contentConfig); // Empty content config
    }
  };

  /**
  * Sets the specified target language title by English title.
  * @param {String} lang The target language.
  * @param {String} engTitle The source English title.
  * @param {String} langTitle The target language's title.
  */
  Content.setLangTitle = function (lang, engTitle, langTitle) {
    langTitleCache[lang] = langTitleCache[lang] || {};
    langTitleCache[lang][langTitle] = engTitle;
  };

  /**
  * Gets the specified target language title by English title.
  * @param {Object} lang The target language.
  * @param {String} langTitle The target language's source title.
  * @returns {String} Returns the found English language title.
  */
  Content.getLangTitle = function (lang, langTitle) {
    if (langTitleCache.hasOwnProperty(lang)) {
      return langTitleCache[lang][langTitle];
    } else {
      return null;
    }
  };

})(window);

(function (window) {

  var HumanScene = window.HumanScene;
  var SceneGraph = HumanScene.sceneGraph = {};
  var HumanSceneContent = HumanScene.content;

  // Module language services
  var moduleTranslationCache = {};

  var loadedChapters = 0;
  var startTime = 0;

  var numChapters, startBranch;

  var GLOBAL_TYPES = ['reflections', 'lights'];
  var STATIC_TYPES = ['material', 'geometry', 'transform'];
  var DYNAMIC_TYPES = ['tweens', 'morph'];

  function loadChapterAssets (moduleId, content, index, assetTypes, ok) {
    var Human = window.Human;
    var assetObjects = _buildAssetObjects(moduleId, content, index);

    Human.modules.load(moduleId, assetObjects, assetTypes, ok);
  }

  function loadChapter(moduleId, content, index, ok) {
    var Human = window.Human;

    // Initialize first chapter
    if (index === content.initialChapter) {

      // Activate start (by default) chapter only
      // Will also initialize start branch.
      Human.modules.activate(moduleId, startTime, {}, function () {

        loadChapterAssets(moduleId, content, index, STATIC_TYPES, function () {

          loadChapterAssets(
            moduleId, content, index, DYNAMIC_TYPES, function () {

              Human.events.fire('module.interactive', { moduleId: moduleId });
              ok();
            });

        });

      });

    } else {
      // Just load
      loadChapterAssets(moduleId, content, index, STATIC_TYPES, function () {
        loadChapterAssets(moduleId, content, index, DYNAMIC_TYPES, function () {
          ok();
        });
      });
    }
  }

  function loadChapters(moduleId, content, index, success) {

    if (loadedChapters === numChapters) {
      if (success) {
        success();
      }

      return;
    }

    loadChapter(moduleId, content, index, function () {

      loadedChapters++;
      index++;

      if (index === numChapters) {
        index = 0;
      }

      loadChapters(moduleId, content, index, success);
    });
  }

  function extendCamera (dest, src) {
    var destCamera = dest.camera || dest.flyTo || dest.jumpTo;

    if (destCamera) {
      HumanScene.extend(destCamera, src);
    }
  }

  /**
  * Fetches a content module's data.
  * @param {String} lang The target language.
  * @param {String} moduleId The module's ID.
  * @param {Object} moduleData The module data definition.
  * @param {function} ok The post-processing callback.
  */
  function translateModuleData(lang, moduleId, moduleData, ok) {
    if (lang === 'en') {
      setTimeout(function () { ok(moduleData); }, 0);
    } else {
      fetchLangModule(lang, moduleId,
        function (moduleLangDef) {
          transformModule(moduleData, moduleLangDef);
          ok(moduleData);
        },
        function () {
          ok(moduleData);
        });
    }
  }

  /**
  * Fetches the language module for the specific language.
  * @param {String} lang The requested language.
  * @param {String} moduleId The id of the module.
  * @param {function} ok Function executed when languge module found.
  * @param {function} error Function executed when languge module not found.
  */
  function fetchLangModule(lang, moduleId, ok, error) {
    // Get cached translation content
    var moduleLangDef;
    if (moduleTranslationCache[lang]) {
      moduleLangDef = moduleTranslationCache[lang][moduleId];
    }
    if (moduleLangDef) {
      setTimeout(function () { ok(moduleLangDef); }, 0);
    } else {
      var langModuleURL = ['/tr', lang, moduleId].join('/');
      var request = new XMLHttpRequest();
      request.onreadystatechange = function () {
        if (this.readyState === 2 && this.status !== 200) {
          request.abort();
        }
        if (this.readyState === 4) {
          if (this.status === 200) {
            moduleLangDef = JSON.parse(request.responseText);
            // Set cached translation content
            moduleTranslationCache[lang] = moduleTranslationCache[lang] || {};
            moduleTranslationCache[lang][moduleId] = moduleLangDef;
            ok(moduleLangDef);
          } else {
            error();
          }
        }
      };
      request.open('GET', langModuleURL, true);
      request.send();
    }
  }

  /**
  * Transforms the module's text data.
  * (i.e., title, description, chapters, annotations)
  * @param {Object} moduleData The module's data
  * @param {Object} moduleLangDef The translation object
  */
  function transformModule(moduleData, moduleLangDef) {
    var lang = moduleLangDef['iso_639_1'];
    var chapters = moduleData.chapters || [];
    var sceneGraph = moduleData.sceneGraph || [];
    var translatedObjects = moduleLangDef.objects || {};
    var translatedChapters = moduleLangDef.chapters || [];
    var props = ['displayName', 'title', 'description'];
    // Object.displayName = translation.displayName
    var translate = function (object, translation) {
      if (typeof (object) === 'object' && typeof (translation) === 'object') {
        props.forEach(function (prop) {
          // Special case for displayName/title
          var translatedProp;
          if (prop === 'displayName') {
            translatedProp = translation['displayName'] || translation['title'];
          } else {
            translatedProp = translation[prop];
          }
          if (object.hasOwnProperty(prop) && translatedProp) {
            var engProp = object[prop];
            object[prop] = translatedProp;
            // Cache language specific title i.e., eng title -> spanish title
            HumanSceneContent.setLangTitle(lang, engProp, translatedProp);
          }
        });
      }
    };
    // Translate title + description
    translate(moduleData, moduleLangDef);
    // Translate objects
    var translateObject = function (object) {
      var id = object.objectId;
      var translatedDisplayName = translatedObjects[id];
      // Translate object
      if (translatedDisplayName) {
        translate(object, { displayName: translatedDisplayName });
      }
      // Translate children
      if (object.objects) {
        object.objects.forEach(translateObject);
      }
    };
    // Translate scene graph
    sceneGraph.forEach(function (graph) {
      var objects = graph.objects || [];
      objects.forEach(translateObject);
    });
    // Translate chapters
    chapters.forEach(function (chapter, chapterIndex) {
      var translatedChapter = translatedChapters[chapterIndex];
      if (translatedChapter) {
        translate(chapter, translatedChapter);
        // Translate annotations
        var annotations = chapter.annotations || [];
        var translatedAnnotations = translatedChapter.annotations || [];
        annotations.forEach(function (annotation, annotationIndex) {
          var translatedAnnotation = translatedAnnotations[annotationIndex];
          if (translatedAnnotation) {
            translate(annotation, translatedAnnotation);
          }
        });
        // Translate hotspots
        var hotspots = chapter.hotspots || [];
        var translatedHotspots = translatedChapter.hotspots || [];
        hotspots.forEach(function (hotspot, hotspotIndex) {
          var translatedHotspot = translatedHotspots[hotspotIndex];
          if (translatedHotspot) {
            translate(hotspot, translatedHotspot);
          }
        });
      }
    });
    // Translate global hotspots
    var globalHotspots = moduleData.hotspots || [];
    var globalTranslatedHotspots = moduleLangDef.hotspots || [];
    globalHotspots.forEach(function (globalHotspot, hotspotIndex) {
      var globalTranslatedHotspot = globalTranslatedHotspots[hotspotIndex];
      if (globalTranslatedHotspot) {
        translate(globalHotspot, globalTranslatedHotspot);
      }
    });
  }

  SceneGraph.reset = function () {
    var Human = window.Human;
    var content = HumanScene.content.get();

    if (content.bookmark) {
      Human.bookmarks.restore(content.bookmark);
    } else {

      var curBranch = Human.timeline.activeRoot._nowBranch;
      var firstBranch = Human.timeline.activeRoot._chapters[0];

      if (curBranch === firstBranch) {
        firstBranch.init(0, {
          camera: true,
          annotations: true,
          properties: true,
          graph: true,
          particles: true
        }, function () {});
      } else {
        Human.timeline.scrub({ time: 0 });
      }
    }
  };

  SceneGraph.load = function (content, success, failure) {
    var Human = window.Human;

    var moduleId, moduleData;
    if (content.bookmark) {

      Human.bookmarks.restore(content.bookmark, success);
    } else if (content.id) {
      moduleId = content.id;

      var onFetch = function () {
        moduleData = JSON.parse(JSON.stringify(
            Human.modules.moduleData[moduleId]));

        if (content.camera && moduleData.chapters[0]) {
          extendCamera(moduleData.chapters[0], content.camera);
        }

        Human.modules.create(moduleId, moduleData, function () {

          Human.modules.load(moduleId, [],  GLOBAL_TYPES, function () {

            var rootTimeline = window.Human.timeline.rootTimelines[moduleId];

            // Globals used elsewhere in the code
            numChapters = moduleData.chapters.length;
            startBranch = rootTimeline._chapters[content.initialChapter];
            startTime = rootTimeline._times[content.initialChapter];

            loadChapters(moduleId, content, content.initialChapter, success);
          });

        });
      };

      var onFetchFail = function () {
        if (failure) {
          failure();
        }
      };

      // Controlled Module Life Cycle
      if (content.moduleData) {

        // Match fetch callback in engine
        content.moduleData.moduleId = content.id;
        Human.modules.moduleData[content.id] = content.moduleData;

        setTimeout(onFetch, 0);
      } else {
        SceneGraph.fetchModule(content, onFetch, onFetchFail);
      }
    } else {
      success();
    }
  };

  // Timeline play instructions coming from module data
  SceneGraph.initTimeline = function (content) {
    var Human = window.Human;

    var animation = Human.modules.modules[content.id].animation;

    if (startTime === 0 && animation && !Human.utils.isEmpty(animation)) {

      Human.timeline.play(animation);

    } else if (startBranch.animation && startBranch.animation.loop) {

      Human.timeline.play({
        startChapterId: startBranch.id,
        loop: true,
        numChapters: 1
      });

    }

  };

  SceneGraph.stage = function (content) {

    if (!content.id) {
      return;
    }

    var Human = window.Human;

    // Initialize timeline only if unchanged
    if (!content.bookmark && Human.timeline.time === startTime) {
      SceneGraph.initTimeline(content);
    }

    var degrees = Number(Human.request.getSearchParam('load-rotate'));

    if (degrees) {

      var containerEl =
        window.document.getElementById(Human.containerId || Human.CONTAINER_ID);

      var elapsed;

      var rotate = function (data) {
        elapsed = data.timeNow - data.timeLast;
        Human.view.camera.rotateY(degrees * elapsed * 0.001);
      };

      var disableRotate = function () {
        Human.events.off('tick', rotate);

        containerEl.removeEventListener('mousedown', disableRotate);
        containerEl.removeEventListener('touchstart', disableRotate);
      };

      Human.events.on('tick', rotate);

      containerEl.addEventListener('mousedown', disableRotate);
      containerEl.addEventListener('touchstart', disableRotate);
    }

    if (HumanScene.getUrlParams().o) {

      if (Object.keys(content.baseAnatomyObjects).length > 0) {

        var showObjects = _buildShowObjects(content.baseAnatomyObjects);

        Human.scene.setEnabledObjects({ objects: showObjects });
        Human.view.camera.fly.flyTo({ enabledObjects: true });
      }
    }
  };

  /**
  * Fetches a content module's data.
  * @param {Object} content The module content config.
  * @param {function} ok Function executed when module fetched.
  * @param {function} error Function executed when module not found.
  */
  SceneGraph.fetchModule = function (content, ok, error) {
    var moduleId = content.id;
    var lang = content.lang || 'en';
    // Process as normal
    if (lang === 'en') {
      window.Human.modules.fetch(moduleId, ok, error);
    } else {
      var onFetchSuccess = function () {
        var moduleData = window.Human.modules.moduleData[moduleId];
        translateModuleData(lang, moduleId, moduleData, ok);
      };
      window.Human.modules.fetch(moduleId, onFetchSuccess, error);
    }
  };

  /* ObjectId conversions */
  function _buildShowObjects (objects) {
    var showObjects = {};

    for (var objId in objects) {
      if (objects.hasOwnProperty(objId)) {
        var _objId = window.Human.modules.convertBaseAnatomyObjectId(objId);

        showObjects[_objId] = objects[objId];
      }
    }

    return showObjects;
  }

  /* Build Asset Objects data for module loading */
  function _buildAssetObjects(moduleId, content, chapterIndex) {
    var module = window.Human.modules.modules[moduleId];
    var loadObjects = [];
    var showObjects = {};

    if (Object.keys(content.baseAnatomyObjects).length > 0) {

      showObjects = _buildShowObjects(content.baseAnatomyObjects);

    } else if (typeof(chapterIndex) === 'number') {
      showObjects = module.chapters[chapterIndex].showObjects;
    } else {
      showObjects = module.showObjects;
    }

    for (var objId in showObjects) {
      if (showObjects.hasOwnProperty(objId) &&
        showObjects[objId] && !!window.Human.scene.objects[objId]) {
        loadObjects.push(window.Human.scene.objects[objId]);
      }
    }

    return loadObjects;
  }

})(window);
/* Human UI 10.4.2
 *
 * (c) 2017 BioDigital, Inc.
 *
 */
 
(function (angular) { 'use strict';

angular.module('humanUI', [
  'humanUI.config',
  'humanUI.utilities',
  'humanUI.background',
  'humanUI.load',
  'humanUI.camera',
  'humanUI.timeline',
  'humanUI.crossSection',
  'humanUI.annotations',
  'humanUI.hotspots',
  'humanUI.actions',
  'humanUI.parser',
  'humanUI.dissect',
  'humanUI.modes',
  'humanUI.info',
  'humanUI.media',
  'humanUI.scene',
  'humanUI.bookmark',
  'humanUI.fullscreen',
  'humanUI.snapshot',
  'humanUI.rpc',
  'humanUI.templates'
])

.constant('MIN_HUMAN_VERSION', '10.0.0')

.run(['$rootScope', 'Human', 'RpcDefinitions', 'ConfigCreator', function ($rootScope, Human, RpcDefinitions, ConfigCreator) {
  Human.properties.subscribe({
    propId: 'locale',
    callback: function (locale) {
      $rootScope.$broadcast('human.locale', locale);
    }
  });

  ConfigCreator.init();
  RpcDefinitions.init();
}])

.factory('currentModule', ['Human', function (Human) {
  var curModule = {
    id: null,
    data: null
  };

  Human.events.on('modules.activate.start', function (data) {
    if(!Human.modules.activeModules[data.moduleId]) {
      Human.assets.server.getModuleDefinition(data.moduleId,
        function (moduleData) {
          curModule.id = data.moduleId;
          curModule.data = moduleData;
        }
      );
    }
  });

  return curModule;
}])

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
    current = Number(versions[0][label]);
    min = Number(versions[1][label]);

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

// Wrap 'loaded' event in a promise,
// Ensuring we can use it if it's already been fired */
.factory('humanLoaded', ['$q', 'Human', function ($q, Human) {
  var deferred = $q.defer();

  Human.events.on('loaded', function () {
    deferred.resolve();
  });

  return deferred.promise;
}]);


angular.module('humanUI.utilities', [])

.factory('isBaseAnatomy', function () {
  return function (input) {
    var moduleId = angular.isObject(input) ? input.moduleId : input;
    return moduleId ? Human.modules.isBaseModule(moduleId) : false;
  };
})

.factory('touchTarget', ['$document', function ($document) {
  return function (element, callback) {
    element.addEventListener('touchmove', function (e) {
      var touch = e.changedTouches[0];
      var target = $document[0].elementFromPoint(touch.pageX, touch.pageY);

      callback(target);
    });
  };
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

.factory('ElementDisplay', ['OutsideListen', function (OutsideListen) {
  return {
    create: function (config) {
      if(!config.trigger || !config.target) {
        return;
      }

      var action = config.action || 'toggle';
      var capitalizedAction = action[0].toUpperCase() + action.slice(1);
      var eventName = config.eventName || 'element' + capitalizedAction;

      var method = action === 'show' ? 'removeClass' :
        (action === 'hide' ? 'addClass' : 'toggleClass');

      var outsideListen;

      if(config.globalClose) {
        outsideListen = OutsideListen.create(config.target);
        outsideListen.excludedEls = [config.trigger[0], config.target[0]];
      }

      var setDisplay = function (_method) {
        config.target[_method]('ng-hide');

        var on = !config.target.hasClass('ng-hide');

        if(outsideListen) {
          if(on) {
            outsideListen.add(setDisplay.bind(null, 'addClass'));
          } else {
            outsideListen.remove();
          }
        }

        config.trigger.triggerHandler(eventName, on);
        config.target.triggerHandler(eventName, on);
      };

      config.trigger.on('click', setDisplay.bind(null, method));
    }
  };
}])

.factory('OutsideListen', ['$document', function ($document) {
  var OutsideListen = function (element, config) {
    config = config || {};

    this.element = element;
    this.excludedEls = [this.element[0]];

    if(angular.isArray(config.exclude)) {
      angular.forEach(config.exclude, function (selector) {
        var elements = $document[0].querySelectorAll(selector);
        elements = Array.prototype.slice.call(elements);

        this.excludedEls = this.excludedEls.concat(elements);
      }, this);
    }
  };

  OutsideListen.prototype._checkContainment = function (target) {
    for (var i = 0; i < this.excludedEls.length; i++) {
      if(this.excludedEls[i].contains(target)) {
        return true;
      }
    }

    return false;
  };

  OutsideListen.prototype.add = function (callback) {
    var checkOutside = function (e) { // Create new listener here
      if(!this._checkContainment(e.target)) {
        callback();
        this.remove();
      }
    };

    this.checkOutside = checkOutside.bind(this);

    $document[0].addEventListener('touchstart', this.checkOutside, true);
    $document[0].addEventListener('mousedown', this.checkOutside, true);
  };

  OutsideListen.prototype.remove = function () {
    $document[0].removeEventListener('touchstart', this.checkOutside, true);
    $document[0].removeEventListener('mousedown', this.checkOutside, true);

    this.checkOutside = null;
  };

  return {
    create: function (element, config) {
      return new OutsideListen(element, config);
    }
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

.filter('excludeBaseAnatomy', ['isBaseAnatomy', function (isBaseAnatomy) {
  return function (module) {
    return isBaseAnatomy(module) ? null : module;
  };
}])

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

.filter('dashNormalize', function () {
  return function (input) {
    if(/^[a-z]+([_[A-Z])[a-z]+/.test(input)) {
      return input.replace(/([a-z])([A-Z])/g, '$1-$2')
                  .replace(/([a-zA-Z])_/g, '$1-')
                  .toLowerCase();
    }

    return input;
  };
})

.filter('camelCaseNormalize', function () {
  return function (input) {
    if(angular.isString(input)) {
      input = input.replace(/[-_]([a-z])/g, function (match) {
        return match[1].toUpperCase();
      });
    }

    return input;
  };
})

.filter('formatPosition', function () {
  return function (position, format) {
    var result = format === 'array' ? [] : {};
    var order = ['x', 'y', 'z'];

    var i;

    switch (format) {
      case 'array':
        if(position.hasOwnProperty('length')) {
          result = position;
        } else {
          for (i = 0; i < order.length; i++) {
            if(position.hasOwnProperty(order[i])) {
              result.push(position[ order[i] ]);
            }
          }
        }
        break;
      case 'object':
        if(!position.hasOwnProperty('length')) {
          result = position;
        } else {
          for (i = 0; i < position.length; i++) {
            result[ order[i] ] = position[i];
          }
        }
        break;
      default:
        result = position;
    }

    return result;
  };
})

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

angular.module('humanUI.utilities')

.factory('HumanCollection', ['$interpolate', function ($interpolate) {
  var object, liClasses, classConfig;

  var HumanCollection = function (element, config) {
    config = config || {};

    this.element = element;

    this.lis = {};
    this.collapseTemplate = config.collapseTemplate || '<span collapse></span>';

    this.element.data('humanCollection', this);
  };

  var HC = HumanCollection;

  // Class Methods

  HC.create = function (element) {
    return new HC(element);
  };

  HC.compare = function (newData, oldData, compare) {
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
  };

  HC.sort = function (property) {
    return function (a, b) {
      var property1 = a[property].toLowerCase();
      var property2 = b[property].toLowerCase();

      if(property1 < property2) {
        return -1;
      } else if(property1 > property2) {
        return 1;
      } else {
        return 0;
      }
    };
  };

  // Instance Methods

  HC.prototype.buildClasses = function (object, isLeaf, itemClasses) {
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
  };

  HC.prototype._buildObjectGroups = function (objects) {
    var objectGroups = {};
    var letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

    var letter, object, id;

    angular.forEach(letters, function (letter) {
      objectGroups[letter] = [];
    });

    for(id in objects) { // Build
      if(objects.hasOwnProperty(id)) {
        object = objects[id];
        letter = object.displayName[0].toLowerCase();
        objectGroups[letter].push(object);
      }
    }

    var displayNameSort = HC.sort('displayName');

    for(id in objectGroups) { // Sort
      if(objectGroups.hasOwnProperty(id)) {
        objectGroups[id].sort(displayNameSort);
      }
    }

    return objectGroups;
  };

  HC.prototype.buildDOMString = function (template, objects, config) {
    var itemId, itemClasses, liStr, letter, header, i, objectGroup;

    var objectGroups = this._buildObjectGroups(objects);
    var str = '<ul>';

    if(config.itemId) {
      itemId = ' id="{{' + config.itemId + ' | escapeHtml }}"';
    } else {
      itemId = '';
    }

    var liTemplate = '<li' + itemId + ' class="{{ classes }}">';

    for(letter in objectGroups) {
      if(objectGroups.hasOwnProperty(letter)) {
        objectGroup = objectGroups[letter];

        if(objectGroup.length > 0) {
          itemId = 'id="letter-group-' + letter + '"';

          header = '<h1 class="letter-header">';
          header += letter.toUpperCase() + '</h1>';

          str += '<li ' + itemId + ' class="letter-group">' + header + '<ul>';
        }

        for (i = 0; i < objectGroup.length; i++) {
          object = objectGroup[i];

          itemClasses = config.itemClasses;
          object.classes = this.buildClasses(object, false, itemClasses);

          liStr = liTemplate + template;
          liStr = $interpolate(liStr)(object);

          delete object.classes; // Cleanup

          str += liStr + '</li>';
        }

        if(objectGroup.length > 0) {
          str += '</ul></li>';
        }

      }
    }

    return str += '</ul>';
  };

  HC.prototype._buildTreeDOMString =
    function (template, objects, config, wrapUl) {
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
            this._buildTreeDOMString(template, object.objects, config, true);
        }

        str += '</li>' + liStr;
      }

      return str += (wrapUl ? '</ul>' : '');
    };

  HC.prototype.buildTreeDOMString =
    function (template, objects, config, wrapUl) {
      return this._buildTreeDOMString(template, objects, config, wrapUl);
    };

  HC.prototype.buildLis = function (lis) {
    if(lis && lis.length) {
      for (var i = 0; i < lis.length; i++) {
        this.lis[ lis[i].id ] = lis[i];
      }
    }

    this.element.triggerHandler('humanCollection.built');
  };

  HC.prototype.emptyLis = function () {
    for(var id in this.lis) {
      if(this.lis.hasOwnProperty(id)) {
        delete this.lis[id];
      }
    }

    this.element.triggerHandler('humanCollection.emptied');
  };

  HC.prototype.getLi = function (id) {
    if(this.lis[id]) {
      return angular.element(this.lis[id]);
    }
  };

  HC.prototype.removeLi = function (id) {
    if(this.lis[id]) {
      this.lis[id].remove();

      delete this.lis[id];
    }
  };

  return HC;
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

.directive('humanList', ['HumanCollection', function (HumanCollection) {
  return {
    restrict: 'E',
    scope: {
      listData: '=',
      listConfig: '='
    },
    compile: function (tElement) {
      var template = tElement[0].innerHTML;
      tElement.addClass('human-collection').empty();

      var postLink = function (scope, element) {
        var list = HumanCollection.create(element);

        var buildList = function (listData) {
          var config = scope.listConfig || {};
          var listStr = list.buildDOMString(template, listData, config);

          element.empty().append(listStr);

          if(config.letterHeaders) {
            element.addClass('letter-headers');
          }

          list.emptyLis();
          list.buildLis(element.find('li'));
        };

        scope.$watch('listData', function (listData) {
          if(listData) {
            buildList(listData);
          }
        });
      };

      return postLink;
    }
  };
}])

.directive('humanTree', ['$compile', 'HumanCollection', 'TreeCollapse', function ($compile, HumanCollection, TreeCollapse) {
  return {
    restrict: 'E',
    scope: {
      treeData: '=',
      treeConfig: '='
    },
    compile: function (tElement) {
      var template = tElement[0].innerHTML;
      tElement.addClass('human-collection').empty();

      var postLink = function (scope, element) {
        var tree = HumanCollection.create(element);

        var buildTree = function (treeData, oldTreeData) {
          var config = scope.treeConfig || {};
          var treeStr;

          // Compare new and old tree objects based on itemId
          if(config.compare && config.itemId) {
            var result =
              HumanCollection.compare(treeData, oldTreeData, config.itemId);

            var firstChild, topUl, $root;

            for (var i = 0; i < result.toRemove.length; i++) {
              tree.removeLi(result.toRemove[i][config.itemId]);
            }

            firstChild = element[0].firstChild;
            topUl = firstChild && firstChild.tagName.toLowerCase() === 'ul';
            $root = topUl ? angular.element(firstChild) : element;

            treeStr =
              tree.buildTreeDOMString(template, result.toAdd, config, !topUl);

            $root.append(treeStr);
          } else {
            treeStr =
              tree.buildTreeDOMString(template, treeData, config, true);

            element.empty().append(treeStr);
          }

          // Tree DOM is in place
          if(config.compile === false) {
            TreeCollapse.globalBind(element);
          } else {
            $compile(element.contents())(scope);
          }

          TreeCollapse.init(element);

          tree.emptyLis();
          tree.buildLis(element.find('li')); // Store li elements
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

angular.module('humanUI.utilities')

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

      return draggable;
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
}]);

angular.module('humanUI.utilities')

.factory('HumanKeySelect', ['$window', function ($window) {

  var isUpArrow = function (e) {
    return e.key === 'ArrowUp' || e.keyCode === 38 || e.which === 38;
  };

  var isDownArrow = function (e) {
    return e.key === 'ArrowDown' || e.keyCode === 40 || e.which === 40;
  };

  var isEnter = function (e) {
    return e.key === 'Enter' || e.keyCode === 13 || e.which === 13;
  };

  var isVisible = function (item) {
    return item.clientHeight > 0 && item.clientWidth > 0;
  };

  var getOuterHeight = function (element) {
    var height = element.getBoundingClientRect().height;
    var style = $window.getComputedStyle(element);

    var marginProps = ['marginTop', 'marginBottom'];

    for (var i = 0; i < marginProps.length; i++) {
      if(style[ marginProps[i] ] && /px$/.test(style[ marginProps[i] ])) {
        height += $window.parseInt(style[ marginProps[i] ]);
      }
    }

    return height;
  };

  var HumanKeySelect = function ($element, items, config) {
    this.$selectedItem = null;
    this.enabled = false;

    this.$element = $element;
    this.items = this.setItems(items);
    this.config = angular.extend({
      cycle: true,
      selectedClass: 'user-selected',
      onSelected: angular.noop
    }, config);

    this.bindHandlers();
  };

  HumanKeySelect.create = function ($element, items, config) {
    return new HumanKeySelect($element, items, config);
  };

  HumanKeySelect.prototype._findScrollParent = function () {
    // Deduce the items' _scrollParent from a sample item
    var item = this.items[0];
    var _scrollParent = null;

    while(!_scrollParent && item && item !== this.$element[0]) {
      item = item.parentNode;

      if(item && item.scrollHeight > item.clientHeight) {
        _scrollParent = item;
      }
    }

    return _scrollParent;
  };

  HumanKeySelect.prototype._selectItem = function (item) {
    var klass = this.config.selectedClass;

    this._clearSelectedItem();

    if(item) {
      this.$selectedItem = angular.element(item);
      this.$selectedItem.addClass(klass);
    }

    return this.$selectedItem;
  };

  HumanKeySelect.prototype._clearSelectedItem = function () {
    var klass = this.config.selectedClass;

    if(this.$selectedItem) {
      this.$selectedItem.removeClass(klass);
      this.$selectedItem = null;
    }
  };

  HumanKeySelect.prototype._isFirstVisibleItem = function (item) {
    var index = this.items.indexOf(item);

    for (var i = index - 1; i >= 0; i--) {
      if(isVisible(this.items[i])) {
        return false;
      }
    }

    return true;
  };

  HumanKeySelect.prototype._isLastVisibleItem = function (item) {
    var index = this.items.indexOf(item);

    for (var i = index + 1; i < this.items.length; i++) {
      if(isVisible(this.items[i])) {
        return false;
      }
    }

    return true;
  };

  HumanKeySelect.prototype._selectNextItem = function (index) {
    var i;

    for (i = index + 1; i < this.items.length; i++) {
      if(isVisible(this.items[i])) {
        return this._selectItem(this.items[i]);
      }
    }

    if(this.config.cycle) {
      for (i = 0; i < index; i++) {
        if(isVisible(this.items[i])) {
          return this._selectItem(this.items[i]);
        }
      }
    }
  };

  HumanKeySelect.prototype._selectPreviousItem = function (index) {
    var i;

    for (i = index - 1; i >= 0; i--) {
      if(isVisible(this.items[i])) {
        return this._selectItem(this.items[i]);
      }
    }

    if(this.config.cycle) {
      for (i = this.items.length - 1; i > index; i--) {
        if(isVisible(this.items[i])) {
          return this._selectItem(this.items[i]);
        }
      }
    }
  };

  HumanKeySelect.prototype._handleScroll = function (dir, _select) {
    var selectedItem = this.$selectedItem[0];
    var itemHeight = getOuterHeight(selectedItem);
    var marginFactor = 2;

    var itemTop, borderTop, itemBottom, borderBottom;

    // Update scroll when on the margins of view
    itemTop = selectedItem.offsetTop - itemHeight * marginFactor;
    borderTop = this._scrollParent.scrollTop;

    itemBottom = selectedItem.offsetTop + itemHeight * (marginFactor + 1);
    borderBottom =
      this._scrollParent.scrollTop + this._scrollParent.clientHeight;

    if(
      // Make sure _scrollParent is still in a scrollable state
      this._scrollParent.scrollHeight > this._scrollParent.clientHeight &&
      ((dir === 1 && itemBottom > borderBottom) ||
      (dir === -1 && itemTop < borderTop))
    ) {
      // Scroll first, then select
      angular.element(this._scrollParent).one('scroll', _select);

      // Update actual scrollPos
      var scrollTop = this._scrollParent.scrollTop;
      var increment = (itemHeight * marginFactor * dir);

      this._scrollParent.scrollTop = scrollTop + increment;

      // No movement
      if(scrollTop === this._scrollParent.scrollTop) {
        var cycle = this.config.cycle;

        if( // Cycle back if we're at the end
          cycle && dir === 1 && this._isLastVisibleItem(selectedItem)
        ) {
          this._scrollParent.scrollTop = 0;
        } else if(
          cycle && dir === -1 && this._isFirstVisibleItem(selectedItem)
        ) {
          this._scrollParent.scrollTop = this._scrollParent.scrollHeight;
        } else {
          // Cycling disabled or not yet at the end, this can happen!
          angular.element(this._scrollParent).off('scroll', _select);
          _select();
        }

      }

    } else {
      _select();
    }
  };

  HumanKeySelect.prototype.selectItem = function (options) {
    options = options || {};

    if(options.hasOwnProperty('index')) {
      this._selectNextItem(options.index - 1);
    }

    if(options.hasOwnProperty('dir')) {
      if(!this.$selectedItem) {
        return;
      }

      var dir = options.dir;
      var index = this.items.indexOf(this.$selectedItem[0]);

      var _select = this[dir === 1 ? '_selectNextItem' : '_selectPreviousItem'];
      _select = _select.bind(this, index);

      // Lazy look for _scrollParent here
      if(!this._scrollParent) {
        this._scrollParent = this._findScrollParent();
      }

      if(this._scrollParent) {
        this._handleScroll(dir, _select);
      } else {
        _select();
      }
    }
  };

  HumanKeySelect.prototype.setItems = function (items) {
    this.items = items || [];

    if(!angular.isArray(this.items)) {
      this.items = Array.prototype.slice.call(this.items);
    }
  };

  HumanKeySelect.prototype.bindHandlers = function () {
    var humanKeySelect = this;

    humanKeySelect.$element.on('focus', function () {
      humanKeySelect.enabled = true;
    });

    humanKeySelect.$element.on('blur', function () {
      humanKeySelect.enabled = false;
      humanKeySelect._clearSelectedItem();
    });

    // Use capture to get around stopPropagation in the collections
    humanKeySelect.$element[0].addEventListener('click', function (e) {
      if(humanKeySelect.enabled && humanKeySelect.items.length) {

        if(humanKeySelect.items.indexOf(e.target) >= 0) {
          humanKeySelect._selectItem(e.target);
        }
      }
    }, true);

    // Attach to window to stop propagation to engine's keydown handlers
    $window.addEventListener('keydown', function (e) {
      if(humanKeySelect.enabled && humanKeySelect.items.length) {
        e.stopImmediatePropagation();

        if(isUpArrow(e) || isDownArrow(e)) {

          if(humanKeySelect.$selectedItem) {
            humanKeySelect.selectItem({ dir: isDownArrow(e) ? 1 : -1 });
          } else {
            humanKeySelect.selectItem({ index: 0 });
          }

        } else if(isEnter(e) && humanKeySelect.$selectedItem) {
          humanKeySelect.config.onSelected(humanKeySelect.$selectedItem);
        }

      }
    }, true);
  };

  return HumanKeySelect;
}]);

angular.module('humanUI.utilities')

.directive('humanSlider', ['Draggable', function (Draggable) {
  return {
    restrict: 'E',
    scope: {
      config: '='
    },
    templateUrl: 'templates/utilities/slider.html',
    link: function (scope, element) {
      var position = 0;
      var config = { min: 0, max: 1, range: 1, axis: 'x' }; // Config defaults
      var updateObject = {};

      var fraction, percent, draggable, prop, clientRect, positionX, positionY;

      var $track    = element.children();
      var $children = $track.children();
      var $progress = $children.eq(0);
      var $handle   = $children.eq(1);

      var track = $track[0];

      var setCSS = function () {
        percent = (fraction * 100) + '%';

        $handle.css(config.axis === 'x' ? 'left' : 'top', percent);
        $progress.css(config.axis === 'x' ? 'width' : 'height', percent);

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

        if(key === 'axis' && value) {
          config[key] = value;

          element.attr('axis', value);
          draggable.constraints.axis = value;

          prop = config.axis === 'x' ? 'width' : 'height';
          draggable.constraints.elementBounds = prop;

          $handle[0].style.top = null;
          $handle[0].style.left = null;
        }

      };

      // Called when slider is changed out of $digest cycle
      var updateValue = function (x, y) {
        // Derive config.value from position
        position = config.axis === 'x' ? x : y;
        prop = config.axis === 'x' ? 'offsetWidth' : 'offsetHeight';

        fraction = position / track[prop];
        scope.config.value = (fraction * config.range) + config.min;

        updateObject.position = updateObject[config.axis] = position;
        updateObject.fraction = fraction;

        if(config.axis === 'x') {
          delete updateObject.y;
        } else {
          delete updateObject.x;
        }

        if(scope.config.change) {
          scope.config.change(updateObject);
        }

        scope.$apply();
      };

      $track.on('mousedown', function (e) {
        clientRect = e.target.getBoundingClientRect();

        positionX = e.clientX - clientRect.left;
        positionY = e.clientY - clientRect.top;

        updateValue(positionX, positionY);
      });

      draggable = Draggable.create({
        element: $handle,
        constraints: { element: 'parent.width', axis: config.axis },
        onMove: updateValue
      });

      scope.$watch('config.min', function (n) { updateConfig('min', n); });
      scope.$watch('config.max', function (n) { updateConfig('max', n); });
      scope.$watch('config.axis', function (n) { updateConfig('axis', n); });

      scope.$watch('config.value', function (n) {
        if(angular.isNumber(n)) {
          // Derive position from config.value
          fraction = (n - config.min) / config.range;

          prop = config.axis === 'x' ? 'offsetWidth' : 'offsetHeight';
          position = fraction * track[prop];
          // TODO: Can you make this better?
          setCSS(); // Will override Draggable css with percent value
        }
      });

    }
  };
}]);

angular.module('humanUI.hotspots', [])

.directive('humanHotspots',
  ['$compile', 'HumanActions', 'HotspotData', 'Hotspot', function ($compile, HumanActions, HotspotData, Hotspot) {

    return {
      restrict: 'E',
      scope: true,
      link: function (scope, element) {
        Hotspot.parentElement = element[0];

        var createHotspots = function (toCreate) {
          angular.forEach(toCreate, function (hotspotData) {
            var hotspot = Hotspot.create(hotspotData);

            if(hotspot.template) { // Only render if a template is present
              hotspot.render();
            }
          });
        };

        var clearHotspots = function (toClear) {
          angular.forEach(toClear, function (hotspot) {
            Hotspot.destroy(hotspot);
          });
        };

        var globalCreated = false;

        Human.events.on('modules.deactivate.finish', function () {
          // Clear out all existing hotspots
          clearHotspots(Hotspot.hotspots.slice(0));
          globalCreated = false;
        });

        Human.events.on('modules.destroy.finish', function () {
          // Clear out all existing hotspots
          clearHotspots(Hotspot.hotspots.slice(0));
          globalCreated = false;
        });

        Human.events.on('timeline.chapters.activated', function (data) {
          // Create global hotspots once on first chapters.activated
          if(!globalCreated) {
            // Create global, module level hotspots
            createHotspots(HotspotData.global);
            globalCreated = true;
          }

          // Clear out all existing non-global hotspots
          var toClear = Hotspot.hotspots.filter(function (hotspot) {
            return !HotspotData.global[hotspot.id];
          });

          clearHotspots(toClear);

          // Create new instances for the current chapter
          var chapterIndex = data.newChapterIndex.toString();
          var byChapter = HotspotData.byChapter;

          if(byChapter.hasOwnProperty(chapterIndex)) {
            createHotspots(byChapter[chapterIndex]);
          }
        });

      }
    };
  }]
);

angular.module('humanUI.hotspots')

.factory('HotspotData', ['$timeout', 'Human', 'currentModule', function ($timeout, Human, currentModule) {

  var HotspotData = { // Source data from the module and / or API.
    all: {},
    global: {},
    byChapter: {},
    byName: {}
  };

  var collectionNames = Object.keys(HotspotData);

  var id = 1; // System generated unique identifier

  HotspotData.getCurrentId = function () {
    return id;
  };

  HotspotData.add = function (hotspotData, chapterScope) {

    // The 'id' property cannot be supplied from outside
    // If it is (as in the first module definitions) it will be assigned to
    // The 'name' property and then deleted
    if(angular.isDefined(hotspotData.id)) {
      hotspotData.name = hotspotData.id;
      delete hotspotData.id;
    }

    // Attach system generated id to hotpot data
    hotspotData.id = id;

    // Master list
    this.all[ hotspotData.id.toString() ] = hotspotData;

    // Chapter scoping
    // Allow argument to override the data
    if(angular.isDefined(chapterScope)) {
      hotspotData.chapterScope = chapterScope;
    }

    if(angular.isDefined(hotspotData.chapterScope)) {
      chapterScope = hotspotData.chapterScope.toString();

      if(!this.byChapter[chapterScope]) {
        this.byChapter[chapterScope] = [];
      }

      this.byChapter[chapterScope].push(hotspotData);
    } else {
      // Global
      this.global[ hotspotData.id.toString() ] = hotspotData;
    }

    // Name organization
    if(angular.isDefined(hotspotData.name)) {
      this.byName[hotspotData.name] = hotspotData;
    }

    id++; // Auto increment to next id
  };

  HotspotData.update = function (hotspotId, hotspotData) {
    var currentData = this.all[ hotspotId.toString() ];

    if(hotspotData.hasOwnProperty('chapterScope')) {
      var oldChapterScope = currentData.chapterScope;
      var newChapterScope = hotspotData.chapterScope;

      // Remove from current byChapter or global
      if(currentData.hasOwnProperty('chapterScope')) {

        var index = this.byChapter[oldChapterScope].indexOf(currentData);
        this.byChapter[oldChapterScope].splice(index, 1);
      } else {
        // Remove from global
        delete this.global[currentData.id];
      }

      // Update to new byChapter or global
      if(angular.isDefined(newChapterScope)) {

        if(!this.byChapter[newChapterScope]) {
          this.byChapter[newChapterScope] = [];
        }

        this.byChapter[newChapterScope].push(currentData);

      } else { // Treat undefined as a delete command
        delete hotspotData.chapterScope;
        delete currentData.chapterScope;

        this.global[currentData.id] = currentData;
      }

    }

    if(hotspotData.hasOwnProperty('name')) {
      var oldName = currentData.name;
      var newName = hotspotData.name;

      // Remove from current byName
      if(currentData.hasOwnProperty('name')) {
        delete this.byName[oldName];
      }

      // Update to new byName
      if(angular.isDefined(newName)) {

        this.byName[newName] = currentData;
      } else { // Treat undefined as a delete command

        delete hotspotData.name;
        delete currentData.name;
      }
    }

    angular.extend(currentData, hotspotData);
  };

  HotspotData.remove = function (hotspotId) {
    delete this.all[hotspotId];

    if(this.global[hotspotId]) {
      delete this.global[hotspotId];
    }

    var key, i, index;

    for(key in this.byChapter) {
      if(this.byChapter.hasOwnProperty(key)) {

        var chapter = this.byChapter[key];

        for (i = 0; i < chapter.length; i++) {
          if(hotspotId === chapter[i].id) {
            index = i;
            break;
          }
        }

        if(angular.isDefined(index)) {
          chapter.splice(index, 1);
          break;
        }

      }
    }

    for(key in this.byName) {
      if(this.byName.hasOwnProperty(key)) {
        if(hotspotId === this.byName[key].id) {
          delete this.byName[key];
          break;
        }
      }
    }

  };

  HotspotData.removeAll = function () {
    var key, data;

    for (var i = 0; i < collectionNames.length; i++) {
      data = this[collectionNames[i]];

      for(key in data) {
        if(data.hasOwnProperty(key)) {
          data[key] = undefined;
          delete data[key];
        }
      }
    }
  };

  var buildFromModule = function () {
    var moduleData = currentModule.data;

    // Global hotspots
    if(moduleData.hotspots && moduleData.hotspots.length) {
      angular.forEach(moduleData.hotspots, function (hotspotData) {
        HotspotData.add(hotspotData);
      });
    }

    // Hotspots scoped to chapters
    if(moduleData.chapters && moduleData.chapters.length) {

      angular.forEach(moduleData.chapters, function (chapter, chapterIndex) {
        if(chapter.hotspots && chapter.hotspots.length) {

          angular.forEach(chapter.hotspots, function (hotspotData) {
            HotspotData.add(hotspotData, chapterIndex);
          });
        }

      });
    }

  };

  Human.events.on('modules.activate.start', function (data) {
    // Guards against unnecessary rebuilding
    if(!Human.modules.activeModules[data.moduleId]) {
      HotspotData.removeAll();
      buildFromModule();
    }
  });

  return HotspotData;
}]);

angular.module('humanUI.hotspots')

.constant('HOTSPOT_TEMPLATES', {
  circle: '<div class="outer"><div class="inner"></div></div>',
  label: '<h1>{{ title }}</h1>'
})

.constant('HOTSPOT_CLASSES', {
  circle: 'circle',
  plus: 'plus',
  minus: 'minus',
  label: 'label',
  left: 'left',
  singleLine: 'single-line',
  pulse: 'pulse',
  pulseHover: 'pulse-hover',
  showHover: 'show-hover'
})

.factory('HOTSPOT_TYPES', ['HOTSPOT_TEMPLATES', 'HOTSPOT_CLASSES', function (HOTSPOT_TEMPLATES, HOTSPOT_CLASSES) {

  return {
    circle: {
      template: HOTSPOT_TEMPLATES.circle,
      classes: [HOTSPOT_CLASSES.circle],
      variations: [HOTSPOT_CLASSES.pulse, HOTSPOT_CLASSES.pulseHover]
    },
    circlePlus: {
      template: HOTSPOT_TEMPLATES.circle,
      classes: [HOTSPOT_CLASSES.circle, HOTSPOT_CLASSES.plus],
      variations: [HOTSPOT_CLASSES.pulse, HOTSPOT_CLASSES.pulseHover]
    },
    circleMinus: {
      template: HOTSPOT_TEMPLATES.circle,
      classes: [HOTSPOT_CLASSES.circle, HOTSPOT_CLASSES.minus],
      variations: [HOTSPOT_CLASSES.pulse, HOTSPOT_CLASSES.pulseHover]
    },
    label: {
      template: HOTSPOT_TEMPLATES.label,
      classes: [HOTSPOT_CLASSES.label],
      variations: [HOTSPOT_CLASSES.left, HOTSPOT_CLASSES.singleLine]
    },
    circleLabel: {
      template: HOTSPOT_TEMPLATES.circle + HOTSPOT_TEMPLATES.label,
      classes: [HOTSPOT_CLASSES.circle, HOTSPOT_CLASSES.label],
      variations: [
        HOTSPOT_CLASSES.plus,
        HOTSPOT_CLASSES.minus,
        HOTSPOT_CLASSES.pulse,
        HOTSPOT_CLASSES.pulseHover,
        HOTSPOT_CLASSES.showHover,
        HOTSPOT_CLASSES.left,
        HOTSPOT_CLASSES.singleLine
      ]
    }
  };

}]);

angular.module('humanUI.hotspots')

.factory('Hotspot',
  ['$window', '$filter', '$interpolate', 'HOTSPOT_TYPES', 'HotspotData', 'Human', 'HumanActions', function (
    $window, $filter, $interpolate,
    HOTSPOT_TYPES, HotspotData, Human, HumanActions
  ) {

    // Constants for the direction normal
    var FULL_OPACITY = 0.9; // Defined in stylsheet, need to hardcode this here
    var FADE_START_ANGLE = 80;
    var MAX_VIEW_ANGLE = 100;

    // Variables shared between hotspot instances
    var viewPos = [];
    var projPos = [];
    var eyeVec = [];

    var viewMat, projMat, canvasRect, x, y, w;

    var canvas = $window.document.getElementById(Human.CANVAS_ID);

    /*
     Constructor

     Attributes:

     id
     chapterScope

     pos
     canvasPos
     _canvasWidth
     _canvasHeight
     _positionUpdate

     shown
     inView
     objectShown
     _viewAngle
     _displayUpdate

     objectId

     actions
     data

     element
     name
     title
     type
     template
     className
     _rendered

     _boundSetPos
     _boundSetObjectShown

     _onClick
     _boundOnClick
     _onEnter
     _boundOnEnter
     _onLeave
     _boundOnLeave
     _userUpdate

    */

    var Hotspot = function (data) {
      var _data = angular.copy(data); // Deep copy the data

      for (var prop in _data) { // Assign all props to new Hotspot
        if(_data.hasOwnProperty(prop)) {
          this[prop] = _data[prop];
        }
      }

      // Apply defaults

      // Shown state, default to true
      if(!angular.isDefined(this.shown)) {
        this.shown = true;
      }

      // Get pos from objectId if necessary
      if(!this.pos && this.objectId) {
        var object = Human.scene.objects[this.objectId];

        if(object) {
          this.pos = Human.scene.objects[this.objectId].getCenter();
        }
      }

      // An optional normal vector.
      if(angular.isArray(this.dir)) {
        $window.vec3.normalize(this.dir, this.dir);
      }

      this._buildType(); // Rules for hotspot "type" property

      // Create Element but do not add to DOM
      this.createElement();
      this.bindEngineHandlers();

      // Initialize event data objects
      this._displayUpdate = { id: this.id };
      this._positionUpdate = { id: this.id };
      this._userUpdate = { id: this.id };

      // Set initial object shown property
      this.setObjectShown();

      // Initialize display and position variables
      this.setCanvasPos();
    };

    Hotspot.TAG_NAME = 'human-hotspot';

    Hotspot.parentElement = null;

    Hotspot.hotspots = []; // Stores currently instantiated hotspots

    Hotspot.create = function (data) {
      var hotspot = new Hotspot(data);

      Hotspot.hotspots.push(hotspot);

      return hotspot;
    };

    Hotspot.get = function (id) {
      for (var i = 0; i < Hotspot.hotspots.length; i++) {
        if(Hotspot.hotspots[i].id === id) {
          return Hotspot.hotspots[i];
        }
      }

      return null;
    };

    Hotspot.destroy = function (hotspot) {
      var index = Hotspot.hotspots.indexOf(hotspot);

      Hotspot.hotspots.splice(index, 1); // De-register

      // Remove from DOM, destroy element and unbind handlers
      hotspot.unRender();
      hotspot.unbindEngineHandlers();

      hotspot = undefined;
    };

    // Instance Methods

    Hotspot.prototype._buildType = function () {
      var type = $filter('camelCaseNormalize')(this.type);

      if(type && HOTSPOT_TYPES[type]) {
        var typeData = HOTSPOT_TYPES[type];
        var typeClassName = typeData.classes.join(' ');

        // Add other classNames to the type's
        if(this.className) {
          this.className = [typeClassName, this.className].join(' ');
        } else {
          this.className = typeClassName;
        }

        // Override with type's template
        this.template = typeData.template;

        if(typeData.title) {
          this.title = typeData.title;
        }

      }
    };

    Hotspot.prototype._setCanvasDims = function () {
      canvasRect = canvas.getBoundingClientRect();

      this._canvasWidth = canvasRect.width;
      this._canvasHeight = canvasRect.height;
    };

    // TODO: Hotspot scaling:
    // First look at perspective matrix scaling / FOV try to find equation

    var eyePos, dot, viewAngle;

    // Sets view an angle 0 - 180 in the same way as annotation pins
    Hotspot.prototype._getViewAngle = function () {
      if(!this.dir) {
        return 0;
      }

      eyePos = Human.view.camera.eye;

      eyeVec[0] = eyePos.x;
      eyeVec[1] = eyePos.y;
      eyeVec[2] = eyePos.z;

      // Get vector between the hotspot and the eye positions
      $window.vec3.subtract(eyeVec, eyeVec, this.pos);
      $window.vec3.normalize(eyeVec, eyeVec);

      dot = $window.Math.min($window.vec3.dot(eyeVec, this.dir), 1);
      viewAngle = $window.Math.acos(dot) * (180 / $window.Math.PI);

      return viewAngle;
    };

    Hotspot.prototype._getViewPos = function () {
      viewMat = Human.renderer.getViewMat();

      if($window.vec3) {
        viewPos = $window.vec3.transformMat4(viewPos, this.pos, viewMat);
      } else {
        viewPos = Human.math.transformPoint3(viewMat, this.pos);
      }

      viewPos[3] = 1; // Need homogeneous 'w' for perspective division

      return viewPos;
    };

    Hotspot.prototype._getCanvasPos = function (viewPos) {
      projMat = Human.renderer.getProjMat();

      if($window.vec4) {
        projPos = $window.vec4.transformMat4(projPos, viewPos, projMat);
      } else {
        projPos = Human.math.transformPoint4(projMat, viewPos);
      }

      x = projPos[0];
      y = projPos[1];
      w = projPos[3];

      this._setCanvasDims(); // Update canvas dimension properties

      return [
        (1 + x / w) * this._canvasWidth / 2,
        (1 - y / w) * this._canvasHeight / 2
      ];
    };

    // Build context from name collection and 'self' keyword
    Hotspot.prototype.getContext = function () {
      var byName = HotspotData.byName;
      var _self = { self: HotspotData.all[this.id] || {} };

      return angular.extend({}, byName, _self);
    };

    Hotspot.prototype.doActions = function () {
      if(!this.actions) {
        return;
      }

      HumanActions.parse(this.actions, this.getContext());
    };

    Hotspot.prototype.createElement = function () {
      var hotspotEl = $window.document.createElement(Hotspot.TAG_NAME);

      if(this.name) {
        hotspotEl.setAttribute('name', this.name);
      }

      if(this.className) {
        hotspotEl.className = this.className;
      }

      if(this.template) {
        hotspotEl.innerHTML = $interpolate(this.template)(this);
      }

      if(this.actions) {
        var joinCharacter = HumanActions.JOIN_CHARACTER;
        hotspotEl.setAttribute('actions', this.actions.join(joinCharacter));
      }

      if(this.pos) {
        hotspotEl.setAttribute('pos', this.pos.join(','));
      }

      if(this.objectId) {
        hotspotEl.setAttribute('object-id', this.objectId);
      }

      if(angular.isObject(this.data)) {
        var key, value;

        angular.forEach(this.data, function (_value, _key) {
          key = $filter('dashNormalize')(_key);
          value = angular.isObject(_value) ? angular.toJson(_value) : _value;

          hotspotEl.setAttribute('data-' + key, value);
        });
      }

      // Set reference to instance in document element
      angular.element(hotspotEl).data('hotspot', this);

      this.element = hotspotEl;

      return hotspotEl;
    };

    Hotspot.prototype.render = function () {
      if(this._rendered) {
        return;
      }

      Hotspot.parentElement.appendChild(this.element);

      this.setCanvasPos();

      this.unbindDOMHandlers(); // Prevent double binding
      this.bindDOMHandlers();

      this._rendered = true;
    };

    Hotspot.prototype.unRender = function () {
      if(!this._rendered) {
        return;
      }

      this.unbindDOMHandlers();

      Hotspot.parentElement.removeChild(this.element);

      this._rendered = false;
    };

    var opacity, angleDiff, fadeRange, scaledOpacity;

    Hotspot.prototype._setOpacity = function () {
      if(!this.dir) { // Skip unnecessary work
        return;
      }

      if(this._viewAngle >= FADE_START_ANGLE) {
        angleDiff = this._viewAngle - FADE_START_ANGLE;
        fadeRange = MAX_VIEW_ANGLE - FADE_START_ANGLE;
        scaledOpacity = (angleDiff / fadeRange) * FULL_OPACITY;

        opacity = $window.Math.max(1 - scaledOpacity, 0);
      } else {
        opacity = FULL_OPACITY;
      }

      this.element.style.opacity = opacity;
    };

    Hotspot.prototype._setTranslation = function () {
      this.element.style.transform =
        'translate(' + this.canvasPos[0] + 'px,' + this.canvasPos[1] + 'px)';
    };

    var objectShown, display, inView;

    Hotspot.prototype.setDisplay = function () {
      objectShown = this.objectShown || !angular.isDefined(this.objectShown);

      display = this.shown && this.inView && objectShown;

      if(this.element) {
        this.element.style.display = display ? 'block' : 'none';
      }

      // Finally, notify
      this._displayUpdate.inView = this.inView;
      this._displayUpdate.shown = this.shown;

      if(angular.isDefined(this.objectShown)) {
        this._displayUpdate.objectShown = this.objectShown;
      }

      // This is fired for the API's consumption
      // We have to use Human.events in order to hook into its event system
      Human.events.fire('hotspots.displayUpdated', this._displayUpdate);
    };

    Hotspot.prototype._getInView = function (viewPos) {
      // Less than max view angle, within Canvas dimensions, in front of camera
      return this._viewAngle < MAX_VIEW_ANGLE &&
        this.canvasPos[0] > 0 &&
        this.canvasPos[0] < this._canvasWidth &&
        this.canvasPos[1] > 0 &&
        this.canvasPos[1] < this._canvasHeight &&
        viewPos[2] <= 0;
    };

    Hotspot.prototype.setCanvasPos = function () {
      if(!this.pos) {
        return;
      }

      viewPos = this._getViewPos();

      this.canvasPos = this._getCanvasPos(viewPos);

      this._viewAngle = this._getViewAngle();

      inView = this._getInView(viewPos);

      // The position can update the display state via the inView property
      // Only call if inView has changed
      if(inView !== this.inView) {
        this.inView = inView;
        this.setDisplay();
      }

      if(this.element) {
        this._setOpacity();
        this._setTranslation();
      }

      // Finally, notify
      this._positionUpdate.canvasPos = this.canvasPos;

      // This is fired for the API's consumption
      // We have to use Human.events in order to hook into its event system
      Human.events.fire('hotspots.positionUpdated', this._positionUpdate);
    };

    Hotspot.prototype.setObjectShown = function () {
      var object = Human.scene.objects[this.objectId];

      if(!this.objectId || !object) {
        return;
      }

      var data = arguments[0];

      if(angular.isObject(data) && data.enabledObjectsUpdate) {
        var update = data.enabledObjectsUpdate;

        if(!update.hasOwnProperty(this.objectId)) {
          return;
        }

        objectShown = update[this.objectId];
      } else {
        objectShown = object.shown;
      }

      // Only call setDisplay when objectShown property changes
      if(objectShown !== this.objectShown) {
        this.objectShown = objectShown;
        this.setDisplay();
      }
    };

    Hotspot.prototype.setShown = function (shown) {
      // Only call setDisplay when shown property changes
      if(shown !== this.shown) {
        this.shown = shown;
        this.setDisplay();
      }
    };

    // Position / View Updating
    Hotspot.prototype.bindEngineHandlers = function () {
      this._boundSetPos = this.setCanvasPos.bind(this);
      Human.events.on('camera.updated', this._boundSetPos);
      Human.events.on('canvas.resized', this._boundSetPos);

      this._boundSetObjectShown = this.setObjectShown.bind(this);
      Human.events.on('scene.objectsShown', this._boundSetObjectShown);
    };

    Hotspot.prototype.unbindEngineHandlers = function () {
      if(angular.isFunction(this._boundSetPos)) {
        Human.events.off('camera.updated', this._boundSetPos);
        Human.events.off('canvas.resized', this._boundSetPos);
        this._boundSetPos = undefined;
      }

      if(angular.isFunction(this._boundSetObjectShown)) {
        Human.events.off('scene.objectsShown', this._boundSetObjectShown);
        this._boundSetObjectShown = undefined;
      }
    };

    // DOM Interaction
    Hotspot.prototype._onClick = function () {
      this.doActions();

      Human.events.fire('hotspots.picked', this._userUpdate);
    };

    Hotspot.prototype._onEnter = function () {
      Human.events.fire('hotspots.entered', this._userUpdate);
    };

    Hotspot.prototype._onLeave = function () {
      Human.events.fire('hotspots.left', this._userUpdate);
    };

    Hotspot.prototype.bindDOMHandlers = function () {
      this._boundOnClick = this._onClick.bind(this);
      this._boundOnEnter = this._onEnter.bind(this);
      this._boundOnLeave = this._onLeave.bind(this);

      this.element.addEventListener('click', this._boundOnClick);
      this.element.addEventListener('mouseenter', this._boundOnEnter);
      this.element.addEventListener('mouseleave', this._boundOnLeave);
    };

    Hotspot.prototype.unbindDOMHandlers = function () {
      if(angular.isFunction(this._boundOnClick)) {
        this.element.removeEventListener('click', this._boundOnClick);
        this._boundOnClick = undefined;
      }

      if(angular.isFunction(this._boundOnEnter)) {
        this.element.removeEventListener('mouseenter', this._boundOnEnter);
        this._boundOnEnter = undefined;
      }

      if(angular.isFunction(this._boundOnLeave)) {
        this.element.removeEventListener('mouseleave', this._boundOnLeave);
        this._boundOnLeave = undefined;
      }
    };

    return Hotspot;
  }]
);

angular.module('humanUI.actions', [])

// Important: Expressions for actions should only be references to:
// object properties, array indices, or numbers

.factory('HumanActions', ['$timeout', 'HumanParser', function ($timeout, HumanParser) {
  var actionsMap = {};

  var ASYNC_EXPRESSION = /Async$/;

  var doActions = function (actions, customContext, callback) {
    if(actions.length === 0) {
      $timeout(callback);
      return;
    }

    var _action = actions.shift().split(':');
    var _instruction = _action.shift();
    var _arguments = _action;

    var nextAction = doActions.bind(null, actions, customContext, callback);
    // Call in next execution context to avoid running into
    // Chaining problems with engine callbacks
    nextAction = $timeout.bind(null, nextAction, 0);

    // Check for Async suffix
    var _async = false;

    if(ASYNC_EXPRESSION.test(_instruction)) {
      _instruction = _instruction.replace(ASYNC_EXPRESSION, '');
      _async = true;
    }

    if(actionsMap.hasOwnProperty(_instruction)) {
      var actionObj = actionsMap[_instruction];

      // Extract data that the action has access to
      var context = angular.extend({}, actionObj.context, customContext);

      for (var i = 0; i < _arguments.length; i++) {
        _arguments[i] = HumanParser.parse(_arguments[i])(context);
      }

      // If the action is async, we need to replace the callback with noop
      var _callback = _async ? angular.noop : nextAction;

      // Build final list of arguments that will be sent to the
      // Action's function
      _arguments = [_instruction].concat(_arguments, _callback);

      actionObj.fn.apply(null, _arguments);

      // If the action is async, call immediately after
      if(_async) {
        nextAction();
      }

    } else { // Move to next if action is not recognized
      nextAction();
    }
  };

  var HumanActions = {

    JOIN_CHARACTER: '|',

    get: function () {
      return Object.keys(actionsMap);
    },

    getContext: function (actionName) {
      var actionObj = actionsMap[actionName];

      if(actionObj) {
        return actionObj.context;
      }
    },

    getMetaData: function (actionName) {
      var actionObj = actionsMap[actionName];

      if(actionObj) {
        return actionObj.metaData;
      }
    },

    define: function (actionNames, fn, context, metaData) {
      var action = {
        fn: fn || angular.noop,
        context: context || {},
        metaData: metaData || {}
      };

      if(!angular.isArray(actionNames)) {
        actionNames = [actionNames];
      }

      for (var i = 0; i < actionNames.length; i++) {
        actionsMap[ actionNames[i] ] = action;
      }
    },

    parse: function () {
      var actions = arguments[0];

      var customContext, callback; // Optional arguments

      if(arguments.length === 1) {
        customContext = {};
        callback = angular.noop;
      } else if(arguments.length === 2) {

        if(angular.isFunction(arguments[1])) {
          customContext = {};
          callback = arguments[1];
        } else {
          customContext = arguments[1];
          callback = angular.noop;
        }

      } else if(arguments.length === 3) {
        customContext = arguments[1];
        callback = arguments[2];
      }

      if(angular.isString(actions)) {
        actions = actions.split(this.JOIN_CHARACTER);
      }

      doActions(actions.slice(0), customContext, callback);
    }
  };

  return HumanActions;
}])

.run(['$window', '$timeout', 'Human', 'currentModule', 'HumanBackground', 'HumanActions', 'Hotspot', function (
    $window, $timeout,
    Human, currentModule, HumanBackground, HumanActions, Hotspot
  ) {

  // Build shared context for all actions
  var context = {};
  var metaData;

  // Special functions for getting 'current' values...
  var currentFunctions = {

    currentTime: function () {
      return Human.timeline.time;
    }

  };

  var buildContext = function () {
    var key;

    for (key in context) {
      if(context.hasOwnProperty(key)) {
        delete context[key];
      }
    }

    for (key in currentModule.data) {
      if(currentModule.data.hasOwnProperty(key)) {
        context[key] = currentModule.data[key];
      }
    }

    for (key in currentFunctions) {
      if(currentFunctions.hasOwnProperty(key)) {
        context[key] = currentFunctions[key];
      }
    }
  };

  Human.events.on('modules.activate.start', function (data) {
    if(!Human.modules.activeModules[data.moduleId]) {
      buildContext();
    }
  });

  // Re-assign currentChapter variable to context each time a chapter is updated
  Human.events.on('timeline.chapters.activated', function (data) {
    // Older modules may not have chapters array
    context.currentChapter = context.chapters ?
      context.chapters[data.newChapterIndex] : null;
  });

  var getChapterObject = function (chapterData) {
    var index = context.chapters.indexOf(chapterData);
    var chapter = Human.timeline.activeRoot._chapters[index];

    return chapter;
  };

  // Have to get annotations via their id assigned by the engine
  // A little dangerous but can't think of another way...
  var getAnnotationObject = function (nowIndex, annotationData) {
    var index = context.chapters[nowIndex].annotations.indexOf(annotationData);
    var idExp = new RegExp(nowIndex + '\\.' + index + '$');

    var annotations = Human.view.annotations.annotations;

    for(var key in annotations) {
      if(annotations.hasOwnProperty(key) && idExp.test(key)) {
        return annotations[key];
      }
    }
  };

  // Generic tween builder
  var doTween = function (start, finish, duration, onUpdate, onComplete) {
    // Build slopes for each value
    if(!angular.isArray(start)) {
      start = [start];
    }

    if(!angular.isArray(finish)) {
      finish = [finish];
    }

    var slopes = [];
    var current = [];
    var i;

    for (i = 0; i < start.length; i++) {
      current.push(start[i]);
      slopes.push((finish[i] - start[i]) / duration);
    }

    var progress = 0;

    var deltaTime, startTime;

    var _onUpdate = function(timestamp) {
      if(!startTime) {
        startTime = timestamp;
      }

      deltaTime = timestamp - startTime;
      progress += deltaTime;
      startTime = timestamp;

      for (i = 0; i < slopes.length; i++) {
        current[i] += deltaTime * slopes[i];
      }

      if(progress < duration) {
        onUpdate(current);
        $window.requestAnimationFrame(_onUpdate);
      } else {
        onUpdate(finish);
        onComplete();

        $window.cancelAnimationFrame(tween);
      }
    };

    var tween = $window.requestAnimationFrame(_onUpdate);
  };

  // ACTION DEFINITIONS

  // Canvas opacity tween action
  var tweenOpacity = function (instruction, start, finish, duration, callback) {
    var containerEl = $window.document.getElementById(Human.CONTAINER_ID);

    // Tween the canvas, annotations and hotspots
    var onUpdate = function (values) {
      containerEl.style.opacity = values[0];
      Hotspot.parentElement.style.opacity = values[0];
    };

    doTween(start, finish, duration * 1000, onUpdate, callback);
  };

  metaData = { arity: 3 };

  HumanActions.define(['tweenOpacity'], tweenOpacity, context, metaData);

  // Background color tween action
  var tweenBackground =
    function (instruction, start, finish, duration, callback) {
      var updates = [
        function (values) {
          HumanBackground.setColors(values);
        },
        function (values) {
          HumanBackground.setColorStops(values);
        }
      ];

      var onUpdate = updates[ backgroundActions.indexOf(instruction) ];

      doTween(start, finish, duration * 1000, onUpdate, callback);
    };

  var backgroundActions = [
    'tweenBackgroundColors',
    'tweenBackgroundColorStops'
  ];

  metaData = { arity: 3 };

  HumanActions.define(backgroundActions, tweenBackground, context, metaData);

  // Wait action
  var waitAction = function (instruction, data, callback) {
    var waitTime = data * 1000;
    var startTime, totalTime;

    var wait = function (timestamp) {
      if(!startTime) {
        startTime = timestamp;
      }

      totalTime = timestamp - startTime;

      if($window.Math.round(totalTime) < waitTime) {
        $window.requestAnimationFrame(wait);
      } else {
        callback();
      }

    };

    $window.requestAnimationFrame(wait);
  };

  metaData = { arity: 1 };

  HumanActions.define(['wait'], waitAction, context, metaData);

  // Object action
  var objectsAction = function (instruction, data, callback) {
    var show = instruction === 'showObjects';
    var update = {};

    if(!angular.isArray(data)) {
      data = [data];
    }

    for (var i = 0; i < data.length; i++) {
      update[ data[i] ] = show;
    }

    Human.scene.setEnabledObjects({ objects: update });

    callback();
  };

  metaData = { arity: 1 };

  HumanActions.define(
    ['hideObjects', 'showObjects'], objectsAction, context, metaData);

  // Camera action
  var cameraAction = function (instruction, data, callback) {
    Human.view.camera.fly[instruction](data, callback);
  };

  metaData = { arity: 1 };

  HumanActions.define(['flyTo', 'jumpTo'], cameraAction, context, metaData);

  // Play action
  var playAction = function () {
    var _arguments = Array.prototype.slice.call(arguments);

    var instruction = _arguments.shift();
    var callback = _arguments.pop();

    var start = _arguments[0];
    var finish = _arguments[1];

    var params = {};
    var bindStopped = true;

    var noTime = !angular.isDefined(start) && !angular.isDefined(finish);
    var singleTime = angular.isDefined(start) && !angular.isDefined(finish);
    var timeRange = angular.isDefined(start) && angular.isDefined(finish);

    if(noTime) { // Play from wherever we are now

      params.startTime = Human.timeline.time;
    } else if(singleTime) { // Single time

      if(angular.isFunction(start)) {
        params.startTime = start();
      } else if(angular.isNumber(start)) {
        params.startTime = start;
      } else if(angular.isObject(start)) {
        params.startChapterId = getChapterObject(start).id;

        params.numChapters = 1;

        var animation = getChapterObject(start).animation;

        // Don't bind stopped event if we're looping
        if(animation && animation.loop) {
          bindStopped = false;
        }
      }

    } else if(timeRange) {

      if(angular.isFunction(start)) {
        params.startTime = start();
      } else if(angular.isNumber(start)) {
        params.startTime = start;
      } else if(angular.isObject(start)) {
        params.startChapterId = getChapterObject(start).id;
      }

      if(angular.isFunction(finish)) {
        params.finishTime = finish();
      } else if(angular.isNumber(finish)) {
        params.finishTime = finish;
      } else if(angular.isObject(finish)) {
        params.finishChapterId = getChapterObject(finish).id;
      }

      if(angular.isNumber(start) || angular.isNumber(finish)) {
        params.align = false; // Prevent alignment to the entire chapter
      }

    }

    if(bindStopped) {
      Human.events.once('timeline.stopped', callback);
    }

    Human.timeline[instruction](params);

    // Just move on to the next if we're looping, not sure what to do here...
    if(!bindStopped) {
      callback();
    }
  };

  metaData = { arity: [0, 2] };

  HumanActions.define(['play'], playAction, context, metaData);

  // Scrub action
  var scrubAction = function (instruction, data, callback) {
    var params = {};

    if(angular.isNumber(data)) { // Single time
      params.time = data;
    } else if(angular.isObject(data)) { // Chapter object
      params.chapterId = getChapterObject(data).id;
    }

    Human.timeline.scrub(params);

    callback();
  };

  metaData = { arity: 1 };

  HumanActions.define(['scrub'], scrubAction, context, metaData);

  // Stop action
  var stopAction = function (instruction, data, callback) {
    Human.timeline.stop();
    callback();
  };

  metaData = { arity: 0 };

  HumanActions.define(['stop'], stopAction, context, metaData);

  // Annotations action
  var annotationsAction = function () {
    var _arguments = Array.prototype.slice.call(arguments);

    var instruction = _arguments.shift();
    var callback = _arguments.pop();

    // Potential annotations are scoped to the current branch
    var nowBranch = Human.timeline.activeRoot._nowBranch;
    var nowIndex = Human.timeline.activeRoot._chapters.indexOf(nowBranch);

    for (var i = 0; i < _arguments.length; i++) {
      var annotation = getAnnotationObject(nowIndex, _arguments[i]);

      if(annotation) {
        annotation.setShown(instruction === 'showAnnotations');
      }
    }

    callback();
  };

  metaData = { arity: [1, Infinity] };

  HumanActions.define(
    ['hideAnnotations', 'showAnnotations'],
    annotationsAction, context, metaData
  );

  // Hotspots action
  var hotspotsAction = function () {
    var _arguments = Array.prototype.slice.call(arguments);

    var instruction = _arguments.shift();
    var callback = _arguments.pop();

    for (var i = 0; i < _arguments.length; i++) {
      var hotspot = Hotspot.get(_arguments[i].id);

      if(hotspot) {
        hotspot.setShown(instruction === 'showHotspots');
      }
    }

    callback();
  };

  metaData = { arity: [1, Infinity] };

  HumanActions.define(
    ['hideHotspots', 'showHotspots'], hotspotsAction, context, metaData);
}]);


angular.module('humanUI.parser', [])

.factory('HumanParser', function () {

  var getterFnCache = {};

  function getterFn (path) {
    var fn = getterFnCache[path];

    if (fn) {
      return fn;
    }

    var pathKeys = path.split('.');

    var code = '';

    // We simply dereference 's' on any dot notation
    pathKeys.forEach(function(key) {
      code += 'if(s == null) return undefined;\n' + 's=s.' + key + ';\n';
    });

    code += 'return s;';

    /* jshint -W054 */
    var evaledFnGetter = new Function('s', code); // s=scope

    evaledFnGetter.toString = function() { return code; };

    fn = evaledFnGetter;

    getterFnCache[path] = fn;

    return fn;
  }

  var expressionCache = {};

  var Parser = function (lexer) {
    this.lexer = lexer;
  };

  Parser.prototype = {

    parse: function (text) {
      this.text = text;
      this.tokens = this.lexer.lex(text);

      var value = angular.noop;

      // Convert the tokens into a series of getter functions
      if (this.tokens.length > 0) {
        value = this.primary();
      }

      if (this.tokens.length !== 0) {
        throw new Error('Unexpected token');
      }

      // This is the final getter in the sequence
      // It contains a reference to its previous getter and so forth...
      return value;
    },

    primary: function() {
      var primary;

      if (this.peek().identifier) {
        primary = this.identifier();
      } else if (this.peek().constant) {
        primary = this.constant();
      } else {
        throw new Error('Not a valid expression');
      }

      var next;

      while ((next = this.expect('[', '.'))) {
        if (next.text === '[') {
          primary = this.objectIndex(primary);
        } else if (next.text === '.') {
          primary = this.fieldAccess(primary);
        }
      }

      return primary;
    },

    fieldAccess: function(object) {
      var getter = this.identifier();

      // scope is the scope context passed in to $parse
      return function $parseFieldAccess(scope) {
        var o = object(scope);

        // The variable 'getter' is the dynamically built function
        /*jshint eqnull: true*/
        return (o == null) ? undefined : getter(o);
      };
    },

    objectIndex: function(obj) {
      var indexFn = this.primary();

      this.consume(']');

      // The 'self' argument is the scope context passed in to $parse
      return function $parseObjectIndex(self) {
        var o = obj(self); // The array object
        var i = indexFn(self); // The index to look up

        if (!o) {
          return undefined;
        }

        return o[i];
      };
    },

    // Returns a getterFn that...
    identifier: function() {
      var id = this.consume().text;

      //Continue reading each '.identifier'
      while (this.peek('.') && this.peekAhead(1).identifier) {
        id += this.consume().text + this.consume().text;
      }

      return getterFn(id);
    },

    // Returns a function that simply returns the constant's value
    constant: function() {
      var value = this.consume().value;

      function $parseConstant() {
        return value;
      }

      $parseConstant.constant = true;
      $parseConstant.literal = true;

      return $parseConstant;
    },

    consume: function(e1) {

      if (this.tokens.length === 0) {
        throw new Error('Unexpected end of expression');
      }

      var token = this.expect(e1);

      if (!token) {
        throw new Error('Unexpected token');
      }

      return token;
    },

    expect: function(e1, e2, e3, e4) {
      var token = this.peek(e1, e2, e3, e4);

      if (token) {
        this.tokens.shift();
        return token;
      }

      return false;
    },

    peek: function(e1, e2, e3, e4) {
      return this.peekAhead(0, e1, e2, e3, e4);
    },

    peekAhead: function(i, e1, e2, e3, e4) {
      if (this.tokens.length > i) {
        var token = this.tokens[i];
        var t = token.text;

        if (
          t === e1 || t === e2 || t === e3 || t === e4 ||
          (!e1 && !e2 && !e3 && !e4)
        ) {
          return token;
        }
      }

      return false;
    }

  };

  var Lexer = function () {};

  Lexer.prototype = {

    lex: function (text) {
      this.text = text;
      this.index = 0;
      this.tokens = [];

      while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index);

        if (this.isNumber(ch) || ch === '.' && this.isNumber(this.peek())) {
          this.readNumber();
        } else if (this.isValidIdentifierStart(this.peekMultichar())) {
          this.readIdentifier();
        } else if (this.is(ch, '[].')) {
          this.tokens.push({index: this.index, text: ch});
          this.index++;
        } else {
          this.index++;
        }
      }

      return this.tokens;
    },

    is: function(ch, chars) {
      return chars.indexOf(ch) !== -1;
    },

    peek: function(i) {
      var num = i || 1;

      return (this.index + num < this.text.length) ?
        this.text.charAt(this.index + num) : false;
    },

    peekMultichar: function() {
      var ch = this.text.charAt(this.index);
      var peek = this.peek();

      if (!peek) {
        return ch;
      }

      var cp1 = ch.charCodeAt(0);
      var cp2 = peek.charCodeAt(0);

      if (cp1 >= 0xD800 && cp1 <= 0xDBFF && cp2 >= 0xDC00 && cp2 <= 0xDFFF) {
        return ch + peek;
      }

      return ch;
    },

    isNumber: function(ch) {
      return ('0' <= ch && ch <= '9') && typeof ch === 'string';
    },

    isValidIdentifierStart: function(ch) {
      return ('a' <= ch && ch <= 'z' ||
              'A' <= ch && ch <= 'Z' ||
              '_' === ch || ch === '$');
    },

    isValidIdentifierContinue: function(ch) {
      return this.isValidIdentifierStart(ch) || this.isNumber(ch);
    },

    readNumber: function() {
      var number = '';
      var start = this.index;

      while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index).toLowerCase();

        if (ch === '.' || this.isNumber(ch)) {
          number += ch;
        } else {
          break;
        }

        this.index++;
      }

      this.tokens.push({
        index: start,
        text: number,
        constant: true,
        value: Number(number)
      });
    },

    readIdentifier: function() {
      var start = this.index;
      this.index += this.peekMultichar().length;

      while (this.index < this.text.length) {
        var ch = this.peekMultichar();

        if (!this.isValidIdentifierContinue(ch)) {
          break;
        }

        this.index += ch.length;
      }

      this.tokens.push({
        index: start,
        text: this.text.slice(start, this.index),
        identifier: true
      });
    }

  };

  return {

    Lexer: Lexer,

    parse: function (expression) {
      var cacheKey = expression = expression.trim();

      var parsedExpression;

      parsedExpression = expressionCache[cacheKey];

      if (!parsedExpression) {
        var lexer = new Lexer();
        var parser = new Parser(lexer);

        parsedExpression = parser.parse(expression);

        expressionCache[cacheKey] = parsedExpression;
      }

      return parsedExpression;
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

      scope.info = 'Toggle Annotations';

      scope.toggleAnnotations = {
        on: annotations.setShown.bind(annotations, true),
        off: annotations.setShown.bind(annotations, false)
      };

      Human.events.on('annotations.shown', function (data) {
        scope.toggleAnnotations.model = data.shown;
        scope.$apply();
      });

      // The 'annotations.shown' event is not entirely reliable, check here too
      Human.events.on('timeline.chapters.activated', function () {
        scope.toggleAnnotations.model = annotations.shown;
        scope.$apply();
      });

      scope.$watch('uiComponents.config.annotations', function (n) {
        scope.show = !!n;
      });
    }
  };
}]);

angular.module('humanUI.background', [])

// Wraps HumanBackground application
.factory('HumanBackground', ['$window', function ($window) {
  if(!$window.HumanBackground) {
    $window.console.warn('HumanBackground not found.');
  }

  return $window.HumanBackground || {};
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
        Human.modules.deactivate(moduleId, {}, function() {
          if (!Human.modules.isBaseModule(moduleId)) {

            var unload = Human.modules.modules[moduleId].rootObjects;

            var assetTypes = [
              'tweens', 'reflections', 'audio', 'videos', 'lights',
              'skyBoxes', 'geometries', 'materials', 'transforms', 'morph'
            ];

            Human.modules.unload(moduleId, unload, assetTypes, function() {
              Human.modules.destroy(moduleId);
            });
          }
        });
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

.factory('getPanRate', ['$window', 'Human', function ($window, Human) {
  var eyeVec = new Float64Array(3);
  var lookVec = new Float64Array(3);
  var diffVec = new Float64Array(3);

  var vectorLength;

  var coordToVec = function (coord, vec) {
    vec[0] = coord.x;
    vec[1] = coord.y;
    vec[2] = coord.z;
  };

  return function () {
    coordToVec(Human.view.camera.getEye(), eyeVec);
    coordToVec(Human.view.camera.getLook(), lookVec);

    if($window.vec3) {
      $window.vec3.sub(diffVec, eyeVec, lookVec);
      vectorLength = $window.vec3.length(diffVec);
    } else {
      Human.math.subVec3(eyeVec, lookVec, diffVec);
      vectorLength = Human.math.lenVec3(diffVec);
    }

    return vectorLength * 0.12;
  };
}])

.directive('centerCamera', ['Human', function (Human) {
  var camera = null;
  var bookmark = false;

  // Need to keep track of a bookmark's camera property outside of the engine
  Human.events.on('bookmarks.restored', function (data) {
    if(data.camera) {
      camera = data.camera;
    }

    bookmark = true;
  });

  var clearData = function () {
    if(bookmark) {
      camera = null;
      bookmark = false;
    }
  };

  // Clear camera data if a new module is activated thereafter
  Human.events.on('modules.deactivate.finish', clearData);
  Human.events.on('modules.destroy.finish', clearData);

  return {
    restrict: 'A',
    link: function (scope, element) {
      element.on('click', function () {
        if(camera) {
          Human.view.camera.fly.flyTo(camera);
        } else {
          Human.init.resetCamera();
        }
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
  objectSlider: false,

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
  scene: ['objectTree', 'objectSlider'],
  tools: ['crossSection', 'dissect', 'isolate', 'xray'],
  modes: ['isolate', 'xray']
})

// Backwards compatibility mappings
.constant('CONFIG_ALIASES', {
  loader: 'loadProgress',
  panel: 'info',
  tree: 'objectTree',
  fs: 'fullscreen',
  slider: 'objectSlider'
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
    },
    objectSlider: {
      objects: false
    }
  },
  notes: {
    'scrubber.chapters': 'Display chapters for scrubber',
    'scrubber.tour': 'Play one chapter at a time',
    'tour.chapters': 'Display chapters for tours',
    'playPause.tour': 'Play one chapter at a time',
    'objectSlider.objects': 'Display objects for objectSlider'
  }
})

// Support nesting params one level deep
.filter('convertDotKeys', function () {
  return function (config) {
    for(var key in config) {
      if(config.hasOwnProperty(key)) {
        if(/\./.test(key)) {
          var parts = key.split('.');

          if(!angular.isObject(config[ parts[0] ])) {
            config[ parts[0] ] = {};
          }

          config[ parts[0] ][ parts[1] ] = config[key];

          delete config[key];
        }
      }
    }

    return config;
  };
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

.filter('extendConfig', ['BASE_CONFIG', 'CONFIG_ALIASES', 'CONFIG_GROUPS', function (BASE_CONFIG, CONFIG_ALIASES, CONFIG_GROUPS) {
  return function (dest, src) {

    if(src.hasOwnProperty('all')) {

      angular.forEach(BASE_CONFIG, function (_value, key) {
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

.filter('convertUiParams', ['CONFIG_ALIASES', 'convertDotKeysFilter', function (CONFIG_ALIASES, convertDotKeysFilter) {
  var uiExp = /^ui-/;

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

    // Filter by ui- prefix, strip it, convert 'true'/'false' to booleans
    angular.forEach(params, function (value, key) {
      if(uiExp.test(key) || CONFIG_ALIASES.hasOwnProperty(key)) {
        key = key
          .replace(uiExp, '')
          .replace(/-([a-z])/g, function (match) { // To camelCase
            return match[1].toUpperCase();
          });

        uiParams[key] = booleanize(value);
      }
    });

    convertDotKeysFilter(uiParams);

    return uiParams;
  };
}])

.provider('ConfigCreator', function () {

  var $get = function ($window, $rootScope, $filter, BASE_CONFIG, Human) {
    var extendConfig = $filter('extendConfig');
    var convertTags = $filter('convertTags');
    var convertUiParams = $filter('convertUiParams');
    var convertDotKeys = $filter('convertDotKeys');

    var getSearchParams = function () {
      var searchParams = {};

      var search = $window.location.search.slice(1);

      // Decode any HTML encoded ampersands
      search = search.replace(/&amp;/g, '&');

      var params = search.split('&');
      var tokens;

      for (var i = 0; i < params.length; i++) {
        tokens = params[i].split('=');
        searchParams[ tokens[0] ] = tokens[1];
      }

      return searchParams;
    };

    return {
      config: {}, // Final configuration
      urlConfig: convertUiParams(getSearchParams()),
      bookmarkConfig: {},
      contentConfig: {},
      applicationConfig: {},

      init: function () {
        var configCreator = this;

        // Put global components data for all directives to access
        $rootScope.uiComponents = { config: this.config };

        // Extend every time a new module is activating
        Human.events.on('modules.activate.start', function (params) {
          // Guards against unnecessary rebuilding
          if(!Human.modules.activeModules[params.moduleId]) {
            var module = Human.modules.modules[params.moduleId];

            configCreator._buildContentConfig(module);
            configCreator._extend();
            configCreator._apply();
          }
        });

        var bookmarkTour = false;
        // Extend when a bookmark tour is restored
        $rootScope.$on('bookmarkTour.state', function (e, state) {
          // Only create config when different
          if(state.bookmarkTour !== bookmarkTour) {
            bookmarkTour = state.bookmarkTour;

            configCreator.bookmarkConfig.bookmarkTour = state.bookmarkTour;
            configCreator._extend();
            configCreator._apply();
          }
        });

      },

      _buildContentConfig: function (content) {
        // Backwards compatibility with tags
        var config = convertTags({}, content.tags);
        // Extend with content's ui prop to get final content config
        extendConfig(config, content.ui || {});
        this.contentConfig = config;
      },

      _buildApplicationConfig: function (config) {
        config = convertDotKeys(config || {});

        extendConfig(this.applicationConfig, config);
      },

      _extend: function () {
        var config = angular.extend({}, BASE_CONFIG);

        // Extend with content configs and app provided config, in desired order
        var configs = [this.contentConfig, this.bookmarkConfig];

        for (var i = 0; i < configs.length; i++) {
          extendConfig(config, configs[i]);
        }

        // Extend config with search params in url
        extendConfig(config, this.urlConfig);

        // The last word goes to the application / RPC layer
        extendConfig(config, this.applicationConfig);

        this.config = config;
        return this.config;
      },

      _apply: function (async) {
        $rootScope.uiComponents.config = this.config; // Make globally available
        $rootScope[async ? '$applyAsync' : '$apply']();
      }

    };

  };
  $get.$inject = ['$window', '$rootScope', '$filter', 'BASE_CONFIG', 'Human'];

  return {
    $get: $get
  };

});


angular.module('humanUI.crossSection', [])

.factory('Clip', ['Human', function (Human) {
  return {
    MAP: [ // Ordered clip planes with display names
      { view: 'Anterior', clip: Human.view.clip.FRONT },
      { view: 'Posterior', clip: Human.view.clip.BACK },
      { view: 'Left', clip: Human.view.clip.LEFT },
      { view: 'Right', clip: Human.view.clip.RIGHT },
      { view: 'Superior', clip: Human.view.clip.TOP },
      { view: 'Inferior', clip: Human.view.clip.BOTTOM }
    ],
    state: {
      current: null
    },
    show: function (clip) {
      // Invisible until further input
      Human.view.clip.setClip({ state: 'clipping' });
      Human.view.clip.selectClip(clip);
      Human.view.clip.setClip({ state: 'visible' }); // Reset input
    },
    reset: function () {
      // Workaround for engine bug
      angular.forEach(Human.view.clip.clips, function (clip) {
        clip.progress = 0;
      });

      Human.view.clip.reset();

      this.state.current = this.MAP[0];
      this.show(this.state.current.clip);
    }
  };
}])

.directive('humanCameraClip', ['$window', 'Human', function ($window, Human) {
  var vec3 = ($window.vec3 && $window.vec3.create) || Human.math.vec3;

  var eyeVec = vec3();
  var lookVec = vec3();
  var tempVec3 = vec3();

  var camera = Human.view.camera;
  var startNear = camera.near;

  var vectorLength;

  var getLookDistance = function () {
    eyeVec[0] = camera.eye.x;
    eyeVec[1] = camera.eye.y;
    eyeVec[2] = camera.eye.z;

    lookVec[0] = camera.look.x;
    lookVec[1] = camera.look.y;
    lookVec[2] = camera.look.z;

    if($window.vec3) {
      $window.vec3.sub(tempVec3, eyeVec, lookVec);
      vectorLength = $window.vec3.length(tempVec3);
    } else {
      Human.math.subVec3(eyeVec, lookVec, tempVec3);
      vectorLength = Human.math.lenVec3(tempVec3);
    }

    return $window.Math.abs(vectorLength);
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
    link: function (scope, element) {
      element.on('click', function () {
        var i = Clip.state.current ? Clip.MAP.indexOf(Clip.state.current) : 0;
        i = i === Clip.MAP.length - 1 ? 0 : i + 1;

        Clip.state.current = Clip.MAP[i];
        Clip.show(Clip.state.current.clip);

        scope.$apply();
      });
    }
  };
}])

.directive('resetSectionPlane', ['Clip', function (Clip) {
  return {
    restrict: 'A',
    link: function (scope, element) {
      element.on('click', function () {
        Clip.reset();

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

          if(data.fraction === 0) { // Workaround for engine bug
            Human.view.clip.selectedClip._setProgress(0);
          }
        }
      };

      Human.events.on('clip.updated', function(params) {
        scope.config.value = params.progress || 0;
        scope.$apply();
      });
    }
  };
}])

.directive('humanCrossSection', ['$parse', '$timeout', 'Clip', function ($parse, $timeout, Clip) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/cross-section/controls.html',
    link: function (scope, element, attr) {

      var setState = function (show) {
        $timeout(function () {
          Human.view.clip.setClip({
            clipId: Clip.state.current.clipId,
            state: show ? 'visible' : 'clipping'
          });
        });
      };

      Clip.state.current = Clip.MAP[0];

      scope.state = Clip.state;

      scope.tooltipText = {
        select: 'Select Plane',
        reset: 'Reset'
      };

      if(attr.tooltipText) {
        angular.extend(scope.tooltipText, $parse(attr.tooltipText)({}));
      }

      element.on('crossSectionToggle', function (e, on) {
        setState(on);
      });
    }
  };
}])

.directive('humanCrossSectionToggle',
  ['$document', 'Clip', 'ElementDisplay', function ($document, Clip, ElementDisplay) {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'templates/cross-section/toggle.html',
      link: function (scope, element, attr) {
        var targetEl;

        if(attr.hasOwnProperty('target')) {
          targetEl = angular.element($document[0].querySelector(attr.target));
        } else {
          targetEl = element.next();  // Default to next element
        }

        // Either target element
        ElementDisplay.create({
          trigger: element,
          target: targetEl,
          eventName: 'crossSectionToggle',
          globalClose: attr.hasOwnProperty('globalClose')
        });

        element.on('crossSectionToggle', function (e, on) {
          scope.callbacks.model = on;
          scope.$apply();
        });

        scope.info = 'Cross Section';

        scope.callbacks = { // Trying out ElementDisplay here instead
          on: angular.noop,
          off: angular.noop
        };

        scope.$watch('uiComponents.config.crossSection', function (n) {
          scope.show = !!n;
        });
      }
    };
  }]
);

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

.directive('humanDissectUndo', function () {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/dissect/undo.html',
    link: function (scope) {
      scope.info = 'Undo Dissect [Ctrl + Z]';

      scope.$watch('uiComponents.config.dissect', function (n) {
        scope.show = !!n;
      });
    }
  };
})

.directive('humanDissect', ['$parse', 'Human', function ($parse, Human) {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/dissect/dissect.html',
    link: function (scope) {
      var setDissect = function (enabled) {
        /* Still using rpc as it is the only place that has logic to update
           other view states */
        Human.rpc.call(null, 'dissect.setEnabled', { enabled: enabled });
      };

      scope.info = 'Dissect [Ctrl + X]';

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
  var documentElement = $$document.documentElement;

  var candidates = {
    request: [
      documentElement.requestFullscreen,
      documentElement.webkitRequestFullscreen,
      documentElement.mozRequestFullScreen,
      documentElement.msRequestFullscreen
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
      this.request = fullScreen.request.bind(documentElement);
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
    props: ['title', 'displayName', 'description'], // Props we want to store
    precedence: ['bookmark', 'chapter', 'module']
  };

  var state = {
    info: { // Objects we want to keep track of
      bookmark: null,
      chapter: null,
      module: null
    },
    bookmarkRestoring: false,
    current: null,
    precedence: angular.copy(config.precedence)
  };

  var $get = function ($filter, Human) {

    var updateCurrent = function () {
      var _info;

      for (var i = 0; i < config.precedence.length; i++) {
        _info = state.info[ config.precedence[i] ];

        if(angular.isObject(_info)) {
          if(_info.title || _info.description) {
            state.current = config.precedence[i];
            return;
          }
        }
      }

      state.current = null;
    };

    var setPrecedence = function (precedence) {
      config.precedence = angular.copy(precedence);
      state.precedence = precedence;

      updateCurrent();
    };

    var setInfo = function (prop, input) {
      if(!state.info.hasOwnProperty(prop) || !input) {
        return null;
      }

      // Normalize chapter data structure
      if(prop === 'chapter' && input.info) {
        input = input.info;
      }

      var output = {};

      for (var idx = 0; idx < config.props.length; idx++) {
        var id = config.props[idx];

        if(input.hasOwnProperty(id)) {
          var value = input[id];

          // Normalize to title property
          if(id === 'displayName') {
            id = 'title';
          }

          if(config.modifyLinks) {
            value = $filter('modifyLinks')(value);
          }

          output[id] = value;
        }
      }

      state.info[prop] = output;
      updateCurrent();
    };

    var clearInfo = function () {
      for (var id in state.info) {
        if(state.info.hasOwnProperty(id)) {
          state.info[id] = null;
        }
      }
    };

    Human.events.on('bookmarks.restoring', function () {
      state.bookmarkRestoring = true;
    });

    Human.events.on('bookmarks.restored', function (bookmark) {
      state.bookmarkRestoring = false;
      setInfo('bookmark', bookmark);
    });

    Human.events.on('timeline.chapters.activated', function (params) {
      setInfo('chapter',
        Human.timeline.activeRoot._chapters[params.newChapterIndex]);
    });

    Human.events.on('modules.activate.finish', function (params) {
      var module = Human.modules.activeModules[params.moduleId];

      if(!config.baseAnatomy) {
        module = $filter('excludeBaseAnatomy')(module);
      }

      setInfo('module', module);
    });

    Human.events.on('modules.deactivate.finish', clearInfo);

    return {
      state: state,
      setPrecedence: setPrecedence,
      setInfo: setInfo
    };
  };
  $get.$inject = ['$filter', 'Human'];

  return {
    $get: $get,
    config: function (extensions) {
      angular.extend(config, extensions);
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

.directive('humanInfo', ['$filter', 'Info', function ($filter, Info) {

  return {
    restrict: 'A',
    scope: true,
    link: function (scope) {

      var setInfo = function () {
        var current = Info.state.current;

        if(current && !Info.state.bookmarkRestoring) {
          var info = angular.copy(Info.state.info[current]);

          if(info.description) {
            info.description = $filter('parseActions')(info.description);
          }

          scope.info = info;
        } else {
          scope.info = null;
        }
      };

      scope.state = Info.state;
      scope.info = null;

      scope.show = false;

      scope.$watch('state.current', setInfo);
      scope.$watchCollection('state.info', setInfo);

      scope.$watch('info', function (n) {
        scope.show = !!n;
      });
    }
  };
}]);


angular.module('humanUI.load', [])

.directive('humanLoadProgress', ['Human', '$timeout', function (Human, $timeout) {
  var DEFAULT_ASSET_TYPES = 'geometry material transform morph';

  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'templates/load/progress.html',
    link: function (scope, element, attrs) {
      var showAssetTypes = attrs.showAssetTypes || DEFAULT_ASSET_TYPES;

      var show;
      var suppress = false;
      scope.statusText = 'Loading...';
      scope.progressPercent = '0%';

      Human.events.on('modules.activate.start', function (params) {
        suppress = false;
        var module = Human.modules.modules[params.moduleId];
        scope.statusText = 'Loading ' + module.displayName + '...';
      });

      Human.events.on('assets.load.start', function () {
        scope.show = show && !suppress;
        scope.$digest();
      });

      Human.events.on('assets.load.progress', function (data) {
        if (suppress) {
          return;
        }
        var ratio = data.receivedAssets / data.requestedAssets;

        scope.curAssetType = data.assetType;

        scope.progressPercent = Math.floor(ratio * 100) + '%';
        scope.show = show && showAssetTypes.indexOf(data.assetType) >= 0;

        // Set width internally here, for use with 'bar' mode
        element[0].style.width = scope.progressPercent;

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

      Human.events.on('module.interactive', function() {
        suppress = true;
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

.constant('AUDIO_PATH', '/content/states/{{ fullUrl }}')

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

      var path = $interpolate(AUDIO_PATH)({'fullUrl': clip.fullUrl});
      var type = path.match(/\.(\w+)$/);
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
      var configShow = false;
      var suggestedShow = false;

      var setShown = function () {
        scope.show = configShow && suggestedShow;
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

      Human.events.on('audio.suggestedClipInfo', function(clip) {
        audioEl.src = Media.getSupportedSrc(clip);

        suggestedShow = !!audioEl.src;

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
      scope.info = 'X-Ray Mode [T]';

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
      scope.info = 'Isolate Mode [I]';

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

angular.module('humanUI.rpc', [])

.factory('RpcDefinitions',
  ['$document', '$filter', 'ConfigCreator', 'Human', 'HumanSnapshot', 'HumanBackground', 'HotspotData', 'Hotspot', 'HOTSPOT_TYPES', function (
    $document, $filter,
    ConfigCreator, Human, HumanSnapshot, HumanBackground, HotspotData, Hotspot,
    HOTSPOT_TYPES
  ) {

    return {
      init: function () {
        var styleTag = $document[0].querySelector('[rpc-styles]');

        // Redefine older version in engine
        Human.rpc.define('injectStyles', function (styles) {
          if(styleTag) {
            if (styleTag.styleSheet) {
              styleTag.styleSheet.cssText = styles;
            } else {
              styleTag.appendChild($document[0].createTextNode(styles));
            }

            // Redraw annotations in case the new styles have affected them
            Human.view.annotations.updateDimensions();
            Human.view.annotations.layouts.redrawLayout();
          }
        }, { hidden: true });

        /** @see /doc/get-display.js */
        var toFilter = ['bookmarkTour', 'loadProgress'];

        Human.rpc.define('ui.getDisplay', function () {
          var config = {};

          angular.forEach(ConfigCreator.config, function (value, key) {
            if(toFilter.indexOf(key) === -1) {
              config[key] = value;
            }
          });

          this.setResult(config);
        });

        /** @see /doc/set-display.js */
        Human.rpc.define('ui.setDisplay', function (displayConfig) {
          ConfigCreator._buildApplicationConfig(displayConfig);
          ConfigCreator._extend();
          ConfigCreator._apply();
        });

        var getSnapshot = function (params) {
          var self = this;

          HumanSnapshot.get(params, function (image) {
            self.setResult(image.src);
          });
        };

        // Hidden aliases for backwards compatibility
        Human.rpc.define('snapshot.get', getSnapshot, { hidden: true });
        Human.rpc.define('scene.snapshot', getSnapshot, { hidden: true });

        /** @see /doc/snapshot.js */
        Human.rpc.define('ui.snapshot', getSnapshot);

        /** @see /doc/get-background.js */
        Human.rpc.define('ui.getBackground', function () {
          var _backgroundData = HumanBackground.getBackgroundData();

          // Only return 255 scale values
          var backgroundData = {
            colors: [
              _backgroundData.colors[0]['255'],
              _backgroundData.colors[1]['255']
            ],
            colorStops: [
              _backgroundData.colors[0]['stop'],
              _backgroundData.colors[1]['stop']
            ],
            gradientType: _backgroundData.gradientType
          };

          this.setResult(backgroundData);
        });

        /** @see /doc/set-background.js */
        Human.rpc.define('ui.setBackground', function (background) {
          if(background.hasOwnProperty('colors')) {
            HumanBackground.setColors(background.colors);
          }

          if(background.hasOwnProperty('colorStops')) {
            HumanBackground.setColorStops(background.colorStops);
          }

          if(background.hasOwnProperty('gradientType')) {
            HumanBackground.setGradientType(background.gradientType);
          }
        });

        /** @see /doc/get-world-position.js */
        Human.rpc.define('ui.getWorldPosition', function (canvasPosition) {
          var x = canvasPosition.x;
          var y = canvasPosition.y;

          var result = Human.renderer.pick(x, y, true);

          if(result) {
            var worldPos = Array.prototype.slice.call(result.worldPos);

            result = formatPosition(worldPos, 'object');
          } else {
            result = null;
          }

          this.setResult(result);
        });

        /* Hotspots */

        // Add created, destroyed, (updated) events?
        // You would have to add instantiated and deinstantiated?

        // HELPER FUNCTIONS

        var formatPosition = $filter('formatPosition');

        // Whitelists and setter functions for hotspot properties via the API
        var INPUT_FILTER = {
          position: function (object, value) {
            object.pos = formatPosition(value, 'array');
          },

          direction: function (object, value) {
            object.dir = formatPosition(value, 'array');
          },

          chapterScope: function (object, value) {
            object.chapterScope = value;
          },

          shown: function (object, value) {
            object.shown = value;
          },

          type: function (object, value) {
            object.type = value;
          },

          title: function (object, value) {
            object.title = value;
          },

          objectId: function (object, value) {
            object.objectId = value;
          },

          data: function (object, value) {
            object.data = value;
          }
        };

        var OUTPUT_FILTER = {
          id: function (object, value) {
            object.id = value;
          },

          pos: function (object, value) {
            object.position = formatPosition(value, 'object');
          },

          dir: function (object, value) {
            object.direction = formatPosition(value, 'object');
          },

          canvasPos: function (object, value) {
            object.canvasPosition = formatPosition(value, 'object');
          },

          chapterScope: function (object, value) {
            object.chapterScope = value;
          },

          shown: function (object, value) {
            object.shown = value;
          },

          type: function (object, value) {
            object.type = value;
          },

          title: function (object, value) {
            object.title = value;
          },

          objectId: function (object, value) {
            object.objectId = value;
          },

          data: function (object, value) {
            object.data = value;
          }
        };

        var filterData = function (srcObject, filter) {
          var destObject = {};

          for(var key in filter) {
            if(
              filter.hasOwnProperty(key) &&
              srcObject.hasOwnProperty(key)
            ) {
              filter[key](destObject, srcObject[key]);
            }
          }

          return destObject;
        };

        /** @see /doc/hotspots-create.js */
        Human.rpc.define('hotspots.create', function (hotspotData) {
          hotspotData = filterData(hotspotData, INPUT_FILTER);

          HotspotData.add(hotspotData);

          var hotspotId = HotspotData.getCurrentId() - 1;

          // Determine if we need to instantiate immediately
          var chapters = Human.timeline.activeRoot._chapters;
          var currentChapter = Human.timeline.activeRoot._nowBranch;
          var currentChapterIndex = chapters.indexOf(currentChapter);

          if(
            !angular.isDefined(hotspotData.chapterScope) ||
            hotspotData.chapterScope === currentChapterIndex
          ) {

            var hotspot = Hotspot.create(HotspotData.all[hotspotId]);

            // Only render if a template is present
            if(hotspot.template) {
              hotspot.render();
            }
          }

          this.setResult(hotspotId);
        });

        /** @see /doc/hotspots-info.js */
        // This returns info only on currently instantiated hotspots
        Human.rpc.define('hotspots.info', function (hotspotId) {
          // RPC mysteriously turns no arguments into an empty object
          if(angular.isObject(hotspotId)) {
            hotspotId = undefined;
          }

          var result = null;

          if(hotspotId) {
            result = filterData(Hotspot.get(hotspotId), OUTPUT_FILTER);
          } else {
            result = [];

            for (var i = 0; i < Hotspot.hotspots.length; i++) {
              result.push(filterData(Hotspot.hotspots[i], OUTPUT_FILTER));
            }
          }

          this.setResult(result);
        });

        /** @see /doc/hotspots-update.js */
        Human.rpc.define('hotspots.update', function (hotspotUpdate) {
          var id = hotspotUpdate.id;
          var srcData = HotspotData.all[id];

          if(!srcData) {
            return;
          }

          hotspotUpdate = filterData(hotspotUpdate, INPUT_FILTER);

          HotspotData.update(id, hotspotUpdate);

          // Re-instantiate hotspot if need be
          var hotspot = Hotspot.get(id);

          if(hotspot) {
            Hotspot.destroy(hotspot);

            hotspot = Hotspot.create(srcData);

            // Only render if a template is present
            if(hotspot.template) {
              hotspot.render();
            }
          }
        });

        /** @see /doc/hotspots-destroy.js */
        Human.rpc.define('hotspots.destroy', function (hotspotId) {
          var hotspot = Hotspot.get(hotspotId);

          if(hotspot) {
            Hotspot.destroy(hotspot);
          }

          HotspotData.remove(hotspotId);
        });

        var setShown = function (hotspotId, shown) {
          if(hotspotId) {
            Hotspot.get(hotspotId).setShown(shown);
          } else {
            for (var i = 0; i < Hotspot.hotspots.length; i++) {
              Hotspot.hotspots[i].setShown(shown);
            }
          }
        };

        /** @see /doc/hotspots-show.js */
        Human.rpc.define('hotspots.show', function (hotspotId) {
          // RPC mysteriously turns no arguments into an empty object
          if(angular.isObject(hotspotId)) {
            hotspotId = undefined;
          }

          setShown(hotspotId, true);
        });

        /** @see /doc/hotspots-hide.js */
        Human.rpc.define('hotspots.hide', function (hotspotId) {
          if(angular.isObject(hotspotId)) {
            hotspotId = undefined;
          }

          setShown(hotspotId, false);
        });

        /** @see /doc/hotspots-types.js */
        Human.rpc.define('hotspots.types', function () {
          var types = Object.keys(HOTSPOT_TYPES).map(function (type) {
            return $filter('dashNormalize')(type);
          });

          this.setResult(types);
        });

        // Hotspot Events

        var positionUpdate = {};

        /** @see /doc/hotspots-position-updated.js */
        Human.rpc.defineEvent('hotspots.positionUpdated', {
          events: ['hotspots.positionUpdated'],
          map: function (data) {
            OUTPUT_FILTER.id(positionUpdate, data.id);
            OUTPUT_FILTER.canvasPos(positionUpdate, data.canvasPos);

            return positionUpdate;
          }
        });

        /** @see /doc/hotspots-display-updated.js */
        Human.rpc.defineEvent('hotspots.displayUpdated');

        /** @see /doc/hotspots-picked.js */
        Human.rpc.defineEvent('hotspots.picked');

        /** @see /doc/hotspots-entered.js */
        Human.rpc.defineEvent('hotspots.entered');

        /** @see /doc/hotspots-left.js */
        Human.rpc.defineEvent('hotspots.left');

      }
    };

  }]
);

angular.module('humanUI.scene', [])

.factory('ObjectOpacities', ['Human', 'SceneObjects', function (Human, SceneObjects) {
  var leaves = [];
  var threshold = 0;
  var originalState = {};

  var newI = 0;
  var oldI = 0;

  var newObject, objectId, relativeDiff, i;

  var element;

  return {
    data: {
      objectIds: []
    },

    newObjectsEvent: 'objectSlider.objectIds',

    // Set the array of objectIds and record their original states
    init: function (objectIds) {
      this.resetScene();

      if(!objectIds) {
        var defaults = SceneObjects.getFromRoots();

        objectIds = defaults.map(function (object) {
          return object.objectId;
        });
      }

      // Reset relevant variables
      this.data.objectIds = objectIds;

      threshold = 1 / objectIds.length;
      leaves = [];
      originalState = {};

      newI = oldI = 0;

      newObject = objectId = relativeDiff = i = undefined;

      // Record original states for resetting
      objectIds.forEach(function (objectId) {
        var _leaves = Human.scene.objects[objectId].getLeafObjects();

        for (i = 0; i < _leaves.length; i++) {
          originalState[ _leaves[i].objectId ] = {
            opacity: _leaves[i].opacity
          };
        }

        var enabled = Human.scene.enabledObjects.hasOwnProperty(objectId);

        if(originalState[objectId]) {
          originalState[objectId].enabled = enabled;
        } else {
          originalState[objectId] = { enabled: enabled };
        }

      });

      element.triggerHandler(this.newObjectsEvent);
    },

    // Reset opacity props on all leaf objects to their
    // Original state
    // Reset enabled property of each object to its original state
    resetScene: function () {
      var state, object;

      var update = {};

      for(var id in originalState) {
        if(originalState.hasOwnProperty(id)) {
          state = originalState[id];
          object = Human.scene.objects[id];

          if(state.hasOwnProperty('enabled')) {
            update[id] = state.enabled;
          }

          if(state.hasOwnProperty('opacity')) {
            object.setOpacity(state.opacity);
          }
        }
      }

      Human.scene.setEnabledObjects({ objects: update });
    },

    set: function (fraction) {
      var update = {};

      // Keep track of change of indices
      newI = Math.floor(fraction / threshold);

      if(newI !== newI) { // Convert NaN to 0
        newI = 0;
      }

      newObject = newI !== oldI;

      objectId = this.data.objectIds[newI];

      // Work to be done only when the current object changes
      if(newObject) {

        // Restore the opacity of all leaves
        // between oldI and newI (not including newI) before re-assigning
        var diff = Math.abs(newI - oldI);
        var dir = (newI - oldI) / diff;

        var  _leaves = [];
        var _objectId;

        i = oldI;

        var _setOpacity = function (leaf) {
          leaf.setOpacity(dir === -1 ? 1 : 0);
        };

        while(i !== newI) {
          _objectId = this.data.objectIds[i];

          if(_objectId) {
            _leaves = _leaves.concat(
              Human.scene.objects[_objectId].getLeafObjects());

            _leaves.forEach(_setOpacity);
          }

          i += dir;
        }

        // Updates current leaves array
        leaves = objectId ?
        Human.scene.objects[objectId].getLeafObjects() : [];

        // Build the enabled objects update
        for (i = 0; i < this.data.objectIds.length; i++) {
          update[ this.data.objectIds[i] ] = newI <= i;
        }

        Human.scene.setEnabledObjects({ objects: update });
      }

      // Set the opacity for all current leaf objects on every change
      if(leaves.length) {
        relativeDiff = (fraction - threshold * newI) / threshold;

        leaves.forEach(function (leaf) {
          leaf.setOpacity(1 - relativeDiff);
        });
      }

      oldI = newI;
    },

    setElement: function (_element) {
      element = _element;
    }
  };
}])

.directive('humanObjectSlider', ['Human', 'ObjectOpacities', function (Human, ObjectOpacities) {
  return {
    restrict: 'E',
    templateUrl: 'templates/scene/object-slider.html',
    scope: true,
    link: function (scope, element, attr) {
      var sliderObjects = element.find('object-slider-objects')[0];
      var axis = attr.axis || 'y';

      var chaptersActivated = false;
      var configShow = false;

      var objectIds = null;

      var setOffsets = function () {
        var threshold = 1 / ObjectOpacities.data.objectIds.length;
        var prop = axis === 'x' ? 'left' : 'top';

        for (var i = 0; i < sliderObjects.children.length; i++) {
          var child = sliderObjects.children[i];
          child.style[prop] = (i * threshold * 100) + '%';
        }
      };

      var setObjectsClass = function (fraction) {
        var prop = axis === 'x' ? 'left' : 'top';

        for (var i = 0; i < sliderObjects.children.length; i++) {
          var $child = angular.element(sliderObjects.children[i]);
          var _fraction = parseInt($child[0].style[prop]) / 100;
          var method = fraction >= _fraction ? 'addClass' : 'removeClass';

          $child[method]('on');
        }
      };

      var setShow = function () {
        scope.show = configShow && chaptersActivated;
      };

      scope.config = {
        axis: axis,
        change: function (data) {
          ObjectOpacities.set(data.fraction);
          setObjectsClass(data.fraction);
        }
      };

      // Used by object tick marks
      scope.setOpacity = function (index) {
        var threshold = 1 / ObjectOpacities.data.objectIds.length;
        var fraction = index * threshold;

        ObjectOpacities.set(fraction);
        setObjectsClass(fraction);

        scope.config.value = fraction;
      };

      ObjectOpacities.setElement(element);

      // Reset UI with a new set of objectIds.
      element.on(ObjectOpacities.newObjectsEvent, function () {
        scope.objectIds = ObjectOpacities.data.objectIds;
        scope.config.value = 0;

        scope.$digest();

        setOffsets();
      });

      Human.events.on('timeline.chapters.activated', function () {
        if(!chaptersActivated) {
          chaptersActivated = true;

          setShow();
          scope.$apply();

          if(scope.show) {
            ObjectOpacities.init(objectIds);
          }
        }
      });

      scope.$watch('uiComponents.config.objectSlider', function (n) {
        var hasObjects = angular.isObject(n) && n.objects;
        var hasData = angular.isObject(n) && n.data;

        element[hasObjects ? 'addClass' : 'removeClass']('objects');

        if(hasData) {
          objectIds = n.data;

          if(angular.isString(objectIds)) {
            objectIds = objectIds.split(',');
          }
        }

        configShow = !!n;
        setShow();
      }, true);

    }
  };
}])

.factory('ObjectRendered', ['$timeout', 'Human', function ($timeout, Human) {

  var ObjectRendered = function (collection, element) {
    this.collection = collection;
    this.element = element;

    this.flagged = {};
    this.liQueue = [];

    this.assetCount = 0;
    this.maxQueueLength = 1;

    this.boundLoadProgress = this.onAssetLoadProgress.bind(this);
    this.boundObjectRenderable = this.onObjectRenderable.bind(this);
    this.boundAssetAttachFinish = this.onAssetAttachFinish.bind(this);

    this.addHandlers();

    this.element.data('objectRendered', this);
  };

  ObjectRendered.create = function (element) {
    var collection = element.data('humanCollection');

    if(collection) {
      var objectRendered = element.data('objectRendered');
      return objectRendered || new ObjectRendered(collection, element);
    }
  };

  ObjectRendered.prototype.setMaxQueueLength = function () {
    this.maxQueueLength = Math.floor(this.assetCount / 100);

    if(this.maxQueueLength < 1) {
      this.maxQueueLength = 1;
    }

    if(this.maxQueueLength > 20) {
      this.maxQueueLength = 20;
    }
  };

  ObjectRendered.prototype.paintAndReset = function () {
    for (var i = 0; i < this.liQueue.length; i++) {
      this.liQueue[i].addClass('anatomy-rendered');
    }

    this.liQueue.length = 0;
  };

  ObjectRendered.prototype._updateRendered = function (objectId, queue) {
    var object = Human.scene.objects[objectId];

    if(object && object.isRenderable()) {

      while(object) {
        if(this.flagged[object.objectId]) {
          break;
        }

        var li = this.collection.getLi(object.objectId);

        if(li) {
          if(queue) {
            this.liQueue.push(li);

            if(this.liQueue.length === this.maxQueueLength) {
              this.paintAndReset();
            }
          } else {
            li.addClass('anatomy-rendered');
          }

          this.flagged[object.objectId] = true;
        }

        object = object.parent;
      }

    }
  };

  ObjectRendered.prototype.updateRendered = function () {
    for(var id in this.collection.lis) {
      if(this.collection.lis.hasOwnProperty(id)) {
        this._updateRendered(id, false);
      }
    }

    this.flagged = {};
  };

  // Ensure new handlers are added once
  ObjectRendered.prototype.addHandlers = function () {
    Human.events.off('assets.load.progress', this.boundLoadProgress);
    Human.events.on('assets.load.progress', this.boundLoadProgress);

    Human.events.off('scene.objectRenderable', this.boundObjectRenderable);
    Human.events.on('scene.objectRenderable', this.boundObjectRenderable);

    Human.events.off('graph.assetAttach.finish', this.boundAssetAttachFinish);
    Human.events.on('graph.assetAttach.finish', this.boundAssetAttachFinish);
  };

  ObjectRendered.prototype.removeHandlers = function () {
    Human.events.off('assets.load.progress', this.boundLoadProgress);
    Human.events.off('scene.objectRenderable', this.boundObjectRenderable);
    Human.events.off('graph.assetAttach.finish', this.boundAssetAttachFinish);
  };

  ObjectRendered.prototype.onAssetLoadProgress = function (data) {
    if(this.assetCount === 0) {
      this.assetCount = data.requestedAssets;
      this.setMaxQueueLength();
    }
  };

  ObjectRendered.prototype.onObjectRenderable = function (data) {
    var objectRendered = this;

    $timeout(function () {
      objectRendered._updateRendered(data.objectId, true);
    });
  };

  ObjectRendered.prototype.onAssetAttachFinish = function () {
    var objectRendered = this;

    $timeout(function () {
      objectRendered.paintAndReset(); // Finish outstanding lis
      objectRendered.flagged = {};
      objectRendered.assetCount = 0;
    });
  };

  return ObjectRendered;
}])

.factory('ObjectEnabled', ['$timeout', 'Human', function ($timeout, Human) {

  var ObjectEnabled = function (collection, element) {
    this.collection = collection;
    this.element = element;

    var onObjectShow = this.onObjectShow.bind(this);
    var onObjectsShown = this.onObjectsShown.bind(this);

    this.element.off('click.objectShow', onObjectShow);
    this.element.on('click.objectShow', onObjectShow);

    Human.events.off('scene.objectsShown', onObjectsShown);
    Human.events.on('scene.objectsShown', onObjectsShown);

    this.element.data('objectEnabled', this);
  };

  // Class Methods

  ObjectEnabled.create = function (element) {
    var collection = element.data('humanCollection');

    if(collection) {
      var objectEnabled = element.data('objectEnabled');
      return objectEnabled || new ObjectEnabled(collection, element);
    }
  };

  ObjectEnabled.toggleEnabledAnatomy = function (enabled, objectId) {
    var object = {};
    object[objectId] = enabled;

    Human.scene.setEnabledObjects({ objects: object });
  };

  // Instance Methods

  ObjectEnabled.prototype.update = function (enabled, objectId) {
    var parentLi = this.collection.getLi(objectId);

    if(parentLi) {
      parentLi[enabled ? 'addClass' : 'removeClass']('anatomy-enabled');
    }
  };

  ObjectEnabled.prototype.onObjectShow = function (e, data) {
    var eventTarget = (data && data.target) || e.target;

    if(eventTarget.hasAttribute('object-enabled')) {
      e.stopPropagation();

      var objectId = eventTarget.getAttribute('object-enabled');

      var parentLi = this.collection.getLi(objectId);
      parentLi.toggleClass('anatomy-enabled');

      var enabled = parentLi.hasClass('anatomy-enabled');
      ObjectEnabled.toggleEnabledAnatomy(enabled, objectId);
    }
  };

  ObjectEnabled.prototype.onObjectsShown = function (params) {
    var objectEnabled = this;
    var updatedSet = params['enabledObjectsUpdate'];

    $timeout(function () {
      angular.forEach(updatedSet, objectEnabled.update, objectEnabled);
    });
  };

  return ObjectEnabled;
}])

.provider('ObjectSelected', function () {
  // Global config
  var _config = { selectOpen: true, deselectClose: true };

  var $get = function ($timeout, Human, TreeCollapse) {

    var ObjectSelected = function (collection, element) {
      this.collection = collection;
      this.element = element;
      this.config = angular.copy(_config); // Inherit from global

      this.throttle = false;

      var onObjectSelect = this.onObjectSelect.bind(this);
      var onObjectsSelected = this.onObjectsSelected.bind(this);

      this.element.off('click.objectSelect', onObjectSelect);
      this.element.on('click.objectSelect', onObjectSelect);

      Human.events.off('scene.objectsSelected', onObjectsSelected);
      Human.events.on('scene.objectsSelected', onObjectsSelected);

      this.element.data('objectSelected', this);
    };

    // Class Methods

    ObjectSelected.create = function (element) {
      var collection = element.data('humanCollection');

      if(collection) {
        var objectSelected = element.data('objectSelected');
        return objectSelected || new ObjectSelected(collection, element);
      }
    };

    // Instance Methods

    ObjectSelected.prototype.selectAnatomy = function (objectId) {
      var objectSelected = this;
      var multiPickEnabled = Human.view.pick.getMultiPickEnabled();

      Human.view.focus.focusObject({
        objectId: objectId,
        replace: !multiPickEnabled,
        flyTo: multiPickEnabled ? 'none' : 'newSelected'
      }, function () {
        objectSelected.throttle = false;
      });
    };

    ObjectSelected.prototype.onObjectSelect = function (e, data) {
      var eventTarget = (data && data.target) || e.target;

      if(eventTarget.hasAttribute('object-selected')) {
        e.stopPropagation();

        var objectId = eventTarget.getAttribute('object-selected');
        var parentLi = this.collection.getLi(objectId);

        this.throttle = true;
        this.selectAnatomy(objectId);

        var target = TreeCollapse.getTarget(parentLi);

        if(target) {
          TreeCollapse.show(target);
        }
      }
    };

    ObjectSelected.prototype.update = function (selected, objectId) {
      var parentLi = this.collection.getLi(objectId);
      var target = TreeCollapse.getTarget(parentLi);

      if(parentLi) {
        parentLi[selected ? 'addClass' : 'removeClass']('anatomy-selected');

        if(target) {
          // Open / close all child lists in tree when selecting from scene
          if(this.config.selectOpen && selected && !this.throttle) {
            TreeCollapse.show(target, { animate: false });
          }

          if(this.config.deselectClose && !selected) {
            TreeCollapse.hide(target, { animate: false });
          }
        }

      }
    };

    ObjectSelected.prototype.onObjectsSelected = function (params) {
      var objectSelected = this;
      var updatedSet = params['selectedObjectsUpdate'];

      $timeout(function () {
        angular.forEach(updatedSet, objectSelected.update, objectSelected);
      });
    };

    return ObjectSelected;
  };
  $get.$inject = ['$timeout', 'Human', 'TreeCollapse'];

  return {
    $get: $get,
    config: function (extensions) {
      angular.extend(_config, extensions);
    }
  };
})

.factory('SceneObjects',
  ['Human', 'ObjectEnabled', 'ObjectSelected', 'ObjectRendered', function (Human, ObjectEnabled, ObjectSelected, ObjectRendered) {

    var isExportObject = function (objectId) {
      return /export_ID$/.test(objectId);
    };

    return { // Filters out 'export object'
      getFromRoots: function () {
        var _objects = [];

        angular.forEach(Human.scene.rootObjects, function (rootObject) {

          angular.forEach(rootObject.objects, function (object) {
            if(isExportObject(object.objectId)) {
              _objects = _objects.concat(object.objects);
            } else {
              _objects.push(object);
            }
          });

        });

        return _objects;
      },

      getFromList: function () {
        var _objects = {};

        angular.forEach(Human.scene.objects, function (object, objectId) {
          if(object.parent && !isExportObject(objectId)) {
            _objects[objectId] = object;
          }
        });

        return _objects;
      },

      init: function (element) {
        ObjectRendered.create(element);
        ObjectEnabled.create(element);
        ObjectSelected.create(element);
      }
    };
  }]
)

.directive('humanObjectTree',
  ['$timeout', 'Human', 'SceneObjects', 'HumanKeySelect', function ($timeout, Human, SceneObjects, HumanKeySelect) {
    return {
      restrict: 'E',
      templateUrl: 'templates/scene/object-tree.html',
      scope: true,
      transclude: true,
      link: function (scope, element, attr) {
        var $tree = element.find('human-tree');

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

        scope.$watchCollection('rootObjects', function () {
          var show;

          if(hasRootObjects()) {
            $timeout(function () { // Init async to not interfere with engine
              scope.sceneObjects = SceneObjects.getFromRoots();
              SceneObjects.init($tree);
            });
          }

          if(angular.isObject(scope.uiComponents.config)) {
            show = !!scope.uiComponents.config.objectTree;
          } else {
            show = false;
          }

          setShown(show);
        });

        // Enable arrow key navigation on the list items
        var humanKeySelect = HumanKeySelect.create(element, null, {
          cycle: !attr.hasOwnProperty('noCycle'),
          onSelected: function ($selectedItem) {
            // Trigger the click handler registered on the list elements
            $tree.triggerHandler('click.objectSelect', {
              target: $selectedItem[0]
            });
          }
        });

        // Event based API for selecting an item
        scope.$on('humanObjectTree.selectItem', function (e, options) {
          humanKeySelect.selectItem(options);
        });

        $tree.on('humanCollection.built', function () {
          humanKeySelect.setItems($tree.find('a'));
        });

        // Component display configuration
        scope.$watch('uiComponents.config.objectTree', function (n) {
          setShown(!!n);
        });
      }
    };
  }]
)

.directive('humanObjectListSearch',
  ['$document', '$timeout', 'SceneObjects', function ($document, $timeout, SceneObjects) {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'templates/scene/object-list-search.html',
      link: function (scope, element, attr) {
        var displayNameMap = {};

        var $targetEl, key;

        if(attr.hasOwnProperty('target')) {
          $targetEl = angular.element($document[0].querySelector(attr.target));
        } else {
          $targetEl = element.next();  // Default to next element
        }

        var buildDisplayNameMap = function () {
          var $list = $targetEl.find('human-list');
          var humanCollection = $list.data('humanCollection');

          angular.forEach(scope.sceneObjects, function (sceneObject, id) {
            key = sceneObject.displayName.toLowerCase();

            if(!displayNameMap[key]) {
              displayNameMap[key] = [];
            }

            displayNameMap[key].push(humanCollection.getLi(id)[0]);
          });
        };

        var searchPlaceholder = 'Search Current 3D Model';

        if(attr.searchPlaceholder) {
          attr.$observe('searchPlaceholder', function (value) {
            scope.searchPlaceholder = value;
          });
        } else {
          scope.searchPlaceholder = searchPlaceholder;
        }

        scope.clearSearch = function () {
          var $input = element.find('input');

          $input.val('');
          $input.triggerHandler('change');
        };

        scope.searchList = function () {
          var searchExp, displayValue, match, i, key;

          var setDisplay = function (items, displayValue) {
            for (i = 0; i < items.length; i++) {
              items[i].style.display = displayValue;
            }
          };

          var searchText = scope.searchText.toLowerCase();
          var matches = 0;

          searchExp = new RegExp('^' + searchText + '|\\s' + searchText);

          for(key in displayNameMap) {
            if(displayNameMap.hasOwnProperty(key)) {
              match = searchExp.test(key);

              displayValue = match ? 'inherit' : 'none';
              setDisplay(displayNameMap[key], displayValue);

              if(match) {
                matches++;
              }
            }
          }

          scope.noResults = matches === 0;
          scope.searching = scope.searchText.length > 0;

          $targetEl.triggerHandler('objectListSearching', scope.searching);
        };

        // Mirrors humanObjectList
        scope._sceneObjects = Human.scene.objects;

        scope.$watchCollection('_sceneObjects', function (_sceneObjects) {
          if(Object.keys(_sceneObjects).length > 0 && $targetEl[0]) {
            $timeout(function () { // Init async to not interfere with engine
              scope.sceneObjects = SceneObjects.getFromList();

              $timeout(function () { // DOM is ready
                buildDisplayNameMap();
              });
            });
          }
        });

      }
    };
  }]
)

.directive('humanObjectList',
  ['$timeout', '$window', 'HumanKeySelect', 'SceneObjects', function ($timeout, $window, HumanKeySelect, SceneObjects) {
    return {
      restrict: 'E',
      templateUrl: 'templates/scene/object-list.html',
      scope: true,
      transclude: true,
      link: function (scope, element, attr) {
        var $list = element.find('human-list');
        var listEl = $list[0];

        var ulContainer;

        var rangeCropping = false;

        var removeCropping = function () {
          for (var i = 0; i < groupRanges.length; i++) {
            groupRanges[i].element.style.display = 'inherit';
          }

          ulContainer.style['margin-top'] = '0px';
          ulContainer.style['margin-bottom'] = '0px';
        };

        var setRangeCropping = function (crop) {
          // Prevent range cropping while in 'search' mode
          if(scope.searching && crop) {
            return;
          }

          if(crop) {
            setRanges();
            cropRanges();

            $list.off('scroll', cropRanges); // Ensure only one binding
            $list.on('scroll', cropRanges);
          } else {
            removeCropping();
            $list.off('scroll', cropRanges);
          }

          rangeCropping = crop;
        };

        var groupRanges = [];

        var setRanges = function () {
          var letterGroups = $list.find('li.letter-group'); // Using jQuery

          // All elements need to be shown to be accurate
          removeCropping();

          groupRanges = [];

          for (var i = 0; i < letterGroups.length; i++) {
            groupRanges.push({
              element: letterGroups[i],
              top: letterGroups[i].offsetTop,
              bottom: letterGroups[i].offsetTop + letterGroups[i].offsetHeight
            });
          }
        };

        var cropRanges = function () {
          if(!ulContainer || groupRanges.length === 0) {
            return;
          }

          var topIndex = 0;
          var bottomIndex = groupRanges.length;

          var i, groupRange;

          for (i = 0; i < groupRanges.length; i++) {
            groupRange = groupRanges[i];

            if(groupRange.bottom < listEl.scrollTop) {
              topIndex = i + 1;
            } else if(groupRange.top > listEl.scrollTop + listEl.clientHeight) {
              if(bottomIndex === groupRanges.length) {
                bottomIndex = i;
              }
            }
          }

          for (i = 0; i < topIndex; i++) {
            groupRanges[i].element.style.display = 'none';
          }

          for (i = topIndex; i < bottomIndex; i++) {
            groupRanges[i].element.style.display = 'inherit';
          }

          var marginBottom = 0;

          for (i = bottomIndex; i < groupRanges.length; i++) {
            marginBottom += (groupRanges[i].bottom - groupRanges[i].top);
            groupRanges[i].element.style.display = 'none';
          }

          ulContainer.style['margin-top'] = groupRanges[topIndex].top + 'px';
          ulContainer.style['margin-bottom'] = marginBottom + 'px';
        };

        scope.objectListConfig = {
          itemId: 'objectId',
          itemClasses: function (object) {
            return {
              'anatomy-rendered': object.isRenderable(),
              'anatomy-enabled': object.shown,
              'anatomy-selected': object.selected
            };
          },
          letterHeaders: true
        };

        scope._sceneObjects = Human.scene.objects;

        scope.$watchCollection('_sceneObjects', function (_sceneObjects) {
          if(Object.keys(_sceneObjects).length > 0) {
            $timeout(function () { // Init async to not interfere with engine
              scope.sceneObjects = SceneObjects.getFromList();
              SceneObjects.init($list);

              $timeout(function () { // DOM is ready
                ulContainer = $list.children()[0];
              });
            });
          }
        });

        // Communication from humanObjectListSearch
        element.on('objectListSearching', function (e, searching) {
          scope.searching = searching;
          element[searching ? 'addClass' : 'removeClass']('searching');

          // Turn off range cropping while searching
          setRangeCropping(!searching);
          listEl.scrollTop = 0;
        });

        // Event based API for range cropping
        scope.$on('objectListRanges.setCropping', function (e, crop) {
          setRangeCropping(crop);
        });

        scope.$on('objectListRanges.setRanges', setRanges);
        scope.$on('objectListRanges.crop', cropRanges);

        Human.events.on('graph.assetAttach.finish', function () {
          setRangeCropping(true);
        });

        // Enable arrow key navigation on the list items
        var humanKeySelect = HumanKeySelect.create(element, null, {
          cycle: !attr.hasOwnProperty('noCycle'),
          onSelected: function ($selectedItem) {
            // Trigger the click handler registered on the list elements
            $list.triggerHandler('click.objectSelect', {
              target: $selectedItem[0]
            });
          }
        });

        // Event based API for selecting an item
        scope.$on('humanObjectList.selectItem', function (e, options) {
          humanKeySelect.selectItem(options);
        });

        $list.on('humanCollection.built', function () {
          humanKeySelect.setItems($list.find('a'));
        });

      }
    };
  }]
);

angular.module('humanUI.snapshot', [])

.provider('HumanSnapshot', function () {
  var _config = {
    copyrightImagePath: null,
    copyrightText: {
      font: '12px Arial',
      fillStyle: '#666666',
      textAlign: 'center'
    }
  };

  var config = function (extensions) {
    if(extensions.copyrightImagePath) {
      _config.copyrightImagePath = extensions.copyrightImagePath;
    }

    if(angular.isObject(extensions.copyrightText)) {
      angular.extend(_config.copyrightText, extensions.copyrightText);
    }
  };

  var $get = function ($window, $document, $q, $timeout, Human) {
    var copyrightImageLoaded = false;
    var copyrightImage;

    var loadCopyrightImage = function () {
      copyrightImage = new $window.Image();

      copyrightImage.onload = function () {
        copyrightImageLoaded = true;
      };

      copyrightImage.src = _config.copyrightImagePath;
    };

    var createCopyright = function (context, width, height) {
      var x, y;

      // Write copy text
      angular.forEach(_config.copyrightText, function (value, key) {
        context[key] = value;
      });

      var text = [new Date().getFullYear(), String.fromCharCode(169)].join(' ');
      var textMetric = context.measureText(text);

      x = width / 2 - textMetric.width / 2;
      y = height - 10;

      context.fillText(text, x, y);

      // Draw Copyright Logo
      if(copyrightImageLoaded) {
        x = width / 2 - copyrightImage.width / 2;
        y = height - 20 - copyrightImage.height;

        context.drawImage(copyrightImage, x, y);
      }
    };

    var createBackground = function (context, backgroundData, width, height) {
      var gradient;

      var _addColorStops = function (gradient, order) {
        for (var i = 0; i < backgroundData.colors.length; i++) {
          var color = backgroundData.colors[i]['255'];
          color = 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')';

          gradient.addColorStop(order[i], color);
        }
      };

      if(backgroundData.gradientType === 'radial') {
        var centerX = width / 2;
        var centerY = height / 2;

        var radius = Math.max(centerX, centerY);

        var args = [centerX, centerY, radius, centerX, centerY, 0];
        gradient = context.createRadialGradient.apply(context, args);

        _addColorStops(gradient, [1, 0]);
      } else {
        gradient = context.createLinearGradient(0, 0, 0, height);

        _addColorStops(gradient, [0, 1]);
      }

      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    };

    var getSnapshot = function (params, callback) {
      params = params || {};

      var engineCanvas = Human.renderer.canvas.getCanvas()[0];

      var engineRect = engineCanvas.getBoundingClientRect();
      var width = engineRect.width;
      var height = engineRect.height;

      // Get dimensions
      var targetWidth = params.width || width;
      var targetHeight = params.height || height;

      // Aspect fix
      if (targetWidth >= targetHeight) {
        targetHeight = $window.Math.floor(height / width * targetWidth);
      } else if (targetWidth < targetHeight) {
        targetWidth = $window.Math.floor(width / height * targetHeight);
      }

      // Pause timeline if playing
      var wasPlaying = false;

      if (Human.timeline.playing) {
        wasPlaying = true;
        Human.timeline.pause();
      }

      Human.renderer.forceRenderFrame();

      // Create output canvas
      var outputCanvas = $document[0].createElement('canvas');
      var outputContext = outputCanvas.getContext('2d');

      outputCanvas.width = targetWidth;
      outputCanvas.height = targetHeight;

      var backgroundData, args;

      // Draw background
      if('HumanBackground' in $window) {
        backgroundData = $window.HumanBackground.getBackgroundData();

        args = [outputContext, backgroundData, targetWidth, targetHeight];
        createBackground.apply(null, args);
      }

      // Draw 3D canvas
      args = [engineCanvas, 0, 0, targetWidth, targetHeight];
      outputContext.drawImage.apply(outputContext, args);

      // Draw copyright
      var copyright = params.copyright === false ? false : true;

      if (copyright) {
        createCopyright(outputContext, targetWidth, targetHeight);
      }

      // Draw annotations
      var layouts = Human.view.annotations.layouts;
      var activeLayout = layouts.getLayout(layouts.activeLayout);

      if(activeLayout && activeLayout.snapshot) {
        var color;

        // Annotation layouts want a color name: black or white?
        if(backgroundData) {
          color = backgroundData.averageGray['1'] > 0.5 ? 'white' : 'black';
        } else {
          color = 'white';
        }

        activeLayout.snapshot(outputCanvas, outputContext, color);
      }

      // Post-render cleanup
      Human.renderer.forceRenderFrame();

      if(wasPlaying) {
        Human.timeline.unpause();
      }

      // Get output image
      var outputImage = new $window.Image();

      outputImage.width = targetWidth;
      outputImage.height = targetHeight;
      outputImage.onload = callback.bind(null, outputImage);

      outputImage.src = outputCanvas.toDataURL('image/jpeg');
    };

    // Immediately load copright image if we have a path
    if(_config.copyrightImagePath) {
      loadCopyrightImage();
    }

    return {
      get: function (params, callback) {
        getSnapshot(params, function (image) {
          if(params.openInTab) {
            $window.open(image.src, '_blank');
          }

          if(angular.isFunction(callback)) {
            callback(image);
          }
        });
      },
      loadCopyrightImage: loadCopyrightImage,
      config: config
    };
  };
  $get.$inject = ['$window', '$document', '$q', '$timeout', 'Human'];

  return {
    $get: $get,
    config: config
  };
});

angular.module('humanUI.timeline', [])

.factory('HumanTimeline', ['Human', function (Human) {

  var hasAnimations = function () {
    var activeRoot = Human.timeline.activeRoot;

    if(activeRoot) {
      var maps, timeline, id, key;

      for (var i = 0; i < activeRoot._chapters.length; i++) {
        maps = activeRoot._chapters[i].maps;

        if(Object.keys(maps).length) {

          for(key in maps) {
            if(maps.hasOwnProperty(key)) {
              timeline = maps[key].data.timeline;
              id = angular.isObject(timeline) ? timeline.id : timeline;

              if(id !== 'dummy') {
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

  return {

    isPlayable: function (timeFrame) {
      if(hasAnimations()) {
        return true;
      } else {
        var activeRoot = Human.timeline.activeRoot;

        if(!activeRoot) {
          return false;
        }

        var hasChapters = Object.keys(activeRoot._chapters).length > 1;

        var hasTimeFrame =
          timeFrame && timeFrame.lastTime > timeFrame.firstTime;

        return hasChapters && hasTimeFrame;
      }
    },

    playChapter: function (targetBranch) {
      Human.timeline.play({
        startChapterId: targetBranch.id,
        loop: !!targetBranch.animation.loop,
        numChapters: 1
      });
    },

    handleChapter: function (targetBranch) {
      var activeRoot = Human.timeline.activeRoot;

      if(!activeRoot) {
        return;
      }

      var currentIndex = activeRoot._chapters.indexOf(activeRoot._nowBranch);
      var targetIndex = activeRoot._chapters.indexOf(targetBranch);

      var diff = targetIndex - currentIndex;

      if(Math.abs(diff) === 1) {
        Human.timeline[diff === 1 ? 'next' : 'prev']();
      } else if(!!targetBranch.animation.loop) {
        this.playChapter(targetBranch);
      } else {
        Human.timeline.scrub({
          chapterId: targetBranch.id
        });
      }
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

      Human.events.on('modules.activate.start', function (params) {
        var module = Human.modules.modules[params.moduleId];

        if(!!module) {
          loop = !!(module.animation && module.animation.loop);
        }
      });

    }
  };
}])

.directive('humanPlayPause',
  ['$timeout', 'HumanTimeline', function ($timeout, HumanTimeline) {
    return {
      restrict: 'E',
      scope: true,
      templateUrl: 'templates/timeline/play-pause.html',
      link: function (scope, element) {
        var configShow, timelineShow;

        var setShown = function () {
          scope.show = !!configShow && !!timelineShow;
        };

        Human.events.on('modules.activate.finish', function() {
          element.addClass('asset-attach');
          $timeout(function () {
              var timeFrame = Human.timeline.getTimeFrame();
              timelineShow = HumanTimeline.isPlayable(timeFrame);
              setShown();
              scope.$apply();
            });
        });

        Human.events.on('module.ready', function() {
          element.removeClass('asset-attach');
        });

        Human.events.on('modules.deactivate.finish', function () {
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
  ['$window', '$sce', '$timeout', 'Human', 'HumanTimeline', 'checkModule', 'translateFilter', function (
    $window, $sce, $timeout,
    Human, HumanTimeline, checkModule, translateFilter
  ) {

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

        // Scroll current chapter element into view
        var scrollIntoView = function () {
          var chapterEl = element[0].children[scope.curIndex];

          if(mode === 'tour' && chapterEl && chapterEl.scrollIntoView) {
            chapterEl.scrollIntoView(false);
          }
        };

        var titleDisplay = function (chapter) {
          if(!scope.titles.hasOwnProperty(chapter.id)) {
            var result = translateFilter(chapter.info, 'displayName', locale);
            scope.titles[chapter.id] = $sce.trustAsHtml(result);
          }

          return scope.titles[chapter.id];
        };

        scope.titles = {};
        scope.chapters = [];

        scope.getOffset = function (index) {
          if(!Human.timeline.activeRoot) {
            return;
          }

          var time = Human.timeline.activeRoot._times[index];

          return mode === 'scrubber' ?
            ((time / timeFrame.lastTime) * 100) + '%' : 'auto';
        };

        var init = function () {
          if(!Human.timeline.activeRoot) {
            return;
          }

          var chapters = Human.timeline.activeRoot._chapters;

          if(chapters.length > 1) {
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
            var targetBranch = Human.timeline.branchTimelines[e.target.id];

            if(mode === 'scrubber') { // Scrubber
              HumanTimeline.playChapter(targetBranch);
            } else { // Tour
              HumanTimeline.handleChapter(targetBranch);
            }
          }
        });

        $$window.on('resize', function () {
          $timeout(checkOverflow);
        });

        scope.$on('human.locale', function (e, _locale) {
          locale = _locale;
        });

        Human.events.on('timeline.chapters.updated', function () {
          $timeout(init);
        });

        Human.events.on('timeline.timeFrame.updated', function (_timeFrame) {
          timeFrame = _timeFrame;
        });

        // NOTE[EM] - Still supported, but may not be needed if you can query
        // Root timeline for targetChapter != currentChapter in scrubber.
        Human.events.on('timeline.chapters.activated', function (data) {
          scope.curIndex = data.newChapterIndex;
          scope.$apply();

          scrollIntoView();
        });
      }
    };
  }]
)

.directive('humanScrubber',
  ['$filter', '$timeout', 'Human', 'HumanTimeline', function ($filter, $timeout, Human, HumanTimeline) {
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

        Human.events.on('timeline.timeFrame.updated', function (_timeFrame) {
          $timeout(function () {
            timelineShow = HumanTimeline.isPlayable(_timeFrame);

            if(timelineShow) {
              update(_timeFrame);
            }

            setShown();
            scope.$apply();
          });
        });

        Human.events.on('modules.activate.finish', function() {
          element.addClass('asset-attach');
          var config = scope.uiComponents.config;

          // When both scrubber and tour configs are true, check chapter length
          if(config.scrubber && config.tour) {
            configShow = Human.timeline.activeRoot._chapters.length === 1;
            setShown();
            scope.$apply();
          }

        });

        Human.events.on('module.ready', function() {
          element.removeClass('asset-attach');
        });

        Human.events.on('modules.deactivate.finish', function () {
          scope.show = false;
          scope.$apply();
        });

        // TODO [EM] - scrubber UI not updating from external scrub event

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
.directive('prevNextChapter', ['Human', 'HumanTimeline', function (Human, HumanTimeline) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var dir = attrs.prevNextChapter || 'next';
      dir = dir === 'next' ? 1 : -1;

      var currentIndex, chapters, disabled;

      var setDisabled = function () {
        disabled = (
          (dir === 1 && currentIndex === chapters.length - 1) ||
          (dir === -1 && currentIndex === 0)
        );

        element[disabled ? 'addClass' : 'removeClass']('disabled');
      };

      element.on('click', function () {
        if(!disabled) {
          var branches = Human.timeline.activeRoot._chapters;
          HumanTimeline.handleChapter(branches[currentIndex + dir]);
        }
      });

      Human.events.on('timeline.chapters.updated', function (_chapters) {
        chapters = _chapters;
      });

      Human.events.on('timeline.chapters.activated', function (params) {
        currentIndex = params.newChapterIndex;
        setDisabled();
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

      Human.events.on('modules.activate.finish', function() {
        element.addClass('asset-attach');

        var config = scope.uiComponents.config;
        timelineShow = Human.timeline.activeRoot._chapters.length > 1;

        if (config.scrubber && config.tour) {
          configShow = timelineShow;
        }

        setShown();
        scope.$apply();
      });

      Human.events.on('module.ready', function() {
        element.removeClass('asset-attach');

      });

      Human.events.on('modules.deactivate.finish', function () {
        scope.show = false;
        scope.$apply();
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


angular.module('humanUI.templates', ['templates/annotations/panel.html', 'templates/bookmark/tour.html', 'templates/camera/center.html', 'templates/camera/mode.html', 'templates/camera/pan.html', 'templates/camera/zoom-in.html', 'templates/camera/zoom-out.html', 'templates/camera/zoom.html', 'templates/cross-section/camera-clip.html', 'templates/cross-section/controls.html', 'templates/cross-section/slider.html', 'templates/cross-section/toggle.html', 'templates/dissect/dissect.html', 'templates/dissect/undo.html', 'templates/fullscreen/panel.html', 'templates/fullscreen/window-link.html', 'templates/info/panel.html', 'templates/load/progress.html', 'templates/media/audio.html', 'templates/modes/isolate.html', 'templates/modes/xray.html', 'templates/scene/object-list-search.html', 'templates/scene/object-list.html', 'templates/scene/object-slider.html', 'templates/scene/object-tree.html', 'templates/timeline/chapters.html', 'templates/timeline/play-pause.html', 'templates/timeline/scrubber.html', 'templates/timeline/tour.html', 'templates/utilities/slider.html']);

angular.module('templates/annotations/panel.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/annotations/panel.html',
    '<button\n' +
    '  class="tool annotations"\n' +
    '  toggle-button="toggleAnnotations">\n' +
    '</button>');
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

angular.module('templates/cross-section/controls.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/cross-section/controls.html',
    '<button\n' +
    '  class="tool"\n' +
    '  cycle-section-plane\n' +
    '  uib-tooltip="{{ tooltipText.select }}"></button>\n' +
    '\n' +
    '<human-cross-section-slider></human-cross-section-slider>\n' +
    '<span class="view">{{ state.current.view }}</span>\n' +
    '\n' +
    '<button\n' +
    '  class="tool"\n' +
    '  reset-section-plane\n' +
    '  plane="curPlane"\n' +
    '  uib-tooltip="{{ tooltipText.reset }}"></button>');
}]);

angular.module('templates/cross-section/slider.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/cross-section/slider.html',
    '<human-slider config="config"></human-slider>');
}]);

angular.module('templates/cross-section/toggle.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/cross-section/toggle.html',
    '<button class="cross-section tool" toggle-button="callbacks"></button>');
}]);

angular.module('templates/dissect/dissect.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/dissect/dissect.html',
    '<button\n' +
    '  class="tool dissect"\n' +
    '  toggle-button="toggleDissect"\n' +
    '  toggle-model="shown"></button>');
}]);

angular.module('templates/dissect/undo.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/dissect/undo.html',
    '<button class="tool dissect-undo" undo-dissect></button>');
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
    '<button class="tool isolate" toggle-button="toggleIsolate"></button>');
}]);

angular.module('templates/modes/xray.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/modes/xray.html',
    '<button class="tool xray" toggle-button="toggleXray"></button>');
}]);

angular.module('templates/scene/object-list-search.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/scene/object-list-search.html',
    '<input\n' +
    '  type="text"\n' +
    '  placeholder="{{ searchPlaceholder }}"\n' +
    '  ng-change="searchList()"\n' +
    '  ng-model="searchText">\n' +
    '\n' +
    '<button ng-show="searching" ng-click="clearSearch()">&times;</button>');
}]);

angular.module('templates/scene/object-list.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/scene/object-list.html',
    '<ng-transclude></ng-transclude>\n' +
    '\n' +
    '<span class="no-results" ng-show="searching && noResults">No Results</span>\n' +
    '\n' +
    '<human-list\n' +
    '  list-data="sceneObjects"\n' +
    '  list-config="objectListConfig">\n' +
    '    <a\n' +
    '      object-selected="{{ objectId | escapeHtml }}"\n' +
    '      title="{{ displayName | escapeHtml }}"\n' +
    '      class="collection-item">\n' +
    '      <span\n' +
    '        object-enabled="{{ objectId | escapeHtml }}"\n' +
    '        class="anatomy-check-icon"></span>{{ displayName | escapeHtml }}\n' +
    '    </a>\n' +
    '</human-list>');
}]);

angular.module('templates/scene/object-slider.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/scene/object-slider.html',
    '<object-slider-objects>\n' +
    '  <button\n' +
    '    ng-repeat="objectId in objectIds"\n' +
    '    ng-click="setOpacity($index)"\n' +
    '    class="object-slider-object"></button>\n' +
    '\n' +
    '  <!-- One at the end to hide the entire scene -->\n' +
    '  <button\n' +
    '    class="object-slider-object"\n' +
    '    ng-click="setOpacity(objectIds.length)"></button>\n' +
    '</object-slider-objects>\n' +
    '\n' +
    '<human-slider config="config"></human-slider>');
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
    '      class="collection-item">\n' +
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
    '  id="{{ chapter.id }}"\n' +
    '  class="chapter"\n' +
    '  ng-class="{ on: $index === curIndex }"\n' +
    '  uib-tooltip-html="titleDisplay(chapter)"\n' +
    '  tooltip-placement="{{ toolTipPos }}"\n' +
    '  title="{{ (showTitles && titleDisplay(chapter)) || \'\' }}"\n' +
    '  ng-style="{ left: getOffset($index) }">{{ $index + 1 }}</button>\n' +
    '');
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

angular.module('templates/utilities/slider.html', []).run(['$templateCache', function($templateCache) {
  $templateCache.put('templates/utilities/slider.html',
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
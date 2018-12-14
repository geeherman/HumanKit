/* Human UI 9.2.0
 *
 * (c) 2016 BioDigital, Inc.
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

.constant('MIN_HUMAN_VERSION', '8.0.0')

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
}]);

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

  var $get = function ($rootScope, $filter, BASE_CONFIG, Human) {
    var extendConfig = $filter('extendConfig');
    var convertTags = $filter('convertTags');
    var convertUiParams = $filter('convertUiParams');
    var convertDotKeys = $filter('convertDotKeys');

    return {
      config: {}, // Final configuration

      urlConfig: convertUiParams(Human.request.getSearchParams()),
      bookmarkConfig: {},
      contentConfig: {},
      applicationConfig: {},

      init: function () {
        var configCreator = this;

        // Put global components data for all directives to access
        $rootScope.uiComponents = { config: this.config };

        // Extend every time a new module is activating
        Human.events.on('modules.activating', function (params) {
          var module = Human.modules.modules[params.moduleId];

          configCreator._buildContentConfig(module);
          configCreator._extend();
          configCreator._apply();
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
  $get.$inject = ['$rootScope', '$filter', 'BASE_CONFIG', 'Human'];

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

      var output = {};

      for (var id in input) {
        if(input.hasOwnProperty(id) && config.props.indexOf(id) >= 0) {
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
      var chapter = Human.timeline.chapterList[params.newChapterIndex];
      setInfo('chapter', chapter);
    });

    Human.events.on('modules.activated', function (params) {
      var module = Human.modules.activeModules[params.moduleId];

      if(!config.baseAnatomy) {
        module = $filter('excludeBaseAnatomy')(module);
      }

      setInfo('module', module);
    });

    Human.events.on('modules.deactivated', clearInfo);

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
  ['$document', 'ConfigCreator', 'Human', 'HumanSnapshot', 'HumanBackground', function ($document, ConfigCreator, Human, HumanSnapshot, HumanBackground) {

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

        /** @see /doc/background.js */
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

      }
    };

  }]
);

angular.module('humanUI.scene', [])

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
    this.paintAndReset(); // Finish outstanding lis
    this.flagged = {};
    this.assetCount = 0;
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

.factory('hasAnimations', function () {
  return function () {
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

angular.module('humanUI.templates', ['templates/annotations/panel.html', 'templates/bookmark/tour.html', 'templates/camera/center.html', 'templates/camera/mode.html', 'templates/camera/pan.html', 'templates/camera/zoom-in.html', 'templates/camera/zoom-out.html', 'templates/camera/zoom.html', 'templates/cross-section/camera-clip.html', 'templates/cross-section/controls.html', 'templates/cross-section/slider.html', 'templates/cross-section/toggle.html', 'templates/dissect/dissect.html', 'templates/dissect/undo.html', 'templates/fullscreen/panel.html', 'templates/fullscreen/window-link.html', 'templates/info/panel.html', 'templates/load/progress.html', 'templates/media/audio.html', 'templates/modes/isolate.html', 'templates/modes/xray.html', 'templates/scene/object-list-search.html', 'templates/scene/object-list.html', 'templates/scene/object-tree.html', 'templates/timeline/chapters.html', 'templates/timeline/play-pause.html', 'templates/timeline/scrubber.html', 'templates/timeline/tour.html', 'templates/utilities/slider.html']);

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
/*
 * Human Background Manager v-4
 * Built on 12.12.2017 05:08:58 PM
 * (c) 2017 BioDigital, Inc.
 */

/*
 * Properties:
 * background: 100,100,200
 * background.colors: same as background
 * bgstd: same as background (for backwards compatibility)
 * background.colorStops=8,100
 * background.gradientType: [linear|radial]
 */

(function (window) {
  'use strict';

  // 3 - 16 comma separated numbers
  var CSV_EXP = /(\s*[\d\.]+\s*,){2,15}\s*[\d\.]+\s*/g;

  var defaults = {
    colors: null,
    colorStops: null,
    gradientType: null
  };

  var colorNames = ['white', 'black'];

  var engineProperties = {
    black: {
      xray: {
        color: [0.8, 0.8, 0.9],
        glassFactor: 0.7,
        murkiness: 0.8
      },
      canvasStyles: {
        wire: {
          strokeStyle: 'rgb(204, 204, 204)'
        }
      }
    },
    white: {
      xray: {
        color: [0, 0, 0.1],
        glassFactor: 0.9,
        murkiness: 0.75
      },
      canvasStyles: {
        wire: {
          strokeStyle: 'rgb(153,153,153)'
        }
      }
    }
  };

  // Build backgroundData from defaults
  var backgroundData = {
    colors: [{}, {}],
    averageColor: {},
    averageGray: {},
    gradientType: null
  };

  var customColors = {}; // Stores custom colors set by an application
  var backgroundEl; // Set in init function

  var isDefined = function (value) {
    return typeof value !== 'undefined';
  };

  var createBackgroundSetEvent = function () {
    // Using createEvent / initEvent for IE support
    var event = window.document.createEvent('Event');
    event.initEvent('human.background.set', true, true);

    var _data = getBackgroundData();

    for(var key in _data) {
      if(_data.hasOwnProperty(key)) {
        event[key] = _data[key];
      }
    }

    return event;
  };

  var is255 = function (channels) {
    for (var i = 0; i < 3; i++) {
      if(window.parseFloat(channels[i]) > 1) {
        return true;
      }
    }

    return false;
  };

  var getWeight = function (stop1, stop2) {
    var stopDiff = window.Math.abs(stop2 - stop1);
    var midPoint = stopDiff / 2 + window.Math.min(stop1, stop2);

    return midPoint / 100;
  };

  var toGray = function (channels) {
    var weightedR = channels[0] * 0.299;
    var weightedG = channels[1] * 0.587;
    var weightedB = channels[2] * 0.114;

    var grayValue = weightedR + weightedG + weightedB;

    if(is255(channels)) {
      grayValue = window.Math.round(grayValue);
    } else {
      grayValue = window.Math.round(grayValue * 100) / 100;
    }

    return grayValue;
  };

  var getComputedColor = function (input) {
    var testEl = window.document.createElement('div');
    testEl.style.backgroundColor = input;

    window.document.documentElement.appendChild(testEl);

    var computedColor = window.getComputedStyle(testEl).backgroundColor;
    computedColor = computedColor.replace(/\s/g, '');

    window.document.documentElement.removeChild(testEl);

    return computedColor;
  };

  var convertChannels = function (channels) {
    channels = channels.slice(0, 4);

    if(channels.length === 3) {
      channels.push(1);
    }

    for (var i = 0; i < 4; i++) {
      channels[i] = window.parseFloat(channels[i]);

      if(channels[i] < 0) {
        channels[i] = 0;
      }

      if(channels[i] > 255) {
        channels[i] = 255;
      }
    }

    if(channels[3] > 1) {
      channels[3] = 1;
    }

    return channels;
  };

  // Convert a single color
  var convert = function (input) {
    var color;

    if(Array.isArray(input)) {
      color = convertChannels(input);
    } else if(typeof input === 'string') {
      var csvMatch = input.match(CSV_EXP);

      if(csvMatch) {
        color = convertChannels(csvMatch[0].split(','));
      } else { // See if the browser can compute the color

        var computedColor = getComputedColor(input);
        csvMatch = computedColor.match(CSV_EXP);

        if(csvMatch) {
          color = convertChannels(csvMatch[0].split(','));
        }
      }
    }

    return color;
  };

  var setAverageColor = function () {
    var colors = backgroundData.colors;
    var average = backgroundData.averageColor;
    var weight = getWeight(colors[0].stop, colors[1].stop);

    average['1'] = averageColors(colors[0]['1'], colors[1]['1'], weight);
    average['255'] = averageColors(colors[0]['255'], colors[1]['255'], weight);

    var averageGray = backgroundData.averageGray;

    averageGray['1'] = toGray(backgroundData.averageColor['1']);
    averageGray['255'] = toGray(backgroundData.averageColor['255']);
  };

  var getColorName = function () {
    var customName = null;
    var measuredName = null;

    // Compare the 1 scale colors
    var color1 = backgroundData.colors[0]['1'];
    var color2 = backgroundData.colors[1]['1'];

    var color = color1.concat(color2).join('');

    for(var _colorName in customColors) {
      if(customColors.hasOwnProperty(_colorName)) {
        // Compare as strings
        if(color === customColors[_colorName].join('')) {
          customName = _colorName;
          break;
        }
      }
    }

    // Measure the average gray
    var averageGray = backgroundData.averageGray['1'];
    measuredName = averageGray < 0.5 ? 'black' : 'white';

    return { custom: customName, measured: measuredName };
  };

  var setGlobalClass = function (colorName) {
    var documentElement = window.document.documentElement;
    var globalClasses = documentElement.className.split(' ');

    var colorClasses = colorNames.map(function (_colorName) {
      return ['bg', _colorName].join('-');
    });

    for (var i = 0; i < colorClasses.length; i++) {
      var index = globalClasses.indexOf(colorClasses[i]);

      if(index >= 0) {
        globalClasses.splice(index, 1);
      }
    }

    var className = ['bg', colorName.custom || colorName.measured].join('-');
    globalClasses.push(className);

    documentElement.className = globalClasses.join(' ').trim();
  };

  var eventQueued = false;

  var setBackground = function () {
    var prefixes = ['-webkit-', '-moz-', '-ms-', '-o-', ''];
    var ruleData = {
      expression: /{{\s([a-z0-9]+)\s}}/g,
      template: '{{ c1 }} {{ s1 }}, {{ c2 }} {{ s2 }}'
    };

    ruleData.c1 = 'rgba(' + backgroundData.colors[0]['255'].join(',') + ')';
    ruleData.c2 = 'rgba(' + backgroundData.colors[1]['255'].join(',') + ')';

    ruleData.s1 = backgroundData.colors[0].stop + '%';
    ruleData.s2 = backgroundData.colors[1].stop + '%';

    var bgRule = ruleData.template;

    var replaceFunc = function (match, prop) {
      bgRule = bgRule.replace(match, ruleData[prop]);
    };

    ruleData.template.replace(ruleData.expression, replaceFunc);

    if(backgroundData.gradientType === 'radial') {
      bgRule = 'radial-gradient(ellipse at center, ' + bgRule + ')';
    } else if(backgroundData.gradientType === 'linear') {
      bgRule = 'linear-gradient(top, ' + bgRule + ')';
    }

    for(var i = 0; i < prefixes.length; i++) {
      backgroundEl.style.backgroundImage = prefixes[i] + bgRule;
    }

    var colorName = getColorName();

    if('Human' in window) {
      synchEngine(colorName);
    }

    setGlobalClass(colorName);

    if(!eventQueued) {
      eventQueued = true;

      // Dispatch event only once after multiple synchronous setBackground calls
      window.setTimeout(function () {
        backgroundEl.dispatchEvent(createBackgroundSetEvent());
        eventQueued = false;
      }, 0);
    }
  };

  // For each property check if we have something custom defined,
  // If not, fallback on the measured property
  var getEngineProperty = function (propertyPath, colorName) {
    var orderedNames = [colorName.custom, colorName.measured];
    var value;

    for (var i = 0; i < orderedNames.length; i++) {
      var pathParts = [orderedNames[i]].concat(propertyPath.split('.'));

      var object = engineProperties;
      var j = 0;
      var property = pathParts[j];

      while (object.hasOwnProperty(property)) {
        object = object[property];
        j++;
        property = pathParts[j];

        if(j === pathParts.length - 1) {
          value = object[property];
          break;
        }
      }

      if(value) {
        break;
      }
    }

    return value;
  };

  var synchEngine = function (colorName) {

    var color = backgroundData.colors[0]['1'].concat(
      backgroundData.colors[1]['1']
    );

    Human.renderer.bg.setBGColor(color);

    if(Human.renderer.getScene()) {
      try {
        var xrayColor = getEngineProperty('xray.color', colorName);
        var xrayGlassFactor = getEngineProperty('xray.glassFactor', colorName);
        var xrayMurkiness = getEngineProperty('xray.murkiness', colorName);
        var canvasStyles = getEngineProperty('canvasStyles', colorName);

        if(isDefined(xrayColor)) {
          Human.renderer.setXrayBGColor(xrayColor);
        }

        if(isDefined(xrayGlassFactor)) {
          Human.renderer.setXrayGlassFactor(xrayGlassFactor);
        }

        if(isDefined(xrayMurkiness)) {
          Human.renderer.setXrayMurkiness(xrayMurkiness);
        }

        if(isDefined(canvasStyles)) {
          Human.view.annotations.setCanvasStyles(canvasStyles);
        }
      }
      catch (e) {
        // Engine errors fail silently
      }
    }
  };

  var copyColor = function (color) {
    var copy;

    if(typeof color === 'string') {
      copy = color;
    } else if(Array.isArray(color)) {
      copy = [];

      for (var i = 0; i < color.length; i++) {
        copy[i] = color[i];
      }
    } else {
      copy = {};

      for(var channel in color) {
        if(color.hasOwnProperty(channel)) {
          copy[channel] = color[channel];
        }
      }
    }

    return copy;
  };

  // Return a deep copy of data for public API
  var getDefaults = function () {
    return {
      colors: copyColor(defaults.colors),
      colorStops: copyColor(defaults.colorStops),
      gradientType: defaults.gradientType
    };
  };

  var setDefaults = function (_defaults) {
    if (_defaults.colors) {
      defaults.colors = _defaults.colors;
    }

    if (_defaults.colorStops) {
      defaults.colorStops = _defaults.colorStops;
    }

    if (_defaults.gradientType) {
      defaults.gradientType = _defaults.gradientType;
    }
  };

  // Return a deep copy of data for public API
  var getBackgroundData = function () {
    return {
      colors: [
        {
          '1': copyColor(backgroundData.colors[0]['1']),
          '255': copyColor(backgroundData.colors[0]['255']),
          stop: backgroundData.colors[0].stop
        },
        {
          '1': copyColor(backgroundData.colors[1]['1']),
          '255': copyColor(backgroundData.colors[1]['255']),
          stop: backgroundData.colors[1].stop
        }
      ],
      averageColor: {
        '1': copyColor(backgroundData.averageColor['1']),
        '255': copyColor(backgroundData.averageColor['255'])
      },
      averageGray: copyColor(backgroundData.averageGray),
      gradientType: backgroundData.gradientType
    };
  };

  var setColor = function (index, input) {
    // Convert input to 4 length array
    var color = convert(input);

    if(!color) {
      throw new TypeError('Invalid color input.');
    }

    // Scale color
    var scaledColor = scaleColor(color);
    var color1, color255;

    if(is255(color)) {
      color255 = color;
      color1 = scaledColor;
    } else {
      color255 = scaledColor;
      color1 = color;
    }

    // Set backround data
    backgroundData.colors[index]['1'] = color1;
    backgroundData.colors[index]['255'] = color255;
  };

  var setColors = function (input) {
    var colors = [];

    if(typeof input === 'string') {
      var csvMatch = input.match(CSV_EXP);

      // Try to extract numbers from the string
      if(csvMatch) {
        input = csvMatch.join(',');
      }

      // Split it on commas
      input = input.split(',');
    }

    if(Array.isArray(input)) {
      var nestedArrays = Array.isArray(input[0]) && Array.isArray(input[1]);

      if(nestedArrays) {
        // Format is good as is
        colors = input;
      } else if (input.length <= 2) {
        // Arrays of 2 items or less can be CSS color name(s)
        colors = input.length === 1 ? input.concat(input) : input;
      } else {
        // Should be a set of numbers between 3 - 16
        var half = window.Math.floor(input.length / 2);
        // Greater than 4 is assumed to be two color values
        if(input.length > 4) {
          colors = [input.slice(0, half), input.slice(half)];
        } else {
          // Single color input, apply to both colors
          colors = [input, input];
        }
      }
    }

    for (var i = 0; i < backgroundData.colors.length; i++) {
      setColor(i, colors[i]);
    }

    setAverageColor();
    setBackground();
  };

  var setColorStops = function (colorStops) {
    if(typeof colorStops === 'string') {
      colorStops = colorStops.split(',');
    }

    for (var i = 0; i < backgroundData.colors.length; i++) {
      backgroundData.colors[i].stop = window.parseInt(colorStops[i]);
    }

    setAverageColor();
    setBackground();
  };

  var setGradientType = function (gradientType) {
    backgroundData.gradientType = gradientType;

    setBackground();
  };

  var scaleColor = function (channels) {
    var _is255 = is255(channels);
    var scaledChannels = [];
    var scaledChannel;

    // Don't scale alpha channel
    for (var i = 0; i < 3; i++) {
      scaledChannel = _is255 ? channels[i] / 255 : channels[i] * 255;

      if(_is255) {
        scaledChannel = window.Math.round(scaledChannel * 100) / 100;
      } else {
        scaledChannel = window.Math.round(scaledChannel);
      }

      scaledChannels.push(scaledChannel);
    }

    if(channels.length === 4) {
      scaledChannels.push(channels[3]);
    }

    return scaledChannels;
  };

  var averageColors = function (color1, color2, weight) {
    var _is255 = is255(color1); // Determine via color1
    var averageColor = [];
    var weighted1, weighted2, average;

    if(!weight) {
      weight = 0.5;
    }

    for (var i = 0; i < 3; i++) {
      weighted1 = window.Math.pow(color1[i], 2) * weight;
      weighted2 = window.Math.pow(color2[i], 2) * (1 - weight);

      average = window.Math.sqrt(weighted1 + weighted2);

      if(_is255) {
        average = window.Math.round(average);
      } else {
        average = window.Math.round(average * 100) / 100;
      }

      averageColor.push(average);
    }

    if(color1.length === 4) {
      average = (color1[3] + color2[3]) / 2;
      average = window.Math.round(average * 100) / 100;

      averageColor.push(average);
    }

    return averageColor;
  };

  // PUBLIC METHODS

  var initted = false;

  window.HumanBackground = {
    element: null,
    engineProperties: engineProperties,

    init: function () {
      if(initted) {
        return;
      }

      initted = true;

      var selector = '[background-color]';

      backgroundEl = window.document.querySelector(selector);

      if (!backgroundEl) {
        throw new Error('Background element not found.');
      }

      this.element = backgroundEl; // Make public

      // Look for default settings on element's attributes
      var colors = backgroundEl.getAttribute('background-color');
      var colorStops = backgroundEl.getAttribute('background-color-stops');
      var gradientType = backgroundEl.getAttribute('background-color-gradient');

      // Allow defaults set via code to override element attribute settings
      defaults.colors = defaults.colors || colors;
      defaults.colorStops = defaults.colorStops || colorStops;
      defaults.gradientType = defaults.gradientType || gradientType;

      // Require each default attibute to be set
      if (!defaults.colors) {
        throw new Error('Background color not set.');
      }

      if (!defaults.colorStops) {
        throw new Error('Background color stops not set.');
      }

      if (!defaults.gradientType) {
        throw new Error('Background gradient type not set.');
      }

      setColors(defaults.colors);
      setColorStops(defaults.colorStops);
      setGradientType(defaults.gradientType);

      backgroundEl.addEventListener('human.background.config', function (e) {
        setColors(e.colors);
        setColorStops(e.colorStops);
        setGradientType(e.gradientType);
      });

      this.input.init();

      return backgroundEl;
    },

    getCustomColor: function (colorName) {
      var color = customColors[colorName];
      return color && copyColor(color);
    },

    addCustomColors: function (_customColors) {
      for(var colorName in _customColors) {
        if(_customColors.hasOwnProperty(colorName)) {
          customColors[colorName] = _customColors[colorName];
          colorNames.push(colorName);
        }
      }
    },

    synchEngine: synchEngine,

    getDefaults: getDefaults,
    setDefaults: setDefaults,

    getBackgroundData: getBackgroundData,

    setColors: setColors,
    setColorStops: setColorStops,
    setGradientType: setGradientType,

    is255: is255,
    scaleColor: scaleColor,
    averageColors: averageColors,
    convert: convert
  };

})(window);


// Responsible for recording the different configuration from various sources
// And given the priority order, coming up with a final configuration

(function (window) {
  'use strict';

  var priorities = ['url', 'bookmark', 'content', 'cookie'];
  var configs = {}; // Map to specific input configs
  var config = {}; // The final config

  var initted = false;
  var contentEnabled = false;

  var createBackgroundConfigEvent = function (config) {
    // Using createEvent / initEvent for IE support
    var event = window.document.createEvent('Event');
    event.initEvent('human.background.config', true, true);

    for(var key in config) {
      if(config.hasOwnProperty(key)) {
        event[key] = config[key];
      }
    }

    return event;
  };

  var handleAliases = function (config) {
    // Alias: type -> gradientType
    if(config.type) {
      config.gradientType = config.type;
      delete config.type;
    }

    // Alias: background.interior -> background.color1
    if(config.interior) {
      config.color1 = config.interior;
      delete config.interior;
    }

    // Alias: background.exterior -> background.color2
    if(config.exterior) {
      config.color2 = config.exterior;
      delete config.exterior;
    }

    // Alias: background.color1 + background.color2 -> background.colors
    if(config.color1 || config.color2) {
      if(!config.color1) {
        config.color1 = config.color2;
      }

      if(!config.color2) {
        config.color2 = config.color1;
      }

      if(typeof config.color1 === 'string') {
        config.color1 = config.color1.split(',');
      }

      if(typeof config.color2 === 'string') {
        config.color2 = config.color2.split(',');
      }

      config.colors = config.color1.concat(config.color2);

      delete config.color1;
      delete config.color2;
    }

    return config;
  };

  var isObject = function (value) {
    return value !== null && typeof value === 'object';
  };

  var isEmptyObject = function (value) {
    return isObject(value) && Object.keys(value).length === 0;
  };

  // This data is only available via event, so storing here
  var bookmarkBackground = {};

  var HumanBackgroundInput = HumanBackground.input = {

    init: function () {
      if(!initted) {
        if('Human' in window) {
          HumanBackgroundInput.enableContentConfig();
        }

        HumanBackgroundInput.buildConfig();

        initted = true;
      }
    },

    setPriorities: function (_priorities) { // Overwrite priorities array
      if(Array.isArray(_priorities)) {
        priorities = _priorities;
      }
    },

    buildConfig: function () {
      config = HumanBackground.getDefaults();

      for (var i = priorities.length - 1; i >= 0; i--) {
        var priority = priorities[i];
        var capitalized = priority[0].toUpperCase() + priority.slice(1);
        var method = 'get' + capitalized + 'Config';

        configs[ priorities[i] ] = handleAliases(this[method]());

        for(var key in configs[ priorities[i] ]) {
          if(configs[ priorities[i] ].hasOwnProperty(key)) {
            config[key] = configs[ priorities[i] ][key];
          }
        }
      }

      var e = createBackgroundConfigEvent(config);
      HumanBackground.element.dispatchEvent(e);

      return config;
    },

    getConfig: function () { // No dynamic building / notification
      return config;
    },

    getUrlParams: function () {
      var paramsString = window.location.search.replace(/^\?/, '');
      var paramPairs = paramsString.split('&');

      var params = {};

      for (var i = 0; i < paramPairs.length; i++) {
        var parts = paramPairs[i].toLowerCase().split('=');
        params[ parts[0] ] = parts[1];
      }

      return params;
    },

    getUrlConfig: function () {
      var config = {};
      var params = this.getUrlParams();

      if(params.background) {
        config.colors = params.background;
      } else if(params.bgstd) { // Backwards compatibility
        var colors = params.bgstd.split(',');

        // If two colors are present in params, we need to reverse these.
        // The old way was applying the colors edge to center
        if(colors.length > 3) {
          var color1 = colors.slice(0, colors.length / 2);
          var color2 = colors.slice(colors.length / 2);

          colors = color2.concat(color1);
        }

        config.colors = colors.join(',');
      }

      // Additional background properties
      for(var key in params) {
        if(params.hasOwnProperty(key)) {
          if(/^background\.[a-z0-9\-]+$/.test(key)) {
            var prop = key.split('.')[1].replace(/-([a-z])/g, function (match) {
              return match[1].toUpperCase();
            });

            config[prop] = window.decodeURIComponent(params[key]);
          }
        }
      }

      return config;
    },

    getBackgroundCookie: function () {
      var cookieMatch = window.document.cookie.match(/background=([^;\s]*)/);
      return cookieMatch && cookieMatch[1];
    },

    getCookieConfig: function () {
      var config = {};
      var backgroundCookie = this.getBackgroundCookie();

      if(backgroundCookie) {
        var customColor = HumanBackground.getCustomColor(backgroundCookie);

        if(customColor) {
          config.colors = customColor;
        } else {
          config.colors = backgroundCookie;
        }

      }

      return config;
    },

    getContentConfig: function () {
      var config = {};
      var data;

      if(!('Human' in window)) {
        return config;
      }

      // Check chapter, then module. Possible to get per-chapter
      if(Human.timeline.activeRoot) {
        data = Human.timeline.activeRoot._nowBranch.background;

        if(!data || isEmptyObject(data)) {
          var rootId = Human.timeline.activeRoot.id;
          data = Human.modules.modules[rootId].background;
        }
      }

      if(typeof data === 'string' || Array.isArray(data)) {
        config.colors = data;
      } else if (data !== null && typeof data === 'object') {
        config = data;
      }

      return config;
    },

    getBookmarkConfig: function () {
      return bookmarkBackground;
    },

    enableContentConfig: function () {
      if(!contentEnabled) {

        var buildConfig = this.buildConfig.bind(this);

        Human.events.on('modules.activate.finish', buildConfig);
        Human.events.on('timeline.chapters.activated', buildConfig);

        Human.events.on('bookmarks.restored', function (bookmark) {
          if (bookmark.background) {
            bookmarkBackground = bookmark.background;
          } else {
            bookmarkBackground = {};
          }

          buildConfig();
        });

        // Reset this here for future config builds.
        Human.events.on('modules.activate.start', function () {
          bookmarkBackground = {};
        });

        contentEnabled = true;
      }
    }

  };

})(window);

'use strict';

(function (window, angular) {

  var HumanWidget = window.HumanWidget;

  var WIDGET = {

    NAME: 'humanWidget.default',

    DEPENDENCIES: {
      'humanWidget': '9.1.4',
      'humanEngine': '14.1.0',
      'humanUI': '13.2.0'
    },

    ENVIRONMENT: window.ENVIRONMENT,

    WEB_GL: {
      device: { ios: true, android: true },
      error: { post: true, log: false, redirect: false }
    },

    EVENTS: {
      // Engine's renderer and websocket have been initialized
      onInit: function () {
        window.engineConfig();

        HumanWidget.activity.intersectThreshold = 0.75;
        HumanWidget.activity.initContentInteractive(window.Human);

        if (HumanWidget.data.embedded) {
          HumanWidget.activity.verifyAPI();
        }

        Human.events.once('modules.activate.start', function () {
          HumanWidget.analytics.ga.init({ appName: WIDGET.NAME.split('.')[1] });
        });
      },

      // Content has been loaded
      onReady: function (content) {

        // TODO: Move into lib
        if (HumanScene.getUrlParams().o) {

          if (Object.keys(content.baseAnatomyObjects).length > 0) {

            var boundary = Human.scene.getBoundary({
              objects: Human.scene.enabledObjects
            });

            Human.view.camera.fly.flyTo({ boundary: boundary });
          }
        }

        // TODO: Better handling of these events...
        window.setTimeout(function () {
          window.Human.events.fire('app.module.sceneReady');
        }, 1000);

        // UI Lib needs this for now...
        if (content.id) {
          window.Human.events.fire('module.ready', { moduleId: content.id });
        }

        if (Human.mobile && Human.mobile.android) {
          window.HumanKitAndroid.moduleLoaded();
        } else if (Human.mobile && Human.mobile.iOS) {
          window.webkit.messageHandlers.assetsHandler.postMessage('loaded');
        }

        console.log('Battlestation fully operational.');
      },

      // Bookmark or module related loading error
      onError: function () {}
    }

  };

  // By default, the angular app bootstraps after engine is initialized
  angular.module(WIDGET.NAME, ['humanWidget', 'human.share'])

  .config(function (BASE_CONFIG) {
    angular.extend(BASE_CONFIG, { share: true });
  });

  window.HumanWidget.init(WIDGET);

  window.ENVIRONMENT = undefined; // Remove from window after use

}(window, angular));

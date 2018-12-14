angular.module(['humanWidget'])

.run(function ($window, Human, BookmarkTour) {
  // This is basically for the object-slider display
  // TODO: Is there a better way?
  Human.events.on('timeline.chapters.activated', function (data) {
    var chapterIndex = data.newChapterIndex;
    $window.document.body.setAttribute('current-chapter', chapterIndex);
  });

  // TODO: Move to lib?
  var resetEl = $window.document.getElementById('scene-reset');

  resetEl.addEventListener('click', function () {

    var Human = window.Human;
    var content = window.HumanScene.content.get();

    if (content.bookmark) {
      Human.bookmarks.restore(content.bookmark);
    } else {

      var curBranch = Human.timeline.activeRoot._nowBranch;
      var firstBranch = Human.timeline.activeRoot._chapters[0];

      if (curBranch === firstBranch) {

        firstBranch.init(0, {}, function () {});

        firstBranch.initCamera(0, function() {});

        firstBranch.initProperties();

        firstBranch.initGraph(firstBranch.synchronization);

        Human.particles.disableAll();
        Human.particles.resetAll();
        firstBranch.initParticles();

      } else {
        Human.timeline.scrub({ time: 0 });
      }
    }

  });

  // TODO: Move these to a UI lib build or remove them altogether
  Human.rpc.define('bookmark.previousChapter', function () {
    var self = this;
    var index = BookmarkTour.state.curCaptureIndex - 1;

    BookmarkTour.state.restore(index, function () {
      self.setResult({});
    });
  }, { hidden: true });

  Human.rpc.define('bookmark.nextChapter', function () {
    var self = this;
    var index = BookmarkTour.state.curCaptureIndex + 1;

    BookmarkTour.state.restore(index, function () {
      self.setResult({});
    });
  }, { hidden: true });

  Human.rpc.define('bookmark.set', function (params) {
    var self = this;

    BookmarkTour.state.restore(params.index, function () {
      self.setResult({});
    });
  }, { hidden: true });

  // TODO: Move to widget lib, don't use Human.properties

  function captureEvent(event) {
    if ($(event.target).is('canvas')) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  var $document = angular.element(document);

  Human.properties.subscribe({
    propId: 'ui.mouseWheel.capture',
    value: true,
    callback: function (value) {
      // Stop mousewheel propagation upwards to any parent windows
      $document[value ? 'on' : 'off']('mousewheel.capture', captureEvent);
    }
  });

});
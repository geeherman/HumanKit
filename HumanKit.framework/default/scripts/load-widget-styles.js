(function () {
  var loadWidgetStyles = function() {
    var w = document.getElementById('widget-styles');
    var p = document.createElement('div');
    p.innerHTML = w.textContent;
    w.parentElement.insertBefore(p, w);
    w.parentElement.removeChild(w);
  };

  var raf = requestAnimationFrame || mozRequestAnimationFrame ||
      webkitRequestAnimationFrame || msRequestAnimationFrame;

  if (raf) {
    raf(function() { window.setTimeout(loadWidgetStyles, 0); });
  } else {
    window.addEventListener('load', loadWidgetStyles);
  }
})();
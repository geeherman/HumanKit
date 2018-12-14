(function (i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r; i[r] = i[r] || function () {
        (i[r].q = i[r].q || []).push(arguments)
    }, i[r].l = 1 * new Date(); a = s.createElement(o),
    m = s.getElementsByTagName(o)[0]; a.async = 1; a.src = g; m.parentNode.insertBefore(a, m)
})(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

if (typeof HumanKitAndroid !== "undefined") {
  window.mobilebundleid = HumanKitAndroid.getBundleID();
  HumanKitAndroid.debugMessage("GOT BundleID" + window.mobilebundleid);
}

if (typeof window.mobilebundleid !== "undefined") {
  ga('create', 'UA-1141985-24', 'auto');
  ga('set', 'forceSSL', true);
  ga('send', 'pageview', { 'dimension5' : window.mobilebundleid });
} else {
  ga('create', 'UA-1141985-22', 'auto');
  ga('require', 'displayfeatures');
  ga('send', 'pageview');
}
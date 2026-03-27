(function () {
  var controller = null;

  function boot() {
    var body = document.body;
    var gameId = body.getAttribute("data-game-id");
    var creatorName = body.getAttribute("data-game-creator");
    var registry = window.Casino830Games || {};
    var creator = registry[creatorName];
    var site = window.Casino830Site;
    var mount = document.getElementById("gameMount");

    if (!gameId || !creatorName || !creator || !site || !mount) {
      return;
    }

    site.bindCommon();
    controller = creator({
      app: site.createGameApi(gameId),
      meta: {
        id: gameId,
        name: site.getGameName(gameId),
      },
    });

    controller.mount(mount);
  }

  function teardown() {
    if (controller && typeof controller.destroy === "function") {
      controller.destroy();
    }
    controller = null;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("pagehide", teardown);
  window.addEventListener("beforeunload", teardown);
})();

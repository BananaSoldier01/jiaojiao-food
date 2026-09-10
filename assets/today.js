(function () {
  var now = new Date();
  var iso = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  document.querySelectorAll("[data-date]").forEach(function (el) {
    if (el.getAttribute("data-date") === iso) el.classList.add("is-today");
  });
})();

document.addEventListener("DOMContentLoaded", function () {
  var stages = document.querySelectorAll(".op-anim");
  if (!stages.length) return;

  if (!("IntersectionObserver" in window)) {
    stages.forEach(function (el) { el.classList.add("is-active"); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      entry.target.classList.toggle("is-active", entry.isIntersecting);
    });
  }, { threshold: 0.35 });

  stages.forEach(function (el) { observer.observe(el); });
});

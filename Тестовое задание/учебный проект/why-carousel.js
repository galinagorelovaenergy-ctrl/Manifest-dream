(function () {
  "use strict";

  var GAP = 16;
  var PADDING = 16;
  var BASE_MAX = 310;
  var VELOCITY_THRESHOLD = 500;
  var SPRING = 0.16;
  var SNAP_EPS = 0.6;

  function rotateYForSlide(x, index, trackItemOffset) {
    var r0 = -(index + 1) * trackItemOffset;
    var r1 = -index * trackItemOffset;
    var r2 = -(index - 1) * trackItemOffset;
    if (x < r1 - 1e-6) {
      if (x <= r0) {
        return 90;
      }
      return (90 * (x - r0)) / (r1 - r0);
    }
    if (x > r1 + 1e-6) {
      if (x >= r2) {
        return -90;
      }
      return (-90 * (x - r1)) / (r2 - r1);
    }
    return 0;
  }

  function init() {
    var root = document.getElementById("why-carousel");
    var viewport = document.getElementById("why-carousel-viewport");
    var track = document.getElementById("why-carousel-track");
    if (!root || !viewport || !track) {
      return;
    }

    var originals = Array.prototype.slice.call(track.querySelectorAll(".why-carousel-item"));
    var realN = originals.length;
    if (realN === 0) {
      return;
    }

    var loopEnabled = realN > 1;
    if (loopEnabled) {
      var lastClone = originals[realN - 1].cloneNode(true);
      lastClone.classList.add("why-carousel-item--clone");
      lastClone.setAttribute("aria-hidden", "true");
      var firstClone = originals[0].cloneNode(true);
      firstClone.classList.add("why-carousel-item--clone");
      firstClone.setAttribute("aria-hidden", "true");
      track.insertBefore(lastClone, originals[0]);
      track.appendChild(firstClone);
    }

    var slides = Array.prototype.slice.call(track.querySelectorAll(".why-carousel-item"));
    var totalSlides = slides.length;

    var dots = Array.prototype.slice.call(root.querySelectorAll(".why-carousel-dot"));
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var itemWidth = 278;
    var trackItemOffset = itemWidth + GAP;
    var position = loopEnabled ? 1 : 0;
    var targetX = 0;
    var currentX = 0;
    var dragging = false;
    var startPointerX = 0;
    var startTrackX = 0;
    var lastMoveT = 0;
    var lastMoveX = 0;
    var velX = 0;
    var isHovered = false;
    var autoplayTimer = null;
    var rafId = 0;

    function minX() {
      return -(Math.max(totalSlides - 1, 0)) * trackItemOffset;
    }

    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }

    function realIndexFromPosition() {
      if (!loopEnabled) {
        return position;
      }
      return (position - 1 + realN) % realN;
    }

    function recalcSizes() {
      var w = root.clientWidth - PADDING * 2;
      itemWidth = Math.max(220, Math.min(w, BASE_MAX - PADDING * 2));
      trackItemOffset = itemWidth + GAP;
      slides.forEach(function (el) {
        el.style.width = itemWidth + "px";
        el.style.minWidth = itemWidth + "px";
      });
      track.style.gap = GAP + "px";
      targetX = -position * trackItemOffset;
      if (reduced || !dragging) {
        currentX = targetX;
      }
    }

    function setDots() {
      var active = realIndexFromPosition();
      dots.forEach(function (d, i) {
        var on = i === active;
        d.classList.toggle("is-active", on);
        d.setAttribute("aria-selected", on ? "true" : "false");
        d.tabIndex = on ? 0 : -1;
      });
      root.setAttribute("data-active-index", String(active));
    }

    function goToReal(realIdx) {
      realIdx = clamp(realIdx, 0, realN - 1);
      if (loopEnabled) {
        position = realIdx + 1;
      } else {
        position = realIdx;
      }
      targetX = -position * trackItemOffset;
      if (reduced || !dragging) {
        currentX = targetX;
      }
      setDots();
    }

    function setPositionBySlideIndex(slideIdx) {
      position = clamp(slideIdx, 0, Math.max(totalSlides - 1, 0));
      targetX = -position * trackItemOffset;
      if (reduced || !dragging) {
        currentX = targetX;
      }
      setDots();
    }

    function updateTransforms() {
      var originPx = position * trackItemOffset + itemWidth / 2;
      track.style.perspectiveOrigin = originPx + "px 50%";

      slides.forEach(function (el, i) {
        var deg = reduced ? 0 : rotateYForSlide(currentX, i, trackItemOffset);
        el.style.transform = "translateZ(0) rotateY(" + deg + "deg)";
      });

      track.style.transform = "translate3d(" + currentX + "px,0,0)";
    }

    function tick() {
      rafId = requestAnimationFrame(tick);
      if (!dragging && !reduced) {
        targetX = -position * trackItemOffset;
        var dx = targetX - currentX;
        if (Math.abs(dx) < SNAP_EPS) {
          currentX = targetX;
          if (loopEnabled && realN > 1) {
            if (position === 0) {
              position = realN;
              targetX = currentX = -position * trackItemOffset;
            } else if (position === totalSlides - 1) {
              position = 1;
              targetX = currentX = -position * trackItemOffset;
            }
          }
        } else {
          currentX += dx * SPRING;
        }
      } else if (!dragging && reduced) {
        currentX = targetX;
      }
      updateTransforms();
    }

    function onPointerDown(e) {
      if (e.button !== 0 && e.pointerType === "mouse") {
        return;
      }
      if (e.target.closest(".why-carousel-dot")) {
        return;
      }
      dragging = true;
      viewport.setPointerCapture(e.pointerId);
      startPointerX = e.clientX;
      startTrackX = currentX;
      lastMoveT = performance.now();
      lastMoveX = e.clientX;
      velX = 0;
    }

    function onPointerMove(e) {
      if (!dragging) {
        return;
      }
      var now = performance.now();
      var dt = Math.max(now - lastMoveT, 1);
      velX = ((e.clientX - lastMoveX) / dt) * 1000;
      lastMoveT = now;
      lastMoveX = e.clientX;
      currentX = clamp(startTrackX + (e.clientX - startPointerX), minX(), 0);
      updateTransforms();
    }

    function onPointerUp(e) {
      if (!dragging) {
        return;
      }
      dragging = false;
      try {
        viewport.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }

      var direction = 0;
      if (e.clientX - startPointerX < 0 || velX < -VELOCITY_THRESHOLD) {
        direction = 1;
      } else if (e.clientX - startPointerX > 0 || velX > VELOCITY_THRESHOLD) {
        direction = -1;
      }

      if (direction !== 0) {
        setPositionBySlideIndex(position + direction);
      } else {
        var nearest = Math.round(-currentX / trackItemOffset);
        setPositionBySlideIndex(nearest);
      }

      if (reduced) {
        currentX = targetX;
      }
    }

    function scheduleAutoplay() {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
      if (reduced || realN <= 1) {
        return;
      }
      autoplayTimer = setInterval(function () {
        if (isHovered) {
          return;
        }
        if (!loopEnabled) {
          if (position >= realN - 1) {
            return;
          }
          setPositionBySlideIndex(position + 1);
          return;
        }
        if (position < totalSlides - 1) {
          setPositionBySlideIndex(position + 1);
        } else {
          setPositionBySlideIndex(1);
        }
      }, 3000);
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        var idx = parseInt(dot.getAttribute("data-index"), 10);
        if (!isNaN(idx)) {
          goToReal(idx);
        }
      });
    });

    root.addEventListener("pointerenter", function () {
      isHovered = true;
    });
    root.addEventListener("pointerleave", function () {
      isHovered = false;
    });

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerUp);

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (loopEnabled) {
          if (position > 0) {
            setPositionBySlideIndex(position - 1);
          } else {
            setPositionBySlideIndex(realN);
          }
        } else {
          setPositionBySlideIndex(Math.max(0, position - 1));
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (loopEnabled) {
          if (position < totalSlides - 1) {
            setPositionBySlideIndex(position + 1);
          } else {
            setPositionBySlideIndex(1);
          }
        } else {
          setPositionBySlideIndex(Math.min(realN - 1, position + 1));
        }
      }
    });

    window.addEventListener(
      "resize",
      function () {
        recalcSizes();
        goToReal(realIndexFromPosition());
      },
      false
    );

    recalcSizes();
    goToReal(0);
    updateTransforms();
    rafId = requestAnimationFrame(tick);
    scheduleAutoplay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

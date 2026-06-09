(function () {
  "use strict";

  function updateViewportUnits() {
    var root = document.documentElement;
    var height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    var width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    root.style.setProperty("--vh", (height * 0.01) + "px");
    root.style.setProperty("--vw", (width * 0.01) + "px");
  }

  updateViewportUnits();
  window.addEventListener("resize", updateViewportUnits);
  window.addEventListener("orientationchange", updateViewportUnits);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateViewportUnits);
    window.visualViewport.addEventListener("scroll", updateViewportUnits);
  }

  var header = document.querySelector(".site-header");
  if (header) {
    function updateHeaderHeight() {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }

    function updateHeaderState() {
      header.classList.toggle("site-header--scrolled", window.scrollY > 1);
    }

    function scrollToHash() {
      var hash = window.location.hash;
      if (!hash || hash === "#") return;

      var target = document.querySelector(hash);
      if (!target) return;

      var offset = hash === "#hero" ? 0 : header.offsetHeight;
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.pageYOffset - offset,
        behavior: "auto",
      });
    }

    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);
    window.addEventListener("scroll", updateHeaderState, { passive: true });
    updateHeaderState();

    if (window.location.hash) {
      requestAnimationFrame(scrollToHash);
    }
  }

  var swiperBase = {
    slidesPerView: "auto",
    spaceBetween: 20,
    grabCursor: true,
    watchOverflow: true,
  };

  new Swiper(".main-prize-swiper", Object.assign({}, swiperBase, {
    spaceBetween: 19,
    observer: true,
    observeParents: true,
    breakpoints: {
      0: { spaceBetween: 19 },
      768: { spaceBetween: 19 },
    },
  }));

  new Swiper(".experience-swiper", Object.assign({}, swiperBase, {
    spaceBetween: 24,
  }));

  var prizesPrev = document.getElementById("prizesPrev");
  var prizesNext = document.getElementById("prizesNext");

  var prizesSwiper = new Swiper(".prizes-swiper", Object.assign({}, swiperBase, {
    slidesPerGroup: 1,
    slidesOffsetAfter: 24,
    observer: true,
    observeParents: true,
    breakpoints: {
      0: {
        spaceBetween: 16,
        slidesPerView: 1.08,
        slidesOffsetAfter: 20,
      },
      768: {
        spaceBetween: 20,
        slidesPerView: 1.2,
        slidesOffsetAfter: 24,
      },
      1200: {
        spaceBetween: 20,
        slidesPerView: 2.8,
      },
      1600: {
        spaceBetween: 20,
        slidesPerView: 3.2,
      },
      1920: {
        spaceBetween: 20,
        slidesPerView: 3.2,
        slidesOffsetAfter: 24,
      },
    },
  }));

  function updatePrizesNav() {
    if (!prizesPrev || !prizesNext) return;
    prizesPrev.disabled = prizesSwiper.isBeginning;
    prizesNext.disabled = prizesSwiper.isEnd;
  }

  if (prizesPrev) {
    prizesPrev.addEventListener("click", function () {
      prizesSwiper.slidePrev();
    });
  }

  if (prizesNext) {
    prizesNext.addEventListener("click", function () {
      prizesSwiper.slideNext();
    });
  }

  prizesSwiper.on("init resize slideChange reachBeginning reachEnd", updatePrizesNav);
  updatePrizesNav();

  var cardsSwiper = new Swiper(".cards-swiper", Object.assign({}, swiperBase, {
    slidesPerGroup: 1,
    slidesOffsetAfter: 0,
    observer: true,
    observeParents: true,
    breakpoints: {
      0: { spaceBetween: 16 },
      768: { spaceBetween: 20 },
      1920: { spaceBetween: 20, slidesPerView: 3.2 },
    },
  }));

  window.addEventListener("load", function () {
    prizesSwiper.update();
    updatePrizesNav();
    cardsSwiper.update();
  });

  initWinners();
  initFaq();

  function initFaq() {
    var accordion = document.getElementById("faqAccordion");
    if (!accordion) return;

    accordion.querySelectorAll(".accordion-collapse").forEach(function (panel) {
      panel.addEventListener("shown.bs.collapse", function () {
        var button = accordion.querySelector('[data-bs-target="#' + panel.id + '"]');
        if (button) button.setAttribute("aria-expanded", "true");
      });

      panel.addEventListener("hidden.bs.collapse", function () {
        var button = accordion.querySelector('[data-bs-target="#' + panel.id + '"]');
        if (button) button.setAttribute("aria-expanded", "false");
      });
    });
  }

  function initWinners() {
    var section = document.getElementById("winners");
    if (!section) return;

    var tbody = section.querySelector(".winners__table tbody");
    var searchInput = section.querySelector(".winners__search-input");
    var pagination = section.querySelector(".winners__pagination");
    var pagesEl = section.querySelector(".winners__pagination-pages");
    var navLinks = document.querySelectorAll("[data-winners-nav]");

    var PAGE_SIZE = 12;
    var allWinners = [];
    var filteredWinners = [];
    var currentPage = 1;

    function hideWinners() {
      section.setAttribute("hidden", "");
      section.classList.remove("winners--visible");
      navLinks.forEach(function (link) {
        link.setAttribute("hidden", "");
      });
    }

    function showWinners() {
      section.removeAttribute("hidden");
      section.classList.add("winners--visible");
      navLinks.forEach(function (link) {
        link.removeAttribute("hidden");
      });
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function getSurname(name) {
      return String(name || "").trim().split(/\s+/)[0].toLowerCase();
    }

    function getTotalPages() {
      return Math.max(1, Math.ceil(filteredWinners.length / PAGE_SIZE));
    }

    function renderTable() {
      if (!tbody) return;

      var totalPages = getTotalPages();
      if (currentPage > totalPages) currentPage = totalPages;

      var start = (currentPage - 1) * PAGE_SIZE;
      var pageItems = filteredWinners.slice(start, start + PAGE_SIZE);

      tbody.innerHTML = "";

      if (!pageItems.length) {
        var emptyRow = document.createElement("tr");
        emptyRow.innerHTML = '<td class="winners__empty" colspan="3">Ничего не найдено</td>';
        tbody.appendChild(emptyRow);
        return;
      }

      pageItems.forEach(function (winner) {
        var row = document.createElement("tr");
        row.innerHTML =
          "<td>" + escapeHtml(winner.date) + "</td>" +
          "<td>" + escapeHtml(winner.name) + "</td>" +
          "<td>" + escapeHtml(winner.prize) + "</td>";
        tbody.appendChild(row);
      });
    }

    function renderPagination() {
      if (!pagination || !pagesEl) return;

      var totalPages = getTotalPages();

      if (totalPages <= 1) {
        pagination.hidden = true;
        return;
      }

      pagination.hidden = false;

      pagesEl.innerHTML = "";

      for (var page = 1; page <= totalPages; page += 1) {
        var pageBtn = document.createElement("button");
        pageBtn.type = "button";
        pageBtn.className = "winners__pagination-page" + (page === currentPage ? " is-active" : "");
        pageBtn.textContent = String(page);
        pageBtn.setAttribute("aria-label", "Страница " + page);
        pageBtn.setAttribute("aria-current", page === currentPage ? "page" : "false");

        (function (pageNumber) {
          pageBtn.addEventListener("click", function () {
            if (pageNumber === currentPage) return;
            currentPage = pageNumber;
            renderTable();
            renderPagination();
          });
        })(page);

        pagesEl.appendChild(pageBtn);
      }
    }

    function render() {
      renderTable();
      renderPagination();
    }

    function applySearch() {
      var query = searchInput ? searchInput.value.trim().toLowerCase() : "";

      if (!query) {
        filteredWinners = allWinners.slice();
      } else {
        filteredWinners = allWinners.filter(function (winner) {
          return getSurname(winner.name).indexOf(query) !== -1;
        });
      }

      currentPage = 1;
      render();
    }

    if (searchInput) {
      searchInput.addEventListener("input", applySearch);
    }

    loadWinnersData()
      .then(function (data) {
        if (!Array.isArray(data) || !data.length) {
          hideWinners();
          return;
        }

        allWinners = data;
        filteredWinners = data.slice();
        showWinners();
        render();
      })
      .catch(function () {
        hideWinners();
      });
  }

  function loadWinnersData() {
    var protocol = window.location.protocol;
    var isHttp = protocol === "http:" || protocol === "https:";

    if (isHttp) {
      var url = new URL("data/winners.json", window.location.href).href;

      return fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error("winners fetch failed");
          return response.json();
        })
        .catch(function () {
          return getEmbeddedWinnersData();
        });
    }

    return getEmbeddedWinnersData();
  }

  function getEmbeddedWinnersData() {
    if (Array.isArray(window.WINNERS_DATA) && window.WINNERS_DATA.length) {
      return Promise.resolve(window.WINNERS_DATA);
    }

    return Promise.reject(new Error("winners data unavailable"));
  }

  var navLinks = document.querySelectorAll('.site-header__nav-link, .site-offcanvas__nav a[href^="#"]');
  var sections = document.querySelectorAll("main section[id]");

  function setActiveNav() {
    var headerOffset = header ? header.offsetHeight : 120;
    var scrollPos = window.scrollY + headerOffset;
    var current = "";

    sections.forEach(function (section) {
      if (section.offsetTop <= scrollPos && section.offsetTop + section.offsetHeight > scrollPos) {
        current = section.getAttribute("id");
      }
    });

    navLinks.forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return;
      link.classList.toggle("active", href === "#" + current);
    });
  }

  window.addEventListener("scroll", setActiveNav);
  setActiveNav();
})();

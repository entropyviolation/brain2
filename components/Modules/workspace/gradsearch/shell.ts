/** GradSearch markup. Port of gradsearch/app/index.html (no scripts). */
export const GRADSEARCH_SHELL = `
<div class="gs-app" data-theme="dark">
<!-- ===================== HEADER ===================== -->
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">◆</div>
      <div class="brand-text">
        <h1>GradSearch</h1>
        <p>Graduate Program Explorer</p>
      </div>
    </div>

    <div class="search-wrap">
      <svg viewBox="0 0 24 24" class="search-icon" aria-hidden="true"><path d="M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input id="search" type="search" placeholder="Search programs, institutions, cities, fields…" autocomplete="off" />
      <kbd class="search-kbd">/</kbd>
    </div>

    <div class="topbar-actions">
      <button id="themeToggle" class="icon-btn" title="Toggle light / dark" aria-label="Toggle theme">
        <span class="theme-dark">☾</span><span class="theme-light">☀</span>
      </button>
    </div>
  </header>

  <!-- ===================== STATS STRIP ===================== -->
  <section class="stats" id="stats" aria-label="Summary statistics"></section>

  <!-- ===================== LAYOUT ===================== -->
  <div class="layout">
    <!-- ---------- SIDEBAR FILTERS ---------- -->
    <aside class="sidebar" id="sidebar">
      <!-- ---- SCORING MODEL ---- -->
      <section class="score-panel" id="scorePanel">
        <div class="score-panel-head">
          <h2>Scoring model</h2>
          <button class="link-btn" id="scorePanelToggle" aria-expanded="true">Hide</button>
        </div>
        <div class="score-panel-body" id="scorePanelBody">
          <div class="mode-toggle" role="group" aria-label="Score mode">
            <button class="mode-btn active" data-mode="mine">My score</button>
            <button class="mode-btn" data-mode="research">Research</button>
          </div>
          <p class="score-hint" id="scoreHint">Adjust attribute weights — every program re-ranks live. Defaults reproduce the original research scores.</p>
          <div class="weights" id="weights"></div>
          <div class="weight-sum" id="weightSum"></div>
          <div class="score-panel-actions">
            <button class="link-btn" id="resetWeights">Reset weights</button>
            <button class="link-btn" id="resetOverrides" hidden></button>
          </div>
        </div>
      </section>

      <div class="sidebar-head">
        <h2>Filters</h2>
        <button id="resetFilters" class="link-btn">Reset all</button>
      </div>

      <div class="filter-group">
        <h3>Field</h3>
        <div class="chips" id="filter-field"></div>
      </div>

      <div class="filter-group">
        <h3>Location tier</h3>
        <div class="chips" id="filter-tier"></div>
      </div>

      <div class="filter-group">
        <h3>Degree</h3>
        <div class="chips" id="filter-degree"></div>
      </div>

      <div class="filter-group">
        <h3>Funding</h3>
        <div class="chips" id="filter-funding"></div>
      </div>

      <div class="filter-group">
        <h3>Country</h3>
        <select id="filter-country" class="select">
          <option value="">All countries</option>
        </select>
      </div>

      <div class="filter-group">
        <h3>Minimum score <span id="scoreVal" class="range-val">0</span></h3>
        <input type="range" id="filter-score" min="0" max="100" value="0" step="1" />
      </div>

      <div class="filter-group">
        <h3>Max duration <span id="durVal" class="range-val">Any</span></h3>
        <input type="range" id="filter-duration" min="0" max="6" value="6" step="0.5" />
      </div>
    </aside>

    <!-- ---------- MAIN ---------- -->
    <main class="main">
      <div class="toolbar">
        <button id="filterToggle" class="btn ghost mobile-only">Filters</button>
        <div class="result-count" id="resultCount"></div>
        <button id="favToggle" class="btn ghost" hidden></button>
        <button id="dismissedToggle" class="btn ghost" hidden></button>
        <button id="restoreAll" class="link-btn" hidden>Restore all</button>
        <div class="toolbar-right">
          <label class="sort-label">
            Sort
            <select id="sort" class="select compact">
              <option value="score-desc">Best score</option>
              <option value="score-asc">Lowest score</option>
              <option value="duration-asc">Shortest duration</option>
              <option value="program-asc">Program A→Z</option>
              <option value="city-asc">City A→Z</option>
            </select>
          </label>
          <div class="view-toggle" role="group" aria-label="View mode">
            <button class="view-btn active" data-view="grid" title="Card view">▦</button>
            <button class="view-btn" data-view="table" title="Table view">▤</button>
          </div>
        </div>
      </div>

      <div class="active-filters" id="activeFilters"></div>

      <div id="results" class="results grid-view"></div>
      <div id="empty" class="empty hidden">
        <p>No programs match your filters.</p>
        <button class="btn" id="emptyReset">Clear filters</button>
      </div>
    </main>
  </div>

  <!-- ===================== COMPARE TRAY ===================== -->
  <div class="compare-tray hidden" id="compareTray">
    <div class="compare-tray-inner">
      <div class="compare-items" id="compareItems"></div>
      <div class="compare-actions">
        <button class="btn ghost" id="clearCompare">Clear</button>
        <button class="btn primary" id="openCompare">Compare <span id="compareCount">0</span></button>
      </div>
    </div>
  </div>

  <!-- ===================== DETAIL DRAWER ===================== -->
  <div class="drawer-overlay hidden" id="drawerOverlay"></div>
  <aside class="drawer hidden" id="drawer" aria-label="Program detail"></aside>

  <!-- ===================== COMPARE MODAL ===================== -->
  <div class="modal-overlay hidden" id="compareModal">
    <div class="modal">
      <div class="modal-head">
        <h2>Compare programs</h2>
        <button class="icon-btn" id="closeCompare" aria-label="Close">✕</button>
      </div>
      <div class="modal-body" id="compareBody"></div>
    </div>
  </div>

  <!-- ===================== VERIFY MODAL ===================== -->
  <div class="modal-overlay hidden" id="verifyModal">
    <div class="modal verify-modal">
      <div class="modal-head">
        <h2>🔍 Verify with web search</h2>
        <button class="icon-btn" id="closeVerify" aria-label="Close">✕</button>
      </div>
      <div class="modal-body" id="verifyBody"></div>
    </div>
  </div>
</div>
`;

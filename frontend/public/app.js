import "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";

const merida = [-89.62, 20.97]; // Coordinates for Merida
const apiUrl = window.env?.API_URL || "http://localhost:3000";

const limites = [
  [-89.820316, 20.846415], // SE
  [-89.453107, 21.173615]  // NE
];

function getUserLocation() {
  return new Promise((resolve) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => resolve([longitude, latitude]),
        (error) => { console.error("Error obtaining location:", error); resolve(null); }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      resolve(null);
    }
  });
}

// ---------- Helpers ----------
function normalizeStr(s = "") {
  return s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function featureBounds(feature) {
  const bounds = new maplibregl.LngLatBounds();
  const geom = feature.geometry;
  const add = (coords) => coords.forEach((c) => bounds.extend([c[0], c[1]]));
  if (!geom) return null;
  if (geom.type === "LineString") add(geom.coordinates);
  else if (geom.type === "MultiLineString") geom.coordinates.forEach(add);
  else return null;
  return bounds;
}

async function init() {
  const map = new maplibregl.Map({
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: merida,
    zoom: 11.8,
    container: "map",
    maxBounds: limites
  });

  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: false,
    showUserLocation: true,
    showAccuracyCircle: false
  });
  map.addControl(geolocate, "bottom-right");

  map.on("load", async () => {
    try {
      const response = await fetch(`${apiUrl}/rutas`);
      const geojson = await response.json();
      console.log("Fetched GeoJSON:", geojson);

      const rutasFeatures = geojson.rutas?.features || [];

      // --- RUTAS ---
      map.addSource("rutas", { type: "geojson", data: geojson.rutas });
      map.addLayer({
        id: "rutas-lineas",
        type: "line",
        source: "rutas",
        paint: { "line-color": ["get", "color"], "line-width": 4 }
      });

      // --- Highlight layer (starts empty) ---
      map.addLayer({
        id: "ruta-highlight",
        type: "line",
        source: "rutas",
        paint: { "line-color": "#ff0000", "line-width": 6 },
        // string equality works even if ids become UUIDs later
        filter: ["==", ["to-string", ["get", "id"]], "__none__"]
      });

      let selectedRouteId = null;
      let routePopup = null;

      function deselectRoute() {
        selectedRouteId = null;
        map.setFilter("ruta-highlight", ["==", ["to-string", ["get", "id"]], "__none__"]);
        if (routePopup) { routePopup.remove(); routePopup = null; }
      }

      function selectRouteByFeature(f, centerLngLat = null) {
        const idStr = String(f.properties?.id);
        selectedRouteId = idStr;
        map.setFilter("ruta-highlight", ["==", ["to-string", ["get", "id"]], idStr]);
        map.moveLayer("ruta-highlight");

        const { nombre_ruta, numero_ruta } = f.properties || {};
        const html = `
          <div style="font-family: system-ui, -apple-system, Arial, sans-serif;">
            <div style="font-weight:700; margin-bottom:4px;">Ruta ${numero_ruta ? `#${numero_ruta}` : ""}</div>
            <div>${nombre_ruta || "Sin nombre"}</div>
          </div>`;

        if (routePopup) routePopup.remove();
        const lngLat = centerLngLat || featureBounds(f)?.getCenter() || map.getCenter();
        routePopup = new maplibregl.Popup({ closeButton: true, closeOnClick: false })
          .setLngLat(lngLat)
          .setHTML(html)
          .addTo(map);
      }

      // --- Click to toggle selection ---
      map.on("click", "rutas-lineas", (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        const clickedIdStr = String(f.properties?.id);
        if (selectedRouteId === clickedIdStr) { deselectRoute(); return; }
        selectRouteByFeature(f, e.lngLat);
      });

      // Cursor on hover
      map.on("mouseenter", "rutas-lineas", () => map.getCanvas().style.cursor = "pointer");
      map.on("mouseleave", "rutas-lineas", () => map.getCanvas().style.cursor = "");

      // --- PARADAS ---
      map.addSource("paradas", { type: "geojson", data: geojson.paradas });
      map.addLayer({
        id: "paradas-puntos",
        type: "circle",
        source: "paradas",
        paint: {
          "circle-radius": 5,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff"
        }
      });

      // --- TIENDAS ---
      map.addSource("tiendas", { type: "geojson", data: geojson.tiendas });
      async function loadIcon(map, id, url, pixelRatio = 2) {
        if (map.hasImage(id)) return;
        const resp = await fetch(url, { mode: "cors" });
        if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        map.addImage(id, bitmap, { pixelRatio });
      }
      const BRAND_ICONS = [
        { nameUp: "OXXO",      imageId: "oxxo-icon",     file: "/icons/oxxo.png" },
        { nameUp: "DUNOSUSA",  imageId: "dunosusa-icon", file: "/icons/dunosusa.png" },
        { nameUp: "SUPER AKI", imageId: "superaki-icon", file: "/icons/superaki.png" },
        { nameUp: "WILLYS",    imageId: "willys-icon",   file: "/icons/willys.png" }
      ];
      const DEFAULT_ICON = { imageId: "default-icon", file: "/icons/default.png" };
      try {
        await Promise.all([
          ...BRAND_ICONS.map(b => loadIcon(map, b.imageId, b.file)),
          loadIcon(map, DEFAULT_ICON.imageId, DEFAULT_ICON.file)
        ]);
      } catch (e) { console.error("Could not load one or more tienda icons:", e); }
    
      map.addLayer({
        id: "tiendas-icons",
        type: "symbol",
        source: "tiendas",
        layout: {
          "icon-image": [
            "match",
            ["upcase", ["get", "nom_tienda"]],
            "OXXO", "oxxo-icon", "DUNOSUSA", "dunosusa-icon",
            "SUPER AKI", "superaki-icon", "WILLYS", "willys-icon",
            /* default */ "default-icon"
          ],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.05, 12, 0.07, 16, 0.09],
          "icon-allow-overlap": true
        }
      });

      // --- iOS-style toggle for "tiendas" (top-right) with label "Recarga" ---
      class TiendasSwitchControl {
        onAdd(mapInstance) {
          this._map = mapInstance;

          const group = document.createElement("div");
          group.className = "maplibregl-ctrl maplibregl-ctrl-group";
          group.style.background = "transparent";
          group.style.border = "none";
          group.style.boxShadow = "none";
          group.style.padding = "6px";
          // make label sit above the button
          group.style.display = "flex";
          group.style.flexDirection = "column";
          group.style.alignItems = "center";
          group.style.gap = "8px";

          // NEW: label above the toggle
          const label = document.createElement("span");
          label.id = "tiendas-toggle-label";
          label.textContent = "Lugares Recarga";
          label.style.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
          label.style.userSelect = "none";
          label.style.pointerEvents = "none";
          label.style.lineHeight = "1";
          group.appendChild(label);

          // Button base (track)
          const btn = document.createElement("button");
          btn.type = "button";
          btn.title = "Ocultar/Mostrar tiendas";
          btn.setAttribute("aria-label", "Ocultar/Mostrar tiendas");
          // associate with label for accessibility
          btn.setAttribute("aria-labelledby", "tiendas-toggle-label");

          btn.style.width = "52px";
          btn.style.height = "28px";
          btn.style.border = "1px solid rgba(0,0,0,.15)";
          btn.style.borderRadius = "999px";
          btn.style.padding = "0";
          btn.style.position = "relative";
          btn.style.cursor = "pointer";
          btn.style.background = "#34C759"; // ON color
          btn.style.boxShadow = "inset 0 1px 2px rgba(0,0,0,.12)";
          btn.style.transition = "background .18s ease, border-color .18s ease";

          // Knob
          const knob = document.createElement("span");
          knob.style.position = "absolute";
          knob.style.top = "50%";
          knob.style.left = "26px";           // ON position
          knob.style.transform = "translateY(-50%)";
          knob.style.width = "24px";
          knob.style.height = "24px";
          knob.style.borderRadius = "50%";
          knob.style.background = "#fff";
          knob.style.boxShadow = "0 1px 3px rgba(0,0,0,.25)";
          knob.style.transition = "left .18s ease, box-shadow .18s ease";
          btn.appendChild(knob);

          // Helpers to read/change layer visibility
          const isVisible = () =>
            this._map.getLayoutProperty("tiendas-icons", "visibility") !== "none";
          const setVisible = (v) =>
            this._map.setLayoutProperty("tiendas-icons", "visibility", v ? "visible" : "none");

          const updateUI = () => {
            const on = isVisible();
            btn.setAttribute("aria-pressed", String(on));
            btn.style.background = on ? "#34C759" : "#d5d5d5";
            btn.style.borderColor = on ? "rgba(52,199,89,.4)" : "rgba(0,0,0,.15)";
            knob.style.left = on ? "26px" : "2px";
          };

          const toggle = () => { setVisible(!isVisible()); updateUI(); };

          // Mouse / touch / keyboard
          btn.addEventListener("click", toggle);
          btn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
          });

          // Initial state (reflect current layer visibility)
          updateUI();

          // Append after label so it sits below it
          group.appendChild(btn);

          this._btn = btn;
          this._container = group;
          return group;
        }

        onRemove() {
          if (this._container?.parentNode) this._container.parentNode.removeChild(this._container);
          this._map = undefined;
        }
      }


      // Add the control in the TOP-RIGHT corner
      map.addControl(new TiendasSwitchControl(), "top-right");



      // --- Click on empty map clears selection ---
      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["rutas-lineas"] });
        if (hits.length === 0 && selectedRouteId !== null) deselectRoute();
      });
      // --- ESC key clears selection ---
      window.addEventListener("keydown", (e) => { if (e.key === "Escape") deselectRoute(); });

      // ===============================
      //  AUTOCOMPLETE SEARCH CONTROL
      // ===============================
      const routeIndex = rutasFeatures.map((f) => {
        const idStr = String(f.properties?.id ?? "");
        const num = String(f.properties?.numero_ruta ?? "");
        const name = String(f.properties?.nombre_ruta ?? "");
        return {
          idStr,
          num,
          name,
          color: f.properties?.color || "#3392ff",
          nNum: normalizeStr(num),
          nName: normalizeStr(name),
          feature: f,
          label: num ? `${num} — ${name}` : name || "(sin nombre)"
        };
      });

      function matchRoutes(qRaw, limit = 8) {
        const q = normalizeStr(qRaw);
        if (!q) return [];
        const qNum = q.replace(/^ruta\s*/i, "").replace(/^#/, "").trim();
        const isNum = qNum && !isNaN(Number(qNum));

        const scored = [];
        for (const r of routeIndex) {
          let score = -1;

          if (isNum) {
            if (r.nNum === qNum) score = 100;
            else if (r.nNum.startsWith(qNum)) score = 80;
            else if (r.nNum.includes(qNum)) score = 60;
          }

          if (r.nName === q) score = Math.max(score, 90);
          else if (r.nName.startsWith(q)) score = Math.max(score, 70);
          else if (r.nName.includes(q)) score = Math.max(score, 50);

          if (score >= 0) scored.push({ r, score });
        }

        scored.sort((a, b) => b.score - a.score || a.r.label.length - b.r.label.length);
        return scored.slice(0, limit).map((x) => x.r);
      }

      function fitAndSelect(feature) {
        const bounds = featureBounds(feature);
        if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 600 });
        selectRouteByFeature(feature);
      }

      class RouteSearchControl {
        onAdd(mapInstance) {
          this._map = mapInstance;
          this._activeIndex = -1;
          this._matches = [];

          const outer = document.createElement("div");
          outer.className = "maplibregl-ctrl maplibregl-ctrl-group";
          outer.style.position = "relative";
          outer.style.padding = "6px";
          outer.style.display = "flex";
          outer.style.flexDirection = "column";
          outer.style.rowGap = "6px";
          outer.style.minWidth = "280px";

          // Row with input + clear
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.gap = "6px";
          row.style.alignItems = "center";

          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = "Buscar ruta (número o nombre)…";
          input.style.flex = "1";
          input.style.padding = "6px 8px";
          input.style.border = "1px solid #ccc";
          input.style.borderRadius = "6px";
          input.setAttribute("aria-label", "Buscar ruta por número o nombre");

          const clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.title = "Limpiar";
          clearBtn.textContent = "X";
          clearBtn.style.padding = "6px 8px";
          clearBtn.style.cursor = "pointer";
          clearBtn.style.border = "1px solid #ccc";
          clearBtn.style.borderRadius = "6px";
          clearBtn.style.background = "#fff";

          row.appendChild(input);
          row.appendChild(clearBtn);

          // Dropdown list
          const list = document.createElement("div");
          list.style.position = "absolute";
          list.style.top = "46px";
          list.style.left = "6px";
          list.style.right = "6px";
          list.style.maxHeight = "240px";
          list.style.overflowY = "auto";
          list.style.border = "1px solid #ccc";
          list.style.borderRadius = "8px";
          list.style.background = "#fff";
          list.style.boxShadow = "0 8px 20px rgba(0,0,0,.15)";
          list.style.display = "none";
          list.setAttribute("role", "listbox");

          outer.appendChild(row);
          outer.appendChild(list);
          this._container = outer;
          this._input = input;
          this._list = list;

          // focus with '/'
          const focusHandler = (e) => {
            if (e.key === "/" && document.activeElement !== input) {
              e.preventDefault();
              input.focus();
            }
          };
          window.addEventListener("keydown", focusHandler);
          this._focusHandler = focusHandler;

          // Selection from index helper
          const chooseIndex = (idx) => {
            if (idx < 0 || idx >= this._matches.length) return;
            const r = this._matches[idx];
            input.value = r.label;
            list.style.display = "none";
            fitAndSelect(r.feature);
          };

          // Render suggestions + set initial active to first item
          const render = () => {
            const q = input.value;
            this._matches = matchRoutes(q);
            list.innerHTML = "";
            this._items = [];
            this._activeIndex = -1;

            if (!q || this._matches.length === 0) {
              list.style.display = "none";
              return;
            }
            list.style.display = "block";

            this._matches.forEach((r, idx) => {
              const item = document.createElement("div");
              item.setAttribute("role", "option");
              item.style.display = "flex";
              item.style.alignItems = "center";
              item.style.gap = "8px";
              item.style.padding = "8px 10px";
              item.style.cursor = "pointer";
              item.style.userSelect = "none";

              const swatch = document.createElement("span");
              swatch.style.width = "12px";
              swatch.style.height = "12px";
              swatch.style.borderRadius = "3px";
              swatch.style.background = r.color || "#3392ff";
              swatch.style.border = "1px solid rgba(0,0,0,.2)";

              const label = document.createElement("span");
              label.textContent = r.label;

              item.appendChild(swatch);
              item.appendChild(label);

              // Hover sets active row
              item.addEventListener("mouseenter", () => setActive(idx));
              // Use mousedown so it works before blur
              item.addEventListener("mousedown", (ev) => {
                ev.preventDefault();
                chooseIndex(idx);
              });

              list.appendChild(item);
            });

            this._items = Array.from(list.children);
            // Auto-select first suggestion for immediate Enter
            setActive(0);
          };

          const ensureVisible = (idx) => {
            if (!this._items || !this._items[idx]) return;
            const el = this._items[idx];
            const top = el.offsetTop;
            const bottom = top + el.offsetHeight;
            if (top < this._list.scrollTop) this._list.scrollTop = top;
            else if (bottom > this._list.scrollTop + this._list.clientHeight) {
              this._list.scrollTop = bottom - this._list.clientHeight;
            }
          };

          const setActive = (idx) => {
            if (!this._items || this._items.length === 0) return;
            this._items.forEach((el, i) => {
              el.style.background = i === idx ? "#eef5ff" : "#fff";
              el.style.outline = i === idx ? "2px solid #8ab6ff" : "none";
            });
            this._activeIndex = idx;
            ensureVisible(idx);
          };

          // Events
          input.addEventListener("input", render);
          input.addEventListener("focus", render);

          input.addEventListener("keydown", (ev) => {
            const visible = list.style.display !== "none";

            if (ev.key === "ArrowDown") {
              ev.preventDefault();
              if (!visible) { render(); return; }
              const next = Math.min(this._activeIndex + 1, (this._items?.length || 1) - 1);
              setActive(next);
            } else if (ev.key === "ArrowUp") {
              ev.preventDefault();
              if (!visible) { render(); return; }
              const prev = Math.max(this._activeIndex - 1, 0);
              setActive(prev);
            } else if (ev.key === "Enter") {
              if (visible && this._activeIndex >= 0) {
                ev.preventDefault();
                chooseIndex(this._activeIndex);
              } else {
                // Fallback: choose best match if dropdown not shown
                const matches = matchRoutes(input.value);
                if (matches[0]) {
                  input.blur();
                  list.style.display = "none";
                  fitAndSelect(matches[0].feature);
                }
              }
            } else if (ev.key === "Escape") {
              list.style.display = "none";
              input.select();
              deselectRoute();
            } else if (ev.key === "Home") {
              if (visible) { ev.preventDefault(); setActive(0); }
            } else if (ev.key === "End") {
              if (visible) { ev.preventDefault(); setActive((this._items?.length || 1) - 1); }
            }
          });

          // Hide on blur (let clicks fire first)
          input.addEventListener("blur", () => setTimeout(() => (list.style.display = "none"), 100));

          clearBtn.addEventListener("click", () => {
            input.value = "";
            list.style.display = "none";
            deselectRoute();
            input.focus();
          });

          return outer;
        }

        onRemove() {
          window.removeEventListener("keydown", this._focusHandler);
          if (this._container?.parentNode) this._container.parentNode.removeChild(this._container);
          this._map = undefined;
        }
      }

      map.addControl(new RouteSearchControl(), "top-left");

    } catch (err) {
      console.error("Failed to load /rutas data:", err);
    }

    geolocate.trigger();
  });
}

init();

/* =========================================================
   SIDODADI LAND GIS
   MAIN JAVASCRIPT - FULL VERSION
   ✅ Nama file sesuai GitHub
   ✅ Filter dropdown pakai rentang nilai
   ✅ Sidebar bisa dibuka-tutup (desktop + mobile)
   ✅ Dashboard analisis multi-chart (6 tab)
   ✅ KPI cards + Export PNG/CSV
   ✅ Stats hero + stats grid bawah sinkron
   ✅ Mobile optimized (overlay, swipe gesture, auto-close)
========================================================= */


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let map;
let parcelLayer = null;
let allFeatures = [];
let filteredFeatures = [];
let drawnItems;
let userLocationMarker = null;
let currentBasemap = null;
let toastTimer = null;
let batasDesaLayer = null;
let jalanLayer = null;
let hakMilikLayer = null;
let hakKosongLayer = null;
let mainChartInstance = null;
let activeChartTab = "kesesuaian";


/* =========================================================
   DOM HELPER
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   RENTANG NILAI (SESUAI DATA CSV)
========================================================= */

const RENTANG_NILAI = {

    "Luas": [
        { label: "< 200 m²",              min: 0,      max: 200 },
        { label: "200 – 400 m²",          min: 200,    max: 400 },
        { label: "400 – 600 m²",          min: 400,    max: 600 },
        { label: "600 – 900 m²",          min: 600,    max: 900 },
        { label: "900 – 1.200 m²",        min: 900,    max: 1200 },
        { label: "> 1.200 m²",            min: 1200,   max: Infinity }
    ],

    "Overlap Hak Milik": [
        { label: "Tidak Ada (0)",         min: 0,      max: 0.0001 },
        { label: "< 100 m²",              min: 0.0001, max: 100 },
        { label: "100 – 300 m²",          min: 100,    max: 300 },
        { label: "300 – 600 m²",          min: 300,    max: 600 },
        { label: "600 – 1.000 m²",        min: 600,    max: 1000 },
        { label: "> 1.000 m²",            min: 1000,   max: Infinity }
    ],

    "Overlap Hak Kosong": [
        { label: "Tidak Ada (0)",         min: 0,      max: 0.0001 },
        { label: "< 50 m²",               min: 0.0001, max: 50 },
        { label: "50 – 150 m²",           min: 50,     max: 150 },
        { label: "150 – 300 m²",          min: 150,    max: 300 },
        { label: "> 300 m²",              min: 300,    max: Infinity }
    ],

    "Persentase Hak Milik": [
        { label: "Tidak Ada (0%)",        min: 0,      max: 0.0001 },
        { label: "Rendah (1 – 50%)",      min: 0.0001, max: 50 },
        { label: "Sedang (50 – 75%)",     min: 50,     max: 75 },
        { label: "Tinggi (75 – 95%)",     min: 75,     max: 95 },
        { label: "Sangat Tinggi (> 95%)", min: 95,     max: 100.0001 }
    ],

    "Persentase Hak Kosong": [
        { label: "Tidak Ada (0%)",        min: 0,      max: 0.0001 },
        { label: "Rendah (1 – 25%)",      min: 0.0001, max: 25 },
        { label: "Sedang (25 – 50%)",     min: 25,     max: 50 },
        { label: "Tinggi (50 – 75%)",     min: 50,     max: 75 },
        { label: "Sangat Tinggi (> 75%)", min: 75,     max: 100.0001 }
    ]

};


/* =========================================================
   WARNA KESESUAIAN (untuk chart)
========================================================= */

const WARNA_KESESUAIAN = {
    "Sesuai Penuh":            "#10b981",
    "Sesuai Sebagian Besar":   "#0ea5e9",
    "Sesuai Sebagian Kecil":   "#f59e0b",
    "Tidak Sesuai":            "#ef4444",
    "Tidak Memiliki Hak":      "#6b7280",
    "default":                 "#94a3b8"
};

const WARNA_PALETTE = [
    "#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b",
    "#ef4444", "#06b6d4", "#ec4899", "#6b7280"
];

function getWarnaKesesuaian(label) {
    return WARNA_KESESUAIAN[label] || WARNA_KESESUAIAN["default"];
}


/* =========================================================
   INITIAL MAP
========================================================= */

map = L.map("map", {
    center: [-5.428, 105.255],
    zoom: 13,
    zoomControl: false,
    preferCanvas: true
});


/* =========================================================
   BASEMAP
========================================================= */

const basemaps = {

    osm: L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 20,
            attribution: '&copy; OpenStreetMap contributors'
        }
    ),

    satellite: L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 20,
            attribution: "Tiles &copy; Esri"
        }
    ),

    topo: L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 17,
            attribution: '&copy; OpenTopoMap'
        }
    ),

    dark: L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
            maxZoom: 20,
            attribution: '&copy; CARTO'
        }
    )

};

currentBasemap = basemaps.osm;
currentBasemap.addTo(map);


/* =========================================================
   ZOOM CONTROL
========================================================= */

L.control.zoom({ position: "topright" }).addTo(map);


/* =========================================================
   DRAWING
========================================================= */

drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({

    position: "topright",

    draw: {

        polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: {
                color: "#f59e0b",
                weight: 3,
                fillOpacity: .2
            }
        },

        polyline: {
            shapeOptions: {
                color: "#f59e0b",
                weight: 4
            }
        },

        rectangle: {
            shapeOptions: {
                color: "#f59e0b",
                weight: 3,
                fillOpacity: .2
            }
        },

        circle: false,
        circlemarker: false,
        marker: true

    },

    edit: {
        featureGroup: drawnItems,
        remove: true
    }

});

map.addControl(drawControl);


/* =========================================================
   DRAW EVENT
========================================================= */

map.on(L.Draw.Event.CREATED, function(event) {

    const layer = event.layer;
    drawnItems.addLayer(layer);

    try {

        const geojson = layer.toGeoJSON();
        const type = geojson.geometry.type;

        if (type === "Polygon" || type === "MultiPolygon") {

            const area = turf.area(geojson);
            const formatted = formatArea(area);

            layer.bindPopup(`
                <div class="parcel-popup">
                    <div class="parcel-popup-title">Hasil Pengukuran</div>
                    <div class="popup-row">
                        <span class="popup-key">Luas</span>
                        <span class="popup-value">${escapeHTML(formatted)}</span>
                    </div>
                </div>
            `);

            notify(`Luas pengukuran: ${formatted}`);

        } else if (type === "LineString") {

            const length = turf.length(geojson, { units: "kilometers" });
            let text;

            if (length >= 1) {
                text = `${length.toLocaleString("id-ID", { maximumFractionDigits: 3 })} km`;
            } else {
                text = `${(length * 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} m`;
            }

            layer.bindPopup(`
                <div class="parcel-popup">
                    <div class="parcel-popup-title">Hasil Pengukuran</div>
                    <div class="popup-row">
                        <span class="popup-key">Panjang</span>
                        <span class="popup-value">${escapeHTML(text)}</span>
                    </div>
                </div>
            `);

            notify(`Panjang pengukuran: ${text}`);

        }

    } catch(error) {

        console.error(error);
        notify("Objek berhasil digambar.");

    }

});


/* =========================================================
   CLEAR MEASURE
========================================================= */

if ($("clearMeasureBtn")) {
    $("clearMeasureBtn").addEventListener("click", function() {
        drawnItems.clearLayers();
        notify("Hasil pengukuran telah dihapus.");
    });
}


/* =========================================================
   BATAS DESA SIDODADI
========================================================= */

async function loadBatasDesa() {

    try {

        const response = await fetch("data/Batas_Desa_Sidodadi.geojson");

        if (!response.ok) {
            throw new Error("File Batas_Desa_Sidodadi.geojson tidak ditemukan.");
        }

        const data = await response.json();

        batasDesaLayer = L.geoJSON(data, {

            style: {
                color: "#dc2626",
                weight: 4,
                opacity: 1,
                fill: false
            },

            onEachFeature: function(feature, layer) {

                layer.bindTooltip("Batas Desa Sidodadi", {
                    sticky: true,
                    direction: "center",
                    className: "boundary-tooltip"
                });

            }

        });

        batasDesaLayer.addTo(map);

        console.log("✅ Batas Desa Sidodadi berhasil dimuat.");

    } catch(error) {

        console.error("Gagal memuat batas desa:", error);

    }

}

loadBatasDesa();


/* =========================================================
   GEOJSON LOADER (BIDANG TANAH)
========================================================= */

async function loadGeoJSON() {

    try {

        notify("Memuat data bidang tanah...");

        const response = await fetch("data/Bidang_Tanah.geojson");

        if (!response.ok) {
            throw new Error("File Bidang_Tanah.geojson tidak ditemukan.");
        }

        const data = await response.json();

        if (data.type !== "FeatureCollection") {
            throw new Error("GeoJSON harus berupa FeatureCollection.");
        }

        allFeatures = data.features.filter(feature => feature && feature.geometry);
        filteredFeatures = [...allFeatures];

        createParcelLayer(allFeatures);
        createDynamicFilters();
        updateDashboard(allFeatures);
        renderTable(allFeatures);

        notify(`${allFeatures.length} bidang berhasil dimuat.`);

    } catch(error) {

        console.error(error);

        allFeatures = [];
        filteredFeatures = [];

        updateDashboard([]);
        renderTable([]);

        notify("GeoJSON belum ditemukan. Pastikan file berada di folder data.");

    }

}


/* =========================================================
   CREATE PARCEL LAYER
========================================================= */

function createParcelLayer(features) {

    if (parcelLayer) {
        map.removeLayer(parcelLayer);
    }

    parcelLayer = L.geoJSON(
        {
            type: "FeatureCollection",
            features: features
        },
        {
            style: parcelStyle,
            onEachFeature: parcelEvents
        }
    );

    parcelLayer.addTo(map);

    if (features.length > 0) {

        const bounds = parcelLayer.getBounds();

        if (bounds.isValid()) {

            map.fitBounds(bounds, {
                padding: [30, 30],
                maxZoom: 18
            });

        }

    }

}


/* =========================================================
   PARCEL STYLE
========================================================= */

function parcelStyle() {

    return {
        color: "#802115",
        weight: 1.2,
        opacity: 1,
        fillColor: "#c54322",
        fillOpacity: .32
    };

}


/* =========================================================
   HIGHLIGHT
========================================================= */

function highlightFeature(event) {

    const layer = event.target;

    layer.setStyle({
        weight: 3,
        color: "#0284c7",
        fillColor: "#38bdf8",
        fillOpacity: .55
    });

    layer.bringToFront();

}

function resetHighlight(event) {

    if (parcelLayer) {
        parcelLayer.resetStyle(event.target);
    }

}


/* =========================================================
   PARCEL EVENTS
========================================================= */

function parcelEvents(feature, layer) {

    layer.on({

        mouseover: highlightFeature,
        mouseout: resetHighlight,

        click: function() {
            showFeaturePopup(feature, layer);
        }

    });

    layer.bindTooltip(getFeatureTitle(feature), {
        sticky: true,
        direction: "top",
        className: "parcel-tooltip"
    });

}


/* =========================================================
   FEATURE TITLE
========================================================= */

function getFeatureTitle(feature) {

    const props = getProperties(feature);
    const keys = Object.keys(props);

    const preferred = [
        "Nama", "nama", "NAMA", "nama_bidang", "NAMA_BIDANG",
        "id", "ID", "nib", "NIB", "nomor", "NO", "no"
    ];

    for (const key of preferred) {

        if (
            props[key] !== undefined &&
            props[key] !== null &&
            String(props[key]).trim() !== ""
        ) {
            return String(props[key]);
        }

    }

    if (keys.length) {
        return String(props[keys[0]]);
    }

    return "Bidang Tanah";

}


/* =========================================================
   POPUP
========================================================= */

function showFeaturePopup(feature, layer) {

    const props = getProperties(feature);
    const keys = Object.keys(props);

    let html = `
        <div class="parcel-popup">
            <div class="parcel-popup-title">
                <i class="fa-solid fa-map-pin"></i>
                Informasi Bidang
            </div>
    `;

    if (!keys.length) {

        html += `
            <div class="popup-row">
                <span class="popup-key">Informasi</span>
                <span class="popup-value">Tidak tersedia</span>
            </div>
        `;

    }

    keys.forEach(key => {

        let value = formatValue(props[key]);

        html += `
            <div class="popup-row">
                <span class="popup-key">${escapeHTML(key)}</span>
                <span class="popup-value">${escapeHTML(value)}</span>
            </div>
        `;

    });

    const area = getAreaM2(feature);

    if (area !== null) {

        html += `
            <div class="popup-row">
                <span class="popup-key">Luas</span>
                <span class="popup-value">${formatArea(area)}</span>
            </div>
        `;

    }

    html += `</div>`;

    layer.bindPopup(html, { maxWidth: 400 }).openPopup();

}


/* =========================================================
   GET PROPERTIES
========================================================= */

function getProperties(feature) {

    if (feature && feature.properties) {
        return feature.properties;
    }

    return {};

}


/* =========================================================
   DYNAMIC FILTER
========================================================= */

function createDynamicFilters() {

    const container = $("dynamicFilters");
    if (!container) return;

    container.innerHTML = "";

    if (!allFeatures.length) {
        container.innerHTML = `<div class="filter-loading">Tidak ada data.</div>`;
        return;
    }

    const fieldSet = new Set();

    allFeatures.forEach(feature => {
        Object.keys(getProperties(feature)).forEach(key => fieldSet.add(key));
    });

    const fields = [...fieldSet];

    if (!fields.length) {
        container.innerHTML = `<div class="filter-loading">GeoJSON tidak memiliki atribut.</div>`;
        return;
    }

    fields.slice(0, 15).forEach(field => {

        const wrapper = document.createElement("div");
        wrapper.className = "dynamic-filter";

        const label = document.createElement("label");
        label.textContent = beautifyFieldName(field);

        const select = document.createElement("select");
        select.dataset.field = field;

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Semua";
        select.appendChild(defaultOption);

        const values = getUniqueValues(field);

        values.slice(0, 200).forEach(value => {

            const option = document.createElement("option");
            option.value = String(value);
            option.textContent = formatValue(value);

            select.appendChild(option);

        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        container.appendChild(wrapper);

    });

    const totalAttrEl = $("totalAttributes");
    if (totalAttrEl) totalAttrEl.textContent = fields.length;

}


/* =========================================================
   UNIQUE VALUES (dengan klasifikasi rentang)
========================================================= */

function getUniqueValues(field) {

    if (RENTANG_NILAI[field]) {
        return RENTANG_NILAI[field].map(r => r.label);
    }

    const values = new Set();

    allFeatures.forEach(feature => {

        const props = getProperties(feature);
        const value = props[field];

        if (
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        ) {
            values.add(value);
        }

    });

    return [...values].sort((a, b) =>
        String(a).localeCompare(String(b), "id")
    );

}


/* =========================================================
   CEK NILAI MASUK RENTANG
========================================================= */

function isValueInRange(rawValue, rangeLabel, field) {

    const config = RENTANG_NILAI[field];
    if (!config) return false;

    const range = config.find(r => r.label === rangeLabel);
    if (!range) return false;

    const num = parseFloat(
        String(rawValue)
            .replace(/,/g, "")
            .replace(/[^0-9.-]/g, "")
    );

    if (Number.isNaN(num)) return false;

    return num >= range.min && num < range.max;

}


/* =========================================================
   APPLY FILTER
========================================================= */

function applyFilters() {

    const searchInput = $("searchInput");
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const selects = document.querySelectorAll(".dynamic-filter select");
    const selectedFilters = {};

    selects.forEach(select => {
        if (select.value !== "") {
            selectedFilters[select.dataset.field] = select.value;
        }
    });

    filteredFeatures = allFeatures.filter(feature => {

        const props = getProperties(feature);

        const matchesFilters = Object.entries(selectedFilters).every(([field, value]) => {

            if (RENTANG_NILAI[field]) {
                return isValueInRange(props[field], value, field);
            }

            return String(props[field]) === value;

        });

        if (!matchesFilters) return false;

        if (search) {

            const values = [
                getFeatureTitle(feature),
                ...Object.keys(props),
                ...Object.values(props).map(formatValue)
            ];

            const found = values.some(value =>
                String(value ?? "").toLowerCase().includes(search)
            );

            if (!found) return false;

        }

        return true;

    });

    createParcelLayer(filteredFeatures);
    updateDashboard(filteredFeatures);
    renderTable(filteredFeatures);

    notify(`${filteredFeatures.length} data ditemukan.`);

}


/* =========================================================
   SEARCH LIVE
========================================================= */

if ($("searchInput")) {
    $("searchInput").addEventListener("input", debounce(function() {
        applyFilters();
    }, 350));
}


/* =========================================================
   APPLY BUTTON
========================================================= */

if ($("applyFilters")) {
    $("applyFilters").addEventListener("click", applyFilters);
}


/* =========================================================
   RESET FILTER
========================================================= */

function resetFilters() {

    if ($("searchInput")) $("searchInput").value = "";

    document.querySelectorAll(".dynamic-filter select").forEach(select => {
        select.value = "";
    });

    filteredFeatures = [...allFeatures];

    createParcelLayer(allFeatures);
    updateDashboard(allFeatures);
    renderTable(allFeatures);

    notify("Semua filter telah direset.");

}

if ($("resetFilters")) $("resetFilters").addEventListener("click", resetFilters);
if ($("clearFilters")) $("clearFilters").addEventListener("click", resetFilters);


/* =========================================================
   CLEAR SEARCH
========================================================= */

if ($("clearSearch")) {
    $("clearSearch").addEventListener("click", function() {

        if ($("searchInput")) {
            $("searchInput").value = "";
            applyFilters();
            $("searchInput").focus();
        }

    });
}


/* =========================================================
   UPDATE DASHBOARD
   ⚠️ Update hero + stats grid bawah sekaligus
========================================================= */

function updateDashboard(features) {

    const total = features.length;

    const totalArea = features.reduce((sum, feature) => {
        const area = getAreaM2(feature);
        return sum + (area || 0);
    }, 0);

    const fields = new Set();

    allFeatures.forEach(feature => {
        Object.keys(getProperties(feature)).forEach(key => fields.add(key));
    });

    // Helper: set nilai ke beberapa ID sekaligus
    const setStat = (ids, value) => {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    };

    // Update HERO + STATS GRID BAWAH sekaligus
    setStat(["totalFields", "totalFields2"], total.toLocaleString("id-ID"));
    setStat(["totalArea", "totalArea2"], formatArea(totalArea));
    setStat(["totalAttributes", "totalAttributes2"], fields.size);

    // Update elemen lainnya (single ID)
    if ($("featureCount")) {
        $("featureCount").textContent = `${total.toLocaleString("id-ID")} bidang`;
    }
    if ($("tableSummary")) {
        $("tableSummary").textContent = `${total.toLocaleString("id-ID")} data`;
    }

}


/* =========================================================
   AREA
========================================================= */

function getAreaM2(feature) {

    const props = getProperties(feature);

    const possibleFields = [
        "Luas", "luas", "LUAS", "luas_m2", "LUAS_M2",
        "area", "AREA", "area_m2", "AREA_M2"
    ];

    for (const field of possibleFields) {

        if (props[field] !== undefined && props[field] !== null) {

            const number = parseFloat(
                String(props[field])
                    .replace(/,/g, "")
                    .replace(/[^0-9.-]/g, "")
            );

            if (!Number.isNaN(number)) {
                return number;
            }

        }

    }

    try {

        if (
            feature.geometry &&
            (feature.geometry.type === "Polygon" ||
             feature.geometry.type === "MultiPolygon")
        ) {
            return turf.area(feature);
        }

    } catch(error) {

        console.warn("Gagal menghitung luas:", error);

    }

    return null;

}


/* =========================================================
   FORMAT AREA
========================================================= */

function formatArea(area) {

    if (area === null || area === undefined || Number.isNaN(area)) {
        return "0 m²";
    }

    if (area >= 10000) {

        const hectare = area / 10000;

        return `${area.toLocaleString("id-ID", { maximumFractionDigits: 2 })} m² (${hectare.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ha)`;

    }

    return `${area.toLocaleString("id-ID", { maximumFractionDigits: 2 })} m²`;

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderTable(features) {

    const head = $("fieldTableHead");
    const body = $("fieldTable");

    if (!head || !body) return;

    head.innerHTML = "";
    body.innerHTML = "";

    if (!features.length) {

        body.innerHTML = `
            <tr>
                <td colspan="10" class="empty-cell">
                    <i class="fa-solid fa-filter-circle-xmark"></i>
                    <span>Tidak ada data yang sesuai.</span>
                </td>
            </tr>
        `;

        return;

    }

    const fieldSet = new Set();

    features.forEach(feature => {
        Object.keys(getProperties(feature)).forEach(key => fieldSet.add(key));
    });

    const fields = [...fieldSet];

    const headerRow = document.createElement("tr");

    const noTh = document.createElement("th");
    noTh.textContent = "No";
    headerRow.appendChild(noTh);

    fields.slice(0, 15).forEach(field => {

        const th = document.createElement("th");
        th.textContent = beautifyFieldName(field);
        headerRow.appendChild(th);

    });

    const areaTh = document.createElement("th");
    areaTh.textContent = "Luas";
    headerRow.appendChild(areaTh);

    head.appendChild(headerRow);

    features.forEach((feature, index) => {

        const tr = document.createElement("tr");

        tr.addEventListener("click", function() {
            zoomToFeature(feature);
        });

        const noTd = document.createElement("td");
        noTd.textContent = index + 1;
        tr.appendChild(noTd);

        fields.slice(0, 15).forEach(field => {

            const td = document.createElement("td");
            const props = getProperties(feature);
            td.textContent = formatValue(props[field]);
            tr.appendChild(td);

        });

        const areaTd = document.createElement("td");
        const area = getAreaM2(feature);
        areaTd.textContent = area !== null ? formatArea(area) : "-";
        tr.appendChild(areaTd);

        body.appendChild(tr);

    });

}


/* =========================================================
   ZOOM TO FEATURE
========================================================= */

function zoomToFeature(feature) {

    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();

    if (bounds.isValid()) {

        map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 19
        });

    }

    if (parcelLayer) {

        parcelLayer.eachLayer(layer => {

            if (layer.feature === feature) {
                showFeaturePopup(feature, layer);
            }

        });

    }

}


/* =========================================================
   BASEMAP SWITCH
========================================================= */

if ($("basemapSelect")) {
    $("basemapSelect").addEventListener("change", function(event) {

        const selected = event.target.value;

        if (currentBasemap) {
            map.removeLayer(currentBasemap);
        }

        currentBasemap = basemaps[selected];
        currentBasemap.addTo(map);

        notify(`Basemap diganti ke ${event.target.selectedOptions[0].text}.`);

    });
}


/* =========================================================
   LAYER TOGGLE (BIDANG TANAH)
========================================================= */

if ($("parcelToggle")) {
    $("parcelToggle").addEventListener("change", function() {

        const checked = this.checked;

        if (checked) {

            if (parcelLayer) {
                parcelLayer.addTo(map);
            }

            if ($("layerStatus")) $("layerStatus").textContent = "Aktif";
            notify("Layer bidang tanah diaktifkan.");

        } else {

            if (parcelLayer) {
                map.removeLayer(parcelLayer);
            }

            if ($("layerStatus")) $("layerStatus").textContent = "Nonaktif";
            notify("Layer bidang tanah dimatikan.");

        }

    });
}


/* =========================================================
   FIT ALL
========================================================= */

if ($("fitBtn")) {
    $("fitBtn").addEventListener("click", function() {
        zoomToAll();
    });
}

function zoomToAll() {

    if (parcelLayer) {

        const bounds = parcelLayer.getBounds();

        if (bounds.isValid()) {

            map.fitBounds(bounds, {
                padding: [30, 30],
                maxZoom: 18
            });

            return;

        }

    }

    if (allFeatures.length) {

        const layer = L.geoJSON({
            type: "FeatureCollection",
            features: allFeatures
        });

        const bounds = layer.getBounds();

        if (bounds.isValid()) {

            map.fitBounds(bounds, { padding: [30, 30] });

        }

    }

}


/* =========================================================
   HOME
========================================================= */

if ($("homeBtn")) {
    $("homeBtn").addEventListener("click", function() {

        map.setView([-5.428, 105.255], 13);
        notify("Tampilan awal dikembalikan.");

    });
}


/* =========================================================
   LOCATE USER
========================================================= */

if ($("locateBtn")) {
    $("locateBtn").addEventListener("click", function() {

        if (!navigator.geolocation) {
            notify("Browser tidak mendukung lokasi.");
            return;
        }

        notify("Mencari lokasi Anda...");

        navigator.geolocation.getCurrentPosition(

            function(position) {

                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                map.setView([lat, lng], 17);

                if (userLocationMarker) {
                    map.removeLayer(userLocationMarker);
                }

                userLocationMarker = L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup(`
                        <strong>Lokasi Saya</strong>
                        <br>
                        Latitude: ${lat.toFixed(6)}
                        <br>
                        Longitude: ${lng.toFixed(6)}
                    `)
                    .openPopup();

                notify("Lokasi berhasil ditemukan.");

            },

            function(error) {

                let message = "Lokasi tidak dapat ditemukan.";

                if (error.code === 1) {
                    message = "Akses lokasi ditolak.";
                }

                notify(message);

            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }

        );

    });
}


/* =========================================================
   FULLSCREEN
========================================================= */

if ($("fullscreenBtn")) {
    $("fullscreenBtn").addEventListener("click", function() {

        const mapElement = document.querySelector(".map-wrapper");
        if (!mapElement) return;

        if (!document.fullscreenElement) {

            mapElement.requestFullscreen().then(() => {

                setTimeout(() => {
                    map.invalidateSize();
                }, 300);

            });

        } else {

            document.exitFullscreen();

        }

    });
}

document.addEventListener("fullscreenchange", function() {

    setTimeout(() => {
        map.invalidateSize();
    }, 300);

});


/* =========================================================
   PRINT
========================================================= */

if ($("printBtn")) {
    $("printBtn").addEventListener("click", function() {
        window.print();
    });
}


/* =========================================================
   IMPORT GEOJSON
========================================================= */

if ($("uploadBtn")) {
    $("uploadBtn").addEventListener("click", function() {
        if ($("geojsonInput")) $("geojsonInput").click();
    });
}

if ($("geojsonInput")) {
    $("geojsonInput").addEventListener("change", async function(event) {

        const file = event.target.files[0];

        if (!file) return;

        try {

            const text = await file.text();
            const data = JSON.parse(text);

            let features = [];

            if (data.type === "FeatureCollection") {
                features = data.features;
            } else if (data.type === "Feature") {
                features = [data];
            } else {
                throw new Error("Format GeoJSON tidak dikenali.");
            }

            allFeatures = features.filter(feature => feature && feature.geometry);
            filteredFeatures = [...allFeatures];

            createParcelLayer(allFeatures);
            createDynamicFilters();
            updateDashboard(allFeatures);
            renderTable(allFeatures);

            notify(`${allFeatures.length} fitur berhasil diimpor.`);

        } catch(error) {

            console.error(error);
            notify(`Gagal membaca GeoJSON: ${error.message}`);

        }

        event.target.value = "";

    });
}


/* =========================================================
   EXPORT GEOJSON
========================================================= */

if ($("exportBtn")) {
    $("exportBtn").addEventListener("click", function() {

        if (!allFeatures.length) {
            notify("Belum ada data untuk diekspor.");
            return;
        }

        const data = {
            type: "FeatureCollection",
            features: allFeatures
        };

        downloadFile(
            JSON.stringify(data, null, 2),
            "sidodadi_bidang_tanah.geojson",
            "application/geo+json"
        );

        notify("GeoJSON berhasil diekspor.");

    });
}


/* =========================================================
   CSV EXPORT
========================================================= */

if ($("tableExportBtn")) $("tableExportBtn").addEventListener("click", exportCSV);
if ($("tableExportBtn2")) $("tableExportBtn2").addEventListener("click", exportCSV);

function exportCSV() {

    if (!filteredFeatures.length) {
        notify("Tidak ada data untuk diekspor.");
        return;
    }

    const fieldSet = new Set();

    filteredFeatures.forEach(feature => {
        Object.keys(getProperties(feature)).forEach(key => fieldSet.add(key));
    });

    const fields = [...fieldSet];

    const headers = ["No", ...fields, "Luas m2"];

    const rows = filteredFeatures.map((feature, index) => {

        const props = getProperties(feature);

        return [
            index + 1,
            ...fields.map(field => formatValue(props[field])),
            getAreaM2(feature) ?? ""
        ];

    });

    const csvRows = [headers, ...rows].map(row =>
        row.map(value => quoteCSV(value)).join(",")
    );

    const csv = "\uFEFF" + csvRows.join("\r\n");

    downloadFile(
        csv,
        "sidodadi_data_bidang.csv",
        "text/csv;charset=utf-8"
    );

    notify("CSV berhasil diekspor.");

}


/* =========================================================
   DOWNLOAD
========================================================= */

function downloadFile(content, filename, type) {

    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);

}


/* =========================================================
   QUOTE CSV
========================================================= */

function quoteCSV(value) {

    return `"${String(value ?? "").replace(/"/g, '""')}"`;

}


/* =========================================================
   DARK MODE
========================================================= */

function toggleDarkMode() {

    document.body.classList.toggle("dark");

    const dark = document.body.classList.contains("dark");
    const icon = dark ? "fa-sun" : "fa-moon";

    if ($("themeBtn")) {
        $("themeBtn").innerHTML = `<i class="fa-solid ${icon}"></i>`;
    }

    if ($("darkBtn")) {
        $("darkBtn").innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${dark ? "Mode Terang" : "Mode Gelap"}</span>
        `;
    }

    localStorage.setItem("sidodadiDarkMode", dark ? "1" : "0");

    setTimeout(() => {
        map.invalidateSize();
    }, 150);

}

if ($("themeBtn")) $("themeBtn").addEventListener("click", toggleDarkMode);
if ($("darkBtn")) $("darkBtn").addEventListener("click", toggleDarkMode);


/* =========================================================
   RESTORE DARK MODE
========================================================= */

if (localStorage.getItem("sidodadiDarkMode") === "1") {

    document.body.classList.add("dark");

    if ($("themeBtn")) {
        $("themeBtn").innerHTML = `<i class="fa-solid fa-sun"></i>`;
    }

    if ($("darkBtn")) {
        $("darkBtn").innerHTML = `
            <i class="fa-solid fa-sun"></i>
            <span>Mode Terang</span>
        `;
    }

}


/* =========================================================
   HERO MAP BUTTON
========================================================= */

if ($("heroMapBtn")) {
    $("heroMapBtn").addEventListener("click", function() {

        const mapSection = $("map-section");
        if (mapSection) {
            mapSection.scrollIntoView({ behavior: "smooth" });
        }

    });
}


/* =========================================================
   COORDINATES
========================================================= */

map.on("mousemove", function(event) {

    if ($("cursorCoords")) {
        $("cursorCoords").textContent =
            `Koordinat: ${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`;
    }

});


/* =========================================================
   UTILITY
========================================================= */

function formatValue(value) {

    if (value === null || value === undefined) return "";

    if (typeof value === "object") {

        try {
            return JSON.stringify(value);
        } catch(error) {
            return String(value);
        }

    }

    return String(value);

}


/* =========================================================
   BEAUTIFY FIELD
========================================================= */

function beautifyFieldName(field) {

    return String(field)
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   DEBOUNCE
========================================================= */

function debounce(func, delay) {

    let timer;

    return function(...args) {

        clearTimeout(timer);

        timer = setTimeout(() => {
            func.apply(this, args);
        }, delay);

    };

}


/* =========================================================
   TOAST
========================================================= */

function notify(message) {

    const toast = $("toast");
    const text = $("toastMessage");

    if (!toast || !text) return;

    text.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);

}


/* =========================================================
   YEAR
========================================================= */

if ($("year")) {
    $("year").textContent = new Date().getFullYear();
}


/* =========================================================
   START
========================================================= */

loadGeoJSON();


/* =========================================================
   RESIZE
========================================================= */

let resizeTimer = null;

window.addEventListener("resize", function() {

    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
        map.invalidateSize();

        // Auto-close sidebar mobile saat resize ke desktop
        if (window.innerWidth > 850) {
            document.body.classList.remove("sidebar-open");
        }

    }, 200);

});


/* =========================================================
   STYLE HAK MILIK
========================================================= */

function hakMilikStyle() {

    return {
        color: "#15fa00",
        weight: 1.5,
        opacity: 1,
        fillColor: "#48ff00",
        fillOpacity: 0.40
    };

}


/* =========================================================
   STYLE HAK KOSONG
========================================================= */

function hakKosongStyle() {

    return {
        color: "#c2410c",
        weight: 1.5,
        opacity: 1,
        fillColor: "#f97316",
        fillOpacity: 0.45
    };

}


/* =========================================================
   LOAD HAK MILIK
========================================================= */

async function loadHakMilik() {

    try {

        const response = await fetch("data/Hak_Milik.geojson");

        if (!response.ok) {
            throw new Error("Hak_Milik.geojson tidak ditemukan.");
        }

        const data = await response.json();

        hakMilikLayer = L.geoJSON(data, {

            style: hakMilikStyle,

            onEachFeature: function(feature, layer) {

                layer.on({

                    mouseover: function(e) {

                        e.target.setStyle({
                            weight: 3,
                            color: "#2b00ff",
                            fillColor: "#2f00fe",
                            fillOpacity: 0.65
                        });

                    },

                    mouseout: function(e) {
                        hakMilikLayer.resetStyle(e.target);
                    },

                    click: function() {
                        showFeaturePopup(feature, layer);
                    }

                });

                layer.bindTooltip(getFeatureTitle(feature), {
                    sticky: true,
                    direction: "top",
                    className: "parcel-tooltip"
                });

            }

        });

        hakMilikLayer.addTo(map);

        console.log("✅ Hak Milik berhasil dimuat.");

    } catch(error) {

        console.error("Gagal memuat Hak Milik:", error);

    }

}


/* =========================================================
   LOAD HAK KOSONG
========================================================= */

async function loadHakKosong() {

    try {

        const response = await fetch("data/Hak_Kosong.geojson");

        if (!response.ok) {
            throw new Error("Hak_Kosong.geojson tidak ditemukan.");
        }

        const data = await response.json();

        hakKosongLayer = L.geoJSON(data, {

            style: hakKosongStyle,

            onEachFeature: function(feature, layer) {

                layer.on({

                    mouseover: function(e) {

                        e.target.setStyle({
                            weight: 3,
                            color: "#9a3412",
                            fillColor: "#fdba74",
                            fillOpacity: 0.70
                        });

                    },

                    mouseout: function(e) {
                        hakKosongLayer.resetStyle(e.target);
                    },

                    click: function() {
                        showFeaturePopup(feature, layer);
                    }

                });

                layer.bindTooltip(getFeatureTitle(feature), {
                    sticky: true,
                    direction: "top",
                    className: "parcel-tooltip"
                });

            }

        });

        hakKosongLayer.addTo(map);

        console.log("✅ Hak Kosong berhasil dimuat.");

    } catch(error) {

        console.error("Gagal memuat Hak Kosong:", error);

    }

}


/* =========================================================
   BUAT LAYER ITEM UNTUK HAK MILIK & HAK KOSONG
========================================================= */

function createHakLayerControls() {

    if (document.getElementById("hakMilikLayerItem")) return;

    const parcelToggle = document.getElementById("parcelToggle");

    if (!parcelToggle) {
        console.error("parcelToggle tidak ditemukan.");
        return;
    }

    let bidangItem = parcelToggle.closest(".layer-item");

    if (!bidangItem) {
        bidangItem = parcelToggle.parentElement;
    }

    const layerParent = bidangItem.parentElement;

    const hakMilikItem = document.createElement("div");
    hakMilikItem.id = "hakMilikLayerItem";

    hakMilikItem.style.cssText = `
        display:flex;
        align-items:center;
        justify-content:space-between;
        width:100%;
        min-height:42px;
        padding:0 10px;
        box-sizing:border-box;
        cursor:pointer;
    `;

    hakMilikItem.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="width:10px;height:10px;min-width:10px;border-radius:2px;background:#22c55e;display:inline-block;"></span>
            <span style="color:inherit;font-size:12px;font-weight:500;white-space:nowrap;">Hak Milik</span>
        </div>
        <label style="position:relative;width:32px;height:18px;display:inline-block;flex-shrink:0;cursor:pointer;">
            <input type="checkbox" id="hakMilikToggle" checked style="opacity:0;width:0;height:0;position:absolute;">
            <span id="hakMilikSlider" style="position:absolute;inset:0;background:#18b77e;border-radius:20px;transition:.2s;"></span>
            <span id="hakMilikKnob" style="position:absolute;width:14px;height:14px;left:15px;top:2px;background:white;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.25);"></span>
        </label>
    `;

    const hakKosongItem = document.createElement("div");
    hakKosongItem.id = "hakKosongLayerItem";

    hakKosongItem.style.cssText = `
        display:flex;
        align-items:center;
        justify-content:space-between;
        width:100%;
        min-height:42px;
        padding:0 10px;
        box-sizing:border-box;
        cursor:pointer;
    `;

    hakKosongItem.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="width:10px;height:10px;min-width:10px;border-radius:2px;background:#f97316;display:inline-block;"></span>
            <span style="color:inherit;font-size:12px;font-weight:500;white-space:nowrap;">Hak Kosong</span>
        </div>
        <label style="position:relative;width:32px;height:18px;display:inline-block;flex-shrink:0;cursor:pointer;">
            <input type="checkbox" id="hakKosongToggle" checked style="opacity:0;width:0;height:0;position:absolute;">
            <span id="hakKosongSlider" style="position:absolute;inset:0;background:#18b77e;border-radius:20px;transition:.2s;"></span>
            <span id="hakKosongKnob" style="position:absolute;width:14px;height:14px;left:15px;top:2px;background:white;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.25);"></span>
        </label>
    `;

    layerParent.insertBefore(hakMilikItem, bidangItem.nextSibling);
    layerParent.insertBefore(hakKosongItem, hakMilikItem.nextSibling);

    const hakMilikToggle = document.getElementById("hakMilikToggle");
    const hakMilikSlider = document.getElementById("hakMilikSlider");
    const hakMilikKnob = document.getElementById("hakMilikKnob");

    if (hakMilikToggle) {
        hakMilikToggle.addEventListener("change", function() {

            if (this.checked) {

                if (hakMilikLayer) hakMilikLayer.addTo(map);
                hakMilikSlider.style.background = "#3c00ff";
                hakMilikKnob.style.left = "15px";

            } else {

                if (hakMilikLayer) map.removeLayer(hakMilikLayer);
                hakMilikSlider.style.background = "#9ca3af";
                hakMilikKnob.style.left = "2px";

            }

        });
    }

    const hakKosongToggle = document.getElementById("hakKosongToggle");
    const hakKosongSlider = document.getElementById("hakKosongSlider");
    const hakKosongKnob = document.getElementById("hakKosongKnob");

    if (hakKosongToggle) {
        hakKosongToggle.addEventListener("change", function() {

            if (this.checked) {

                if (hakKosongLayer) hakKosongLayer.addTo(map);
                hakKosongSlider.style.background = "#f97316";
                hakKosongKnob.style.left = "15px";

            } else {

                if (hakKosongLayer) map.removeLayer(hakKosongLayer);
                hakKosongSlider.style.background = "#9ca3af";
                hakKosongKnob.style.left = "2px";

            }

        });
    }

}


/* =========================================================
   LOAD HAK MILIK + HAK KOSONG
========================================================= */

async function loadHakLayers() {

    await Promise.all([
        loadHakMilik(),
        loadHakKosong()
    ]);

    createHakLayerControls();

}

loadHakLayers();


/* =========================================================
   STYLE JALAN
========================================================= */

function jalanStyle() {

    return {
        color: "#2563eb",
        weight: 4,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round"
    };

}


/* =========================================================
   MENCARI NAMA JALAN
========================================================= */

function getNamaJalan(feature) {

    const props = feature && feature.properties ? feature.properties : {};

    const preferredFields = [
        "nama_jalan", "NAMA_JALAN", "namajalan", "Nama_Jalan",
        "Nama Jalan", "nama", "NAMA", "name", "NAME", "Name",
        "jalan", "JALAN"
    ];

    for (const field of preferredFields) {

        if (
            props[field] !== undefined &&
            props[field] !== null &&
            String(props[field]).trim() !== ""
        ) {
            return String(props[field]);
        }

    }

    const keys = Object.keys(props);

    if (keys.length > 0) {

        const firstValue = props[keys[0]];

        if (
            firstValue !== undefined &&
            firstValue !== null &&
            String(firstValue).trim() !== ""
        ) {
            return String(firstValue);
        }

    }

    return "Jalan";

}


/* =========================================================
   POPUP JALAN
========================================================= */

function showJalanPopup(feature, layer) {

    const props = feature && feature.properties ? feature.properties : {};
    const keys = Object.keys(props);
    const namaJalan = getNamaJalan(feature);

    let html = `
        <div class="jalan-popup">
            <div style="font-size:16px;font-weight:700;margin-bottom:12px;color:#1d4ed8;">
                <i class="fa-solid fa-road" style="margin-right:7px;"></i>
                ${escapeHTML(namaJalan)}
            </div>
    `;

    if (!keys.length) {

        html += `
            <div style="padding:8px 0;color:#666;">
                Tidak ada informasi atribut jalan.
            </div>
        `;

    }

    keys.forEach(key => {

        let value = formatValue(props[key]);

        html += `
            <div style="display:flex;justify-content:space-between;gap:15px;padding:7px 0;border-bottom:1px solid #e5e7eb;">
                <span style="font-weight:600;color:#374151;">${escapeHTML(key)}</span>
                <span style="text-align:right;color:#111827;">${escapeHTML(value)}</span>
            </div>
        `;

    });

    html += `</div>`;

    layer.bindPopup(html, { maxWidth: 400 }).openPopup();

}


/* =========================================================
   EVENT JALAN
========================================================= */

function jalanEvents(feature, layer) {

    const originalStyle = jalanStyle();

    layer.on({

        mouseover: function(event) {

            const target = event.target;

            target.setStyle({
                color: "#1d4ed8",
                weight: 7,
                opacity: 1
            });

            target.bringToFront();

        },

        mouseout: function(event) {

            const target = event.target;
            target.setStyle(originalStyle);

        },

        click: function() {
            showJalanPopup(feature, layer);
        }

    });

    layer.bindTooltip(getNamaJalan(feature), {
        sticky: true,
        direction: "top",
        className: "jalan-tooltip"
    });

}


/* =========================================================
   LOAD GEOJSON JALAN
========================================================= */

async function loadJalan() {

    try {

        notify("Memuat data jalan...");

        const response = await fetch("data/Jalan.geojson");

        if (!response.ok) {
            throw new Error("File Jalan.geojson tidak ditemukan.");
        }

        const data = await response.json();

        if (data.type !== "FeatureCollection") {
            throw new Error("GeoJSON Jalan harus berupa FeatureCollection.");
        }

        const features = data.features.filter(feature => feature && feature.geometry);

        if (!features.length) {
            throw new Error("GeoJSON Jalan tidak memiliki fitur.");
        }

        jalanLayer = L.geoJSON(
            {
                type: "FeatureCollection",
                features: features
            },
            {
                style: jalanStyle,
                onEachFeature: jalanEvents
            }
        );

        jalanLayer.addTo(map);

        console.log("✅ Layer Jalan berhasil dimuat:", features.length, "fitur");

        const toggle = document.getElementById("jalanToggle");

        if (toggle) toggle.checked = true;

        notify(`${features.length} data jalan berhasil dimuat.`);

    } catch(error) {

        console.error("Gagal memuat Jalan:", error);

        notify("Data Jalan belum dapat dimuat. Pastikan Jalan.geojson berada di folder data.");

    }

}


/* =========================================================
   MEMBUAT CHECKBOX JALAN
========================================================= */

function createJalanToggle() {

    if (document.getElementById("jalanLayerItem")) return;

    const parcelToggle = document.getElementById("parcelToggle");

    if (!parcelToggle) {
        console.warn("parcelToggle belum ditemukan.");
        return;
    }

    let bidangItem = parcelToggle.closest(".layer-item");

    if (!bidangItem) bidangItem = parcelToggle.parentElement;

    if (!bidangItem) {
        console.warn("Container layer tidak ditemukan.");
        return;
    }

    const parent = bidangItem.parentElement;

    const jalanItem = document.createElement("div");
    jalanItem.id = "jalanLayerItem";

    jalanItem.style.cssText = `
        display:flex;
        align-items:center;
        justify-content:space-between;
        width:100%;
        min-height:42px;
        padding:0 10px;
        box-sizing:border-box;
        cursor:pointer;
    `;

    jalanItem.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="width:28px;height:4px;border-radius:4px;background:#2563eb;display:inline-block;"></span>
            <span style="color:inherit;font-size:12px;font-weight:500;white-space:nowrap;">Jalan</span>
        </div>
        <label style="position:relative;width:32px;height:18px;display:inline-block;flex-shrink:0;cursor:pointer;">
            <input type="checkbox" id="jalanToggle" checked style="opacity:0;width:0;height:0;position:absolute;">
            <span id="jalanSlider" style="position:absolute;inset:0;background:#2563eb;border-radius:20px;transition:.25s;"></span>
            <span id="jalanKnob" style="position:absolute;width:14px;height:14px;left:16px;top:2px;background:white;border-radius:50%;transition:.25s;box-shadow:0 1px 3px rgba(0,0,0,.25);"></span>
        </label>
    `;

    parent.insertBefore(jalanItem, bidangItem.nextSibling);

    const toggle = document.getElementById("jalanToggle");
    const slider = document.getElementById("jalanSlider");
    const knob = document.getElementById("jalanKnob");

    if (toggle) {
        toggle.addEventListener("change", function() {

            if (this.checked) {

                if (jalanLayer) jalanLayer.addTo(map);
                slider.style.background = "#2563eb";
                knob.style.left = "16px";

                notify("Layer jalan diaktifkan.");

            } else {

                if (jalanLayer) map.removeLayer(jalanLayer);
                slider.style.background = "#9ca3af";
                knob.style.left = "2px";

                notify("Layer jalan dimatikan.");

            }

        });
    }

    jalanItem.addEventListener("click", function(event) {

        if (event.target.closest("label")) return;

        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event("change"));

    });

}


/* =========================================================
   LEAFLET LEGEND JALAN
========================================================= */

function createJalanLegend() {

    if (document.getElementById("jalanLegend")) return;

    const JalanLegend = L.control({ position: "bottomright" });

    JalanLegend.onAdd = function() {

        const div = L.DomUtil.create("div", "jalan-legend");
        div.id = "jalanLegend";

        div.innerHTML = `
            <div style="font-weight:700;margin-bottom:8px;font-size:13px;">Legenda</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                <span style="width:28px;height:4px;background:#2563eb;border-radius:4px;display:inline-block;"></span>
                <span>Jalan</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="width:28px;height:4px;background:#dc2626;display:inline-block;"></span>
                <span>Batas Desa</span>
            </div>
        `;

        div.style.cssText = `
            background:rgba(255,255,255,.95);
            padding:10px 12px;
            border-radius:8px;
            box-shadow:0 2px 10px rgba(0,0,0,.15);
            font-size:12px;
            color:#111827;
        `;

        L.DomEvent.disableClickPropagation(div);

        return div;

    };

    JalanLegend.addTo(map);

}


/* =========================================================
   CSS JALAN
========================================================= */

function addJalanCSS() {

    if (document.getElementById("jalanLayerCSS")) return;

    const style = document.createElement("style");
    style.id = "jalanLayerCSS";

    style.innerHTML = `
        .jalan-tooltip {
            background:rgba(255,255,255,.95);
            border:1px solid #2563eb;
            color:#1d4ed8;
            font-weight:600;
            padding:5px 9px;
            border-radius:6px;
            box-shadow:0 2px 6px rgba(0,0,0,.15);
        }

        .jalan-popup {
            min-width:240px;
            font-size:13px;
        }

        .jalan-popup .leaflet-popup-content {
            margin:12px;
        }

        .dark .jalan-legend {
            background:rgba(31,41,55,.95) !important;
            color:#fff !important;
        }
    `;

    document.head.appendChild(style);

}


/* =========================================================
   INISIALISASI LAYER JALAN
========================================================= */

function initJalanLayer() {

    addJalanCSS();
    createJalanLegend();
    loadJalan();
    createJalanToggle();

}

if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", function() {

        setTimeout(initJalanLayer, 500);

    });

} else {

    setTimeout(initJalanLayer, 500);

}


/* =========================================================
   SIDEBAR TOGGLE (OPEN / CLOSE)
   ✅ Desktop + Mobile + Overlay + Swipe Gesture
========================================================= */

(function initSidebarToggle() {

    function setup() {

        const sidebar = document.getElementById("sidebar");
        const menuBtn = document.getElementById("menuBtn");
        const closeBtn = document.getElementById("closeSidebar");
        const overlay = document.getElementById("sidebarOverlay");
        const body = document.body;

        if (!sidebar) {
            console.error("❌ Elemen #sidebar tidak ditemukan!");
            return;
        }

        if (!menuBtn) {
            console.error("❌ Elemen #menuBtn tidak ditemukan!");
            return;
        }

        console.log("✅ Sidebar toggle siap!");

        function isMobile() {
            return window.innerWidth <= 850;
        }

        function openSidebar() {
            body.classList.add("sidebar-open");
            body.classList.remove("sidebar-closed");
        }

        function closeSidebar() {
            body.classList.remove("sidebar-open");
        }

        // Toggle button
        menuBtn.addEventListener("click", function (e) {

            e.stopPropagation();

            if (isMobile()) {

                if (body.classList.contains("sidebar-open")) {
                    closeSidebar();
                } else {
                    openSidebar();
                }

            } else {

                body.classList.toggle("sidebar-closed");
                localStorage.setItem(
                    "sidebarClosed",
                    body.classList.contains("sidebar-closed")
                );

            }

            setTimeout(function () {
                if (window.map && typeof map.invalidateSize === "function") {
                    map.invalidateSize();
                }
            }, 400);

        });

        // Close button
        if (closeBtn) {
            closeBtn.addEventListener("click", function () {

                if (isMobile()) {
                    closeSidebar();
                } else {
                    body.classList.add("sidebar-closed");
                    localStorage.setItem("sidebarClosed", "true");
                }

                setTimeout(function () {
                    if (window.map && typeof map.invalidateSize === "function") {
                        map.invalidateSize();
                    }
                }, 400);

            });
        }

        // ✅ Overlay click — tap di luar untuk tutup sidebar
        if (overlay) {
            overlay.addEventListener("click", function () {
                closeSidebar();
            });
        }

        // ✅ Auto-close saat klik nav-link di mobile
        document.querySelectorAll(".nav-link, .side-action").forEach(link => {

            link.addEventListener("click", function() {

                if (isMobile() && body.classList.contains("sidebar-open")) {

                    // Delay sedikit supaya animasi klik kelihatan
                    setTimeout(closeSidebar, 200);

                }

            });

        });

        // ✅ Swipe gesture — geser dari kiri untuk buka, geser ke kiri untuk tutup
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        const SWIPE_THRESHOLD = 60;

        document.addEventListener("touchstart", function(e) {
            if (!isMobile()) return;
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener("touchend", function(e) {
            if (!isMobile()) return;

            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;

            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Abaikan kalau swipe lebih vertikal dari horizontal
            if (Math.abs(diffY) > Math.abs(diffX)) return;
            if (Math.abs(diffX) < SWIPE_THRESHOLD) return;

            // Swipe dari kiri ke kanan (buka sidebar) — hanya kalau mulai dari tepi kiri
            if (diffX > 0 && touchStartX < 40 && !body.classList.contains("sidebar-open")) {
                openSidebar();
            }

            // Swipe dari kanan ke kiri (tutup sidebar) — hanya kalau sidebar terbuka
            if (diffX < 0 && body.classList.contains("sidebar-open")) {
                closeSidebar();
            }

        }, { passive: true });

        // Restore sidebar state desktop
        if (!isMobile()) {
            const saved = localStorage.getItem("sidebarClosed");
            if (saved === "true") {
                body.classList.add("sidebar-closed");
            }
        }

    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setup);
    } else {
        setup();
    }

})();


/* =========================================================
   DASHBOARD ANALISIS MULTI-CHART
========================================================= */

/* =========================================================
   HITUNG STATISTIK GENERIK
========================================================= */

function hitungStatistik(fieldNames) {

    const hasil = {};

    allFeatures.forEach(feature => {

        const props = getProperties(feature);

        let value = "Tidak Diketahui";

        for (const field of fieldNames) {
            if (props[field] !== undefined && props[field] !== null && String(props[field]).trim() !== "") {
                value = String(props[field]).trim();
                break;
            }
        }

        if (!hasil[value]) {
            hasil[value] = 0;
        }

        hasil[value]++;

    });

    return hasil;

}


/* =========================================================
   HITUNG DISTRIBUSI LUAS
========================================================= */

function hitungDistribusiLuas() {

    const rentang = [
        { label: "< 200 m²",       min: 0,    max: 200,    count: 0 },
        { label: "200 – 400 m²",   min: 200,  max: 400,    count: 0 },
        { label: "400 – 600 m²",   min: 400,  max: 600,    count: 0 },
        { label: "600 – 900 m²",   min: 600,  max: 900,    count: 0 },
        { label: "900 – 1.200 m²", min: 900,  max: 1200,   count: 0 },
        { label: "> 1.200 m²",     min: 1200, max: Infinity, count: 0 }
    ];

    allFeatures.forEach(feature => {

        const area = getAreaM2(feature);

        if (area === null) return;

        for (const r of rentang) {
            if (area >= r.min && area < r.max) {
                r.count++;
                break;
            }
        }

    });

    return rentang;

}


/* =========================================================
   HITUNG TOP 10 PEMILIK TERLUAS
========================================================= */

function hitungTopPemilik() {

    const pemilik = [];

    allFeatures.forEach(feature => {

        const props = getProperties(feature);

        const nama =
            props["Nama"] ||
            props["nama"] ||
            props["NAMA"] ||
            props["nama_bidang"] ||
            "Tanpa Nama";

        const luas = getAreaM2(feature) || 0;

        pemilik.push({ nama: String(nama), luas: luas });

    });

    return pemilik
        .sort((a, b) => b.luas - a.luas)
        .slice(0, 10);

}


/* =========================================================
   KONFIG CHART: KESESUAIAN
========================================================= */

function getConfigKesesuaian() {

    const statistik = hitungStatistik(["Kesesuaian", "kesesuaian", "KESESUAIAN"]);
    const entries = Object.entries(statistik).sort((a, b) => b[1] - a[1]);

    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);
    const colors = labels.map(l => getWarnaKesesuaian(l));

    return {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: "#ffffff",
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#07111f",
                    titleColor: "#ffffff",
                    bodyColor: "#e5edf7",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.parsed;
                            const percent = ((value / total) * 100).toFixed(1);
                            return `  ${value} bidang (${percent}%)`;
                        }
                    }
                }
            }
        }
    };

}


function getLegendKesesuaian() {
    const statistik = hitungStatistik(["Kesesuaian", "kesesuaian", "KESESUAIAN"]);
    const entries = Object.entries(statistik).sort((a, b) => b[1] - a[1]);
    return entries.map(([label, count]) => ({
        label: label,
        count: count,
        color: getWarnaKesesuaian(label)
    }));
}


/* =========================================================
   KONFIG CHART: JENIS HAK
========================================================= */

function getConfigJenisHak() {

    const statistik = hitungStatistik(["Jenis Hak", "jenis_hak", "JENIS_HAK", "jenisHak"]);
    const entries = Object.entries(statistik).sort((a, b) => b[1] - a[1]);

    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);
    const colors = labels.map((_, i) => WARNA_PALETTE[i % WARNA_PALETTE.length]);

    return {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: "#ffffff",
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#07111f",
                    titleColor: "#ffffff",
                    bodyColor: "#e5edf7",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.parsed;
                            const percent = ((value / total) * 100).toFixed(1);
                            return `  ${value} bidang (${percent}%)`;
                        }
                    }
                }
            }
        }
    };

}


function getLegendJenisHak() {
    const statistik = hitungStatistik(["Jenis Hak", "jenis_hak", "JENIS_HAK", "jenisHak"]);
    const entries = Object.entries(statistik).sort((a, b) => b[1] - a[1]);
    return entries.map(([label, count], i) => ({
        label: label,
        count: count,
        color: WARNA_PALETTE[i % WARNA_PALETTE.length]
    }));
}


/* =========================================================
   KONFIG CHART: DISTRIBUSI LUAS
========================================================= */

function getConfigLuas() {

    const rentang = hitungDistribusiLuas();

    return {
        type: "bar",
        data: {
            labels: rentang.map(r => r.label),
            datasets: [{
                label: "Jumlah Bidang",
                data: rentang.map(r => r.count),
                backgroundColor: [
                    "#94a3b8", "#0ea5e9", "#10b981",
                    "#f59e0b", "#8b5cf6", "#ef4444"
                ],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#07111f",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (c) => `  ${c.parsed.y} bidang`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: "#64748b" },
                    grid: { color: "#f1f5f9" }
                },
                x: {
                    ticks: { color: "#64748b", font: { size: 10 } },
                    grid: { display: false }
                }
            }
        }
    };

}


function getLegendLuas() {
    const rentang = hitungDistribusiLuas();
    const colors = ["#94a3b8", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];
    return rentang.map((r, i) => ({
        label: r.label,
        count: r.count,
        color: colors[i]
    }));
}


/* =========================================================
   KONFIG CHART: OVERLAP
========================================================= */

function getConfigOverlap() {

    const statMilik = hitungStatistik(["Kategori Hak Milik", "kategori_hak_milik"]);
    const statKosong = hitungStatistik(["Kategori Hak Kosong", "kategori_hak_kosong"]);

    const allLabels = [...new Set([...Object.keys(statMilik), ...Object.keys(statKosong)])];

    const dataMilik = allLabels.map(l => statMilik[l] || 0);
    const dataKosong = allLabels.map(l => statKosong[l] || 0);

    return {
        type: "bar",
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: "Hak Milik",
                    data: dataMilik,
                    backgroundColor: "#0ea5e9",
                    borderRadius: 8
                },
                {
                    label: "Hak Kosong",
                    data: dataKosong,
                    backgroundColor: "#f97316",
                    borderRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    labels: { color: "#64748b", font: { size: 11, weight: "600" } }
                },
                tooltip: {
                    backgroundColor: "#07111f",
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: "#64748b" },
                    grid: { color: "#f1f5f9" }
                },
                x: {
                    ticks: { color: "#64748b", font: { size: 10 } },
                    grid: { display: false }
                }
            }
        }
    };

}


function getLegendOverlap() {

    const statMilik = hitungStatistik(["Kategori Hak Milik"]);
    const statKosong = hitungStatistik(["Kategori Hak Kosong"]);

    const hasil = [];

    Object.entries(statMilik).sort((a, b) => b[1] - a[1]).forEach(([label, count]) => {
        hasil.push({ label: `HM: ${label}`, count: count, color: "#0ea5e9" });
    });

    Object.entries(statKosong).sort((a, b) => b[1] - a[1]).forEach(([label, count]) => {
        hasil.push({ label: `HK: ${label}`, count: count, color: "#f97316" });
    });

    return hasil;

}


/* =========================================================
   KONFIG CHART: PERSENTASE
========================================================= */

function hitungPersentaseMilik() {

    const RENTANG = [
        { label: "Tidak Ada (0%)",      min: 0,      max: 0.0001, count: 0 },
        { label: "Rendah (1–50%)",      min: 0.0001, max: 50,     count: 0 },
        { label: "Sedang (50–75%)",     min: 50,     max: 75,     count: 0 },
        { label: "Tinggi (75–95%)",     min: 75,     max: 95,     count: 0 },
        { label: "Sangat Tinggi (>95%)", min: 95,    max: 100.0001, count: 0 }
    ];

    allFeatures.forEach(feature => {
        const props = getProperties(feature);
        const raw = props["Persentase Hak Milik"] || props["persentase_hak_milik"] || props["PERSENTASE_HAK_MILIK"];
        const num = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
        if (Number.isNaN(num)) return;

        for (const r of RENTANG) {
            if (num >= r.min && num < r.max) {
                r.count++;
                break;
            }
        }
    });

    return RENTANG;

}


function getConfigPersentase() {

    const rentang = hitungPersentaseMilik();

    return {
        type: "bar",
        data: {
            labels: rentang.map(r => r.label),
            datasets: [{
                label: "Jumlah Bidang",
                data: rentang.map(r => r.count),
                backgroundColor: ["#94a3b8", "#ef4444", "#f59e0b", "#0ea5e9", "#10b981"],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#07111f",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: { label: (c) => `  ${c.parsed.y} bidang` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: "#64748b" },
                    grid: { color: "#f1f5f9" }
                },
                x: {
                    ticks: { color: "#64748b", font: { size: 9 } },
                    grid: { display: false }
                }
            }
        }
    };

}


function getLegendPersentase() {
    const rentang = hitungPersentaseMilik();
    const colors = ["#94a3b8", "#ef4444", "#f59e0b", "#0ea5e9", "#10b981"];
    return rentang.map((r, i) => ({
        label: r.label,
        count: r.count,
        color: colors[i]
    }));
}


/* =========================================================
   KONFIG CHART: TOP 10 PEMILIK
========================================================= */

function getConfigTopPemilik() {

    const top = hitungTopPemilik();

    return {
        type: "bar",
        data: {
            labels: top.map(t => t.nama.length > 18 ? t.nama.substring(0, 18) + "..." : t.nama),
            datasets: [{
                label: "Luas (m²)",
                data: top.map(t => t.luas),
                backgroundColor: "#10b981",
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#07111f",
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (c) => `  ${c.parsed.x.toLocaleString("id-ID", { maximumFractionDigits: 2 })} m²`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#64748b", font: { size: 10 } },
                    grid: { color: "#f1f5f9" }
                },
                y: {
                    ticks: { color: "#64748b", font: { size: 10 } },
                    grid: { display: false }
                }
            }
        }
    };

}


function getLegendTopPemilik() {
    const top = hitungTopPemilik();
    return top.map((t, i) => ({
        label: `${i + 1}. ${t.nama}`,
        count: t.luas,
        color: "#10b981",
        isLuas: true
    }));
}


/* =========================================================
   RENDER KPI CARDS
========================================================= */

function renderKpiCards() {

    const grid = document.getElementById("chartKpiGrid");
    if (!grid) return;

    const total = allFeatures.length;
    const totalLuas = allFeatures.reduce((s, f) => s + (getAreaM2(f) || 0), 0);

    const statKesesuaian = hitungStatistik(["Kesesuaian"]);
    const sesuai = (statKesesuaian["Sesuai Penuh"] || 0) + (statKesesuaian["Sesuai Sebagian Besar"] || 0);
    const tidakSesuai = (statKesesuaian["Tidak Sesuai"] || 0) + (statKesesuaian["Tidak Memiliki Hak"] || 0);

    const persenSesuai = total > 0 ? ((sesuai / total) * 100).toFixed(1) : 0;

    grid.innerHTML = `
        <div class="chart-kpi-card">
            <div class="chart-kpi-icon blue">
                <i class="fa-solid fa-draw-polygon"></i>
            </div>
            <div class="chart-kpi-content">
                <span>Total Bidang</span>
                <strong>${total.toLocaleString("id-ID")}</strong>
            </div>
        </div>

        <div class="chart-kpi-card">
            <div class="chart-kpi-icon green">
                <i class="fa-solid fa-ruler-combined"></i>
            </div>
            <div class="chart-kpi-content">
                <span>Total Luas</span>
                <strong>${totalLuas.toLocaleString("id-ID", { maximumFractionDigits: 0 })} m²</strong>
            </div>
        </div>

        <div class="chart-kpi-card">
            <div class="chart-kpi-icon orange">
                <i class="fa-solid fa-circle-check"></i>
            </div>
            <div class="chart-kpi-content">
                <span>Sesuai</span>
                <strong>${sesuai} (${persenSesuai}%)</strong>
            </div>
        </div>

        <div class="chart-kpi-card">
            <div class="chart-kpi-icon purple">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="chart-kpi-content">
                <span>Tidak Sesuai</span>
                <strong>${tidakSesuai}</strong>
            </div>
        </div>
    `;

}


/* =========================================================
   RENDER CHART SESUAI TAB
========================================================= */

function renderChart() {

    const canvas = document.getElementById("mainChart");
    if (!canvas) return;

    if (typeof Chart === "undefined") {
        console.error("Chart.js tidak ter-load!");
        notify("Grafik tidak dapat dimuat.");
        return;
    }

    if (mainChartInstance) {
        mainChartInstance.destroy();
    }

    let config = null;
    let legendData = null;

    switch (activeChartTab) {

        case "kesesuaian":
            config = getConfigKesesuaian();
            legendData = getLegendKesesuaian();
            break;

        case "jenis-hak":
            config = getConfigJenisHak();
            legendData = getLegendJenisHak();
            break;

        case "luas":
            config = getConfigLuas();
            legendData = getLegendLuas();
            break;

        case "overlap":
            config = getConfigOverlap();
            legendData = getLegendOverlap();
            break;

        case "persentase":
            config = getConfigPersentase();
            legendData = getLegendPersentase();
            break;

        case "top-pemilik":
            config = getConfigTopPemilik();
            legendData = getLegendTopPemilik();
            break;

    }

    if (config) {
        mainChartInstance = new Chart(canvas, config);
    }

    if (legendData) {
        renderLegend(legendData);
    }

    renderKpiCards();

}


/* =========================================================
   RENDER LEGEND
========================================================= */

function renderLegend(data) {

    const container = document.getElementById("chartLegend");
    if (!container) return;

    container.innerHTML = "";

    if (!data.length) {
        container.innerHTML = `<div style="text-align:center;color:#94a3b8;font-size:11px;padding:20px;">Tidak ada data</div>`;
        return;
    }

    const total = data.reduce((s, d) => s + d.count, 0);

    data.forEach(item => {

        const row = document.createElement("div");
        row.className = "legend-row";

        let valueHtml = "";

        if (item.isLuas) {
            valueHtml = `
                <span class="legend-count">${item.count.toLocaleString("id-ID", { maximumFractionDigits: 0 })}</span>
                <span class="legend-percent">m²</span>
            `;
        } else {
            const percent = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
            valueHtml = `
                <span class="legend-count">${item.count}</span>
                <span class="legend-percent">(${percent}%)</span>
            `;
        }

        row.innerHTML = `
            <div class="legend-left">
                <span class="legend-color" style="background:${item.color};"></span>
                <span class="legend-label">${escapeHTML(item.label)}</span>
            </div>
            <div class="legend-right">
                ${valueHtml}
            </div>
        `;

        container.appendChild(row);

    });

    const totalEl = document.getElementById("chartTotal");
    if (totalEl) {
        if (activeChartTab === "top-pemilik") {
            totalEl.innerHTML = `Total: <strong>${data.length}</strong> bidang terluas`;
        } else {
            totalEl.innerHTML = `Total: <strong>${total}</strong> bidang`;
        }
    }

}


/* =========================================================
   OPEN / CLOSE MODAL
========================================================= */

function openChartModal() {

    const modal = document.getElementById("chartModal");
    if (!modal) {
        console.error("Modal #chartModal tidak ditemukan!");
        return;
    }

    if (!allFeatures.length) {
        notify("Data belum dimuat. Tunggu beberapa saat.");
        return;
    }

    // Auto-close toast kalau sedang muncul
    const toast = document.getElementById("toast");
    if (toast) toast.classList.remove("show");

    modal.classList.add("show");
    document.body.style.overflow = "hidden";

    setTimeout(() => {
        renderChart();
    }, 100);

}


function closeChartModal() {

    const modal = document.getElementById("chartModal");
    if (!modal) return;

    modal.classList.remove("show");
    document.body.style.overflow = "";

}


/* =========================================================
   EXPORT CHART PNG
========================================================= */

function exportChartPNG() {

    if (!mainChartInstance) {
        notify("Chart belum siap.");
        return;
    }

    const canvas = document.getElementById("mainChart");
    const newCanvas = document.createElement("canvas");
    const ctx = newCanvas.getContext("2d");

    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement("a");
    link.download = `grafik-${activeChartTab}-${Date.now()}.png`;
    link.href = newCanvas.toDataURL("image/png");
    link.click();

    notify("Gambar grafik berhasil diunduh.");

}


/* =========================================================
   EXPORT CHART DATA KE CSV
========================================================= */

function exportChartCSV() {

    if (!mainChartInstance) {
        notify("Chart belum siap.");
        return;
    }

    const chart = mainChartInstance;
    const labels = chart.data.labels || [];
    const datasets = chart.data.datasets || [];

    let csv = "";

    if (datasets.length === 1) {
        csv = "Label,Nilai\n";
        labels.forEach((l, i) => {
            csv += `"${l}",${datasets[0].data[i]}\n`;
        });
    } else {
        const header = ["Label", ...datasets.map(d => d.label)];
        csv = header.join(",") + "\n";
        labels.forEach((l, i) => {
            const row = [`"${l}"`];
            datasets.forEach(d => row.push(d.data[i] || 0));
            csv += row.join(",") + "\n";
        });
    }

    downloadFile(
        "\uFEFF" + csv,
        `data-grafik-${activeChartTab}.csv`,
        "text/csv;charset=utf-8"
    );

    notify("Data grafik berhasil diekspor.");

}


/* =========================================================
   INIT CHART MODAL
========================================================= */

function initChartModal() {

    const openBtn = document.getElementById("openChartBtn");
    const sideBtn = document.getElementById("chartBtnSide");
    const closeBtn = document.getElementById("closeChartBtn");
    const overlay = document.getElementById("chartModalOverlay");
    const exportPngBtn = document.getElementById("exportChartBtn");
    const exportCsvBtn = document.getElementById("exportChartCsvBtn");

    if (openBtn) openBtn.addEventListener("click", openChartModal);
    if (sideBtn) sideBtn.addEventListener("click", openChartModal);
    if (closeBtn) closeBtn.addEventListener("click", closeChartModal);
    if (overlay) overlay.addEventListener("click", closeChartModal);
    if (exportPngBtn) exportPngBtn.addEventListener("click", exportChartPNG);
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportChartCSV);

    // Tab navigation
    document.querySelectorAll(".chart-tab").forEach(tab => {

        tab.addEventListener("click", function () {

            document.querySelectorAll(".chart-tab").forEach(t => t.classList.remove("active"));
            this.classList.add("active");

            activeChartTab = this.dataset.tab;
            renderChart();

        });

    });

    // ESC untuk tutup
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeChartModal();
    });

    console.log("✅ Dashboard multi-chart siap!");

}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChartModal);
} else {
    initChartModal();
}
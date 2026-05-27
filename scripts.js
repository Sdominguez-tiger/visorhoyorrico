// =============================
// Mapa inicial 
// =============================

var textoBusquedaCapas = '';

var map = L.map('map').setView([6.605, -75.426], 16); //coordenadas y zoom

// =============================
// Mapas bases
// =============================

var baseLayers = {
    imagery: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri' }
  
    ),
    osmDE: OpenStreetMap_DE = L.tileLayer(
    'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
    }
),
};

var capaActivaPorMenu = null;


// =============================
// CONTROL COMPARADOR SWIPE
// =============================

var swipeControl = null;

// capas seleccionadas
var capaIzquierda = null;
var capaDerecha = null;

// =============================
// ACTIVAR SWIPE
// =============================

// =============================
// ACTIVAR SWIPE — soporta ImageOverlay Y GeoJSON
// =============================
function activarSwipe(capaLeft, capaRight) {
    desactivarSwipe();

    if (!capaLeft || !capaRight) {
        alert('Debes seleccionar dos capas.');
        return;
    }

    // PASO 1: Agregar capas al mapa si no están
    if (!map.hasLayer(capaLeft))  capaLeft.addTo(map);
    if (!map.hasLayer(capaRight)) capaRight.addTo(map);

    var mapContainer = map.getContainer();
    var currentX     = mapContainer.offsetWidth / 2;

    // =============================
    // PASO 2: Detectar tipo de cada capa
    // ImageOverlay → tiene getElement()
    // GeoJSON      → vive en un pane del mapa
    // =============================
    var esImagenIzq = (typeof capaLeft.getElement  === 'function');
    var esImagenDer = (typeof capaRight.getElement === 'function');

    // PASO 3: Para capas GeoJSON, moverlas a panes dedicados
    // así podemos recortar el pane completo con clip
    var paneIzq = null;
    var paneDer = null;

    if (!esImagenIzq) {
        // Crear pane izquierdo si no existe
        if (!map.getPane('swipePaneLeft')) {
            map.createPane('swipePaneLeft');
        }
        paneIzq = map.getPane('swipePaneLeft');
        paneIzq.style.zIndex = 450;
        paneIzq.style.pointerEvents = 'none';

        // Reasignar la capa al pane izquierdo
        map.removeLayer(capaLeft);
        capaLeft.options.pane = 'swipePaneLeft';
        capaLeft.addTo(map);
    }

    if (!esImagenDer) {
        // Crear pane derecho si no existe
        if (!map.getPane('swipePaneRight')) {
            map.createPane('swipePaneRight');
        }
        paneDer = map.getPane('swipePaneRight');
        paneDer.style.zIndex = 451;
        paneDer.style.pointerEvents = 'none';

        // Reasignar la capa al pane derecho
        map.removeLayer(capaRight);
        capaRight.options.pane = 'swipePaneRight';
        capaRight.addTo(map);
    }

    // =============================
    // PASO 4: Crear el divisor visual
    // =============================
  var divider = document.createElement('div');
    divider.id  = 'swipeDivider';
    divider.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        left: ${currentX}px;
        width: 4px;
        background: linear-gradient(to bottom, #9172b4, #2e1f33);
        cursor: ew-resize;
        z-index: 1000;
        box-shadow: 0 0 8px rgba(0,0,0,0.5);
        pointer-events: none;
    `;

    var handle = document.createElement('div');
    handle.id = 'swipeHandle';
    handle.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 36px;
        height: 36px;
        background: white;
        border-radius: 50%;
        border: 2px solid #9172b4;
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        color: #2e1f33;
        pointer-events: all;
        cursor: ew-resize;
        user-select: none;
        transition: box-shadow 0.15s, transform 0.15s;
    `;
    handle.innerHTML = '◀▶';
    divider.appendChild(handle);
    mapContainer.appendChild(divider);

    // =============================
    // PASO 5: Función que aplica el recorte según tipo de capa
    // =============================
    function updateClip(x) {

        var mapRect = mapContainer.getBoundingClientRect();

        // --- Capa DERECHA: mostrar solo la parte derecha (x en adelante) ---
        if (esImagenDer) {
            // ImageOverlay: recortar el elemento <img>
            var elDer = capaRight.getElement();
            if (elDer) {
                var imgRect  = elDer.getBoundingClientRect();
                var clipLeft = x - (imgRect.left - mapRect.left);
                clipLeft = Math.max(0, Math.min(clipLeft, imgRect.width));
                elDer.style.clip = `rect(0px, ${imgRect.width}px, ${imgRect.height}px, ${clipLeft}px)`;
            }
        } else {
            // GeoJSON: recortar el pane entero
            if (paneDer) {
                var mapW = mapRect.width;
                paneDer.style.clip = `rect(0px, ${mapW}px, ${mapRect.height}px, ${x}px)`;
            }
        }

        // --- Capa IZQUIERDA: mostrar solo la parte izquierda (hasta x) ---
        if (esImagenIzq) {
            var elIzq = capaLeft.getElement();
            if (elIzq) {
                var imgRectI  = elIzq.getBoundingClientRect();
                var clipRight = x - (imgRectI.left - mapRect.left);
                clipRight = Math.max(0, Math.min(clipRight, imgRectI.width));
                elIzq.style.clip = `rect(0px, ${clipRight}px, ${imgRectI.height}px, 0px)`;
            }
        } else {
            if (paneIzq) {
                paneDer.style.clip = `rect(0px, ${mapRect.width}px, ${mapRect.height}px, ${x}px)`;
                paneIzq.style.clip = `rect(0px, ${x}px, ${mapRect.height}px, 0px)`;
            }
        }
    }

    updateClip(currentX);

    // PASO 6: Redibujar clip cuando el mapa se mueve
    function onMapMove() { updateClip(currentX); }
    map.on('move zoom moveend zoomend', onMapMove);

    // =============================
    // PASO 7: Drag del divisor
    // =============================
    var dragging = false;

    // Solo el handle activa el drag — no toda la línea ni el mapa
    handle.addEventListener('mousedown', function(e) {
        dragging = true;
        map.dragging.disable();
        map.scrollWheelZoom.disable();
        handle.style.boxShadow = '0 2px 16px rgba(145,114,180,0.7)';
        handle.style.transform = 'translate(-50%, -50%) scale(1.12)';
        e.preventDefault();
        e.stopPropagation();
    });

   window.addEventListener('mouseup', function() {
        if (!dragging) return;
        dragging = false;
        map.dragging.enable();
        map.scrollWheelZoom.enable();
        handle.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
        handle.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    window.addEventListener('mousemove', function(e) {
        if (!dragging) return;

        var mapRect = mapContainer.getBoundingClientRect();
        var x = e.clientX - mapRect.left;
        x = Math.max(0, Math.min(x, mapRect.width));

        currentX = x;
        divider.style.left = x + 'px';
        updateClip(x);
    });

    // =============================
    // PASO 8: Guardar todo para poder deshacer
    // =============================
    swipeControl = {
        divider:    divider,
        leftLayer:  capaLeft,
        rightLayer: capaRight,
        paneIzq:    paneIzq,
        paneDer:    paneDer,
        esImagenIzq: esImagenIzq,
        esImagenDer: esImagenDer,
        onMapMove:  onMapMove
    };
}

// =============================
// TOGGLE PANEL SWIPE (BOTÓN)
// =============================
function togglePanelSwipe() {

    var panel = document.getElementById('panelSwipe');

    if (!panel) return;

    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';

        // PASO EXTRA: apagar swipe activo sin dañar nada
        desactivarSwipe();
    }
}


// =============================
// DESACTIVAR SWIPE
// =============================
// =============================
// DESACTIVAR SWIPE — limpia imágenes Y panes GeoJSON
// =============================
function desactivarSwipe() {
    if (!swipeControl) return;

    // PASO 1: Quitar el divisor visual
    if (swipeControl.divider && swipeControl.divider.parentNode) {
        swipeControl.divider.parentNode.removeChild(swipeControl.divider);
    }

    // PASO 2: Restaurar clip de ImageOverlay izquierda
    if (swipeControl.esImagenIzq && swipeControl.leftLayer) {
        var elIzq = swipeControl.leftLayer.getElement
            ? swipeControl.leftLayer.getElement() : null;
        if (elIzq) { elIzq.style.clip = ''; elIzq.style.clipPath = ''; }
    }

    // PASO 3: Restaurar clip de ImageOverlay derecha
    if (swipeControl.esImagenDer && swipeControl.rightLayer) {
        var elDer = swipeControl.rightLayer.getElement
            ? swipeControl.rightLayer.getElement() : null;
        if (elDer) { elDer.style.clip = ''; elDer.style.clipPath = ''; }
    }

    // PASO 4: Limpiar clip de panes GeoJSON
    if (swipeControl.paneIzq) {
        swipeControl.paneIzq.style.clip = '';
        // Devolver la capa al pane por defecto
        if (swipeControl.leftLayer && map.hasLayer(swipeControl.leftLayer)) {
            map.removeLayer(swipeControl.leftLayer);
            swipeControl.leftLayer.options.pane = 'overlayPane';
            swipeControl.leftLayer.addTo(map);
        }
    }
    if (swipeControl.paneDer) {
        swipeControl.paneDer.style.clip = '';
        if (swipeControl.rightLayer && map.hasLayer(swipeControl.rightLayer)) {
            map.removeLayer(swipeControl.rightLayer);
            swipeControl.rightLayer.options.pane = 'overlayPane';
            swipeControl.rightLayer.addTo(map);
        }
    }

    // PASO 5: Quitar capas del mapa (solo si NO son GeoJSON con pane)
    if (!swipeControl.paneIzq && swipeControl.leftLayer && map.hasLayer(swipeControl.leftLayer)) {
        map.removeLayer(swipeControl.leftLayer);
    }
    if (!swipeControl.paneDer && swipeControl.rightLayer && map.hasLayer(swipeControl.rightLayer)) {
        map.removeLayer(swipeControl.rightLayer);
    }

    // PASO 6: Quitar eventos del mapa
    if (swipeControl.onMapMove) {
        map.off('move zoom moveend zoomend', swipeControl.onMapMove);
    }

    // PASO 7: Limpiar variable global
    swipeControl = null;
}

// Capa base inicial
baseLayers.imagery.addTo(map);

// =============================
// Configuración de mapas en formato GeoJSON
// Agrega nuevas capas de ArcGIS aquí
// =============================

var capasConfig = [
    { key: 'Centro poblado', nombre: 'Centro poblado', url: 'data/C_P_Hoyorrico.geojson' },
    { key: 'Veredas corregimiento', nombre: 'Veredas corregimiento', url: 'data/Veredas_C_Hoyorrico.json' },
    { key: 'Terrenos Hoyorrico', nombre: 'Terrenos Hoyorrico', url: 'data/u_clc_terreno.json' },
    { key: 'Vias centro poblado', nombre: 'Vias centro poblado', url: 'data/Vias_C_P.json' },
    { key: 'Construcciones Hoyorrico', nombre: 'Construcciones Hoyorrico', url: 'data/u_clc_Construcciones.json'},
    { key: 'Parcelacion centro poblado', nombre: 'Parcelaciones centro poblado', url: 'data/Parcelacion_C_PHoyorrico.json' },
    
    // ===== AÑO 2010 =====
    { key: 'Construcciones 2010', nombre: 'Contrucciones nuevas año 2010', url: 'data/Identificacion_construcciones_2010.json', grupo: 'Cartografía Año 2010' },
    { key: 'NDBI 2010', nombre: 'NDBI 2010', url: 'data/NDBI_2010.json', grupo: 'Cartografía Año 2010' },
    
    // ===== AÑO 2018 =====
    { key: 'Construcciones 2018', nombre: 'Contrucciones nuevas año 2018', url: 'data/Identificacion_construcciones_2018.json', grupo: 'Cartografía Año 2018' },
    { key: 'Suelo Expansión 2018', nombre: 'Suelo expansión 2018', url:'data/Suelo_Expansion_2018.json', grupo: 'Cartografía Año 2018' },
    { key: 'NDBI 2018', nombre: 'NDBI 2018', url: 'data/NDBI_2018.json', grupo: 'Cartografía Año 2018' },
   
    // ===== AÑO 2025 =====
    { key: 'Construcciones 2025', nombre: 'Contrucciones nuevas año 2025', url: 'data/Identificacion_construcciones_2025.json', grupo: 'Cartografía Año 2025' },
    { key: 'Cobertura', nombre: 'Area de estudio', url: 'data/Cobertura_330m.json', grupo: 'Cartografía Año 2025' },
    { key: 'Suelo Expansión 2025', nombre: 'Suelo expansión 2025', url: 'data/Suelo_Expansion_2025.json', grupo: 'Cartografía Año 2025' },
    { key: 'NDBI 2025', nombre: 'NDBI 2025', url: 'data/NDBI_2025.json', grupo: 'Cartografía Año 2025' },
    
    
];

// =============================
// FOTO GEOREFERENCIADA
// =============================

var foto2010 = L.imageOverlay(
    'data/imagenes/Hoyorrico_2010.png',
    [
        [6.597718, -75.437810], //  CAMBIAR por tus valores
        [6.611834, -75.416758]  //  CAMBIAR por tus valores
    ]
);

var foto2018 = L.imageOverlay(
    'data/imagenes/Hoyorrico_2018.png',
    [
        [6.597718, -75.437810], //  CAMBIAR por tus valores
        [6.611834, -75.416758]  //  CAMBIAR por tus valores
    ]
);

var foto2025 = L.imageOverlay(
    'data/imagenes/Hoyorrico_2025.png',
    [
        [6.597718, -75.437810], //  CAMBIAR por tus valores
        [6.611834, -75.416758]  //  CAMBIAR por tus valores
    ]
);

var swipeControl = null;

// Almacenes generales de las capas
var capasGeoJSON = {};  // guarda los datos GeoJSON
var capasLeaflet = {};  // guarda las capas Leaflet

// Grupo padre para capas geográficas
var grupoCapasGeograficas = L.layerGroup().addTo(map);

// =============================
// Popups atributos de las capas
// =============================

function popupDesdeAtributos(feature) {
    if (!feature.properties) return 'Sin atributos';

    var html = '';
    for (var campo in feature.properties) {
        html += '<b>' + campo + ':</b> ' + feature.properties[campo] + '<br>';
    }
    return html || 'Sin atributos';


    // Obtener capas activas en el mapa
    var capasActivas = [];

    map.eachLayer(function (layer) {
        if (
            layer instanceof L.ImageOverlay ||
            layer instanceof L.GeoJSON
        ) {
            capasActivas.push(layer);
        }
    });

    // Validación: mínimo 2 capas
    if (capasActivas.length < 2) {
        alert('Debes tener al menos dos capas activas para comparar.');
        return;
    }

    // Si ya hay swipe, eliminarlo
    if (swipeControl) {
        map.removeControl(swipeControl);
        swipeControl = null;
    }

    // Usar SOLO las dos primeras capas activas
    var capaSuperior = capasActivas[0];
    var capaInferior = capasActivas[1];

    // Crear swipe
    swipeControl = L.control
        .sideBySide(capaSuperior, capaInferior)
        .addTo(map);
}


// =============================
// Configuración de estilo por capas
// =============================

function obtenerEstiloPorCapa(key) {
    const estilos = {
        'Centro poblado': {
            color: '#ffc400',
            weight: 2,
            fillOpacity: 0.0
        },
        'Veredas corregimiento': {
            color: '#bbff00',
            weight: 0.5,
            fillOpacity: 0.0
        },
        'Construcciones Hoyorrico': {
            color: '#ff0000',
            weight: .8,
            fillColor: '#ffffff',
            fillOpacity: 0.6
        },
        'Parcelacion centro poblado': {
            color: '#5f5f5f',
            weight: 1,
            fillOpacity: 0.0
        },
    
        'Suelo Expansión 2025': {
            color: '#9172b4',
            weight: 1,
            fillOpacity: 0.6
        },

        'Suelo Expansión 2018': {
            color: '#b47272',
            weight: 1,
            fillOpacity: 0.6
        },

        'Terrenos Hoyorrico': {
            color: '#e58f1e',
            weight: .5,
            fillOpacity: 0.0
        },

         'Vias centro poblado': {
            color: '#c300ff',
            weight: 2,
            fillOpacity: 0.0
        },

        'Cobertura': {
            color: '#a4a1a1',
            fillColor: '#bbbb31',
            weight: 1,
            fillOpacity: 0.3,
            dashArray: '7' //Linea punteada
        },

        
        'Construcciones 2010': {
            color: '#0055ff',
            fillColor: '#0055ff' 
        },

        'Construcciones 2018': {
            color: '#9900ff',
            fillColor: '#9900ff'
        },


        'Construcciones 2025': {
          color: '#ff6f00',
          fillColor: '#ff6f00'
        },

         // ===== NDBI — estilos base (se sobreescriben por gridcode) =====
        'NDBI 2010': { color: '#888', weight: 0.5, fillOpacity: 0.8 },
        'NDBI 2018': { color: '#888', weight: 0.5, fillOpacity: 0.8 },
        'NDBI 2025': { color: '#888', weight: 0.5, fillOpacity: 0.8 }

    };

    return estilos[key] || {
        color: '#333',
        weight: 1,
        fillOpacity: 0.2
    };
}

// =============================
// CARGAR CAPAS (CON PUNTOS ROJOS)
// =============================

function cargarCapa(config) {
    fetch(config.url)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            capasGeoJSON[config.key] = data;
            var layer;

            // =============================
            // MODIFICACIÓN: CAPA PUNTOS ROJOS
            // =============================

            if (config.key === 'Construcciones 2010') {
                layer = L.geoJSON(data, {
                    // Si el GeoJSON trae polígonos, calculamos el centro para poner el punto
                    coordsToLatLng: function(coords) {
                        if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                            var lat = 0, lng = 0, cont = 0;
                            coords[0].forEach(function(c) {
                                lng += c[0];
                                lat += c[1];
                                cont++;
                            });
                            return L.latLng(lat / cont, lng / cont);
                        }
                        return L.latLng(coords[1], coords[0]);
                    },
                    // Definimos el estilo de punto rojo
                    pointToLayer: function(feature, latlng) {
                        return L.circleMarker(latlng, {
                            radius: 4,
                            fillColor: '#0055ff', // Rojo
                            color: '#FFFFFF',     // Borde blanco para contraste
                            weight: 1.5,
                            opacity: 1,
                            fillOpacity: 1
                        });
                    },
                    onEachFeature: function(feature, layer) {
                        layer.bindPopup(popupDesdeAtributos(feature));
                    }
                });
            } else {


            if (config.key === 'Construcciones 2018') {
                layer = L.geoJSON(data, {
                    // Si el GeoJSON trae polígonos, calculamos el centro para poner el punto
                    coordsToLatLng: function(coords) {
                        if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                            var lat = 0, lng = 0, cont = 0;
                            coords[0].forEach(function(c) {
                                lng += c[0];
                                lat += c[1];
                                cont++;
                            });
                            return L.latLng(lat / cont, lng / cont);
                        }
                        return L.latLng(coords[1], coords[0]);
                    },
                    // Definimos el estilo de punto rojo
                    pointToLayer: function(feature, latlng) {
                        return L.circleMarker(latlng, {
                            radius: 4,
                            fillColor: '#9900ff', // Morado
                            color: '#FFFFFF',     // Borde blanco para contraste
                            weight: 1.5,
                            opacity: 1,
                            fillOpacity: 1
                        });
                    },
                    onEachFeature: function(feature, layer) {
                        layer.bindPopup(popupDesdeAtributos(feature));
                    }
                });
            } else 

            if (config.key === 'Construcciones 2025') {
                layer = L.geoJSON(data, {
                    // Si el GeoJSON trae polígonos, calculamos el centro para poner el punto
                    coordsToLatLng: function(coords) {
                        if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                            var lat = 0, lng = 0, cont = 0;
                            coords[0].forEach(function(c) {
                                lng += c[0];
                                lat += c[1];
                                cont++;
                            });
                            return L.latLng(lat / cont, lng / cont);
                        }
                        return L.latLng(coords[1], coords[0]);
                    },
                    // Definimos el estilo de punto rojo
                    pointToLayer: function(feature, latlng) {
                        return L.circleMarker(latlng, {
                            radius: 4,
                            fillColor: '#ff6f00', // Rojo
                            color: '#FFFFFF',     // Borde blanco para contraste
                            weight: 1.5,
                            opacity: 1,
                            fillOpacity: 1
                        });
                    },
                    onEachFeature: function(feature, layer) {
                        layer.bindPopup(popupDesdeAtributos(feature));
                    }
                });
            } else if (
                config.key === 'NDBI 2010' ||
                config.key === 'NDBI 2018' ||
                config.key === 'NDBI 2025'
            ) {
                // =============================
                // CAPAS NDBI — simbología por gridcode
                // igual que ArcGIS Pro
                // =============================
                layer = L.geoJSON(data, {
                    style: function(feature) {
                        // PASO A: usar función de color por categoría
                        return estiloNDBI(feature);
                    },
                    onEachFeature: function(feature, layer) {
                        // PASO B: popup con categoría legible
                        var gc = feature.properties
                            ? parseInt(feature.properties.gridcode)
                            : 0;
                        var info = coloresNDBI[gc]
                            ? coloresNDBI[gc].label
                            : 'Sin categoría';

                        var html = '<b>Categoría NDBI:</b> ' + info + '<br>';

                        // Agregar otros atributos limpios
                        for (var campo in feature.properties) {
                            if (campo === 'gridcode') continue;
                            var valor = feature.properties[campo];
                            if (valor === null || valor === undefined || valor === '' || valor === 0) continue;
                            if (typeof valor === 'number') valor = redondear(valor);
                            html += '<b>' + campo + ':</b> ' + valor + '<br>';
                        }

                        layer.bindPopup(html);
                    }
                });

            } else {
                // =============================
                // Capas normales — color por key
                // =============================
                layer = L.geoJSON(data, {
                    style: function(feature) {
                        return obtenerEstiloPorCapa(config.key);
                    },
                    onEachFeature: function(feature, layer) {
                        layer.bindPopup(popupDesdeAtributos(feature));
                    }
                });
            }


            }
                 
                // =============================
                // Control de capas
                // =============================

            capasLeaflet[config.key] = layer;
            // grupoCapasGeograficas.addLayer(layer);
            actualizarTreeControl();
        })
        .catch(function(error) {
            console.error('Error al cargar ' + config.url + ':', error);
        });
}


// =============================
// SELECTOR DE CAPAS PARA TABLA / DASHBOARD
// =============================

function poblarSelectorCapas() {
    var selector = document.getElementById('selectorCapa');
    selector.innerHTML = '';

    capasConfig.forEach(function(capa) {
        var option = document.createElement('option');
        option.value = capa.key;
        option.textContent = capa.nombre;
        selector.appendChild(option);
    });
}

function obtenerCapaSeleccionada() {
    var key = document.getElementById('selectorCapa').value;
    var config = capasConfig.find(function(c) { return c.key === key; });

    if (!config || !capasGeoJSON[key]) return null;

    return {
        key: key,
        data: capasGeoJSON[key],
        titulo: config.nombre
    };
}

// =============================
// CONTROL DE CAPAS AGRUPADO
// Requiere Leaflet.Control.Layers.Tree
// =============================
var treeControl = null;

function actualizarTreeControl() {
   if (treeControl) {
        treeControl.remove();
    } 

    var baseTree = {
        label: '<b>Tipo de Mapa Base</b>', // Titulo de mapas bases
        selectAllCheckbox: false,
        collapsed: true,
      children: [
    {
        label: `<div class="miniatura-mapa">
                    <img src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1973/1190">
                    <span>Satelital</span>
                </div>`,
        layer: baseLayers.imagery
    },
    {
        label: `<div class="miniatura-mapa">
                    <img src="https://tile.openstreetmap.de/12/1190/1973.png">
                    <span>Mapa de Calles</span>
                </div>`,
        layer: baseLayers.osmDE
    }
]

    };

    // =============================
    // Organizar capas por año
    // =============================


var grupos = {};

// =============================
// unir contenedores temáticos
// =============================

var contenedores = {
    'Cartografía base': [],
    'Cartografía Año 2010': [],
    'Cartografía Año 2018': [],
    'Cartografía Año 2025': [],
};


capasConfig.forEach(function(capa) {

    var contenedor;

    if (!capa.grupo) {
        contenedor = 'Cartografía base';
    } else {
        contenedor = capa.grupo;
    }

    if (!contenedores[contenedor]) {
        contenedores[contenedor] = [];
    }

    if (capasLeaflet[capa.key]) {
        contenedores[contenedor].push({
            label: `
  <span>
    <div class="fila-capa">
      <span class="nombre-capa">
        ${obtenerSimboloHTML(capa.key)} ${capa.nombre}
      </span>
      <span class="menu-capa" data-key="${capa.key}">⋮</span>
    </div>
  </span>
`,
            layer: capasLeaflet[capa.key]
        });
    }
});




var overlaysTree = {
    label: '<b>Capas geográficas</b>',
    selectAllCheckbox: false,
    collapsed: true, // el título principal queda visible
    children: Object.keys(contenedores)
        .filter(function(nombre) {
            return contenedores[nombre].length > 0;
        })
        .map(function (nombre) {

    let capasDelGrupo = contenedores[nombre];

    // Si hay texto de búsqueda, filtrar
    if (textoBusquedaCapas) {
        capasDelGrupo = contenedores[nombre].filter(function (item) {
            return item.label.toLowerCase().includes(textoBusquedaCapas);
        });
    }

    return {
        label: `
            <div class="layer-group-header">
                ${nombre}
            </div>
        `,
        selectAllCheckbox: true,

        // 🔑 AQUÍ DECIDIMOS SI SE ABRE O NO
        collapsed: textoBusquedaCapas ? capasDelGrupo.length === 0 : true,

        children: capasDelGrupo
    };
})
};



var fotosTree = {
    label: '<b>Fotografías georreferenciadas</b>',
    selectAllCheckbox: false,
    collapsed: true,
    children: [
        {
            label: 'Hoyorrico 2010',
            layer: foto2010
        },
        {
            label: 'Hoyorrico 2018',
            layer: foto2018
        },
        {
            label: 'Hoyorrico 2025',
            layer: foto2025
        }
    ]
};




treeControl = L.control.layers.tree(baseTree, [ overlaysTree, fotosTree ], {
    collapsed: false,
    position: 'topright'
}).addTo(map);


setTimeout(function () {

    const input = document.getElementById('inputBusquedaCapas');
    if (!input) return;

   
}, 600);


function abrirNodoPorTexto(texto) {
    document.querySelectorAll('.leaflet-layerstree-node-label').forEach(function (label) {
        if (label.innerText.trim().toLowerCase() === texto.toLowerCase()) {
            const toggle = label.parentElement.querySelector('.leaflet-layerstree-toggle');
            if (toggle && toggle.innerHTML === '+') {
                toggle.click();
            }
        }
    });
}

// =============================
// MOVER CONTROL AL PANEL + BUSCADOR FIJO ENCIMA
// =============================
setTimeout(function () {

    var control = document.querySelector('.leaflet-control-layers');
    var panel   = document.getElementById('panelInferior');

    if (!control || !panel) return;

    // PASO 1: Crear el buscador fijo si no existe aún
    if (!document.getElementById('buscadorFijo')) {

        var buscadorDiv = document.createElement('div');
        buscadorDiv.id  = 'buscadorFijo';
        buscadorDiv.innerHTML = `
            <span class="icono-busqueda">🔍</span>
            <input
                type="text"
                id="inputBusquedaCapas"
                placeholder="Buscar capa..."
                autocomplete="off"
            >
            <div id="listaSugerencias"></div>
        `;

        // PASO 2: Insertar el buscador PRIMERO en el panel
        panel.prepend(buscadorDiv);
    }

    // PASO 3: Meter el árbol de capas DEBAJO del buscador
    panel.appendChild(control);
    setTimeout(function() {
    document.querySelectorAll('.layer-group-header').forEach(function(div) {
        var parent = div.parentElement;
        while (parent && parent !== document.getElementById('panelInferior')) {
            parent.style.width = '100%';
            parent.style.boxSizing = 'border-box';
            parent.style.padding = '0';
            parent.style.margin = '0';
            parent = parent.parentElement;
        }
    });
}, 900);
    

    control.style.position = 'relative';
    control.style.top      = '0';
    control.style.left     = '0';
    control.style.width    = '100%';

    // PASO 4: Inicializar los eventos del buscador
    // (solo una vez, aunque actualizarTreeControl se llame varias veces)
    if (!window._buscadorInicializado) {
        window._buscadorInicializado = true;
        inicializarBuscador();
    }

}, 500);

}

// =============================
// Tabla de atributos
// =============================

function esValorOcultoTabla(valor) {
    if (valor === null || valor === undefined) return true;

    if (typeof valor === 'number') {
        return valor === 0;
    }

    if (typeof valor === 'string') {
        var limpio = valor.trim();

        if (limpio === '') return true;
        if (limpio === '0' || limpio === '0.0' || limpio === '0,0') return true;

        // Si el string representa número, revisar si es cero
        var numero = Number(limpio.replace(',', '.'));
        if (!isNaN(numero) && numero === 0) return true;
    }

    return false;
}

function mostrarTablaAtributos(geojson, titulo) {
    var contenedor = document.getElementById('tablaContenido');

    if (!geojson || !geojson.features || geojson.features.length === 0) {
        contenedor.innerHTML = '<p>No hay datos para mostrar.</p>';
        return;
    }

    if (!geojson.features[0].properties) {
        contenedor.innerHTML = '<p>No hay atributos disponibles.</p>';
        return;
    }

    var camposOriginales = Object.keys(geojson.features[0].properties);

    // ✅ PASO A: dejar solo los campos que tengan al menos un valor útil
    var campos = camposOriginales.filter(function(campo) {
    return geojson.features.some(function(feature) {
        if (!feature.properties) return false;

        var valor = feature.properties[campo];
        return !esValorOcultoTabla(valor);
    });
});

    // ✅ Si no queda ningún campo útil
    if (campos.length === 0) {
        contenedor.innerHTML = '<p>No hay atributos relevantes para mostrar.</p>';
        return;
    }

    var html = '<h3>Tabla de atributos - ' + titulo + '</h3>';
    html += '<table><thead><tr>';

    campos.forEach(function(campo) {
        html += '<th>' + campo + '</th>';
    });

    html += '</tr></thead><tbody>';

    geojson.features.forEach(function(feature) {
        html += '<tr>';

        campos.forEach(function(campo) {
            var valor = '';

            if (
    feature.properties &&
    !esValorOcultoTabla(feature.properties[campo])
) {
    valor = feature.properties[campo];
}

            html += '<td>' + valor + '</td>';
        });

        html += '</tr>';
    });

    html += '</tbody></table>';
    contenedor.innerHTML = html;
}

// =============================
// Muestra Dashboard
// =============================

function mostrarDashboard(geojson, titulo) {
    var contenedor = document.getElementById('dashboardContenido');

    if (!geojson || !geojson.features || geojson.features.length === 0) {
        contenedor.innerHTML = '<p>No hay datos para resumir.</p>';
        return;
    }

    var features = geojson.features || [];
    var totalRegistros = features.length;
    var totalCampos = 0;
    var camposUtiles = 0;
    var registrosConGeom = 0;
    var registrosSinGeom = 0;
    var tipoDominante = 'Sin geometría';
    var tiposGeom = {};
    var totalValoresUtiles = 0;
    var totalCeldas = 0;

    var campos = [];

    if (features[0] && features[0].properties) {
        campos = Object.keys(features[0].properties);
        totalCampos = campos.length;
    }

    // Contar campos útiles y completitud
    if (campos.length > 0) {
        camposUtiles = campos.filter(function(campo) {
            return features.some(function(feature) {
                if (!feature.properties) return false;

                if (typeof esValorOcultoTabla === 'function') {
                    return !esValorOcultoTabla(feature.properties[campo]);
                }

                var valor = feature.properties[campo];
                return valor !== null && valor !== undefined && valor !== '' && valor !== 0 && valor !== '0';
            });
        }).length;

        features.forEach(function(feature) {
            campos.forEach(function(campo) {
                totalCeldas++;

                var valor = feature.properties ? feature.properties[campo] : null;

                if (typeof esValorOcultoTabla === 'function') {
                    if (!esValorOcultoTabla(valor)) {
                        totalValoresUtiles++;
                    }
                } else {
                    if (valor !== null && valor !== undefined && valor !== '' && valor !== 0 && valor !== '0') {
                        totalValoresUtiles++;
                    }
                }
            });
        });
    }

    // Geometrías
    features.forEach(function(feature) {
        if (feature.geometry && feature.geometry.type) {
            registrosConGeom++;
            var tipo = feature.geometry.type;
            tiposGeom[tipo] = (tiposGeom[tipo] || 0) + 1;
        } else {
            registrosSinGeom++;
        }
    });

    var maxTipo = 0;
    Object.keys(tiposGeom).forEach(function(tipo) {
        if (tiposGeom[tipo] > maxTipo) {
            maxTipo = tiposGeom[tipo];
            tipoDominante = tipo;
        }
    });

    var traducciones = {
        'Point': 'Puntos',
        'MultiPoint': 'Multipuntos',
        'LineString': 'Líneas',
        'MultiLineString': 'Multilíneas',
        'Polygon': 'Polígonos',
        'MultiPolygon': 'Multipolígonos'
    };

    tipoDominante = traducciones[tipoDominante] || tipoDominante;

    var porcentajeCompletitud = totalCeldas > 0
        ? Math.round((totalValoresUtiles / totalCeldas) * 100)
        : 0;

    // Mensaje destacado
    var mensajeResumen = '';
    if (porcentajeCompletitud >= 80) {
        mensajeResumen = 'La capa presenta una estructura de atributos sólida, con buen nivel de completitud y consistencia general.';
    } else if (porcentajeCompletitud >= 50) {
        mensajeResumen = 'La capa cuenta con una base de atributos útil, aunque todavía hay campos con bajo nivel de contenido.';
    } else {
        mensajeResumen = 'La capa tiene información básica disponible, pero la completitud de atributos es limitada y podría mejorarse.';
    }

    var html = '';

    html += '<h3 class="dashboard-general-titulo">Dashboard general - ' + titulo + '</h3>';

    html += '<div class="dashboard-tabla-wrap">';
    html += '  <table class="dashboard-tabla-general">';
    html += '      <thead>';
    html += '          <tr>';
    html += '              <th>Métrica</th>';
    html += '              <th>Valor</th>';
    html += '          </tr>';
    html += '      </thead>';
    html += '      <tbody>';
    html += '          <tr><td>Total de registros</td><td>' + totalRegistros + '</td></tr>';
    html += '          <tr><td>Total de campos</td><td>' + totalCampos + '</td></tr>';
    html += '          <tr><td>Campos útiles</td><td>' + camposUtiles + '</td></tr>';
    html += '          <tr><td>Registros con geometría válida</td><td>' + registrosConGeom + '</td></tr>';
    html += '          <tr><td>Registros sin geometría</td><td>' + registrosSinGeom + '</td></tr>';
    html += '          <tr><td>Tipo de geometría dominante</td><td>' + tipoDominante + '</td></tr>';
    html += '      </tbody>';
    html += '  </table>';
    html += '</div>';

    html += '<div class="dashboard-reporte-general">';
    html += '  <h4>📊 Lectura general de la capa</h4>';
    html += '  <div class="dashboard-indicador-resumen">✔ ' + mensajeResumen + '</div>';
    html += '  <p><b>Total de registros:</b> cantidad de elementos geográficos contenidos en la capa.</p>';
    html += '  <p><b>Total de campos:</b> número total de atributos definidos en la estructura original de la capa.</p>';
    html += '  <p><b>Campos útiles:</b> atributos que realmente contienen información y no están vacíos ni en cero.</p>';
    html += '  <p><b>Registros con geometría válida:</b> elementos que cuentan con ubicación o forma espacial utilizable en el mapa.</p>';
    html += '  <p><b>Registros sin geometría:</b> elementos que existen en la tabla, pero no tienen representación espacial asociada.</p>';
    html += '  <p><b>Tipo de geometría dominante:</b> clase espacial que más se repite en la capa, como puntos, líneas o polígonos.</p>';
    html += '</div>';

    contenedor.innerHTML = html;
}
// =============================
// Abre el panel grande
// =============================

function expandirPanel(idPanel) {
    var panel = document.getElementById(idPanel);
    var contenedor = document.getElementById('panelInferior');
    var panelConsulta = document.getElementById('panelConsulta');

    var left = panelConsulta.offsetLeft + panelConsulta.offsetWidth + 20;
    var top = 10;
    var width = contenedor.clientWidth - left - 10;
    var height = contenedor.clientHeight - 20;

    if (width < 250) width = 250;
    if (height < 140) height = 140;

    panel.style.left = '0';
    panel.style.top = '10px';
    panel.style.width = '100%';
    panel.style.height = 'auto';
}

// =============================
// Abre y cierra los paneles con botonoes
// =============================

function toggleDashboard() {
    var panel = document.getElementById('dashboard');
    var capa = capaActivaPorMenu || obtenerCapaSeleccionada();

    
    if (panel.style.display === 'none' || panel.style.display === '') {
        //expandirPanel('dashboard');

        if (capa && capa.data) {
            activarCapaYZoomDesdeTabla(capa);
            mostrarDashboard(capa.data, capa.titulo);
        } else {
            document.getElementById('dashboardContenido').innerHTML = '<p>No hay datos cargados para esa capa.</p>';
        }

        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
}

function activarScrollRuedaTabla() {
    var panelTabla = document.getElementById('tablaAtributos');
    var contenidoTabla = document.getElementById('tablaContenido');

    if (!panelTabla || !contenidoTabla) return;

    // Evitar que Leaflet robe el scroll de la tabla
    if (typeof L !== 'undefined' && L.DomEvent) {
        L.DomEvent.disableClickPropagation(panelTabla);
        L.DomEvent.disableScrollPropagation(panelTabla);

        L.DomEvent.disableClickPropagation(contenidoTabla);
        L.DomEvent.disableScrollPropagation(contenidoTabla);
    }

    // Refuerzo adicional: detener propagación de la rueda
    if (!contenidoTabla.dataset.scrollPreparado) {
        contenidoTabla.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: true });

        contenidoTabla.dataset.scrollPreparado = 'true';
    }
}

function toggleTabla() {
    var panel = document.getElementById('tablaAtributos');
    var capa = capaActivaPorMenu || obtenerCapaSeleccionada();

    if (panel.style.display === 'none' || panel.style.display === '') {

        if (capa && capa.data) {
            activarCapaYZoomDesdeTabla(capa);
            mostrarTablaAtributos(capa.data, capa.titulo);
        } else {
            document.getElementById('tablaContenido').innerHTML = '<p>No hay datos cargados para esa capa.</p>';
        }

        panel.style.display = 'flex';
        activarScrollRuedaTabla();

    } else {
        panel.style.display = 'none';
    }
}

// =============================
// ACTUALIZAR TABLA / DASHBOARD
// CUANDO CAMBIA LA CAPA
// =============================


// document.getElementBy function() {
//     var capa = capaActivaPorMenu || obtenerCapaSeleccionada();
//
//     var panelDashboard = document.getElementById('dashboard');
//     if (panelDashboard.style.display !== 'none' && capa && capa.data) {
//         mostrarDashboard(capa.data, capa.titulo);
//     }
//
//     var panelTabla = document.getElementById('tablaAtributos');
//     if (panelTabla.style.display !== 'none' && capa && capa.data) {
//         mostrarTablaAtributos(capa.data, capa.titulo);
//     }
// });

// =============================
// INICIO
// =============================

//poblarSelectorCapas();
capasConfig.forEach(cargarCapa);

// =============================
// TOGGLE PANEL TIMELINE (BOTÓN)
// =============================
function togglePanelTimeline() {

    var control = document.getElementById('timelineControl');
    if (!control) return;

    // Si está oculto, lo mostramos
    if (control.style.display === 'none' || control.style.display === '') {
        control.style.display = 'flex';

        // PASO EXTRA: Si hay un swipe activo, lo pausamos
        // para que la línea de tiempo funcione correctamente
        if (swipeControl !== null) {
            alert('Desactiva primero la comparación de capas.');
            control.style.display = 'none';
            return;
        }

    } else {
        // Si está visible, lo ocultamos y limpiamos todo
        ocultarTimeline();
    }
}

// =============================
// MOSTRAR / OCULTAR TIMELINE
// =============================

function mostrarTimeline() {
    var control = document.getElementById('timelineControl');
    if (control) control.style.display = 'flex';
}

function ocultarTimeline() {
    var control = document.getElementById('timelineControl');
    if (control) control.style.display = 'none';

    [foto2010, foto2018, foto2025].forEach(function(foto) {
        if (map.hasLayer(foto)) map.removeLayer(foto);
    });

    ['Construcciones 2010', 'Construcciones 2018', 'Construcciones 2025'].forEach(function(key) {
        var capa = capasLeaflet[key];
        if (capa && map.hasLayer(capa)) map.removeLayer(capa);
    });

    var slider = document.getElementById('timelineSlider');
    if (slider) slider.value = 0;
}

// =============================
// LÍNEA DE TIEMPO
// =============================
var años = ['2010', '2018', '2025'];
var fotosTimeline = [foto2010, foto2018, foto2025];

function activarFotoTimeline(indice) {

    if (swipeControl !== null) return;

    // Fotos
    fotosTimeline.forEach(function(foto, i) {
        if (i === indice) {
            if (!map.hasLayer(foto)) foto.addTo(map);
        } else {
            if (map.hasLayer(foto)) map.removeLayer(foto);
        }
    });

    // Construcciones por año
    var construccionesPorAnio = [
        'Construcciones 2010',
        'Construcciones 2018',
        'Construcciones 2025'
    ];

    construccionesPorAnio.forEach(function(key, i) {
        var capa = capasLeaflet[key];
        if (!capa) return;
        if (i === indice) {
            if (!map.hasLayer(capa)) capa.addTo(map);
        } else {
            if (map.hasLayer(capa)) map.removeLayer(capa);
        }
    });
}

var slider = document.getElementById('timelineSlider');
if (slider) {
    slider.addEventListener('input', function() {
        activarFotoTimeline(parseInt(this.value));
    });
}

setTimeout(function(){
    poblarSelectoresSwipe();
}, 1000);

// =============================
// LLENAR SELECTORES SWIPE
// =============================

function poblarSelectoresSwipe() {

    var left = document.getElementById('selectLeftLayer');
    var right = document.getElementById('selectRightLayer');

    if (!left || !right) return;

    // imágenes georreferenciadas
    agregarOpcionEspecial(left, 'foto2010', 'Imagen 2010');
    agregarOpcionEspecial(left, 'foto2018', 'Imagen 2018');
    agregarOpcionEspecial(left, 'foto2025', 'Imagen 2025');

    agregarOpcionEspecial(right, 'foto2010', 'Imagen 2010');
    agregarOpcionEspecial(right, 'foto2018', 'Imagen 2018');
    agregarOpcionEspecial(right, 'foto2025', 'Imagen 2025');

    
}

function agregarOpcionEspecial(select, value, texto){

    var option = document.createElement('option');

    option.value = value;
    option.textContent = texto;

    select.appendChild(option);
}

// =============================
// OBTENER CAPA PARA SWIPE
// =============================

function obtenerLayerPorValor(valor){

    // imágenes
    if(valor === 'foto2010') return foto2010;
    if(valor === 'foto2018') return foto2018;
    if(valor === 'foto2025') return foto2025;

    // geojson
    return capasLeaflet[valor];
}

// =============================
// INICIAR COMPARACIÓN
// =============================

function iniciarComparacion(){

    var leftValue = document.getElementById('selectLeftLayer').value;
    var rightValue = document.getElementById('selectRightLayer').value;

    if(!leftValue || !rightValue){
        alert('Selecciona ambas capas');
        return;
    }

    var leftLayer = obtenerLayerPorValor(leftValue);
    var rightLayer = obtenerLayerPorValor(rightValue);

    // agregar al mapa si no existen
    if(!map.hasLayer(leftLayer)){
        leftLayer.addTo(map);
    }

    if(!map.hasLayer(rightLayer)){
        rightLayer.addTo(map);
    }

    activarSwipe(leftLayer, rightLayer);
}

function toggleAcordeon(header) {
    var item = header.parentElement;
    var body = header.nextElementSibling;

    if (item.classList.contains("active")) {
        item.classList.remove("active");
        body.style.display = "none";
    } else {
        item.classList.add("active");
        body.style.display = "block";
    }
}

document.querySelectorAll('.acordeon-body').forEach(function(body) {
    body.style.display = 'none';
});

// =============================
// SIMBOLOGÍA NDBI POR GRIDCODE
// Igual que ArcGIS Pro:
// 1 = Vegetación densa  (azul)
// 2 = Vegetación moderada (verde)
// 3 = Suelo desnudo / transición (naranja)
// 4 = Área construida (rojo)
// =============================

var coloresNDBI = {
    1: { fillColor: '#4472C4', color: '#2e4f8a', label: 'Vegetación densa' },
    2: { fillColor: '#92D050', color: '#5a8a2e', label: 'Vegetación moderada' },
    3: { fillColor: '#FFC000', color: '#b38600', label: 'Suelo desnudo / transición' },
    4: { fillColor: '#FF0000', color: '#aa0000', label: 'Área construida' }
};

function estiloNDBI(feature) {
    // PASO 1: Leer el gridcode del polígono
    var gc = feature.properties && feature.properties.gridcode
        ? parseInt(feature.properties.gridcode)
        : 0;

    // PASO 2: Buscar el color correspondiente
    var estilo = coloresNDBI[gc];

    // PASO 3: Si no hay coincidencia, color gris por defecto
    if (!estilo) {
        return { color: '#999', weight: 0.5, fillColor: '#cccccc', fillOpacity: 0.7 };
    }

    return {
        color:       estilo.color,
        weight:      0.5,
        fillColor:   estilo.fillColor,
        fillOpacity: 0.8
    };
}

// =============================
// crear función de simbología
// =============================

function obtenerSimboloHTML(key) {
    const estilo = obtenerEstiloPorCapa(key);

    // NDBI — mostrar 4 cuadraditos de colores como leyenda
    if (key.includes("NDBI")) {
        return `<span style="display:inline-flex;gap:2px;margin-right:6px;">
            <span style="width:8px;height:8px;background:#4472C4;display:inline-block;border-radius:1px;"></span>
            <span style="width:8px;height:8px;background:#92D050;display:inline-block;border-radius:1px;"></span>
            <span style="width:8px;height:8px;background:#FFC000;display:inline-block;border-radius:1px;"></span>
            <span style="width:8px;height:8px;background:#FF0000;display:inline-block;border-radius:1px;"></span>
        </span>`;
    }

    // Detectar tipo básico (puedes mejorar esto luego)
    if (key.includes("Construcciones 20")) {
        // polígono
        return `<span style="
            display:inline-block;
            width:10px;
            height:10px;
            background:${estilo.fillColor || estilo.color};
            border-radius:50%;
            margin-right:6px;
        "></span>`;
    }

    if (key.includes("Vias")) {
        // línea
        return `<span style="
            display:inline-block;
            width:16px;
            height:2px;
            background:${estilo.color};
            margin-right:6px;
        "></span>`;
    }

    // polígono
    return `<span style="
        display:inline-block;
        width:12px;
        height:12px;
        background:${estilo.fillColor || estilo.color};
        border:1px solid ${estilo.color};
        margin-right:6px;
    "></span>`;
}

// =============================
// MENÚ CONTEXTUAL DE CAPA
// =============================

function mostrarMenuContextualCapa() {
    var menu = document.getElementById('menuContextualCapa');
    menu.style.display = 'block';
}

function cerrarMenuContextualCapa() {
    var menu = document.getElementById('menuContextualCapa');
    menu.style.display = 'none';
}

function accionTabla() {
    toggleTabla();
}

function guardarEstadoArbolCapas() {
    var abiertos = [];

    document.querySelectorAll('.leaflet-layerstree-node').forEach(function(nodo, index) {
        var hijos = nodo.querySelector(':scope > .leaflet-layerstree-children');

        if (hijos && window.getComputedStyle(hijos).display !== 'none') {
            abiertos.push(index);
        }
    });

    return abiertos;
}

function restaurarEstadoArbolCapas(abiertos) {
    document.querySelectorAll('.leaflet-layerstree-node').forEach(function(nodo, index) {
        var hijos = nodo.querySelector(':scope > .leaflet-layerstree-children');
        var toggle = nodo.querySelector(':scope > .leaflet-layerstree-header .leaflet-layerstree-toggle');

        if (!hijos) return;

        if (abiertos.includes(index)) {
            hijos.style.display = 'block';

            if (toggle) {
                toggle.textContent = '−';
            }
        }
    });
}

function activarCapaYZoomDesdeTabla(capa) {
    if (!capa || !capa.key) return;

    var layer = capasLeaflet[capa.key];
    if (!layer) return;

    // Guardar qué carpetas del árbol estaban abiertas
    var estadoArbol = guardarEstadoArbolCapas();

    // Activar capa si no está activa
    if (!map.hasLayer(layer)) {
        layer.addTo(map);
    }

    // Hacer zoom a la extensión completa
    if (typeof layer.getBounds === 'function') {
        var bounds = layer.getBounds();

        if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [20, 20],
                maxZoom: 19
            });
        }
    }

    // ✅ Restaurar carpetas abiertas después de que Leaflet refresque el árbol
    setTimeout(function() {
        restaurarEstadoArbolCapas(estadoArbol);
    }, 100);
}

function accionDashboard() {
    toggleDashboard();
}


function togglePanelAcciones() {
  var panel = document.getElementById('panelAccionesCapa');

  if (panel.style.display === 'none' || panel.style.display === '') {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}



document.addEventListener('click', function (e) {

    var boton = e.target.closest('.menu-capa');
    var menu = document.getElementById('menuContextualCapa');

    // =============================
    // CLICK EN LOS TRES PUNTOS
    // =============================
    if (boton) {
        e.preventDefault();
        e.stopPropagation();

        var key = boton.getAttribute('data-key');

        if (!key || !capasGeoJSON[key]) {
            alert('No hay información para esta capa.');
            return;
        }

        var config = capasConfig.find(function (c) {
            return c.key === key;
        });

        capaActivaPorMenu = {
            key: key,
            data: capasGeoJSON[key],
            titulo: config ? config.nombre : key
        };

        // Posición del botón ⋮ en pantalla
var rect = boton.getBoundingClientRect();

        // Posición del panel derecho
        var panel = document.getElementById('panelInferior');
        var panelRect = panel.getBoundingClientRect();

        // Mostrar menú temporalmente para medirlo
        menu.style.display = 'block';
        menu.style.position = 'fixed';
        menu.style.right = 'auto';

        var menuWidth = menu.offsetWidth;
        var menuHeight = menu.offsetHeight;

        // Pegar el menú al costado izquierdo del panel derecho
        var left = panelRect.left - menuWidth;

        //  Centrar verticalmente respecto al botón
        var top = rect.top + (rect.height / 2) - (menuHeight / 2);

        //  Evitar que se salga por arriba o por abajo del panel derecho
        if (top < panelRect.top + 10) {
        top = panelRect.top + 10;
}

if (top + menuHeight > panelRect.bottom - 10) {
    top = panelRect.bottom - menuHeight - 10;
}

menu.style.left = left + 'px';
menu.style.top = top + 'px';

        return;
    }

    // =============================
    // CLICK FUERA DEL MENÚ
    // =============================
    if (menu && !e.target.closest('#menuContextualCapa')) {
        menu.style.display = 'none';
    }
});


function mostrarMenuContextualCapa() {
    var menu = document.getElementById('menuContextualCapa');
    menu.style.display = 'block';
}

// =============================
// HERRAMIENTAS DE DIBUJO
// =============================

// PASO 1: Grupo donde se guardan todos los dibujos
var grupoDibujos = L.featureGroup().addTo(map);

// PASO 2: Guardar qué herramienta está activa
var herramientaActiva = null;

// PASO 3: Guardar el handler de dibujo actual
var handlerActual = null;

// =============================
// ABRIR / CERRAR PANEL DIBUJO
// =============================
function togglePanelDibujo() {
    var panel = document.getElementById('panelDibujo');
    if (!panel) return;

    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
        // Al cerrar, cancelar herramienta activa
        cancelarHerramienta();
    }
}

// =============================
// ACTIVAR HERRAMIENTA
// =============================
function activarHerramienta(tipo) {

    // Cancelar herramienta anterior si había una
    cancelarHerramienta();

    // Quitar clase activo de todos los botones
    document.querySelectorAll('.btn-herramienta').forEach(function(b) {
        b.classList.remove('activo');
    });

    herramientaActiva = tipo;

    // PASO 4: Según el tipo, activar el handler de Leaflet.Draw
    if (tipo === 'circulo') {
        handlerActual = new L.Draw.Circle(map, {
            shapeOptions: { color: '#9172b4', weight: 2 }
        });

    } else if (tipo === 'poligono') {
        handlerActual = new L.Draw.Polygon(map, {
            shapeOptions: { color: '#2e1f33', weight: 2, fillOpacity: 0.2 }
        });

    } else if (tipo === 'linea') {
        handlerActual = new L.Draw.Polyline(map, {
            shapeOptions: { color: '#ff6f00', weight: 3 }
        });

    } else if (tipo === 'punto') {
        handlerActual = new L.Draw.Marker(map);

    } else if (tipo === 'medirLinea') {
        handlerActual = new L.Draw.Polyline(map, {
            shapeOptions: { color: '#0055ff', weight: 2, dashArray: '6' }
        });

    } else if (tipo === 'medirArea') {
        handlerActual = new L.Draw.Polygon(map, {
            shapeOptions: { color: '#00aa55', weight: 2, fillOpacity: 0.15 }
        });
    }

    // PASO 5: Iniciar el dibujo
    if (handlerActual) {
        handlerActual.enable();
    }
}

// =============================
// CANCELAR HERRAMIENTA ACTIVA
// =============================
function cancelarHerramienta() {
    if (handlerActual) {
        handlerActual.disable();
        handlerActual = null;
    }
    herramientaActiva = null;
}

// =============================
// BORRAR TODOS LOS DIBUJOS
// =============================
function limpiarDibujos() {
    grupoDibujos.clearLayers();
    cancelarHerramienta();
}

// =============================
// PASO 6: CAPTURAR LO QUE SE DIBUJA
// y mostrar popup con medidas + atributos limpios
// =============================

map.on(L.Draw.Event.CREATED, function(e) {

    var layer = e.layer;
    var tipo  = e.layerType;
    var info  = '';

    // --- LÍNEA ---
    if (tipo === 'polyline') {
        var metros = 0;
        var puntos = layer.getLatLngs();
        for (var i = 0; i < puntos.length - 1; i++) {
            metros += puntos[i].distanceTo(puntos[i + 1]);
        }
        var km = metros / 1000;
        info = '<b>📏 Longitud</b><br>';
        info += metros < 1000
            ? redondear(metros) + ' m'
            : redondear(km) + ' km';

    // --- POLÍGONO o CÍRCULO ---
    } else if (tipo === 'polygon' || tipo === 'rectangle') {
        var areaM2 = L.GeometryUtil
            ? L.GeometryUtil.geodesicArea(layer.getLatLngs()[0])
            : 0;
        var areaHa = areaM2 / 10000;
        info = '<b>▦ Área</b><br>';
        info += areaM2 < 10000
            ? redondear(areaM2) + ' m²'
            : redondear(areaHa) + ' ha';

    } else if (tipo === 'circle') {
        var radioM   = layer.getRadius();
        var areaCirc = Math.PI * radioM * radioM;
        info = '<b>⬤ Círculo</b><br>';
        info += 'Radio: '  + redondear(radioM)   + ' m<br>';
        info += 'Área: '   + redondear(areaCirc / 10000) + ' ha';

    // --- PUNTO / MARCADOR ---
    } else if (tipo === 'marker' || tipo === 'circlemarker') {
        var latlng = layer.getLatLng();
        info = '<b>● Punto</b><br>';
        info += 'Lat: ' + redondear(latlng.lat) + '<br>';
        info += 'Lng: ' + redondear(latlng.lng);
    }

    // PASO 7: Mostrar popup con la información
    layer.bindPopup(info).openPopup();

    // PASO 8: Agregar al grupo de dibujos
    grupoDibujos.addLayer(layer);

    // PASO 9: Cancelar herramienta para que no siga dibujando
    cancelarHerramienta();

    // Quitar clase activo de botones
    document.querySelectorAll('.btn-herramienta').forEach(function(b) {
        b.classList.remove('activo');
    });
});

// =============================
// HELPER: redondear a 3 decimales
// =============================
function redondear(numero) {
    return Math.round(numero * 1000) / 1000;
}

// =============================
// MEJORA POPUPS CAPAS GEOJSON:
// ocultar nulos y redondear números
// =============================
function popupDesdeAtributos(feature) {
    if (!feature.properties) return 'Sin atributos';

    var html = '';

    for (var campo in feature.properties) {
        var valor = feature.properties[campo];

        // PASO A: Saltar valores nulos, vacíos o cero
        if (valor === null || valor === undefined || valor === '' || valor === 0) {
            continue;
        }

        // PASO B: Si es número, redondear a 3 decimales
        if (typeof valor === 'number') {
            valor = redondear(valor);
        }

        html += '<b>' + campo + ':</b> ' + valor + '<br>';
    }

    return html || 'Sin atributos disponibles';
}

// =============================
// BUSCADOR FIJO E INTELIGENTE
// =============================

// PASO 1: Escuchar cuando el usuario escribe en el buscador
document.addEventListener('DOMContentLoaded', function() {
    inicializarBuscador();
});

// Por si el DOM ya cargó antes
if (document.readyState !== 'loading') {
    setTimeout(inicializarBuscador, 800);
}

function inicializarBuscador() {

    var input = document.getElementById('inputBusquedaCapas');
    var lista = document.getElementById('listaSugerencias');

    if (!input || !lista) return;

    // PASO 2: Al escribir → mostrar sugerencias
    input.addEventListener('input', function() {

        var texto = this.value.toLowerCase().trim();

        // Limpiar resaltados anteriores
        document.querySelectorAll('.fila-capa').forEach(function(f) {
            f.classList.remove('resaltada');
        });

        // Si está vacío, ocultar lista
        if (!texto) {
            lista.style.display = 'none';
            lista.innerHTML = '';
            return;
        }

        // PASO 3: Buscar coincidencias en capasConfig
        var coincidencias = capasConfig.filter(function(capa) {
            return capa.nombre.toLowerCase().includes(texto);
        });

        // PASO 4: Construir la lista de sugerencias
        if (coincidencias.length === 0) {
            lista.innerHTML = '<div class="sugerencia-item" style="color:#999;">Sin resultados</div>';
            lista.style.display = 'block';
            return;
        }

        lista.innerHTML = '';

        coincidencias.forEach(function(capa) {

            var item = document.createElement('div');
            item.className = 'sugerencia-item';

            // Símbolo de la capa + nombre con texto resaltado
            var simbolo = obtenerSimboloHTML(capa.key);
            var nombreResaltado = resaltarTexto(capa.nombre, texto);

            item.innerHTML = simbolo + nombreResaltado;

// PASO 5: Al hacer click en una sugerencia
            item.addEventListener('click', function() {

                // Poner el nombre en el input
                input.value = capa.nombre;

                // Ocultar lista de sugerencias
                lista.style.display = 'none';

                // NUEVO: resaltar TODAS las capas que contengan
                // el texto escrito, no solo la que se clickeó
                var textoBuscado = capa.nombre;

                // Quitar resaltados anteriores primero
                document.querySelectorAll('.fila-capa').forEach(function(f) {
                    f.classList.remove('resaltada');
                });

                // Llamar para resaltar todas las coincidencias
                abrirYResaltarCapa(capa.key, textoBuscado);
            });

            lista.appendChild(item);
        });

        lista.style.display = 'block';
    });

    // PASO 6: Al presionar Enter → buscar la primera coincidencia
    input.addEventListener('keydown', function(e) {

        if (e.key !== 'Enter') return;

        var texto = this.value.toLowerCase().trim();
        if (!texto) return;

        lista.style.display = 'none';

        var primera = capasConfig.find(function(capa) {
            return capa.nombre.toLowerCase().includes(texto);
        });

        if (primera) {
            abrirYResaltarCapa(primera.key, primera.nombre);
        }
    });

    // PASO 7: Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#buscadorFijo')) {
            lista.style.display = 'none';
        }
    });
}


// =============================
// ABRIR EL GRUPO Y RESALTAR TODAS LAS CAPAS COINCIDENTES
// =============================
function abrirYResaltarCapa(key, nombre) {

    // PASO A: Quitar resaltados anteriores
    document.querySelectorAll('.fila-capa').forEach(function(f) {
        f.classList.remove('resaltada');
    });

    // PASO B: Buscar TODAS las filas que contengan el texto buscado
    var filas = document.querySelectorAll('.fila-capa');
    var filasEncontradas = [];

    filas.forEach(function(fila) {
        if (fila.innerText.toLowerCase().includes(nombre.toLowerCase())) {
            filasEncontradas.push(fila);
        }
    });

    // PASO C: Si el árbol aún no renderizó, esperar y reintentar
    if (filasEncontradas.length === 0) {
        setTimeout(function() {
            abrirYResaltarCapa(key, nombre);
        }, 400);
        return;
    }

    // PASO D: Resaltar y abrir contenedores SIN usar .click()
    // Usamos solo CSS para no romper el sistema de toggle de Leaflet
    filasEncontradas.forEach(function(fila) {

        // Resaltar visualmente la fila
        fila.classList.add('resaltada');

        // Subir por el DOM buscando nodos padre para abrirlos
        var nodoActual = fila.closest('.leaflet-layerstree-node');

        while (nodoActual) {

            // PASO D1: Mostrar los hijos directos del nodo
            var hijos = nodoActual.querySelector(
                ':scope > .leaflet-layerstree-children'
            );
            if (hijos) {
                // Forzar visible solo con CSS — sin tocar eventos
                hijos.style.display = 'block';
            }

            // PASO D2: Cambiar el texto del toggle de + a −
            // solo visualmente, sin hacer .click()
            var toggle = nodoActual.querySelector(
                ':scope > .leaflet-layerstree-header .leaflet-layerstree-toggle'
            );
            if (toggle && toggle.textContent.trim() === '+') {
                // Cambiamos el símbolo visualmente
                toggle.textContent = '−';
            }

            // PASO D3: Subir al nodo padre
            var padre = nodoActual.parentElement;
            nodoActual = padre
                ? padre.closest('.leaflet-layerstree-node')
                : null;
        }
    });

    // PASO E: Scroll suave hasta la primera coincidencia
    setTimeout(function() {
        if (filasEncontradas.length > 0) {
            filasEncontradas[0].scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, 250);
}


// =============================
// RESALTAR TEXTO COINCIDENTE
// =============================
function resaltarTexto(nombre, texto) {

    // Buscar la posición del texto dentro del nombre
    var indice = nombre.toLowerCase().indexOf(texto.toLowerCase());

    if (indice === -1) return nombre;

    // Partir el nombre en 3: antes, coincidencia, después
    var antes      = nombre.substring(0, indice);
    var coincide   = nombre.substring(indice, indice + texto.length);
    var despues    = nombre.substring(indice + texto.length);

    // Envolver la coincidencia en <mark> para resaltarla
    return antes + '<mark>' + coincide + '</mark>' + despues;
}

// =============================
// PANEL ANÁLISIS ESTADÍSTICO
// =============================

// Variable para guardar la gráfica activa
var chartInstancia = null;

// PASO NUEVO: guardar qué capas están activas en el análisis
// para poder quitarlas cuando cambie la selección
var capasActivasAnalisis = {
    izq: null,   // key de la capa izquierda activa
    der: null    // key de la capa derecha activa
};

// NUEVO: recordar qué capas activó el análisis
// para poder quitarlas al limpiar
var capasActivasAnalisis = {
    izq: null,
    der: null
};

// =============================
// ABRIR / CERRAR PANEL
// =============================
function togglePanelAnalisis() {
    var panel = document.getElementById('panelAnalisis');
    if (!panel) return;

    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        // Poblar los selectores con las capas disponibles
        poblarSelectoresAnalisis();
    } else {
        panel.style.display = 'none';
        limpiarAnalisis();
    }
}

function esCapaValidaParaAnalisis(key) {
    var capasPermitidas = [
        'Centro poblado',
        'Construcciones Hoyorrico',
        'Construcciones 2010',
        'Construcciones 2018',
        'Construcciones 2025',
        'NDBI 2010',
        'NDBI 2018',
        'NDBI 2025'
    ];

    return capasPermitidas.includes(key);
}

// =============================
// POBLAR SELECTORES DEL ANÁLISIS
// =============================

function poblarSelectoresAnalisis() {

    var selIzq = document.getElementById('selectAnalisisIzq');
    var selDer = document.getElementById('selectAnalisisDer');

    if (!selIzq || !selDer) return;

    // Limpiar opciones anteriores
    selIzq.innerHTML = '<option value="">Seleccionar capa...</option>';
    selDer.innerHTML = '<option value="">Seleccionar capa...</option>';

    // Agregar solo las capas que ya cargaron
    capasConfig.forEach(function(capa) {
    // Solo mostrar capas relevantes para el análisis
      if (!esCapaValidaParaAnalisis(capa.key)) return;

      // Solo si ya cargaron datos
      if (!capasGeoJSON[capa.key]) return;

      var opt1 = document.createElement('option');
      opt1.value       = capa.key;
      opt1.textContent = capa.nombre;
      selIzq.appendChild(opt1);

      var opt2 = document.createElement('option');
      opt2.value       = capa.key;
      opt2.textContent = capa.nombre;
      selDer.appendChild(opt2);
});


    // =============================================
    // NUEVO: al cambiar selector izquierdo →
    // quitar del mapa la capa anterior
    // =============================================
    selIzq.addEventListener('change', function() {

        // PASO A: quitar del mapa la capa izquierda anterior
        if (capasActivasAnalisis.izq) {
            var capaAnterior = capasLeaflet[capasActivasAnalisis.izq];
            if (capaAnterior && map.hasLayer(capaAnterior)) {
                map.removeLayer(capaAnterior);
            }
        }

        // PASO B: registrar la nueva selección
        capasActivasAnalisis.izq = this.value || null;

        // PASO C: ocultar el resultado anterior
        // (ya no es válido si cambió una capa)
        var resultado = document.getElementById('analisisResultado');
        if (resultado) resultado.style.display = 'none';
    });

    // =============================================
    // NUEVO: al cambiar selector derecho →
    // quitar del mapa la capa anterior
    // =============================================
    selDer.addEventListener('change', function() {

        // PASO A: quitar del mapa la capa derecha anterior
        if (capasActivasAnalisis.der) {
            var capaAnterior = capasLeaflet[capasActivasAnalisis.der];
            if (capaAnterior && map.hasLayer(capaAnterior)) {
                map.removeLayer(capaAnterior);
            }
        }

        // PASO B: registrar la nueva selección
        capasActivasAnalisis.der = this.value || null;

        // PASO C: ocultar el resultado anterior
        var resultado = document.getElementById('analisisResultado');
        if (resultado) resultado.style.display = 'none';
    });
}

// =============================
// EJECUTAR ANÁLISIS
// =============================
function ejecutarAnalisis() {

    var keyIzq = document.getElementById('selectAnalisisIzq').value;
    var keyDer = document.getElementById('selectAnalisisDer').value;

    // VALIDAR selección
    if (!keyIzq || !keyDer) {
        alert('Selecciona las dos capas para analizar.');
        return;
    }
    if (keyIzq === keyDer) {
        alert('Selecciona dos capas diferentes.');
        return;
    }

    var datosIzq = capasGeoJSON[keyIzq];
    var datosDer = capasGeoJSON[keyDer];

    if (!datosIzq || !datosDer) {
        alert('Una de las capas no tiene datos cargados.');
        return;
    }

    var nombreIzq = capasConfig.find(function(c){ return c.key === keyIzq; }).nombre;
    var nombreDer = capasConfig.find(function(c){ return c.key === keyDer; }).nombre;

    // =============================================
    // MEJORA 1: Activar ambas capas en el mapa
    // =============================================
    var capaLeafletIzq = capasLeaflet[keyIzq];
    var capaLeafletDer = capasLeaflet[keyDer];

    // Activar capas en el mapa
    if (capaLeafletIzq && !map.hasLayer(capaLeafletIzq)) {
        capaLeafletIzq.addTo(map);
    }
    if (capaLeafletDer && !map.hasLayer(capaLeafletDer)) {
        capaLeafletDer.addTo(map);
    }

    // NUEVO: guardar cuáles capas están activas ahora
    capasActivasAnalisis.izq = keyIzq;
    capasActivasAnalisis.der = keyDer;

    // =============================================
    // MEJORA 2: Obtener colores reales de cada capa
    // =============================================
    var colorIzq = obtenerColorCapa(keyIzq);
    var colorDer = obtenerColorCapa(keyDer);

    // PASO 1: Calcular estadísticas
    
    var statsIzq = calcularEstadisticas(datosIzq, keyIzq);
    var statsDer = calcularEstadisticas(datosDer, keyDer);

    // PASO 2: Dibujar gráfica con colores reales
    dibujarGrafica(nombreIzq, statsIzq, colorIzq, nombreDer, statsDer, colorDer);

// PASO 3: Generar reporte textual con análisis espacial
    generarReporte(nombreIzq, statsIzq, nombreDer, statsDer, datosIzq, datosDer);

    // Mostrar resultado
    document.getElementById('analisisResultado').style.display = 'block';
}

// =============================
// CALCULAR ESTADÍSTICAS DE UNA CAPA
// =============================
function calcularEstadisticas(geojson, key) {

    var total      = geojson.features ? geojson.features.length : 0;
    var conGeom    = 0;
    var sinGeom    = 0;
    var tiposGeom  = {};

    if (geojson.features) {
        geojson.features.forEach(function(f) {
            if (f.geometry && f.geometry.type) {
                conGeom++;
                var t = f.geometry.type;
                tiposGeom[t] = (tiposGeom[t] || 0) + 1;
            } else {
                sinGeom++;
            }
        });
    }

    // Tipo dominante
    var tipoDominante = 'Sin geometría';
    var maxTipo = 0;
    Object.keys(tiposGeom).forEach(function(t) {
        if (tiposGeom[t] > maxTipo) {
            maxTipo = tiposGeom[t];
            tipoDominante = t;
        }
    });

    // Traducir tipo al español
    var traducciones = {
        'Point':           'Puntos',
        'MultiPoint':      'Multipuntos',
        'LineString':      'Líneas',
        'MultiLineString': 'Multilíneas',
        'Polygon':         'Polígonos',
        'MultiPolygon':    'Multipolígonos'
    };
    tipoDominante = traducciones[tipoDominante] || tipoDominante;
    // Contar features por tipo de geometría (para variedad en gráfica)
var conteoTipos = Object.keys(tiposGeom).length;  // nº de tipos distintos

// Contar campos de atributos
    var numCampos = 0;
    if (geojson.features && geojson.features[0] && geojson.features[0].properties) {
        numCampos = Object.keys(geojson.features[0].properties).length;
    }

    return {
        total:         total,
        conGeom:       conGeom,
        sinGeom:       sinGeom,
        tipoDominante: tipoDominante,
        tiposGeom:     tiposGeom,
        numCampos:     numCampos
    };
}

// =============================
// OBTENER COLOR REAL DE LA CAPA
// Para NDBI devuelve el color principal (azul)
// Para Construcciones devuelve su color asignado
// Para el resto usa el color del estilo
// =============================
function obtenerColorCapa(key) {

    // NDBI — color dominante (azul vegetación densa)
    if (key.includes('NDBI')) {
        return { fondo: 'rgba(68,114,196,0.85)', borde: '#2e4f8a' };
    }

    // Obtener estilo definido en obtenerEstiloPorCapa
    var estilo = obtenerEstiloPorCapa(key);

    // Usar fillColor si existe, si no usar color del borde
    var colorBase = estilo.fillColor || estilo.color || '#9172b4';

    // Convertir hex a rgba con transparencia
    var rgb = hexARgb(colorBase);

    return {
        fondo: 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.85)',
        borde: colorBase
    };
}

// Helper: convierte hex #RRGGBB a {r,g,b}
function hexARgb(hex) {
    // Limpiar # y expandir formato corto #RGB
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0]+hex[0] + hex[1]+hex[1] + hex[2]+hex[2];
    }
    return {
        r: parseInt(hex.substring(0,2), 16),
        g: parseInt(hex.substring(2,4), 16),
        b: parseInt(hex.substring(4,6), 16)
    };
}

// =============================
// DIBUJAR GRÁFICA INTELIGENTE + TABLA COMPARATIVA
// — Puntos vs Puntos: gráfica de totales
// — Polígono + otra capa: gráfica Dentro vs Fuera
// =============================
function dibujarGrafica(nombreIzq, statsIzq, colorIzq, nombreDer, statsDer, colorDer) {

    // PASO 1: Destruir gráfica anterior
    if (chartInstancia) {
        chartInstancia.destroy();
        chartInstancia = null;
    }

    var ctx = document.getElementById('chartAnalisis').getContext('2d');

    // PASO 2: Detectar si hay un polígono en alguna de las dos capas
    var hayPoligono =
        statsIzq.tipoDominante === 'Polígonos' ||
        statsIzq.tipoDominante === 'Multipolígonos' ||
        statsDer.tipoDominante === 'Polígonos' ||
        statsDer.tipoDominante === 'Multipolígonos';

    // PASO 3: Detectar si ambas capas son del mismo tipo (puntos vs puntos)
    var ambosIgualTipo =
        statsIzq.tipoDominante !== 'Sin geometría' &&
        statsDer.tipoDominante !== 'Sin geometría' &&
        statsIzq.tipoDominante === statsDer.tipoDominante;

    // ══════════════════════════════════════════
    // CASO A: Polígono + otra capa
    // Gráfica: Dentro del área vs Fuera del área
    // ══════════════════════════════════════════
    if (hayPoligono && typeof turf !== 'undefined') {

        // Detectar cuál es el polígono y cuál los elementos
        var geojsonPol  = null;
        var geojsonElem = null;
        var nombreElem  = '';

        if (statsIzq.tipoDominante === 'Polígonos' ||
            statsIzq.tipoDominante === 'Multipolígonos') {
            geojsonPol  = capasGeoJSON[Object.keys(capasGeoJSON).find(
                function(k) { return capasConfig.find(
                    function(c) { return c.key === k && c.nombre === nombreIzq; }
                ); }
            )];
            geojsonElem = capasGeoJSON[Object.keys(capasGeoJSON).find(
                function(k) { return capasConfig.find(
                    function(c) { return c.key === k && c.nombre === nombreDer; }
                ); }
            )];
            nombreElem = nombreDer;
        } else {
            geojsonPol  = capasGeoJSON[Object.keys(capasGeoJSON).find(
                function(k) { return capasConfig.find(
                    function(c) { return c.key === k && c.nombre === nombreDer; }
                ); }
            )];
            geojsonElem = capasGeoJSON[Object.keys(capasGeoJSON).find(
                function(k) { return capasConfig.find(
                    function(c) { return c.key === k && c.nombre === nombreIzq; }
                ); }
            )];
            nombreElem = nombreIzq;
        }

        // Contar elementos dentro y fuera
        var dentroCount = 0;
        var totalElem   = 0;

        if (geojsonPol && geojsonElem && geojsonElem.features) {
            totalElem = geojsonElem.features.length;

            geojsonElem.features.forEach(function(feat) {
                if (!feat.geometry) return;
                var punto;
                if (feat.geometry.type === 'Point') {
                    punto = feat;
                } else {
                    try { punto = turf.centroid(feat); } catch(e) { return; }
                }
                var estaDentro = geojsonPol.features.some(function(pol) {
                    if (!pol.geometry) return false;
                    try { return turf.booleanPointInPolygon(punto, pol); }
                    catch(e) { return false; }
                });
                if (estaDentro) dentroCount++;
            });
        }

        var fueraCount = totalElem - dentroCount;

        // Dibujar gráfica Dentro vs Fuera
        chartInstancia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Dentro del área', 'Fuera del área'],
                datasets: [{
                    label: nombreElem,
                    data:  [dentroCount, fueraCount],
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.8)',   // verde para dentro
                        'rgba(229, 57, 53, 0.8)'    // rojo para fuera
                    ],
                    borderColor: [
                        '#2e7d32',
                        '#c62828'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                var pct = totalElem > 0
                                    ? Math.round((c.parsed.y / totalElem) * 100)
                                    : 0;
                                return c.parsed.y + ' elementos (' + pct + '%)';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Número de elementos',
                            font: { size: 10 }
                        },
                        ticks: { font: { size: 10 } }
                    },
                    x: { ticks: { font: { size: 10 } } }
                }
            }
        });

    // ══════════════════════════════════════════
    // CASO B: Puntos vs Puntos (o cualquier mismo tipo)
    // Gráfica: total de cada capa — SIN la columna "Sin geometría"
    // ══════════════════════════════════════════
    } else {

        chartInstancia = new Chart(ctx, {
            type: 'bar',
            data: {
                // Solo dos barras — una por capa — sin "Sin geometría"
                labels: [nombreIzq, nombreDer],
                datasets: [{
                    label: 'Total de elementos',
                    data:  [statsIzq.total, statsDer.total],
                    backgroundColor: [colorIzq.fondo, colorDer.fondo],
                    borderColor:     [colorIzq.borde, colorDer.borde],
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                return 'Total: ' + c.parsed.y + ' elementos';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Número de elementos',
                            font: { size: 10 }
                        },
                        ticks: { font: { size: 10 } }
                    },
                    x: {
                        ticks: {
                            font: { size: 10 },
                            callback: function(value, index) {
                                var nombre = this.getLabelForValue(index);
                                return nombre.length > 20
                                    ? nombre.substring(0, 18) + '…'
                                    : nombre;
                            }
                        }
                    }
                }
            }
        });
    }

    // ══════════════════════════════════════════
    // PASO 4: Tabla comparativa (igual que antes — no se toca)
    // ══════════════════════════════════════════
    var contenedorGrafica = document.getElementById('analisisGrafica');

    var tablaAnterior = document.getElementById('tablaComparativa');
    if (tablaAnterior) tablaAnterior.remove();

    var diferencia     = statsDer.total - statsIzq.total;
    var difAbsoluta    = Math.abs(diferencia);
    var pctCrecimiento = statsIzq.total > 0
        ? ((diferencia / statsIzq.total) * 100).toFixed(1) : 0;
    var crecio = diferencia > 0;
    var colorDif = crecio ? '#2e7d32' : '#b71c1c';
    var iconoDif = crecio ? '▲' : '▼';
    var textoDif = crecio
        ? '+' + difAbsoluta + ' elementos más en ' + nombreDer
        : '-' + difAbsoluta + ' elementos menos en ' + nombreDer;

    var filas = [
        { metrica: 'Total de elementos',    valA: statsIzq.total,          valB: statsDer.total,          destacar: true },
        { metrica: 'Con geometría válida',  valA: statsIzq.conGeom,        valB: statsDer.conGeom },
        { metrica: 'Sin geometría',         valA: statsIzq.sinGeom,        valB: statsDer.sinGeom },
        { metrica: 'Tipo de geometría',     valA: statsIzq.tipoDominante,  valB: statsDer.tipoDominante },
        { metrica: 'Campos atributos',      valA: statsIzq.numCampos || '—', valB: statsDer.numCampos || '—' }
    ];

    var htmlFilas = filas.map(function(fila) {
        var estiloFila = fila.destacar ? 'background:#f0eaf8; font-weight:bold;' : '';
        return '<tr style="' + estiloFila + '">' +
            '<td style="padding:5px 8px; border:1px solid #e0e0e0; color:#555; font-size:11px;">' + fila.metrica + '</td>' +
            '<td style="padding:5px 8px; border:1px solid #e0e0e0; text-align:center; font-size:12px;">' + fila.valA + '</td>' +
            '<td style="padding:5px 8px; border:1px solid #e0e0e0; text-align:center; font-size:12px;">' + fila.valB + '</td>' +
        '</tr>';
    }).join('');

    var filaDiferencia = '';
    if (ambosIgualTipo) {
        filaDiferencia =
            '<tr style="background:#fff8e1;">' +
                '<td style="padding:5px 8px; border:1px solid #e0e0e0; color:#555; font-size:11px; font-weight:bold;">Diferencia</td>' +
                '<td colspan="2" style="padding:5px 8px; border:1px solid #e0e0e0; text-align:center; font-size:12px; color:' + colorDif + '; font-weight:bold;">' +
                    iconoDif + ' ' + textoDif +
                '</td>' +
            '</tr>' +
            '<tr style="background:#fff8e1;">' +
                '<td style="padding:5px 8px; border:1px solid #e0e0e0; color:#555; font-size:11px; font-weight:bold;">Variación porcentual</td>' +
                '<td colspan="2" style="padding:5px 8px; border:1px solid #e0e0e0; text-align:center; font-size:12px; color:' + colorDif + '; font-weight:bold;">' +
                    iconoDif + ' ' + Math.abs(pctCrecimiento) + '% respecto a ' + nombreIzq +
                '</td>' +
            '</tr>';
    }

    var leyendaHTML =
        '<div style="display:flex; gap:16px; margin-top:12px; margin-bottom:6px; font-size:12px; align-items:center;">' +
            '<span style="display:flex; align-items:center; gap:5px;">' +
                '<span style="display:inline-block; width:14px; height:14px; background:' + colorIzq.borde + '; border-radius:3px;"></span>' +
                '<span style="color:#333;">' + nombreIzq + '</span>' +
            '</span>' +
            '<span style="display:flex; align-items:center; gap:5px;">' +
                '<span style="display:inline-block; width:14px; height:14px; background:' + colorDer.borde + '; border-radius:3px;"></span>' +
                '<span style="color:#333;">' + nombreDer + '</span>' +
            '</span>' +
        '</div>';

    var tablaHTML =
        '<div id="tablaComparativa" style="margin-top:4px;">' +
            leyendaHTML +
            '<table style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;">' +
                '<thead>' +
                    '<tr style="background:#2e1f33; color:white;">' +
                        '<th style="padding:6px 8px; font-size:11px; text-align:left;">Métrica</th>' +
                        '<th style="padding:6px 8px; font-size:11px; text-align:center; word-break:break-word; max-width:110px; white-space:normal; line-height:1.4;">' + acortarNombre(nombreIzq) + '</th>' +
                        '<th style="padding:6px 8px; font-size:11px; text-align:center; word-break:break-word; max-width:110px; white-space:normal; line-height:1.4;">' + acortarNombre(nombreDer) + '</th>' +
                    '</tr>' +
                '</thead>' +
                '<tbody>' + htmlFilas + filaDiferencia + '</tbody>' +
            '</table>' +
        '</div>';

    contenedorGrafica.insertAdjacentHTML('afterend', tablaHTML);
}

// =============================
// NOMBRE COMPLETO EN ENCABEZADO
// Permite que se parta en dos líneas si es largo
// =============================
function acortarNombre(nombre) {
    // Devolver el nombre completo sin cortar
    // El CSS de la celda se encarga de partir en líneas si es necesario
    return nombre;
}

// =============================
// REPORTE — SOLO ANÁLISIS DE CONTENENCIA ESPACIAL
// =============================
function generarReporte(nombreIzq, statsIzq, nombreDer, statsDer, geojsonIzq, geojsonDer) {

    var contenedor = document.getElementById('analisisReporte');

    // PASO 1: Verificar que Turf.js esté disponible
    if (typeof turf === 'undefined') {
        contenedor.innerHTML = '<p style="color:#999; font-size:12px;">El análisis espacial no está disponible.</p>';
        return;
    }

    // PASO 2: Detectar cuál capa es el polígono y cuál tiene los elementos
    // El polígono es el "contenedor" (ej: Centro poblado)
    // Los elementos son los que pueden estar dentro o fuera (ej: Construcciones)
    var capaPol    = null;
    var capaElem   = null;
    var nombrePol  = '';
    var nombreElem = '';

    if (statsIzq.tipoDominante === 'Polígonos' || statsIzq.tipoDominante === 'Multipolígonos') {
        capaPol    = geojsonIzq;
        capaElem   = geojsonDer;
        nombrePol  = nombreIzq;
        nombreElem = nombreDer;
    } else if (statsDer.tipoDominante === 'Polígonos' || statsDer.tipoDominante === 'Multipolígonos') {
        capaPol    = geojsonDer;
        capaElem   = geojsonIzq;
        nombrePol  = nombreDer;
        nombreElem = nombreIzq;
    }

   // PASO 3: Si ninguna capa es polígono,
    // generar análisis comparativo en palabras
    if (!capaPol || !capaElem) {
        generarAnalisisSinPoligonos(
            geojsonIzq, nombreIzq,
            geojsonDer, nombreDer,
            contenedor
        );
        return;
    }

    // PASO 4: Contar cuántos elementos caen dentro del polígono
    var dentroCount = 0;
    var totalElem   = capaElem.features.length;

    capaElem.features.forEach(function(feat) {
        if (!feat.geometry) return;

        var punto;

        // Si el elemento es un punto, usarlo directamente
        if (feat.geometry.type === 'Point') {
            punto = feat;
        } else {
            // Si es polígono o línea, calcular su centro geométrico
            try { punto = turf.centroid(feat); } catch(e) { return; }
        }

        // Verificar si ese punto cae dentro de algún polígono de capaPol
        var estaDentro = capaPol.features.some(function(pol) {
            if (!pol.geometry) return false;
            try { return turf.booleanPointInPolygon(punto, pol); } catch(e) { return false; }
        });

        if (estaDentro) dentroCount++;
    });

    // PASO 5: Calcular porcentajes y elementos fuera
    var fueraDentro = totalElem - dentroCount;
    var pctDentro   = totalElem > 0 ? Math.round((dentroCount / totalElem) * 100) : 0;
    var pctFuera    = 100 - pctDentro;

    // PASO 6: Elegir mensaje de interpretación según el resultado
    var mensajeColor = '';
    var mensajeTexto = '';

    if (pctDentro === 100) {
        mensajeColor = '#2e7d32';
        mensajeTexto = `✅ La totalidad de los elementos de <b>${nombreElem}</b> se encuentran
            dentro del área de <b>${nombrePol}</b>. Esto indica una cobertura completa
            y coherente entre ambas capas.`;

    } else if (pctDentro === 0) {
        mensajeColor = '#c62828';
        mensajeTexto = `❌ Ningún elemento de <b>${nombreElem}</b> cae dentro del área de
            <b>${nombrePol}</b>. Es posible que las capas no se superpongan geográficamente
            o que pertenezcan a zonas distintas. Se recomienda verificar los sistemas de
            coordenadas y la extensión espacial de cada capa.`;

    } else if (pctDentro >= 75) {
        mensajeColor = '#1565c0';
        mensajeTexto = `🔵 La mayor parte de los elementos (<b>${pctDentro}%</b>) de
            <b>${nombreElem}</b> se encuentran dentro de <b>${nombrePol}</b>.
            Los <b>${fueraDentro}</b> elementos restantes (<b>${pctFuera}%</b>) están por fuera,
            lo que puede indicar una expansión reciente más allá del límite establecido,
            o elementos que aún no han sido incorporados al área oficial.`;

    } else if (pctDentro >= 40) {
        mensajeColor = '#e65100';
        mensajeTexto = `🟠 Aproximadamente la mitad de los elementos (<b>${pctDentro}%</b>) de
            <b>${nombreElem}</b> se ubican dentro de <b>${nombrePol}</b>, mientras que
            <b>${fueraDentro}</b> elementos (<b>${pctFuera}%</b>) quedan fuera.
            Esta distribución mixta puede reflejar un crecimiento disperso o que el área
            delimitada no cubre completamente la zona de interés.`;

    } else {
        mensajeColor = '#b71c1c';
        mensajeTexto = `🔴 Solo el <b>${pctDentro}%</b> de los elementos de
            <b>${nombreElem}</b> se encuentran dentro de <b>${nombrePol}</b>.
            La mayoría (<b>${fueraDentro}</b> elementos, <b>${pctFuera}%</b>) están fuera
            del área. Esto puede indicar que el límite del polígono no representa
            correctamente el área real de influencia, o que hay una expansión significativa
            fuera del perímetro definido.`;
    }

    // PASO 7: Construir el HTML del reporte
    contenedor.innerHTML = `
        <div style="font-size:12px; color:#333; line-height:1.7;">

            <b style="font-size:13px; color:#2e1f33;">📍 Análisis de contenencia espacial</b>

            <div style="margin-top:10px; padding:10px; background:#f5f5f5;
                        border-radius:6px; border:1px solid #e0e0e0;">
                <b>¿Qué se analizó?</b><br>
                Se evaluó cuántos elementos de la capa <b>${nombreElem}</b>
                (${totalElem} en total) se encuentran geográficamente dentro
                del área definida por la capa <b>${nombrePol}</b>.
            </div>

            <div style="margin-top:10px; padding:10px; background:#e8f5e9;
                        border-radius:6px; border-left:4px solid #4caf50;">
                <b>Dentro del área:</b>
                <span style="font-size:15px; font-weight:bold; color:#2e7d32;">
                    ${dentroCount}
                </span>
                elementos &nbsp;—&nbsp; <b>${pctDentro}%</b> del total
            </div>

            <div style="margin-top:6px; padding:10px; background:#fce4e4;
                        border-radius:6px; border-left:4px solid #e53935;">
                <b>Fuera del área:</b>
                <span style="font-size:15px; font-weight:bold; color:#c62828;">
                    ${fueraDentro}
                </span>
                elementos &nbsp;—&nbsp; <b>${pctFuera}%</b> del total
            </div>

            <div style="margin-top:10px; padding:10px; border-left:4px solid ${mensajeColor};
                        background:#fafafa; border-radius:4px; color:#333;">
                <b>Interpretación:</b><br><br>
                ${mensajeTexto}
            </div>

        </div>
    `;
}

// =============================
// ANÁLISIS EN PALABRAS PARA CAPAS SIN POLÍGONOS
// Se usa cuando ambas capas son puntos, líneas, etc.
// =============================
function generarAnalisisSinPoligonos(geojsonA, nombreA, geojsonB, nombreB, contenedor) {

    var totalA = geojsonA.features ? geojsonA.features.length : 0;
    var totalB = geojsonB.features ? geojsonB.features.length : 0;

    // PASO 1: Detectar años en los nombres
    var anioA = extraerAnio(nombreA);
    var anioB = extraerAnio(nombreB);

    // PASO 2: Calcular diferencia y porcentaje
    var diferencia  = totalB - totalA;
    var difAbsoluta = Math.abs(diferencia);
    var crecio      = diferencia > 0;
    var pctCambio   = totalA > 0
        ? Math.abs(((diferencia / totalA) * 100)).toFixed(1)
        : 0;

    // PASO 3: Definir período temporal
    var periodoTexto    = '';
    var aniosDetectados = anioA && anioB;

    if (aniosDetectados) {
        var anioMenor          = Math.min(parseInt(anioA), parseInt(anioB));
        var anioMayor          = Math.max(parseInt(anioA), parseInt(anioB));
        var aniosTranscurridos = anioMayor - anioMenor;
        periodoTexto = anioMenor + ' y ' + anioMayor +
            ' (' + aniosTranscurridos + ' años)';
    }

    // PASO 4: Icono y color según si creció o bajó
    var iconoCambio  = crecio ? '▲' : '▼';
    var colorCambio  = crecio ? '#2e7d32' : '#b71c1c';
    var palabraCambio = crecio ? 'incremento' : 'reducción';

    // PASO 5: Detectar tema por nombre de capa
    var esConstru = nombreA.toLowerCase().includes('construc') ||
                    nombreB.toLowerCase().includes('construc');
    var esNDBI    = nombreA.toLowerCase().includes('ndbi') ||
                    nombreB.toLowerCase().includes('ndbi');

    var contextoTema = esConstru
        ? 'construcciones nuevas identificadas en el territorio'
        : esNDBI
            ? 'polígonos de cobertura del índice NDBI'
            : 'elementos geográficos registrados';

    // PASO 6: Párrafo 1 — introducción
    var parrafo1 = aniosDetectados
        ? 'Este análisis compara las <b>' + contextoTema + '</b> entre los años ' +
          '<b>' + periodoTexto + '</b>. En el año <b>' + anioA + '</b> se identificaron ' +
          '<b>' + totalA + ' elementos</b>, mientras que en el año <b>' + anioB +
          '</b> se registraron <b>' + totalB + ' elementos</b>.'
        : 'Este análisis compara los <b>' + contextoTema + '</b> entre las capas ' +
          '<b>' + nombreA + '</b> (' + totalA + ' elementos) y ' +
          '<b>' + nombreB + '</b> (' + totalB + ' elementos).';

    // PASO 7: Párrafo 2 — descripción del cambio
    var parrafo2 = diferencia === 0
        ? 'El número de elementos <b>no presentó variación</b> entre ambos períodos, ' +
          'manteniéndose en <b>' + totalA + ' registros</b>. Esto indica que el territorio ' +
          'no experimentó cambios detectables en el tipo de elemento analizado.'
        : 'Se evidencia un <b>' + palabraCambio + ' de ' + difAbsoluta + ' elementos</b>, ' +
          'equivalente a un cambio del <b>' + pctCambio + '%</b> respecto al período base. ' +
          (crecio
              ? 'Este crecimiento refleja una dinámica territorial activa en el área de estudio.'
              : 'Esta disminución puede indicar consolidación, corrección de datos ' +
                'o cambios en el uso del suelo.');

    // PASO 8: Párrafo 3 — interpretación según magnitud
    var pctNum  = parseFloat(pctCambio);
    var parrafo3 = '';

    if (diferencia === 0) {
        parrafo3 = 'La estabilidad registrada sugiere una zona consolidada sin nuevos ' +
            'desarrollos significativos en el período analizado.';
    } else if (pctNum <= 15) {
        parrafo3 = 'El bajo porcentaje de variación (' + pctCambio + '%) indica una ' +
            'dinámica territorial estable, propia de zonas ya consolidadas.';
    } else if (pctNum <= 50) {
        parrafo3 = 'La variación moderada del ' + pctCambio + '% refleja una dinámica ' +
            'territorial activa, frecuente en zonas de expansión urbana progresiva.';
    } else if (pctNum <= 100) {
        parrafo3 = 'El significativo cambio del ' + pctCambio + '% evidencia una marcada ' +
            'dinámica territorial, típica de zonas en expansión urbana acelerada.';
    } else {
        parrafo3 = 'El incremento superior al 100% (' + pctCambio + '%) representa una ' +
            'transformación radical del territorio, indicativa de procesos intensivos ' +
            'de urbanización o cambios estructurales en el uso del suelo.';
    }

    // PASO 9: Recomendación
    var parrafo4 = aniosDetectados
        ? 'Se recomienda cruzar esta información con capas de uso del suelo, ' +
          'normativa urbana y planos catastrales del período entre ' + periodoTexto +
          ', para identificar patrones de ocupación y apoyar decisiones de ' +
          'ordenamiento territorial.'
        : 'Se recomienda complementar con información temporal y capas catastrales ' +
          'adicionales para establecer patrones de cambio territorial.';

    // PASO 10: Construir HTML
    contenedor.innerHTML += '<div style="' +
        'margin-top:14px; padding:12px; background:#f8f9fb; ' +
        'border:1px solid #d6dde6; border-radius:6px; ' +
        'font-size:12px; font-family:Arial,sans-serif; line-height:1.7; color:#333;' +
    '">' +
        '<div style="font-weight:bold; font-size:13px; color:#2e1f33; ' +
            'margin-bottom:10px;">' +
            '📊 Análisis comparativo de elementos' +
        '</div>' +
        '<div style="background:white; border:1px solid #e0e0e0; ' +
            'border-left:4px solid ' + colorCambio + '; border-radius:4px; ' +
            'padding:8px 12px; margin-bottom:10px; font-size:13px; ' +
            'font-weight:bold; color:' + colorCambio + ';">' +
            iconoCambio + ' ' +
            (diferencia === 0
                ? 'Sin variación entre períodos'
                : (crecio ? '+' : '-') + difAbsoluta +
                  ' elementos (' + (crecio ? '+' : '-') + pctCambio + '%)') +
        '</div>' +
        '<p style="margin:0 0 8px 0;">' + parrafo1 + '</p>' +
        '<p style="margin:0 0 8px 0;">' + parrafo2 + '</p>' +
        '<p style="margin:0 0 8px 0;">' + parrafo3 + '</p>' +
        '<p style="margin:0;">'          + parrafo4 + '</p>' +
    '</div>';
}

// =============================
// EXTRAER AÑO DE UN NOMBRE DE CAPA
// =============================
function extraerAnio(nombre) {
    var match = nombre.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
}

// =============================
// LIMPIAR ANÁLISIS
// =============================
function limpiarAnalisis() {

    // PASO 1: Quitar del mapa las capas que activó el análisis
    if (capasActivasAnalisis.izq) {
        var capaIzq = capasLeaflet[capasActivasAnalisis.izq];
        if (capaIzq && map.hasLayer(capaIzq)) {
            map.removeLayer(capaIzq);
        }
        capasActivasAnalisis.izq = null;
    }

    if (capasActivasAnalisis.der) {
        var capaDer = capasLeaflet[capasActivasAnalisis.der];
        if (capaDer && map.hasLayer(capaDer)) {
            map.removeLayer(capaDer);
        }
        capasActivasAnalisis.der = null;
    }

// PASO 2: Destruir gráfica
    if (chartInstancia) {
        chartInstancia.destroy();
        chartInstancia = null;
    }

    // Quitar tabla comparativa si existe
    var tablaAnterior = document.getElementById('tablaComparativa');
    if (tablaAnterior) tablaAnterior.remove();

    // PASO 3: Ocultar el bloque de resultados
    var resultado = document.getElementById('analisisResultado');
    if (resultado) resultado.style.display = 'none';

    // PASO 4: Limpiar texto del reporte
    var reporte = document.getElementById('analisisReporte');
    if (reporte) reporte.innerHTML = '';

    // PASO 5: Resetear los selectores
    var selIzq = document.getElementById('selectAnalisisIzq');
    var selDer = document.getElementById('selectAnalisisDer');
    if (selIzq) selIzq.value = '';
    if (selDer) selDer.value = '';

    // PASO 6: Forzar que los árboles del panel sean visibles
    // El removeLayer() a veces los oculta — esto los restaura sin mover nada
    setTimeout(function () {
        var control = document.querySelector('.leaflet-control-layers');
        if (control) {
            control.style.display = 'block';
            control.style.visibility = 'visible';
            control.style.opacity = '1';
        }

        // Mostrar también todos los hijos directos del árbol
        document.querySelectorAll(
            '.leaflet-layerstree-children'
        ).forEach(function (nodo) {
            // Solo restaurar los de primer nivel (los tres contenedores grandes)
            if (
                nodo.parentElement &&
                nodo.parentElement.classList.contains('leaflet-layerstree-node') &&
                nodo.parentElement.parentElement &&
                nodo.parentElement.parentElement.classList.contains('leaflet-control-layers-overlays')
            ) {
                nodo.style.display = '';
            }
        });

    }, 200);
}
// =============================
// LEYENDA FLOTANTE
// =============================

function toggleLeyenda() {
    var panel = document.getElementById('panelLeyenda');
    if (!panel) return;
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        actualizarLeyenda();
    } else {
        panel.style.display = 'none';
    }
}

// =============================
// ACTUALIZAR CONTENIDO DE LA LEYENDA
// según las capas activas en el mapa
// =============================
function actualizarLeyenda() {
    var body = document.getElementById('panelLeyendaBody');
    if (!body) return;

    // Recopilar capas activas agrupadas
    var grupos = {};
    var orden  = [];

    capasConfig.forEach(function(config) {
        var layer = capasLeaflet[config.key];
        if (!layer || !map.hasLayer(layer)) return;

        var grupo = config.grupo || 'Cartografía base';
        if (!grupos[grupo]) {
            grupos[grupo] = [];
            orden.push(grupo);
        }
        grupos[grupo].push(config);
    });

    if (orden.length === 0) {
        body.innerHTML = '<div class="leyenda-vacia">Sin capas activas</div>';
        return;
    }

    var html = '';

    orden.forEach(function(nombreGrupo) {
        html += '<div class="leyenda-grupo">';
        html += '<div class="leyenda-grupo-titulo">' + nombreGrupo + '</div>';

        grupos[nombreGrupo].forEach(function(config) {
            html += construirItemLeyenda(config);
        });

        html += '</div>';
    });

    body.innerHTML = html;
}

// =============================
// CONSTRUIR ÍTEM DE LEYENDA POR TIPO
// =============================
function construirItemLeyenda(config) {

    var key    = config.key;
    var nombre = config.nombre;

    // NDBI — 4 categorías de color
    if (key.includes('NDBI')) {
        var chips = Object.keys(coloresNDBI).map(function(gc) {
            var c = coloresNDBI[gc];
            return '<div class="leyenda-ndbi-fila">' +
                '<div class="leyenda-ndbi-chip" style="background:' + c.fillColor + ';"></div>' +
                '<span>' + c.label + '</span>' +
            '</div>';
        }).join('');

        return '<div class="leyenda-item" style="flex-direction:column; align-items:flex-start; gap:4px;">' +
            '<span style="font-size:12px; font-weight:bold; color:#2e1f33;">' + nombre + '</span>' +
            '<div class="leyenda-ndbi">' + chips + '</div>' +
        '</div>';
    }

    var estilo = obtenerEstiloPorCapa(key);
    var color  = estilo.fillColor || estilo.color || '#888';
    var borde  = estilo.color || color;

    // Puntos (Construcciones por año)
    if (key.includes('Construcciones 20')) {
        return '<div class="leyenda-item">' +
            '<div class="leyenda-simbolo-punto" style="background:' + color + '; border-color:white;"></div>' +
            '<span>' + nombre + '</span>' +
        '</div>';
    }

    // Líneas (Vías)
    if (key.includes('Vias')) {
        var dashStyle = '';
        return '<div class="leyenda-item">' +
            '<div class="leyenda-simbolo-linea" style="background:' + borde + ';"></div>' +
            '<span>' + nombre + '</span>' +
        '</div>';
    }

    // Polígonos con línea punteada (Cobertura)
    if (key === 'Cobertura') {
        return '<div class="leyenda-item">' +
            '<div class="leyenda-simbolo-poligono" style="' +
                'background:' + (color !== borde ? color : 'transparent') + ';' +
                'border: 2px dashed ' + borde + ';' +
            '"></div>' +
            '<span>' + nombre + '</span>' +
        '</div>';
    }

    // Polígonos normales
    var bgColor = estilo.fillOpacity === 0
        ? 'transparent'
        : color;

    return '<div class="leyenda-item">' +
        '<div class="leyenda-simbolo-poligono" style="' +
            'background:' + bgColor + ';' +
            'border-color:' + borde + ';' +
        '"></div>' +
        '<span>' + nombre + '</span>' +
    '</div>';
}

// =============================
// DRAG — mover la leyenda por el mapa
// =============================
(function() {
    var draggingLeyenda = false;
    var offsetX = 0, offsetY = 0;

    var header = null;

    function initDragLeyenda() {
        header = document.getElementById('panelLeyendaHeader');
        if (!header) return;

        header.addEventListener('mousedown', function(e) {
            if (e.target.id === 'btnCerrarLeyenda') return;

            var panel = document.getElementById('panelLeyenda');
            var rect  = panel.getBoundingClientRect();
            offsetX   = e.clientX - rect.left;
            offsetY   = e.clientY - rect.top;

            draggingLeyenda = true;

            // Desactivar Leaflet para que no interfiera
            map.dragging.disable();
            map.scrollWheelZoom.disable();
            map.doubleClickZoom.disable();

            e.preventDefault();
            e.stopPropagation();
        });
    }

    // Esperar a que el DOM esté listo
    setTimeout(initDragLeyenda, 800);

    document.addEventListener('mousemove', function(e) {
        if (!draggingLeyenda) return;

        var panel   = document.getElementById('panelLeyenda');
        var mapEl   = document.getElementById('map');
        var mapRect = mapEl.getBoundingClientRect();

        var x = e.clientX - mapRect.left - offsetX;
        var y = e.clientY - mapRect.top  - offsetY;

        x = Math.max(0, Math.min(x, mapRect.width  - panel.offsetWidth));
        y = Math.max(0, Math.min(y, mapRect.height - panel.offsetHeight));

        panel.style.left = x + 'px';
        panel.style.top  = y + 'px';

        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mouseup', function() {
        if (!draggingLeyenda) return;
        draggingLeyenda = false;

        // Reactivar Leaflet
        map.dragging.enable();
        map.scrollWheelZoom.enable();
        map.doubleClickZoom.enable();
    });
})();

// =============================
// ZOOM AUTOMÁTICO AL ACTIVAR CAPA
// =============================

// Escuchar cuando cualquier capa se agrega al mapa
map.on('layeradd', function(e) {

    var layer = e.layer;

    // Solo trabajar con capas GeoJSON (evitar base maps y overlays)
    if (!(layer instanceof L.GeoJSON)) return;

    // Buscar qué clave corresponde a esa capa
    var keyEncontrado = null;

    for (var key in capasLeaflet) {
        if (capasLeaflet[key] === layer) {
            keyEncontrado = key;
            break;
        }
    }

    if (!keyEncontrado) return;

    // Validar que tenga geometría válida
    if (typeof layer.getBounds === 'function') {
        var bounds = layer.getBounds();

        if (bounds && bounds.isValid && bounds.isValid()) {

            // Aplicar zoom elegante
            map.fitBounds(bounds, {
                padding: [20, 20],
                maxZoom: 19,
                duration: 0.5  // 👈 suavidad visual
            });
        }
    }
// =====================================
// ABRIR GRUPO AUTOMÁTICAMENTE EN EL ÁRBOL
// =====================================
setTimeout(function () {

    // Buscar el grupo al que pertenece la capa
    var config = capasConfig.find(function(c) {
        return c.key === keyEncontrado;
    });

    if (!config) return;

    // Obtener nombre del grupo
    var nombreGrupo = config.grupo || 'Cartografía base';

    // Buscar todos los nodos del árbol
    document.querySelectorAll('.leaflet-layerstree-node').forEach(function(nodo) {

        var label = nodo.querySelector('.layer-group-header');

        if (!label) return;

        if (label.innerText.trim() === nombreGrupo) {

            var hijos = nodo.querySelector(':scope > .leaflet-layerstree-children');
            var toggle = nodo.querySelector(':scope > .leaflet-layerstree-header .leaflet-layerstree-toggle');

            if (hijos) {
                hijos.style.display = 'block';
            }

            if (toggle && toggle.textContent.trim() === '+') {
                toggle.textContent = '−';
            }
        }
    });

}, 120);

});

// =============================
// TOUR INTRODUCTORIO
// =============================

var tourPasos = [
    {
        icono: '🗺️',
        titulo: 'Bienvenido al Geovisor',
        descripcion: 'Este visor geográfico te permite explorar el territorio del Centro Poblado Hoyorrico. Aquí encontrarás capas temáticas, fotografías aéreas y herramientas de análisis.',
        elemento: null
    },
    {
        icono: '📋',
        titulo: 'Panel de capas',
        descripcion: 'En el panel derecho puedes activar y desactivar las capas geográficas disponibles. También puedes buscar una capa por nombre usando el buscador.',
        elemento: '#panelInferior'
    },
    {
        icono: '⇄',
        titulo: 'Comparar capas',
        descripcion: 'El botón ⇄ activa el comparador. Puedes ver dos capas lado a lado arrastrando el divisor central para comparar cambios en el tiempo.',
        elemento: '.btn-swipe'
    },
    {
        icono: '⏱',
        titulo: 'Línea de tiempo',
        descripcion: 'El botón ⏱ muestra fotografías aéreas de 2010, 2018 y 2025. Arrastra el slider para ver cómo ha cambiado el territorio.',
        elemento: '.btn-timeline'
    },
    {
        icono: '✎',
        titulo: 'Herramientas de dibujo',
        descripcion: 'Con el botón ✎ puedes dibujar polígonos, líneas y puntos sobre el mapa, y medir áreas y distancias directamente.',
        elemento: '.btn-dibujo'
    },
    {
        icono: '▁▃▅',
        titulo: 'Análisis estadístico',
        descripcion: 'El botón de gráfica permite comparar dos capas estadísticamente. Puedes ver cuántos elementos hay dentro de un área, cómo han cambiado y mucho más.',
        elemento: '.btn-analisis'
    },
    {
        icono: '🗺',
        titulo: 'Leyenda',
        descripcion: 'El botón 🗺 muestra la leyenda de las capas activas. Puedes moverla a cualquier parte del mapa arrastrándola desde su encabezado.',
        elemento: '.btn-leyenda'
    },
    {
        icono: '⋮',
        titulo: 'Menú de cada capa',
        descripcion: 'Al abrir una capa en el panel y hacer clic en los tres puntos ⋮, puedes ver la Tabla de atributos o el Dashboard de esa capa específica.',
        elemento: null
    },
    {
        icono: '✅',
        titulo: '¡Listo para explorar!',
        descripcion: 'Ya conoces las herramientas principales. Puedes volver a ver este tour en cualquier momento recargando la página. ¡Explora el territorio!',
        elemento: null
    }
];

var tourPasoActual = 0;
var tourElementoAnterior = null;

function iniciarTour() {
    tourPasoActual = 0;
    mostrarPasoTour(0);
}

function mostrarPasoTour(indice) {
    // Quitar resaltado anterior
    if (tourElementoAnterior) {
        tourElementoAnterior.classList.remove('tour-resaltado');
        tourElementoAnterior = null;
    }

    var paso = tourPasos[indice];
    var overlay = document.getElementById('tourOverlay');
    var card    = document.getElementById('tourCard');

    if (!overlay || !card) return;

    // Mostrar overlay y card
    overlay.style.display = 'flex';
    card.style.display    = 'block';

    // Actualizar puntos de progreso
    document.querySelectorAll('.tour-dot').forEach(function(dot, i) {
        dot.classList.toggle('activo', i <= indice);
    });

    // Actualizar contenido
    document.getElementById('tourIcono').textContent      = paso.icono;
    document.getElementById('tourTitulo').textContent     = paso.titulo;
    document.getElementById('tourDescripcion').textContent = paso.descripcion;

    // Resaltar elemento si existe
    if (paso.elemento) {
        var el = document.querySelector(paso.elemento);
        if (el) {
            el.classList.add('tour-resaltado');
            tourElementoAnterior = el;
        }
    }

    // Posicionar la card
    posicionarCard(paso.elemento);

    // Botón anterior
    var btnAnt = document.getElementById('tourBtnAnterior');
    btnAnt.style.display = indice === 0 ? 'none' : 'block';

    // Botón siguiente / finalizar
    var btnSig = document.getElementById('tourBtnSiguiente');
    btnSig.textContent = indice === tourPasos.length - 1 ? '¡Comenzar! 🚀' : 'Siguiente →';
}

function posicionarCard(selectorElemento) {
    var card = document.getElementById('tourCard');

    // Posición por defecto: centrada
    card.style.top    = '50%';
    card.style.left   = '50%';
    card.style.transform = 'translate(-50%, -50%)';

    if (!selectorElemento) return;

    var el = document.querySelector(selectorElemento);
    if (!el) return;

    var rect    = el.getBoundingClientRect();
    var cardW   = 320;
    var cardH   = 280;
    var margen  = 20;

    var top  = rect.top;
    var left = rect.right + margen;

    // Si se sale por la derecha, poner a la izquierda
    if (left + cardW > window.innerWidth - margen) {
        left = rect.left - cardW - margen;
    }

    // Si se sale por abajo, ajustar
    if (top + cardH > window.innerHeight - margen) {
        top = window.innerHeight - cardH - margen;
    }

    if (top < margen) top = margen;
    if (left < margen) left = margen;

    card.style.top       = top + 'px';
    card.style.left      = left + 'px';
    card.style.transform = 'none';
}

function tourSiguiente() {
    if (tourPasoActual < tourPasos.length - 1) {
        tourPasoActual++;
        mostrarPasoTour(tourPasoActual);
    } else {
        cerrarTour();
    }
}

function tourAnterior() {
    if (tourPasoActual > 0) {
        tourPasoActual--;
        mostrarPasoTour(tourPasoActual);
    }
}

function cerrarTour() {

    if (tourElementoAnterior) {
        tourElementoAnterior.classList.remove('tour-resaltado');
        tourElementoAnterior = null;
    }

    var overlay = document.getElementById('tourOverlay');
    var card    = document.getElementById('tourCard');

    if (overlay) overlay.style.display = 'none';
    if (card)    card.style.display    = 'none';

}

// Iniciar el tour automáticamente al cargar
window.addEventListener('load', function() {
    setTimeout(iniciarTour, 800);
});

// =====================================
// CERRAR TABLA Y DASHBOARD AL DESACTIVAR CAPA
// =====================================

map.on('layerremove', function(e) {

    var layer = e.layer;

    // Buscar la key de esa capa
    var keyRemovida = null;

    for (var key in capasLeaflet) {
        if (capasLeaflet[key] === layer) {
            keyRemovida = key;
            break;
        }
    }

    if (!keyRemovida) return;

    // Verificar si coincide con la capa activa del panel
    if (capaActivaPorMenu && capaActivaPorMenu.key === keyRemovida) {

        // Cerrar tabla de atributos si está abierta
        var tabla = document.getElementById('tablaAtributos');
        if (tabla && tabla.style.display !== 'none') {
            tabla.style.display = 'none';
        }

        // Cerrar dashboard si está abierto
        var dashboard = document.getElementById('dashboard');
        if (dashboard && dashboard.style.display !== 'none') {
            dashboard.style.display = 'none';
        }

        // Limpiar la variable activa
        capaActivaPorMenu = null;
    }

});

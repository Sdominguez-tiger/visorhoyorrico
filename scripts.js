// =============================
// Mapa inicial 
// =============================

var textoBusquedaCapas = '';

// Evita que el zoom automático interfiera con la cámara
var recorridoCinematograficoActivo = false;

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
// ACTIVAR SWIPE HORIZONTAL
// Compatible con ImageOverlay y GeoJSON
// =============================
function activarSwipe(capaLeft, capaRight) {

    desactivarSwipe();

    if (!capaLeft || !capaRight) {
        alert('Debes seleccionar dos capas.');
        return;
    }

    // Agregar las capas al mapa si todavía no están
    if (!map.hasLayer(capaLeft)) capaLeft.addTo(map);
    if (!map.hasLayer(capaRight)) capaRight.addTo(map);

    var mapContainer = map.getContainer();
    var currentY = mapContainer.offsetHeight / 2;

    // Identificar el tipo de capa
    var esImagenIzq = typeof capaLeft.getElement === 'function';
    var esImagenDer = typeof capaRight.getElement === 'function';

    var paneIzq = null;
    var paneDer = null;

    // Crear un pane independiente para la primera capa GeoJSON
    if (!esImagenIzq) {

        if (!map.getPane('swipePaneLeft')) {
            map.createPane('swipePaneLeft');
        }

        paneIzq = map.getPane('swipePaneLeft');
        paneIzq.style.zIndex = 450;
        paneIzq.style.pointerEvents = 'none';

        map.removeLayer(capaLeft);
        capaLeft.options.pane = 'swipePaneLeft';
        capaLeft.addTo(map);
    }

    // Crear un pane independiente para la segunda capa GeoJSON
    if (!esImagenDer) {

        if (!map.getPane('swipePaneRight')) {
            map.createPane('swipePaneRight');
        }

        paneDer = map.getPane('swipePaneRight');
        paneDer.style.zIndex = 451;
        paneDer.style.pointerEvents = 'none';

        map.removeLayer(capaRight);
        capaRight.options.pane = 'swipePaneRight';
        capaRight.addTo(map);
    }

    // =============================
    // CREAR DIVISOR HORIZONTAL
    // =============================

    var divider = document.createElement('div');
    divider.id = 'swipeDivider';

    divider.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        top: ${currentY}px;
        height: 4px;
        background: linear-gradient(to right, #9172b4, #2e1f33);
        cursor: ns-resize;
        z-index: 1000;
        box-shadow: 0 0 8px rgba(0,0,0,0.5);
        pointer-events: auto;
        touch-action: none;
    `;

    // Control circular del divisor
    var handle = document.createElement('div');
    handle.id = 'swipeHandle';

    handle.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 38px;
        height: 38px;
        background: white;
        border-radius: 50%;
        border: 2px solid #9172b4;
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        color: #2e1f33;
        cursor: ns-resize;
        user-select: none;
        pointer-events: auto;
        touch-action: none;
    `;

    handle.innerHTML = '↕';

    divider.appendChild(handle);
    mapContainer.appendChild(divider);

    // =============================
    // RECORTE DE LAS CAPAS
    // =============================

    function updateClip(y) {

        var mapRect = mapContainer.getBoundingClientRect();

        // PRIMERA CAPA: parte superior
        if (esImagenIzq) {

            var elIzq = capaLeft.getElement();

            if (elIzq) {

                var rectIzq = elIzq.getBoundingClientRect();
                var clipYIzq = y - (rectIzq.top - mapRect.top);

                clipYIzq = Math.max(
                    0,
                    Math.min(clipYIzq, rectIzq.height)
                );

                elIzq.style.clip =
                    `rect(0px, ${rectIzq.width}px, ${clipYIzq}px, 0px)`;
            }

        } else if (paneIzq) {

            paneIzq.style.clip =
                `rect(0px, ${mapRect.width}px, ${y}px, 0px)`;
        }

        // SEGUNDA CAPA: parte inferior
        if (esImagenDer) {

            var elDer = capaRight.getElement();

            if (elDer) {

                var rectDer = elDer.getBoundingClientRect();
                var clipYDer = y - (rectDer.top - mapRect.top);

                clipYDer = Math.max(
                    0,
                    Math.min(clipYDer, rectDer.height)
                );

                elDer.style.clip =
                    `rect(${clipYDer}px, ${rectDer.width}px, ${rectDer.height}px, 0px)`;
            }

        } else if (paneDer) {

            paneDer.style.clip =
                `rect(${y}px, ${mapRect.width}px, ${mapRect.height}px, 0px)`;
        }
    }

    updateClip(currentY);

    // Actualizar el recorte cuando cambia la vista del mapa
    function onMapMove() {
        updateClip(currentY);
    }

    map.on('move zoom moveend zoomend', onMapMove);

   // =============================
// ARRASTRE EXCLUSIVO DEL DIVISOR
// Solo inicia con clic izquierdo sobre la línea
// =============================

var dragging = false;
var pointerActivo = null;

var teniaArrastreMapa = map.dragging.enabled();
var teniaZoomRueda = map.scrollWheelZoom.enabled();

function iniciarArrastre(e) {

    // Aceptar únicamente el botón izquierdo del mouse
    if (e.button !== 0) return;

    // Verificar que el clic sea sobre la línea o el control circular
    if (
        e.target !== divider &&
        !handle.contains(e.target)
    ) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    dragging = true;
    pointerActivo = e.pointerId;

    // Capturar el puntero para que el arrastre
    // continúe asociado exclusivamente al divisor
    divider.setPointerCapture(e.pointerId);

    map.dragging.disable();
    map.scrollWheelZoom.disable();

    handle.style.boxShadow =
        '0 2px 16px rgba(145,114,180,0.7)';
}

function moverDivisor(e) {

    // No mover si no se inició el arrastre
    if (!dragging) return;

    // Verificar que sea el mismo puntero que inició el movimiento
    if (e.pointerId !== pointerActivo) return;

    e.preventDefault();
    e.stopPropagation();

    var mapRect = mapContainer.getBoundingClientRect();

    var y = e.clientY - mapRect.top;

    y = Math.max(0, Math.min(y, mapRect.height));

    currentY = y;

    divider.style.top = y + 'px';

    updateClip(y);
}

function finalizarArrastre(e) {

    if (!dragging) return;

    if (
        e &&
        e.pointerId !== undefined &&
        e.pointerId !== pointerActivo
    ) return;

    dragging = false;

    // Liberar la captura del puntero
    if (
        pointerActivo !== null &&
        divider.hasPointerCapture(pointerActivo)
    ) {
        divider.releasePointerCapture(pointerActivo);
    }

    pointerActivo = null;

    // Restaurar el movimiento normal del mapa
    if (teniaArrastreMapa) {
        map.dragging.enable();
    }

    if (teniaZoomRueda) {
        map.scrollWheelZoom.enable();
    }

    handle.style.boxShadow =
        '0 2px 10px rgba(0,0,0,0.35)';
}

// Los tres eventos quedan asociados al divisor,
// no a toda la ventana
divider.addEventListener('pointerdown', iniciarArrastre);
divider.addEventListener('pointermove', moverDivisor);
divider.addEventListener('pointerup', finalizarArrastre);
divider.addEventListener('pointercancel', finalizarArrastre);
divider.addEventListener('lostpointercapture', finalizarArrastre);


    // =============================
    // GUARDAR REFERENCIAS
    // =============================

    swipeControl = {
        divider: divider,
        leftLayer: capaLeft,
        rightLayer: capaRight,
        paneIzq: paneIzq,
        paneDer: paneDer,
        esImagenIzq: esImagenIzq,
        esImagenDer: esImagenDer,
        onMapMove: onMapMove,

        iniciarArrastre: iniciarArrastre,
        moverDivisor: moverDivisor,
        finalizarArrastre: finalizarArrastre,

        teniaArrastreMapa: teniaArrastreMapa,
        teniaZoomRueda: teniaZoomRueda
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
// DESACTIVAR SWIPE HORIZONTAL
// =============================
function desactivarSwipe() {

    if (!swipeControl) return;

    // 1. Finalizar un posible arrastre
    if (swipeControl.finalizarArrastre) {
        swipeControl.finalizarArrastre();
    }

    // 2. Retirar los eventos del divisor
swipeControl.divider.removeEventListener(
    'pointerdown',
    swipeControl.iniciarArrastre
);

swipeControl.divider.removeEventListener(
    'pointermove',
    swipeControl.moverDivisor
);

swipeControl.divider.removeEventListener(
    'pointerup',
    swipeControl.finalizarArrastre
);

swipeControl.divider.removeEventListener(
    'pointercancel',
    swipeControl.finalizarArrastre
);

swipeControl.divider.removeEventListener(
    'lostpointercapture',
    swipeControl.finalizarArrastre
);

    // 3. Retirar el divisor
    if (
        swipeControl.divider &&
        swipeControl.divider.parentNode
    ) {
        swipeControl.divider.parentNode.removeChild(
            swipeControl.divider
        );
    }

    // 4. Restaurar la primera imagen
    if (swipeControl.esImagenIzq && swipeControl.leftLayer) {

        var elIzq = swipeControl.leftLayer.getElement
            ? swipeControl.leftLayer.getElement()
            : null;

        if (elIzq) {
            elIzq.style.clip = '';
            elIzq.style.clipPath = '';
        }
    }

    // 5. Restaurar la segunda imagen
    if (swipeControl.esImagenDer && swipeControl.rightLayer) {

        var elDer = swipeControl.rightLayer.getElement
            ? swipeControl.rightLayer.getElement()
            : null;

        if (elDer) {
            elDer.style.clip = '';
            elDer.style.clipPath = '';
        }
    }

    // 6. Restaurar la primera capa GeoJSON
    if (swipeControl.paneIzq) {

        swipeControl.paneIzq.style.clip = '';

        if (
            swipeControl.leftLayer &&
            map.hasLayer(swipeControl.leftLayer)
        ) {
            map.removeLayer(swipeControl.leftLayer);

            swipeControl.leftLayer.options.pane = 'overlayPane';

            swipeControl.leftLayer.addTo(map);
        }
    }

    // 7. Restaurar la segunda capa GeoJSON
    if (swipeControl.paneDer) {

        swipeControl.paneDer.style.clip = '';

        if (
            swipeControl.rightLayer &&
            map.hasLayer(swipeControl.rightLayer)
        ) {
            map.removeLayer(swipeControl.rightLayer);

            swipeControl.rightLayer.options.pane = 'overlayPane';

            swipeControl.rightLayer.addTo(map);
        }
    }

    // 8. Retirar capas de imagen del mapa
    if (
        !swipeControl.paneIzq &&
        swipeControl.leftLayer &&
        map.hasLayer(swipeControl.leftLayer)
    ) {
        map.removeLayer(swipeControl.leftLayer);
    }

    if (
        !swipeControl.paneDer &&
        swipeControl.rightLayer &&
        map.hasLayer(swipeControl.rightLayer)
    ) {
        map.removeLayer(swipeControl.rightLayer);
    }

    // 9. Desconectar eventos del mapa
    if (swipeControl.onMapMove) {
        map.off(
            'move zoom moveend zoomend',
            swipeControl.onMapMove
        );
    }

    // 10. Limpiar la variable
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
    { key: 'Troncal de Occidente', nombre: 'Troncal de Occidente', url: 'data/Troncal_Occidente.json' },
    { key: 'Fuentes hidricas del centro poblado', nombre: 'Fuentes hidricas del centro poblado', url: 'data/Fuentes_Hidricas_CP.json' },
    
    // ===== AÑO 2010 =====
    { key: 'Construcciones 2010', nombre: 'Contrucciones nuevas año 2010', url: 'data/Identificacion_construcciones_2010.json', grupo: 'Cartografía Año 2010' },
    { key: 'NDBI 2010', nombre: 'NDBI 2010', url: 'data/NDBI_2010.json', grupo: 'Cartografía Año 2010' },
    { key: 'Suelo Expansión 2010', nombre: 'Suelo expansión 2010', url:'data/Suelo_Expansion_2010.json', grupo: 'Cartografía Año 2010' },

    // ===== AÑO 2018 =====
    { key: 'Construcciones 2018', nombre: 'Contrucciones nuevas año 2018', url: 'data/Identificacion_construcciones_2018.json', grupo: 'Cartografía Año 2018' },
    { key: 'Suelo Expansión 2018', nombre: 'Suelo Expansión 2018', url:'data/Suelo_Expansion_2018.json', grupo: 'Cartografía Año 2018' },
    { key: 'NDBI 2018', nombre: 'NDBI 2018', url: 'data/NDBI_2018.json', grupo: 'Cartografía Año 2018' },
   
    // ===== AÑO 2025 =====
    { key: 'Construcciones 2025', nombre: 'Contrucciones nuevas año 2025', url: 'data/Identificacion_construcciones_2025.json', grupo: 'Cartografía Año 2025' },
    { key: 'Cobertura', nombre: 'Area de estudio', url: 'data/Cobertura_330m.json', grupo: 'Cartografía Año 2025' },
    { key: 'Suelo Expansión 2025', nombre: 'Suelo expansión 2025', url: 'data/Suelo_Expansion_2025.json', grupo: 'Cartografía Año 2025' },
    { key: 'NDBI 2025', nombre: 'NDBI 2025', url: 'data/NDBI_2025.json', grupo: 'Cartografía Año 2025' },
    { key: 'Vias identificadas del centro poblado', nombre: 'Vias identificadas del centro poblado', url: 'data/Vias_C_P_Identificadas.json', grupo: 'Cartografía Año 2025' },
    
    // ===== Proyyeccion 2032 =====
     { key: 'Suelo Expansión 2032', nombre: 'Suelo Expansión 2032', url: 'data/Suelo_Expansion_2032.json', grupo: 'Proyección Año 2032' },
    
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

         'Fuentes hidricas del centro poblado': {
            color: 'rgb(115, 223, 225)',
            weight: 3,
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
    
        'Suelo Expansión 2032': {
            color: 'rgb(225, 0, 0)',
            weight: 1,
            fillOpacity: 0.3
        },

        'Suelo Expansión 2025': {
            color: 'rgb(225, 85, 0)',
            weight: 1,
            fillOpacity: 0.3
        },

        'Suelo Expansión 2018': {
            color: 'rgb(197, 0, 225)',
            weight: 1,
            fillOpacity: 0.3
        },

        'Suelo Expansión 2010': {
            color: 'rgb(0, 112, 255)',
            weight: 1,
            fillOpacity: 0.3
        },

        'Terrenos Hoyorrico': {
            color: '#e58f1e',
            weight: .5,
            fillOpacity: 0.0
        },

         'Vias centro poblado': {
            color: '#eb4040',
            weight: 2,
            fillOpacity: 0.0
        },

         'Vias identificadas del centro poblado': {
            color: '#7bff00',
            weight: 2,
            fillOpacity: 0.0
        },

         'Troncal de Occidente': {
            color: '#ff0000',
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

    capasDelGrupo.sort(function(a, b) {

    var textoA = a.label
        .replace(/<[^>]*>/g, '')
        .trim()
        .toLowerCase();

    var textoB = b.label
        .replace(/<[^>]*>/g, '')
        .trim()
        .toLowerCase();

    return textoA.localeCompare(textoB, 'es');
});
``

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
.concat([
    {
        label: `
            <div class="layer-group-header">
                Personalizar simbología y descargar
            </div>
        `,
        collapsed: true,
        selectAllCheckbox: false,
        children: [
            {
                label: `
                    <div id="editorSimbologia">

                        <label for="selectorCapaEstilo">
                            Seleccionar capa
                        </label>

                        <select id="selectorCapaEstilo">
                            <option value="">
                                Selecciona una capa...
                            </option>
                        </select>

                        <label for="colorRelleno">
                            Color de relleno
                        </label>
                        <input type="color"
                               id="colorRelleno"
                               value="#3388ff">

                        <label for="colorBorde">
                            Color del contorno
                        </label>
                        <input type="color"
                               id="colorBorde"
                               value="#333333">

                        <label for="grosorBorde">
                            Grosor del borde
                        </label>
                        <input type="range"
                               id="grosorBorde"
                               min="0.5" max="8"
                               step="0.5" value="2">

                        <label for="tamanoPunto">
                            Tamaño del marcador
                        </label>
                        <input type="range"
                               id="tamanoPunto"
                               min="2" max="20"
                               step="1" value="4">

                        <button type="button"
                                id="btnDescargarSHP">
                            📥 Descargar capa SHP
                        </button>

                        <div id="estadoPersonalizar"></div>

                    </div>
                `
            }
        ]
    }
])
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

// Identificar exclusivamente el encabezado Capas geograficas
setTimeout(function() {
    marcarEncabezadoCapasGeograficas();
}, 150);

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
    // Inicializar selector y descarga SHP
inicializarEditorSHP();
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



/* =========================================
   PANEL DEL RECORRIDO DEL DRON
   ========================================= */

// Exponer la función globalmente para que el botón
// onclick="togglePanelRecorrido()" pueda ejecutarla.
window.togglePanelRecorrido = function () {

    var panel = document.getElementById('recorridoControl');
    var estado = document.getElementById('recorridoEstado');

    // Verificar que el panel exista en index.html.
    if (!panel) {
        console.error(
            'Recorrido: no se encontró el elemento #recorridoControl.'
        );
        return;
    }

    // Comprobar si el panel está oculto.
    var estaOculto =
        window.getComputedStyle(panel).display === 'none';

    if (estaOculto) {

        // Abrir el panel sin bloquearlo por el comparador.
        panel.style.display = 'block';
        panel.style.visibility = 'visible';
        panel.style.opacity = '1';
        panel.style.zIndex = '2000';

        if (estado) {
            estado.textContent = 'Preparado para iniciar';
        }

        console.log('Recorrido: panel abierto.');

    } else {

        // Cerrar únicamente el panel del recorrido.
        panel.style.display = 'none';

        console.log('Recorrido: panel cerrado.');
    }
};


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

    if (
    key.includes("Vias") ||
    key.includes("Troncal") ||
    key.includes("Fuentes")
) {
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


// PASO 3: Generar interpretación actual
generarReporte(
    nombreIzq,
    statsIzq,
    nombreDer,
    statsDer,
    datosIzq,
    datosDer
);

// PASO 4: Conservar toda la información del análisis
var centroMapa = map.getCenter();

analisisActualReporte = {

    // Identificación de las capas
    keyIzq: keyIzq,
    keyDer: keyDer,

    nombreIzq: nombreIzq,
    nombreDer: nombreDer,

    // Resultados estadísticos
    statsIzq: statsIzq,
    statsDer: statsDer,

    // Datos geográficos originales
    datosIzq: datosIzq,
    datosDer: datosDer,

    // Colores de las capas
    colorIzq: colorIzq,
    colorDer: colorDer,

    // Información de la vista cartográfica
    vistaMapa: {
        lat: centroMapa.lat,
        lng: centroMapa.lng,
        zoom: map.getZoom()
    },

    fecha: new Date()
};

// Mostrar resultados
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


 // =============================
 // ZOOM AUTOMÁTICO AL ACTIVAR CAPA
 // Sin forzar la apertura de los grupos
 // =============================

map.on('layeradd', function(e) {

    var layer = e.layer;

    // Durante el recorrido cinematográfico,
    // la cámara controla el movimiento del mapa.
    if (recorridoCinematograficoActivo) return;

    // Procesar únicamente capas GeoJSON.
    if (!(layer instanceof L.GeoJSON)) return;

    // Comprobar que la capa pertenece al catálogo del geovisor.
    var capaRegistrada = false;

    for (var key in capasLeaflet) {
        if (capasLeaflet[key] === layer) {
            capaRegistrada = true;
            break;
        }
    }

    if (!capaRegistrada) return;

    // Acercar el mapa a la extensión de la capa.
    if (typeof layer.getBounds === 'function') {

        var bounds = layer.getBounds();

        if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [20, 20],
                maxZoom: 19,
                duration: 0.5
            });
        }
    }

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
    icono: '🎥',
    titulo: 'Recorrido territorial en modo video',
    descripcion: 'El botón del dron abre el panel de recorrido territorial. Pulsa Reproducir para realizar un recorrido automático por los sectores de Hoyorrico y observar las construcciones de 2010, 2018 y 2025. Puedes pausar, reanudar o reiniciar el recorrido con sus controles.',
    elemento: '.btn-recorrido'
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
    
    // Actualizar el icono de la introducción
    var iconoTour = document.getElementById('tourIcono');

    if (paso.elemento === '.btn-recorrido') {
        // Dron SVG con el mismo estilo del botón lateral
        iconoTour.innerHTML = `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="42"
                height="42"
                fill="none"
                stroke="#2e1f33"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                aria-label="Dron">

                <!-- Brazos -->
                <path d="M9 10 5.5 6.5"/>
                <path d="M15 10 18.5 6.5"/>
                <path d="M9 14 5.5 17.5"/>
                <path d="M15 14 18.5 17.5"/>

                <!-- Hélices -->
                <path d="M2.5 5h5"/>
                <path d="M16.5 5h5"/>
                <path d="M2.5 19h5"/>
                <path d="M16.5 19h5"/>

                <!-- Cuerpo del dron -->
                <rect x="8.5" y="9" width="7" height="6" rx="2"/>

                <!-- Cámara del dron -->
                <circle cx="12" cy="12" r="1"/>
            </svg>
        `;
    } else {
        // Mantener los iconos originales de los demás pasos
        iconoTour.textContent = paso.icono;
    }

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

// =====================================================
// RECORRIDO CINEMATOGRAFICO CONTINUO DE HOYORRICO
// =====================================================

// Estado general del vuelo
var recorridoTerritorial = {
    activo: false,
    pausado: false,

    // Posición actual dentro de la trayectoria
    progreso: 0,

    // Identificador de la animación continua
    animacionFrame: null,

    // Momento en que comenzó o se reanudó
    tiempoInicio: null,

    // Tiempo acumulado antes de una pausa
    tiempoAcumulado: 0,

    // Duración total del vuelo en milisegundos
    duracionTotal: 70000,

    // Control del cambio de años
    intervaloAnios: null,
    indiceAnio: 0,
    anioActual: '2010',

    // Trayectoria calculada
    trayectoria: []
};


// Capas temporales que ya existen en capasLeaflet
var capasRecorrido = {
    '2010': 'Construcciones 2010',
    '2018': 'Construcciones 2018',
    '2025': 'Construcciones 2025'
};


// Secuencia temporal
var secuenciaAniosVuelo = [
    '2010',
    '2018',
    '2025'
];


// =====================================================
// ACTUALIZAR TEXTO DEL PANEL
// =====================================================

function actualizarEstadoRecorrido(mensaje, anio) {

    var estado =
        document.getElementById('recorridoEstado');

    if (!estado) return;

    if (anio) {
        estado.textContent =
            'Año ' + anio + ' - ' + mensaje;
    } else {
        estado.textContent = mensaje;
    }
}


// =====================================================
// OBTENER LOS LIMITES REALES DE LA ZONA DE ESTUDIO
// =====================================================

function obtenerLimitesVuelo() {

    var limitesVuelo = null;

    // Primero usar la extensión conjunta de las construcciones
    var capasLimites = [
        'Construcciones 2010',
        'Construcciones 2018',
        'Construcciones 2025'
    ];

    capasLimites.forEach(function(key) {

        var capa = capasLeaflet[key];

        if (
            !capa ||
            typeof capa.getBounds !== 'function'
        ) {
            return;
        }

        var limitesCapa = capa.getBounds();

        if (
            !limitesCapa ||
            !limitesCapa.isValid ||
            !limitesCapa.isValid()
        ) {
            return;
        }

        if (!limitesVuelo) {

            limitesVuelo = L.latLngBounds(
                limitesCapa.getSouthWest(),
                limitesCapa.getNorthEast()
            );

        } else {

            limitesVuelo.extend(limitesCapa);
        }
    });

    // Respaldo: usar la extensión de la imagen georreferenciada
    if (!limitesVuelo && foto2025) {
        limitesVuelo = foto2025.getBounds();
    }

    // Respaldo final: usar coordenadas conocidas
    if (!limitesVuelo) {
        limitesVuelo = L.latLngBounds(
            [6.597718, -75.437810],
            [6.611834, -75.416758]
        );
    }

    return limitesVuelo;
}


// =====================================================
// AGREGAR PUNTOS INTERMEDIOS A UNA FRANJA
// Cuantos más puntos se generen, más continuo será el vuelo
// =====================================================

function agregarFranjaVuelo(
    trayectoria,
    latitudInicial,
    longitudInicial,
    latitudFinal,
    longitudFinal,
    cantidadPuntos
) {

    for (
        var i = 0;
        i < cantidadPuntos;
        i++
    ) {

        var proporcion =
            i / (cantidadPuntos - 1);

        var latitud =
            latitudInicial +
            (
                latitudFinal -
                latitudInicial
            ) * proporcion;

        var longitud =
            longitudInicial +
            (
                longitudFinal -
                longitudInicial
            ) * proporcion;

        trayectoria.push(
            L.latLng(latitud, longitud)
        );
    }
}


// =====================================================
// CONSTRUIR EL VUELO TIPO BUMERAN
// Empieza en el costado oriental y avanza hacia el occidente
// La primera franja comienza en el sur y avanza hacia el norte
// =====================================================

function construirTrayectoriaBumeran() {

    var limites = obtenerLimitesVuelo();

    if (
        !limites ||
        !limites.isValid ||
        !limites.isValid()
    ) {
        return [];
    }

    var norte = limites.getNorth();
    var sur = limites.getSouth();
    var oeste = limites.getWest();
    var este = limites.getEast();

    // Reducir un poco los bordes para que la cámara
    // permanezca dentro de la zona de estudio
    var margenLatitud =
        (norte - sur) * 0.10;

    var margenLongitud =
        (este - oeste) * 0.08;

    norte = norte - margenLatitud;
    sur = sur + margenLatitud;
    oeste = oeste + margenLongitud;
    este = este - margenLongitud;

    var trayectoria = [];

    // Cantidad de franjas desde occidente hacia oriente
    var cantidadFranjas = 7;

    // Cantidad de posiciones intermedias por cada franja
    var puntosPorFranja = 90;

    var separacionHorizontal =
        (este - oeste) /
        (cantidadFranjas - 1);

    for (
    var franja = 0;
    franja < cantidadFranjas;
    franja++
) {

    // El recorrido comienza en el costado oriental
    // y avanza progresivamente hacia el occidente
    var longitudActual =
        este -
        separacionHorizontal * franja;

    var siguienteLongitud =
        franja < cantidadFranjas - 1
            ? este -
              separacionHorizontal *
              (franja + 1)
            : longitudActual;

// Franjas pares: comenzar desde el SUR y avanzar hacia el NORTE
// La primera franja empieza abajo y sube por el territorio
if (franja % 2 === 0) {

    agregarFranjaVuelo(
        trayectoria,
        sur,
        longitudActual,
        norte,
        longitudActual,
        puntosPorFranja
    );

    // Al llegar al norte, avanzar hacia la siguiente franja
    if (franja < cantidadFranjas - 1) {

        agregarFranjaVuelo(
            trayectoria,
            norte,
            longitudActual,
            norte,
            siguienteLongitud,
            35
        );
    }

} else {

    // Franjas impares: regresar desde el NORTE hacia el SUR
    agregarFranjaVuelo(
        trayectoria,
        norte,
        longitudActual,
        sur,
        longitudActual,
        puntosPorFranja
    );

    // Al llegar al sur, avanzar hacia la siguiente franja
    if (franja < cantidadFranjas - 1) {

        agregarFranjaVuelo(
            trayectoria,
            sur,
            longitudActual,
            sur,
            siguienteLongitud,
            35
        );
    }
}

    }

    return trayectoria;
}

// =====================================================
// MOSTRAR LAS CONSTRUCCIONES DE FORMA ACUMULATIVA
//
// 2010: se muestra Construcciones 2010
// 2018: permanecen 2010 y se agrega 2018
// 2025: permanecen 2010 y 2018, y se agrega 2025
// =====================================================

function mostrarAnioRecorrido(anio) {

    var capa2010 =
        capasLeaflet['Construcciones 2010'];

    var capa2018 =
        capasLeaflet['Construcciones 2018'];

    var capa2025 =
        capasLeaflet['Construcciones 2025'];

    // Primera etapa: mostrar únicamente 2010
    if (anio === '2010') {

        if (
            capa2010 &&
            !map.hasLayer(capa2010)
        ) {
            capa2010.addTo(map);
        }
    }

    // Segunda etapa: conservar 2010 y agregar 2018
    if (anio === '2018') {

        if (
            capa2010 &&
            !map.hasLayer(capa2010)
        ) {
            capa2010.addTo(map);
        }

        if (
            capa2018 &&
            !map.hasLayer(capa2018)
        ) {
            capa2018.addTo(map);
        }
    }

    // Tercera etapa: conservar 2010 y 2018, y agregar 2025
    if (anio === '2025') {

        if (
            capa2010 &&
            !map.hasLayer(capa2010)
        ) {
            capa2010.addTo(map);
        }

        if (
            capa2018 &&
            !map.hasLayer(capa2018)
        ) {
            capa2018.addTo(map);
        }

        if (
            capa2025 &&
            !map.hasLayer(capa2025)
        ) {
            capa2025.addTo(map);
        }
    }

    // Sincronizar el slider temporal existente
    var slider =
        document.getElementById('timelineSlider');

    if (slider) {

        if (anio === '2010') {
            slider.value = 0;
        }

        if (anio === '2018') {
            slider.value = 1;
        }

        if (anio === '2025') {
            slider.value = 2;
        }
    }
}


// =====================================================
// CAMBIAR AL SIGUIENTE AÑO Y ACUMULAR LAS CONSTRUCCIONES
// =====================================================

function mostrarSiguienteAnioVuelo() {

    if (
        !recorridoTerritorial.activo ||
        recorridoTerritorial.pausado
    ) {
        return;
    }

    var anio =
        secuenciaAniosVuelo[
            recorridoTerritorial.indiceAnio
        ];

    // Cuando la secuencia vuelve a 2010,
    // quitar únicamente las tres capas de construcciones.
    // Las vías permanecen visibles.
    if (
        anio === '2010' &&
        recorridoTerritorial.indiceAnio === 0
    ) {

        var capasConstruccionesTemporales = [
            'Construcciones 2010',
            'Construcciones 2018',
            'Construcciones 2025'
        ];

        capasConstruccionesTemporales.forEach(
            function(keyConstruccion) {

                var capaConstruccion =
                    capasLeaflet[keyConstruccion];

                if (
                    capaConstruccion &&
                    map.hasLayer(capaConstruccion)
                ) {
                    map.removeLayer(capaConstruccion);
                }
            }
        );
    }

    recorridoTerritorial.anioActual = anio;

    // Encender las construcciones de forma acumulativa
    mostrarAnioRecorrido(anio);

    // Mensaje mostrado en el panel
    var mensajeAcumulacion = '';

    if (anio === '2010') {

        mensajeAcumulacion =
            'Unidades construidas representadas en 2010';
    }

    if (anio === '2018') {

        mensajeAcumulacion =
            'Acumulación visual de construcciones: 2010 + 2018';
    }

    if (anio === '2025') {

        mensajeAcumulacion =
            'Acumulación visual de construcciones: 2010 + 2018 + 2025';
    }

    actualizarEstadoRecorrido(
        mensajeAcumulacion,
        anio
    );

    // Avanzar al siguiente año
    recorridoTerritorial.indiceAnio++;

    // Después de 2025, volver a comenzar en 2010
    if (
        recorridoTerritorial.indiceAnio >=
        secuenciaAniosVuelo.length
    ) {
        recorridoTerritorial.indiceAnio = 0;
    }
}


// =====================================================
// INICIAR EL CAMBIO AUTOMATICO DE AÑOS
// =====================================================

function iniciarCicloTemporalVuelo() {

    detenerCicloTemporalVuelo();

    // Mostrar inmediatamente el año actual
    mostrarSiguienteAnioVuelo();

    // Cambiar los puntos cada cinco segundos
    recorridoTerritorial.intervaloAnios =
        setInterval(function() {

            mostrarSiguienteAnioVuelo();

        }, 3000);
}


// =====================================================
// DETENER EL CAMBIO AUTOMATICO DE AÑOS
// =====================================================

function detenerCicloTemporalVuelo() {

    if (
        recorridoTerritorial.intervaloAnios !== null
    ) {

        clearInterval(
            recorridoTerritorial.intervaloAnios
        );

        recorridoTerritorial.intervaloAnios = null;
    }
}


// =====================================================
// INTERPOLAR ENTRE DOS POSICIONES CONSECUTIVAS
// =====================================================

function obtenerPosicionTrayectoria(progreso) {

    var trayectoria =
        recorridoTerritorial.trayectoria;

    if (!trayectoria.length) {
        return null;
    }

    // Convertir progreso de 0 a 1 en índice de trayectoria
    var posicionExacta =
        progreso * (trayectoria.length - 1);

    var indiceAnterior =
        Math.floor(posicionExacta);

    var indiceSiguiente =
        Math.min(
            indiceAnterior + 1,
            trayectoria.length - 1
        );

    var proporcion =
        posicionExacta - indiceAnterior;

    var puntoAnterior =
        trayectoria[indiceAnterior];

    var puntoSiguiente =
        trayectoria[indiceSiguiente];

    var latitud =
        puntoAnterior.lat +
        (
            puntoSiguiente.lat -
            puntoAnterior.lat
        ) * proporcion;

    var longitud =
        puntoAnterior.lng +
        (
            puntoSiguiente.lng -
            puntoAnterior.lng
        ) * proporcion;

    return L.latLng(latitud, longitud);
}


// =====================================================
// ANIMACION CONTINUA DE LA CAMARA
// =====================================================

function animarCamaraTerritorial(tiempoActual) {

    if (
        !recorridoTerritorial.activo ||
        recorridoTerritorial.pausado
    ) {
        return;
    }

    if (
        recorridoTerritorial.tiempoInicio === null
    ) {
        recorridoTerritorial.tiempoInicio =
            tiempoActual;
    }

    var tiempoTranscurrido =
        recorridoTerritorial.tiempoAcumulado +
        (
            tiempoActual -
            recorridoTerritorial.tiempoInicio
        );

    var progreso =
        tiempoTranscurrido /
        recorridoTerritorial.duracionTotal;

    progreso = Math.max(
        0,
        Math.min(progreso, 1)
    );

    recorridoTerritorial.progreso = progreso;

    var posicionActual =
        obtenerPosicionTrayectoria(progreso);

    if (posicionActual) {

        // setView sin animación individual:
        // requestAnimationFrame genera el movimiento continuo
        map.setView(
            posicionActual,
            18,
            {
                animate: false,
                reset: false
            }
        );
    }

    if (progreso < 1) {

        recorridoTerritorial.animacionFrame =
            requestAnimationFrame(
                animarCamaraTerritorial
            );

    } else {

        finalizarRecorridoTerritorial();
    }
}


// =====================================================
// INICIAR EL VUELO
// =====================================================

function iniciarRecorridoTerritorial() {

    if (swipeControl !== null) {

        alert(
            'Desactiva primero la comparación de capas.'
        );

        return;
    }

    var capasFaltantes = [];

    Object.keys(capasRecorrido).forEach(
        function(anio) {

            var key = capasRecorrido[anio];

            if (!capasLeaflet[key]) {
                capasFaltantes.push(key);
            }
        }
    );

    if (capasFaltantes.length > 0) {

        alert(
            'Las capas temporales todavía están cargando. ' +
            'Espera unos segundos y vuelve a intentarlo.'
        );

        return;
    }

    recorridoTerritorial.trayectoria =
        construirTrayectoriaBumeran();

    if (
        recorridoTerritorial.trayectoria.length === 0
    ) {

        alert(
            'No fue posible calcular la trayectoria del vuelo.'
        );

        return;
    }

    map.stop();

    detenerCicloTemporalVuelo();

    if (
        recorridoTerritorial.animacionFrame !== null
    ) {

        cancelAnimationFrame(
            recorridoTerritorial.animacionFrame
        );
    }

    recorridoTerritorial.activo = true;
    recorridoTerritorial.pausado = false;
    recorridoTerritorial.progreso = 0;
    recorridoTerritorial.tiempoInicio = null;
    recorridoTerritorial.tiempoAcumulado = 0;
    recorridoTerritorial.indiceAnio = 0;
    recorridoTerritorial.anioActual = '2010';

    recorridoCinematograficoActivo = true;

// =====================================================
// MANTENER VISIBLES LAS DOS CAPAS VIALES DURANTE EL VUELO
// =====================================================

var capasVialesRecorrido = [
    'Vias centro poblado',
    'Vias identificadas del centro poblado'
];

capasVialesRecorrido.forEach(function(keyVia) {

    var capaVia = capasLeaflet[keyVia];

    if (
        capaVia &&
        !map.hasLayer(capaVia)
    ) {
        capaVia.addTo(map);
    }
});


    var botonReproducir =
        document.getElementById(
            'btnIniciarRecorrido'
        );

    var botonPausar =
        document.getElementById(
            'btnPausarRecorrido'
        );

    if (botonReproducir) {
        botonReproducir.disabled = true;
    }

    if (botonPausar) {
        botonPausar.disabled = false;
        botonPausar.textContent = '⏸ Pausar';
        botonPausar.classList.remove(
            'recorrido-pausado'
        );
    }

      // Mostrar 2010 e iniciar cambios temporales
    iniciarCicloTemporalVuelo();

    actualizarEstadoRecorrido(
    'Iniciando vuelo desde el costado oriental',
    '2010'
    );

    recorridoTerritorial.animacionFrame =
        requestAnimationFrame(
            animarCamaraTerritorial
        );
}


// =====================================================
// PAUSAR EL VUELO
// =====================================================

function pausarRecorridoTerritorial() {

    if (
        !recorridoTerritorial.activo ||
        recorridoTerritorial.pausado
    ) {
        return;
    }

    recorridoTerritorial.pausado = true;

    detenerCicloTemporalVuelo();

    if (
        recorridoTerritorial.animacionFrame !== null
    ) {

        cancelAnimationFrame(
            recorridoTerritorial.animacionFrame
        );

        recorridoTerritorial.animacionFrame = null;
    }

    // Guardar el tiempo recorrido hasta la pausa
    recorridoTerritorial.tiempoAcumulado =
        recorridoTerritorial.progreso *
        recorridoTerritorial.duracionTotal;

    recorridoTerritorial.tiempoInicio = null;

    var botonPausar =
        document.getElementById(
            'btnPausarRecorrido'
        );

    if (botonPausar) {
        botonPausar.textContent =
            '▶ Reanudar';

        botonPausar.classList.add(
            'recorrido-pausado'
        );
    }

    actualizarEstadoRecorrido(
        'Recorrido pausado en la vista actual',
        recorridoTerritorial.anioActual
    );
}


// =====================================================
// REANUDAR EL VUELO
// =====================================================

function reanudarRecorridoTerritorial() {

    if (
        !recorridoTerritorial.activo ||
        !recorridoTerritorial.pausado
    ) {
        return;
    }

    recorridoTerritorial.pausado = false;
    recorridoTerritorial.tiempoInicio = null;

    var botonPausar =
        document.getElementById(
            'btnPausarRecorrido'
        );

    if (botonPausar) {
        botonPausar.textContent = '⏸ Pausar';

        botonPausar.classList.remove(
            'recorrido-pausado'
        );
    }

    iniciarCicloTemporalVuelo();

    actualizarEstadoRecorrido(
        'Reanudando vuelo continuo',
        recorridoTerritorial.anioActual
    );

    recorridoTerritorial.animacionFrame =
        requestAnimationFrame(
            animarCamaraTerritorial
        );
}


// =====================================================
// ALTERNAR PAUSA Y REANUDACION
// =====================================================

function alternarPausaRecorrido() {

    if (!recorridoTerritorial.activo) {
        return;
    }

    if (recorridoTerritorial.pausado) {

        reanudarRecorridoTerritorial();

    } else {

        pausarRecorridoTerritorial();
    }
}


// =====================================================
// REINICIAR EL VUELO
// =====================================================

function reiniciarRecorridoTerritorial() {

    detenerCicloTemporalVuelo();

    if (
        recorridoTerritorial.animacionFrame !== null
    ) {

        cancelAnimationFrame(
            recorridoTerritorial.animacionFrame
        );

        recorridoTerritorial.animacionFrame = null;
    }

    recorridoTerritorial.activo = false;
    recorridoTerritorial.pausado = false;
    recorridoTerritorial.progreso = 0;
    recorridoTerritorial.tiempoInicio = null;
    recorridoTerritorial.tiempoAcumulado = 0;
    recorridoTerritorial.indiceAnio = 0;
    recorridoTerritorial.anioActual = '2010';

    recorridoCinematograficoActivo = false;

    Object.keys(capasRecorrido).forEach(
        function(anio) {

            var key = capasRecorrido[anio];
            var capa = capasLeaflet[key];

            if (
                capa &&
                map.hasLayer(capa)
            ) {
                map.removeLayer(capa);
            }
        }
    );

// Quitar las dos capas viales activadas por el recorrido
var capasVialesRecorrido = [
    'Vias centro poblado',
    'Vias identificadas del centro poblado'
];

// Quitar las zonas de expansión activadas
// al finalizar el recorrido
var capasExpansionFinal = [
    'Suelo Expansión 2018',
    'Suelo Expansión 2025',
    'Suelo Expansión 2032'
];

capasExpansionFinal.forEach(function(keyExpansion) {

    var capaExpansion =
        capasLeaflet[keyExpansion];

    if (
        capaExpansion &&
        map.hasLayer(capaExpansion)
    ) {
        map.removeLayer(capaExpansion);
    }
});

capasVialesRecorrido.forEach(function(keyVia) {

    var capaVia = capasLeaflet[keyVia];

    if (
        capaVia &&
        map.hasLayer(capaVia)
    ) {
        map.removeLayer(capaVia);
    }
});

    map.setView(
        [6.605, -75.426],
        16,
        {
            animate: false
        }
    );

    var botonReproducir =
        document.getElementById(
            'btnIniciarRecorrido'
        );

    var botonPausar =
        document.getElementById(
            'btnPausarRecorrido'
        );

    if (botonReproducir) {
        botonReproducir.disabled = false;
        botonReproducir.textContent =
            '▶ Reproducir';
    }

    if (botonPausar) {
        botonPausar.disabled = true;
        botonPausar.textContent =
            '⏸ Pausar';

        botonPausar.classList.remove(
            'recorrido-pausado'
        );
    }

    actualizarEstadoRecorrido(
        'Preparado para iniciar',
        null
    );
}


// =====================================================
// MOSTRAR Y RECORRER LAS ZONAS DE EXPANSION
// AL FINAL DEL VUELO
// =====================================================

function mostrarZonasExpansionFinal() {

    var clavesExpansionFinal = [
        'Suelo Expansión 2018',
        'Suelo Expansión 2025',
        'Suelo Expansión 2032'
    ];

    var capasExpansionDisponibles = [];
    var limitesExpansionConjunta = null;

    // =================================================
    // PASO 1: Encender las tres capas de expansión
    // y guardar sus límites
    // =================================================

    clavesExpansionFinal.forEach(function(keyExpansion) {

        var capaExpansion =
            capasLeaflet[keyExpansion];

        if (!capaExpansion) {

            console.warn(
                'No se encontró la capa: ' +
                keyExpansion
            );

            return;
        }

        // Encender sin apagar construcciones ni vías
        if (!map.hasLayer(capaExpansion)) {
            capaExpansion.addTo(map);
        }

        if (
            typeof capaExpansion.getBounds !== 'function'
        ) {
            return;
        }

        var limitesCapa =
            capaExpansion.getBounds();

        if (
            !limitesCapa ||
            !limitesCapa.isValid ||
            !limitesCapa.isValid()
        ) {
            return;
        }

        // Guardar capa y límites para el recorrido final
        capasExpansionDisponibles.push({
            key: keyExpansion,
            capa: capaExpansion,
            limites: limitesCapa
        });

        // Construir también la extensión conjunta final
        if (!limitesExpansionConjunta) {

            limitesExpansionConjunta =
                L.latLngBounds(
                    limitesCapa.getSouthWest(),
                    limitesCapa.getNorthEast()
                );

        } else {

            limitesExpansionConjunta.extend(
                limitesCapa
            );
        }
    });

    // Validar que se encontraron capas
    if (capasExpansionDisponibles.length === 0) {

        actualizarEstadoRecorrido(
            'No fue posible localizar las zonas de expansión',
            null
        );

        return;
    }

    // =================================================
    // PASO 2: Función que acerca la cámara
    // a cada zona individualmente
    // =================================================

    function visitarZonaExpansion(indice) {

        // Si todavía quedan zonas por visitar
        if (
            indice <
            capasExpansionDisponibles.length
        ) {

            var zona =
                capasExpansionDisponibles[indice];

            var anioZona =
                zona.key.replace(
                    'Suelo Expansión ',
                    ''
                );

            actualizarEstadoRecorrido(
                'Acercamiento a la zona de expansión ' +
                anioZona,
                anioZona
            );

            map.flyToBounds(
                zona.limites,
                {
                    // Mayor padding produce una vista útil
                    // sin cortar el polígono
                    padding: [90, 90],

                    // Permite acercamiento detallado
                    maxZoom: 18,

                    // Movimiento suave
                    duration: 4.5,
                    easeLinearity: 0.15
                }
            );

            // Esperar antes de visitar la siguiente zona
            setTimeout(function() {

                visitarZonaExpansion(
                    indice + 1
                );

            }, 5500);

            return;
        }

        // =================================================
        // PASO 3: Al terminar las tres zonas,
        // mostrar una vista conjunta
        // =================================================

        if (limitesExpansionConjunta) {


            map.flyToBounds(
                limitesExpansionConjunta,
                {
                    padding: [55, 55],
                    maxZoom: 17,
                    duration: 4.5,
                    easeLinearity: 0.15
                }
            );
        }
    }

    // Iniciar el recorrido final desde 2018
    visitarZonaExpansion(0);
}

// =====================================================
// FINALIZAR EL VUELO
// =====================================================

function finalizarRecorridoTerritorial() {

    detenerCicloTemporalVuelo();

    if (
        recorridoTerritorial.animacionFrame !== null
    ) {

        cancelAnimationFrame(
            recorridoTerritorial.animacionFrame
        );

        recorridoTerritorial.animacionFrame = null;
    }

    recorridoTerritorial.activo = false;
    recorridoTerritorial.pausado = false;

   // Conservar la acumulación de construcciones
// de 2010, 2018 y 2025
mostrarAnioRecorrido('2025');

recorridoTerritorial.anioActual = '2025';

// Encender las zonas de expansión y realizar
// el acercamiento hacia el crecimiento territorial
mostrarZonasExpansionFinal();

    var botonReproducir =
        document.getElementById(
            'btnIniciarRecorrido'
        );

    var botonPausar =
        document.getElementById(
            'btnPausarRecorrido'
        );

    if (botonReproducir) {
        botonReproducir.disabled = false;
        botonReproducir.textContent =
            '▶ Reproducir nuevamente';
    }

    if (botonPausar) {
        botonPausar.disabled = true;
        botonPausar.textContent =
            '⏸ Pausar';

        botonPausar.classList.remove(
            'recorrido-pausado'
        );
    }

    actualizarEstadoRecorrido(
         'Vuelo finalizado. Zonas de expansión 2018, 2025 y proyección 2032.',
    '2032'
    );

    // Liberar el zoom automático cuando termine
// todo el recorrido final de las expansiones
setTimeout(function() {

    recorridoCinematograficoActivo = false;

}, 22000);
}


// =====================================================
// CONECTAR LOS BOTONES EXISTENTES
// =====================================================

function conectarBotonesRecorrido() {

    var botonReproducir =
        document.getElementById(
            'btnIniciarRecorrido'
        );

    var botonPausar =
        document.getElementById(
            'btnPausarRecorrido'
        );

    var botonReiniciar =
        document.getElementById(
            'btnReiniciarRecorrido'
        );

    if (botonReproducir) {

        botonReproducir.addEventListener(
            'click',
            iniciarRecorridoTerritorial
        );
    }

    if (botonPausar) {

        botonPausar.addEventListener(
            'click',
            alternarPausaRecorrido
        );

        botonPausar.disabled = true;
    }

    if (botonReiniciar) {

        botonReiniciar.addEventListener(
            'click',
            reiniciarRecorridoTerritorial
        );
    }
}


// ==========================================
// CONFIGURACIÓN DEL REPORTE PERSONALIZADO
// ==========================================

var configuracionReporte = null;

// Almacenar los resultados del último análisis ejecutado
var analisisActualReporte = null;

function inicializarPreguntasReporte() {

    var botonAbrir = document.getElementById(
        'btnAbrirPreguntasReporte'
    );

    var preguntas = document.getElementById(
        'preguntasReporte'
    );

    var botonConfirmar = document.getElementById(
        'btnConfirmarReporte'
    );

    if (!botonAbrir || !preguntas || !botonConfirmar) {
        console.warn('No se encontró el formulario del reporte.');
        return;
    }

    // MOSTRAR U OCULTAR LAS PREGUNTAS
    botonAbrir.addEventListener('click', function() {

        var estaOculto =
            window.getComputedStyle(preguntas).display === 'none';

        if (estaOculto) {

            preguntas.style.display = 'block';

            botonAbrir.textContent = '✖ Ocultar configuración';

        } else {

            preguntas.style.display = 'none';

            botonAbrir.textContent =
                '📄 Generar reporte personalizado';

        }

    });


    
// CONFIRMAR LAS RESPUESTAS
botonConfirmar.addEventListener('click', function() {

    // Verificar que exista un análisis ejecutado
    if (!analisisActualReporte) {

        alert('Primero debes ejecutar el análisis estadístico.');

        return;
    }

    // Obtener respuestas del usuario
    var enfoque = document.getElementById(
        'reporteEnfoque'
    ).value;

    var detalle = document.getElementById(
        'reporteDetalle'
    ).value;

    var mapa = document.getElementById(
        'reporteMapa'
    ).value;

    // Guardar preferencias
    configuracionReporte = {
        enfoque: enfoque,
        detalle: detalle,
        mapa: mapa
    };

    // Mostrar confirmación
    var estado = document.getElementById(
        'estadoConfiguracionReporte'
    );

    estado.textContent =
        '✓ Configuración guardada correctamente.';

    estado.style.color = '#2e7d32';

    // Habilitar descarga del reporte
var botonDescargar = document.getElementById(
    'btnDescargarReporte'
);

if (botonDescargar) {
    botonDescargar.disabled = false;
}

    console.log(
        'Configuración del reporte:',
        configuracionReporte
    );

});


}

// INICIALIZAR EL FORMULARIO
inicializarPreguntasReporte();



// ==========================================
// GENERAR REPORTE TÉCNICO EN PDF
// ==========================================

async function generarPDFPersonalizado() {

    // 1. Validar información y librerías
    if (!analisisActualReporte || !configuracionReporte) {
        alert('Primero ejecuta el análisis y confirma las preguntas.');
        return;
    }

    var jsPDF = window.jspdf && window.jspdf.jsPDF;

    if (!jsPDF || typeof html2canvas !== 'function') {
        alert('No se encuentran disponibles las librerías del PDF.');
        return;
    }

    var boton = document.getElementById('btnDescargarReporte');
    var estado = document.getElementById('estadoConfiguracionReporte');

    if (boton) {
        boton.disabled = true;
        boton.textContent = 'Generando informe técnico...';
    }

    try {

        // ==========================================
        // 2. CONFIGURACIÓN DEL DOCUMENTO
        // ==========================================

        var pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        if (typeof pdf.autoTable !== 'function') {
            throw new Error('No se ha cargado el complemento AutoTable.');
        }

        pdf.setProperties({
            title: 'Reporte técnico de análisis espacial - Hoyorrico',
            subject: 'Análisis estadístico y espacial de capas geográficas',
            author: 'Geovisor Centro Poblado Hoyorrico',
            creator: 'Geovisor Centro Poblado Hoyorrico'
        });

        var ancho = pdf.internal.pageSize.getWidth();
        var alto = pdf.internal.pageSize.getHeight();

        var margen = 18;
        var anchoTexto = ancho - margen * 2;
        var y = 20;


        // ==========================================
        // 3. FUNCIONES AUXILIARES DE FORMATO
        // ==========================================

        function revisarEspacio(espacio) {

            if (y + espacio > alto - 20) {
                pdf.addPage();
                y = 22;
            }

        }

        function agregarSeccion(titulo, numero) {

            revisarEspacio(16);

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12);
            pdf.setTextColor(46, 31, 51);

            pdf.text(numero + '. ' + titulo, margen, y);

            y += 4;

            pdf.setDrawColor(145, 114, 180);
            pdf.setLineWidth(0.6);

            pdf.line(
                margen,
                y,
                ancho - margen,
                y
            );

            y += 7;
        }

        function agregarParrafo(texto, tamano) {

            tamano = tamano || 10;

            if (!texto || !String(texto).trim()) return;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(tamano);
            pdf.setTextColor(55, 55, 55);

            var lineas = pdf.splitTextToSize(
                String(texto).trim(),
                anchoTexto
            );

            var altura = lineas.length * 5;

            revisarEspacio(altura + 4);

            pdf.text(
                lineas,
                margen,
                y,
                {
                    align: lineas.length > 1 ? 'justify' : 'left',
                    maxWidth: anchoTexto,
                    lineHeightFactor: 1.4
                }
            );

            y += altura + 5;
        }

        function formatoNumero(valor) {

            if (typeof valor === 'number') {
                return valor.toLocaleString('es-CO');
            }

            return String(valor);
        }

        function obtenerRGB(color, alternativo) {

            if (Array.isArray(color)) {
                return color;
            }

            if (typeof color === 'string') {

                if (color.charAt(0) === '#') {

                    var hex = color.substring(1);

                    if (hex.length === 3) {
                        hex = hex.split('').map(function(v) {
                            return v + v;
                        }).join('');
                    }

                    return [
                        parseInt(hex.substring(0, 2), 16),
                        parseInt(hex.substring(2, 4), 16),
                        parseInt(hex.substring(4, 6), 16)
                    ];
                }

                var rgb = color.match(/rgba?\(([^)]+)\)/);

                if (rgb) {

                    return rgb[1].split(',').slice(0, 3).map(function(v) {
                        return Math.round(Number(v.trim()));
                    });

                }
            }

            return alternativo || [145, 114, 180];
        }


        // ==========================================
        // 4. PORTADA Y DATOS GENERALES
        // ==========================================

        pdf.setFillColor(46, 31, 51);

        pdf.rect(
            0,
            0,
            ancho,
            43,
            'F'
        );

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(17);
        pdf.setTextColor(255, 255, 255);

        pdf.text(
            'REPORTE TÉCNICO',
            margen,
            19
        );

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        pdf.text(
            'Análisis estadístico y espacial',
            margen,
            28
        );

        pdf.setFontSize(9);

        pdf.text(
            'Centro Poblado Hoyorrico',
            margen,
            36
        );

        y = 55;

        pdf.setTextColor(46, 31, 51);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);

        pdf.text(
            'INFORMACIÓN DEL ESTUDIO',
            margen,
            y
        );

        y += 8;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(65, 65, 65);

        var fecha = analisisActualReporte.fecha.toLocaleString('es-CO');

        pdf.text('Fecha de elaboración: ' + fecha, margen, y);

        y += 7;

        pdf.text(
            'Capa principal: ' + analisisActualReporte.nombreIzq,
            margen,
            y
        );

        y += 6;

        pdf.text(
            'Capa de referencia: ' + analisisActualReporte.nombreDer,
            margen,
            y
        );

        y += 12;


        // ==========================================
        // 5. OBJETIVO Y ENFOQUE DEL REPORTE
        // ==========================================

        agregarSeccion('OBJETO DEL ANÁLISIS', '1');

        var enfoque = configuracionReporte.enfoque;

        var descripcionEnfoque = {
            general:
                'Comparación estadística general de las cantidades y características de los elementos registrados en las dos capas seleccionadas.',

            espacial:
                'Evaluación de la distribución espacial de los elementos respecto al área de referencia, considerando su ubicación dentro y fuera de la delimitación analizada.',

            geometria:
                'Caracterización de las entidades geográficas mediante el tipo de geometría, la presencia de información geométrica y los atributos disponibles.'
        };

        agregarParrafo(descripcionEnfoque[enfoque] || descripcionEnfoque.general);


        // ==========================================
        // 6. TABLA ESTADÍSTICA PROFESIONAL
        // ==========================================

        agregarSeccion('RESULTADOS ESTADÍSTICOS', '2');

        var datosA = analisisActualReporte.statsIzq;
        var datosB = analisisActualReporte.statsDer;

        var filas = [

            [
                'Total de elementos',
                formatoNumero(datosA.total),
                formatoNumero(datosB.total)
            ],

            [
                'Geometrías válidas',
                formatoNumero(datosA.conGeom),
                formatoNumero(datosB.conGeom)
            ],

            [
                'Geometrías ausentes',
                formatoNumero(datosA.sinGeom),
                formatoNumero(datosB.sinGeom)
            ],

            [
                'Geometría predominante',
                datosA.tipoDominante,
                datosB.tipoDominante
            ],

            [
                'Campos de atributos',
                formatoNumero(datosA.numCampos),
                formatoNumero(datosB.numCampos)
            ]

        ];

        // La diferencia y variación se calculan sobre el total
        var diferencia = datosB.total - datosA.total;

        var variacion = datosA.total > 0
            ? (diferencia / datosA.total) * 100
            : null;

        pdf.autoTable({

            startY: y,

            head: [[
                'Indicador',
                'Capa principal',
                'Capa de referencia'
            ]],

            body: filas,

            theme: 'grid',

            margin: {
                left: margen,
                right: margen
            },

            styles: {
                font: 'helvetica',
                fontSize: 8.5,
                cellPadding: 3,
                textColor: [55, 55, 55],
                lineColor: [220, 220, 225],
                lineWidth: 0.2,
                valign: 'middle',
                overflow: 'linebreak'
            },

            headStyles: {
                fillColor: [46, 31, 51],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },

            alternateRowStyles: {
                fillColor: [247, 246, 249]
            },

            columnStyles: {
                0: { cellWidth: 55, fontStyle: 'bold' },
                1: { halign: 'center' },
                2: { halign: 'center' }
            }

        });

        y = pdf.lastAutoTable.finalY + 7;

        // Diferencia entre los totales
        pdf.setFillColor(247, 246, 249);

        pdf.roundedRect(
            margen,
            y,
            anchoTexto,
            20,
            2,
            2,
            'F'
        );

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(46, 31, 51);

        pdf.text(
            'Diferencia cuantitativa: ' + formatoNumero(diferencia) + ' elementos',
            margen + 5,
            y + 7
        );

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);

        var textoVariacion = variacion === null
            ? 'No es posible calcular la variación porcentual porque la capa principal no contiene elementos.'
            : 'Variación relativa respecto a la capa principal: ' +
                variacion.toFixed(1).replace('.', ',') + ' %.';

        pdf.text(
            textoVariacion,
            margen + 5,
            y + 14
        );

        y += 29;


        // ==========================================
        // 7. INFORMACIÓN GEOMÉTRICA DETALLADA
        // ==========================================

        if (configuracionReporte.detalle === 'tecnico') {

            agregarSeccion('CARACTERIZACIÓN GEOMÉTRICA', '3');

            [datosA, datosB].forEach(function(datos, indice) {

                var nombre = indice === 0
                    ? analisisActualReporte.nombreIzq
                    : analisisActualReporte.nombreDer;

                agregarParrafo(nombre, 10);

                var tipos = datos.tiposGeom || {};

                var listaTipos = Object.keys(tipos);

                if (listaTipos.length === 0) {

                    agregarParrafo(
                        'No se encontraron geometrías clasificadas en esta capa.'
                    );

                } else {

                    listaTipos.forEach(function(tipo) {

                        agregarParrafo(
                            tipo + ': ' + formatoNumero(tipos[tipo]) + ' entidades',
                            9
                        );

                    });

                }

            });

        }


        // ==========================================
        // 8. INTERPRETACIÓN DE LOS RESULTADOS
        // ==========================================

        agregarSeccion(
            'INTERPRETACIÓN DE LOS RESULTADOS',
            configuracionReporte.detalle === 'tecnico' ? '4' : '3'
        );

        var interpretacion = document.getElementById('analisisReporte');

        if (interpretacion && interpretacion.innerText.trim()) {

            agregarParrafo(interpretacion.innerText.trim(), 9.5);

        } else {

            agregarParrafo(
                'El análisis se realizó a partir de las estadísticas calculadas para las dos capas seleccionadas. Los resultados deben interpretarse teniendo en cuenta la naturaleza, escala y cobertura de la información geográfica utilizada.'
            );

        }

        if (enfoque === 'general') {

            agregarParrafo(
                'La diferencia cuantitativa expresa la variación entre los registros de ambas capas. Esta comparación no implica por sí sola que las entidades correspondan espacialmente o que los cambios observados representen nuevas construcciones.',
                9
            );

        }


        
// ==========================================
// 9. GRÁFICA VECTORIAL PARA PDF
// ==========================================

// Reservar el espacio completo antes de dibujar.
// Evita que las barras queden fuera de la página.
revisarEspacio(105);

agregarSeccion(
    'REPRESENTACIÓN GRÁFICA',
    configuracionReporte.detalle === 'tecnico' ? '5' : '4'
);

if (
    typeof chartInstancia !== 'undefined' &&
    chartInstancia &&
    chartInstancia.data &&
    chartInstancia.data.datasets.length > 0
) {

    var etiquetas = chartInstancia.data.labels || [];

    var conjunto = chartInstancia.data.datasets[0];

    var valores = conjunto.data.map(function(valor) {
        return Number(valor) || 0;
    });

    var maximo = Math.max.apply(null, valores.concat([1]));

    // Área de dibujo
    var inicioX = margen + 15;
    var anchoGrafica = anchoTexto - 30;

    var altoBarras = 42;
    var baseY = y + 55;

    var espacio = anchoGrafica / Math.max(etiquetas.length, 1);

    var anchoBarra = Math.min(25, espacio * 0.40);

    // Ejes y líneas de referencia
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);

    for (var nivel = 0; nivel <= 4; nivel++) {

        var proporcion = nivel / 4;

        var posicionY = baseY - proporcion * altoBarras;

        var valorEje = maximo * proporcion;

        pdf.setDrawColor(225, 225, 230);
        pdf.setLineWidth(0.2);

        pdf.line(
            inicioX,
            posicionY,
            inicioX + anchoGrafica,
            posicionY
        );

        pdf.text(
            formatoNumero(Math.round(valorEje)),
            inicioX - 3,
            posicionY + 2,
            { align: 'right' }
        );

    }

    // Dibujar las barras como elementos vectoriales
    valores.forEach(function(valor, i) {

        var altoBarra = (valor / maximo) * altoBarras;

        var xCentro = inicioX + espacio * (i + 0.5);

        var xBarra = xCentro - anchoBarra / 2;

        var yBarra = baseY - altoBarra;

        // Recuperar el color original de Chart.js
        var colores = conjunto.backgroundColor;

        var colorActual = Array.isArray(colores)
            ? colores[i]
            : colores;

        var rgb = obtenerRGB(
            colorActual,
            [145, 114, 180]
        );

        // Barra vectorial
        pdf.setFillColor(rgb[0], rgb[1], rgb[2]);

        pdf.roundedRect(
            xBarra,
            yBarra,
            anchoBarra,
            altoBarra,
            1,
            1,
            'F'
        );

        // Valor superior
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(45, 45, 45);

        pdf.text(
            formatoNumero(valor),
            xCentro,
            yBarra - 3,
            { align: 'center' }
        );

        // Nombre de la categoría
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);

        var etiqueta = pdf.splitTextToSize(
            String(etiquetas[i]),
            espacio - 4
        );

        pdf.text(
            etiqueta,
            xCentro,
            baseY + 6,
            { align: 'center' }
        );

    });

    // Descripción de la gráfica
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);

    pdf.text(
        conjunto.label || 'Comparación de elementos geográficos',
        margen + 15,
        baseY + 17
    );

    // Actualizar posición para el siguiente apartado
    y = baseY + 25;

} else {

    agregarParrafo(
        'No se encontró una gráfica estadística disponible para este análisis.'
    );

}


        // ==========================================
        // 10. REPRESENTACIÓN CARTOGRÁFICA
        // ==========================================

        agregarSeccion(
            'REPRESENTACIÓN CARTOGRÁFICA',
            configuracionReporte.detalle === 'tecnico' ? '6' : '5'
        );

        var imagenMapa = null;

        var centroOriginal = map.getCenter();
        var zoomOriginal = map.getZoom();

        try {

            // Ajustar extensión si el usuario lo solicitó
            if (configuracionReporte.mapa === 'general') {

                var capaIzq = capasLeaflet[
                    analisisActualReporte.keyIzq
                ];

                var capaDer = capasLeaflet[
                    analisisActualReporte.keyDer
                ];

                var capas = [capaIzq, capaDer].filter(Boolean);

                if (capas.length > 0) {

                    var grupo = L.featureGroup(capas);
                    var limites = grupo.getBounds();

                    if (limites.isValid()) {

                        map.fitBounds(limites, {
                            padding: [35, 35],
                            maxZoom: 17,
                            animate: false
                        });

                    }

                }

            }

            map.invalidateSize();

            await new Promise(function(resolve) {
                setTimeout(resolve, 1200);
            });

            // Captura con mayor resolución
            var captura = await html2canvas(
                document.getElementById('map'),
                {
                    useCORS: true,
                    allowTaint: false,
                    scale: 3,
                    backgroundColor: '#ffffff',
                    logging: false,

                    ignoreElements: function(elemento) {

                        return elemento.id === 'timelineControl' ||
                            elemento.id === 'recorridoControl' ||
                            elemento.id === 'panelLeyenda' ||
                            elemento.classList.contains('btn-swipe') ||
                            elemento.classList.contains('btn-timeline') ||
                            elemento.classList.contains('btn-recorrido') ||
                            elemento.classList.contains('btn-dibujo') ||
                            elemento.classList.contains('btn-analisis') ||
                            elemento.classList.contains('btn-leyenda');

                    }
                }
            );

            imagenMapa = captura.toDataURL('image/png');

        } catch(errorMapa) {

            console.error('Error capturando el mapa:', errorMapa);

        } finally {

            map.setView(centroOriginal, zoomOriginal, {
                animate: false
            });

            map.invalidateSize();

        }


        // Incorporar imagen cartográfica
        if (imagenMapa) {

            var imagen = new Image();

            imagen.src = imagenMapa;

            await new Promise(function(resolve) {

                imagen.onload = resolve;

            });

            var anchoMapa = anchoTexto;

            var altoMapa =
                anchoMapa * imagen.height / imagen.width;

            if (altoMapa > 105) {

                altoMapa = 105;

                anchoMapa =
                    altoMapa * imagen.width / imagen.height;

            }

            revisarEspacio(altoMapa + 12);

            pdf.addImage(
                imagenMapa,
                'PNG',
                margen,
                y,
                anchoMapa,
                altoMapa
            );

            y += altoMapa + 9;

            agregarParrafo(
                'Fuente: representación cartográfica generada en el geovisor del Centro Poblado Hoyorrico a partir de las capas seleccionadas.'
            );

        } else {

            agregarParrafo(
                'No fue posible obtener la captura cartográfica. Se recomienda verificar los servicios de mapas base y los permisos de captura.'
            );

        }


        // ==========================================
        // 11. PIE DE PÁGINA Y NUMERACIÓN
        // ==========================================

        var paginas = pdf.getNumberOfPages();

        for (var pagina = 1; pagina <= paginas; pagina++) {

            pdf.setPage(pagina);

            pdf.setDrawColor(210, 210, 215);
            pdf.setLineWidth(0.3);

            pdf.line(
                margen,
                alto - 14,
                ancho - margen,
                alto - 14
            );

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(110, 110, 110);

            pdf.text(
                'Geovisor Centro Poblado Hoyorrico',
                margen,
                alto - 8
            );

            pdf.text(
                'Página ' + pagina + ' de ' + paginas,
                ancho - margen,
                alto - 8,
                { align: 'right' }
            );

        }


        // ==========================================
        // 12. DESCARGAR EL DOCUMENTO
        // ==========================================

        var nombreArchivo =
            'Reporte_Tecnico_Hoyorrico_' +
            analisisActualReporte.keyIzq + '_' +
            analisisActualReporte.keyDer;

        nombreArchivo = nombreArchivo.replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
        );

        pdf.save(nombreArchivo + '.pdf');

        if (estado) {

            estado.textContent =
                '✓ Informe técnico generado correctamente.';

            estado.style.color = '#2e7d32';

        }

    } catch(error) {

        console.error('Error generando el informe:', error);

        alert(
            'No fue posible generar el documento. ' +
            'Consulta la consola del navegador.'
        );

    } finally {

        if (boton) {

            boton.disabled = false;

            boton.textContent = '📥 Generar y descargar PDF';

        }

    }

}



// ==========================================
// CONECTAR BOTON CON GENERADOR PDF
// ==========================================

var botonPDF = document.getElementById('btnDescargarReporte');

if (botonPDF) {

    botonPDF.addEventListener(
        'click',
        generarPDFPersonalizado
    );

}


/* =====================================================
   SELECTOR DE CAPAS Y DESCARGA SHAPEFILE
   ===================================================== */

// Recordar la capa seleccionada cuando Leaflet reconstruya el árbol
var capaSeleccionadaParaSHP = '';


function inicializarEditorSHP() {

    var selector = document.getElementById('selectorCapaEstilo');
    var boton = document.getElementById('btnDescargarSHP');
    var estado = document.getElementById('estadoPersonalizar');
    var editor = document.getElementById('editorSimbologia');

    var colorRelleno = document.getElementById('colorRelleno');
    var colorBorde = document.getElementById('colorBorde');
    var grosorBorde = document.getElementById('grosorBorde');
    var tamanoPunto = document.getElementById('tamanoPunto');

    if (!selector || !boton || !estado) return;

    // Evitar que los controles interfieran con el árbol
    // sin bloquear el funcionamiento de los campos.
    if (editor && !editor.dataset.eventosPreparados) {

        ['click', 'mousedown', 'dblclick', 'touchstart', 'pointerdown']
            .forEach(function(evento) {

                editor.addEventListener(evento, function(e) {
                    e.stopPropagation();
                });

            });

        editor.dataset.eventosPreparados = 'true';
    }

    // Conservar la capa seleccionada cuando Leaflet
    // reconstruye el árbol de capas.
    var seleccionAnterior = capaSeleccionadaParaSHP;

    // Llenar selector
    selector.innerHTML = '';

    var opcionInicial = document.createElement('option');
    opcionInicial.value = '';
    opcionInicial.textContent = 'Selecciona una capa...';
    selector.appendChild(opcionInicial);

    capasConfig.forEach(function(config) {

        if (!capasGeoJSON[config.key] || !capasLeaflet[config.key]) {
            return;
        }

        var opcion = document.createElement('option');
        opcion.value = config.key;
        opcion.textContent = config.nombre;

        selector.appendChild(opcion);
    });

    if (seleccionAnterior && capasLeaflet[seleccionAnterior]) {
        selector.value = seleccionAnterior;
    }

    boton.disabled = !selector.value;

    // Convertir colores de Leaflet al formato HEX
    function colorAHex(color, respaldo) {

        if (!color) return respaldo;

        if (/^#[0-9a-f]{6}$/i.test(color)) {
            return color;
        }

        var rgb = color.match(/\d+/g);

        if (rgb && rgb.length >= 3) {
            return '#' + rgb.slice(0, 3).map(function(v) {
                return ('0' + Number(v).toString(16)).slice(-2);
            }).join('');
        }

        return respaldo;
    }

    // Cargar la simbología actual de la capa seleccionada
    function cargarEstiloActual(key) {

        var capa = capasLeaflet[key];
        if (!capa) return;

        var base = obtenerEstiloPorCapa(key) || {};
        var opciones = null;
        var radio = 4;

        if (capa.eachLayer) {

            capa.eachLayer(function(elemento) {

                if (!opciones && elemento.options) {
                    opciones = elemento.options;
                }

                if (
                    typeof elemento.getRadius === 'function'
                ) {
                    radio = elemento.getRadius();
                }
            });
        }

        opciones = opciones || base;

        if (colorRelleno) {
            colorRelleno.value = colorAHex(
                opciones.fillColor || opciones.color || base.fillColor || base.color,
                '#3388ff'
            );
        }

        if (colorBorde) {
            colorBorde.value = colorAHex(
                opciones.color || base.color,
                '#333333'
            );
        }

        if (grosorBorde) {
            grosorBorde.value =
                opciones.weight !== undefined ? opciones.weight :
                base.weight !== undefined ? base.weight : 2;
        }

        if (tamanoPunto) {
            tamanoPunto.value = radio;
        }
    }

    // Aplicar los cambios visuales a la capa
    function aplicarCambiosSimbologia() {

        var key = selector.value;
        if (!key) return;

        var capa = capasLeaflet[key];
        if (!capa) return;

        var nuevoEstilo = {
            color: colorBorde.value,
            fillColor: colorRelleno.value,
            weight: parseFloat(grosorBorde.value)
        };

        // Actualizar relleno, contorno y grosor
        if (typeof capa.setStyle === 'function') {
            capa.setStyle(nuevoEstilo);
        }

        // Actualizar únicamente los marcadores circulares
        if (capa.eachLayer) {

            capa.eachLayer(function(elemento) {

                if (typeof elemento.setRadius === 'function') {
                    elemento.setRadius(
                        parseFloat(tamanoPunto.value)
                    );
                }

            });
        }

        estado.textContent = '✓ Simbología actualizada en el mapa.';
    }

    // Cuando cambia la selección
    selector.onchange = function() {

        var key = this.value;

        capaSeleccionadaParaSHP = key;
        boton.disabled = !key;

        if (!key) {
            estado.textContent = 'Selecciona una capa para continuar.';
            return;
        }

        var capa = capasLeaflet[key];

        if (!capa) {
            estado.textContent = 'La capa todavía no está disponible.';
            return;
        }

        
        // ACTIVAR LA CAPA SIN RECONSTRUIR EL ÁRBOL
        if (!map.hasLayer(capa)) {

            var controlArbol = treeControl;

            // Guardar el evento que actualiza el árbol
            var eventoArbol = controlArbol &&
                              controlArbol._onLayerChange;

            // Desconectar temporalmente la actualización
            if (eventoArbol) {
                capa.off(
                    'add remove',
                    eventoArbol,
                    controlArbol
                );
            }

            try {

                // Activar la capa en el mapa
                map.addLayer(capa);

            } finally {

                // Recuperar el evento para los cambios posteriores
                if (eventoArbol) {
                    capa.on(
                        'add remove',
                        eventoArbol,
                        controlArbol
                    );
                }
            }

            // Marcar la casilla de la capa como activada
            var idCapa = L.Util.stamp(capa);

            var entradas = (
                controlArbol &&
                controlArbol._layerControlInputs
            )
                ? controlArbol._layerControlInputs
                : document.querySelectorAll(
                    '.leaflet-control-layers-selector'
                );

            for (var i = 0; i < entradas.length; i++) {

                if (Number(entradas[i].layerId) === idCapa) {
                    entradas[i].checked = true;
                    break;
                }
            }
        }


        cargarEstiloActual(key);

        estado.textContent = '✓ Capa seleccionada y activa: ' + key;
    };

    // Conectar los controles de color y tamaño
    if (colorRelleno) {
        colorRelleno.oninput = aplicarCambiosSimbologia;
    }

    if (colorBorde) {
        colorBorde.oninput = aplicarCambiosSimbologia;
    }

    if (grosorBorde) {
        grosorBorde.oninput = aplicarCambiosSimbologia;
    }

    if (tamanoPunto) {
        tamanoPunto.oninput = aplicarCambiosSimbologia;
    }

    // Mantener activa la descarga existente
    boton.onclick = descargarCapaSeleccionadaSHP;

    // Recuperar valores si ya había una capa seleccionada
    if (selector.value) {

        cargarEstiloActual(selector.value);

        estado.textContent =
            'Capa seleccionada: ' + selector.value;

    } else {

        estado.textContent =
            'Selecciona una capa para continuar.';
    }
}


/* =====================================================
   DESCARGAR CAPA SELECCIONADA EN FORMATO SHP
   CORREGIDO: ESPERAR LA GENERACIÓN DEL ARCHIVO ZIP
   ===================================================== */

async function descargarCapaSeleccionadaSHP() {

    var selector = document.getElementById('selectorCapaEstilo');
    var boton = document.getElementById('btnDescargarSHP');
    var estado = document.getElementById('estadoPersonalizar');

    if (!selector || !boton || !estado) return;

    var key = selector.value;

    if (!key) {
        estado.textContent = 'Primero debes seleccionar una capa.';
        return;
    }

    if (
        typeof shpwrite === 'undefined' ||
        typeof shpwrite.zip !== 'function'
    ) {
        estado.textContent =
            'No se pudo cargar la librería SHP. Revisa tu conexión.';
        return;
    }

    var datosOriginales = capasGeoJSON[key];

    if (
        !datosOriginales ||
        !Array.isArray(datosOriginales.features)
    ) {
        estado.textContent = 'No se encontraron datos para esta capa.';
        return;
    }

    var config = capasConfig.find(function(capa) {
        return capa.key === key;
    });

    var nombre = config ? config.nombre : key;

    var nombreArchivo = nombre
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    if (!nombreArchivo) {
        nombreArchivo = 'capa_geografica';
    }

    // Geometrías compatibles con Shapefile
    var geometriaCompatible = [
        'Point',
        'LineString',
        'Polygon',
        'MultiLineString',
        'MultiPolygon'
    ];

    // Preparar copia de los datos originales
    var entidades = datosOriginales.features.filter(function(feature) {

        return (
            feature &&
            feature.geometry &&
            geometriaCompatible.includes(feature.geometry.type)
        );

    }).map(function(feature) {

        var propiedades = {};

        Object.keys(feature.properties || {}).forEach(function(campo) {

            var valor = feature.properties[campo];

            if (
                valor === null ||
                typeof valor === 'string' ||
                typeof valor === 'number' ||
                typeof valor === 'boolean'
            ) {
                propiedades[campo] = valor;
            } else {
                propiedades[campo] = JSON.stringify(valor);
            }

        });

        return {
            type: 'Feature',
            geometry: feature.geometry,
            properties: propiedades
        };

    });

    if (entidades.length === 0) {
        estado.textContent =
            'Esta capa no contiene geometrías compatibles con SHP.';
        return;
    }

    boton.disabled = true;
    estado.textContent = 'Generando archivo Shapefile...';

    try {

        var geojsonExportacion = {
            type: 'FeatureCollection',
            features: entidades
        };

        // IMPORTANTE:
        // Esperar a que shpwrite termine de generar el ZIP
        var archivoZIP = await shpwrite.zip(geojsonExportacion, {

            folder: nombreArchivo,
            filename: nombreArchivo,
            outputType: 'blob',
            compression: 'STORE',

            types: {
                point: nombreArchivo + '_puntos',
                polygon: nombreArchivo + '_poligonos',
                polyline: nombreArchivo + '_lineas'
            }

        });

        // Comprobar el resultado generado
        var blobZIP;

        if (archivoZIP instanceof Blob) {

            blobZIP = archivoZIP;

        } else if (
            archivoZIP instanceof ArrayBuffer ||
            ArrayBuffer.isView(archivoZIP)
        ) {

            blobZIP = new Blob([archivoZIP], {
                type: 'application/zip'
            });

        } else {

            throw new Error(
                'La librería no devolvió un archivo ZIP válido.'
            );
        }

        if (blobZIP.size < 22) {
            throw new Error('El archivo ZIP generado está vacío o incompleto.');
        }

        // Crear descarga
        var urlTemporal = URL.createObjectURL(blobZIP);

        var enlace = document.createElement('a');

        enlace.href = urlTemporal;
        enlace.download = nombreArchivo + '.zip';

        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);

        // Liberar memoria después de iniciar la descarga
        setTimeout(function() {
            URL.revokeObjectURL(urlTemporal);
        }, 10000);

        var omitidas =
            datosOriginales.features.length - entidades.length;

        estado.textContent = omitidas > 0
            ? '✓ Descarga generada. Se omitieron ' +
              omitidas + ' geometrías no compatibles.'
            : '✓ Archivo SHP descargado correctamente.';

    } catch(error) {

        console.error('Error generando el archivo SHP:', error);

        estado.textContent =
            'Error al generar el ZIP: ' + error.message;

    } finally {

        boton.disabled = !selector.value;

    }
}


// Conectar los botones ya existentes en index.html
conectarBotonesRecorrido();
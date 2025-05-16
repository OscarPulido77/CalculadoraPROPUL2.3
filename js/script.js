/*
 * Copyright 2025 [Tu Nombre o Nombre de tu Sitio/Empresa]. Todos los derechos reservados.
 * Script para la Calculadora de Materiales Tablayeso.
 * Maneja la lógica de agregar ítems, calcular materiales y generar reportes.
 * Implementa el criterio de cálculo v2.0, con nombres específicos para Durock Calibre 20 y lógica de tornillos de 1".
 * Implementa selección de tipo de panel por cara de muro y para cielos.
 * Implementa Múltiples Entradas de Medida (Segmentos) para Muros Y Cielos.
 * Ajusta el orden de las entradas.
 * Implementa cálculo de Angular de Lámina para cielos basado en el perímetro completo de segmentos.
 * Agrega opción para descontar metraje de Angular en cielos.
 * Agrega campo para Área de Trabajo en el cálculo general y lo incluye en reportes.
 * Añade manejo básico de errores en el cálculo.
 *
 * --- NUEVAS FUNCIONALIDADES (Integrando Lógica Completa) ---
 * Implementa cálculo de Metraje (Área para Muros/Cielos, Lineal para Cenefas) con regla "menor a 1 = 1" por dimensión.
 * Permite agregar ítems de tipo Cenefa con orientación y tipo de anclaje.
 * Añade selector para el tipo de Poste en ítems de tipo Muro.
 * Muestra metraje calculado por ítem automáticamente.
 * Muestra totales de metrajes (Muro Área, Cielo Área, Cenefa Lineal) en el resumen final y reportes.
 * Implementa lógica de cálculo detallada para Paneles, Postes, Canales, Angular, Canal Listón, Canal Soporte según especificaciones.
 * Implementa lógica de cálculo detallada para Fijaciones (Clavos, Fulminantes, Tornillos 1", Tornillos 1/2") incluyendo distinción de punta y uso (Muros, Cielos, Cenefas).
 * Implementa lógica de cálculo detallada para Materiales de Acabado (Pasta, Cinta, Lija, Basecoat, Cinta Malla, Esponja) según tipo de panel.
 * Implementa Fases 3 y 4: Resumen Bruto, Acumulación Global FLOAT, Redondeo Global (ceil), Merma (5%), y Empaque (conceptual).
 *
 * --- CORRECCIONES SOLICITADAS ---
 * - Corrección del error "Cannot access 'estimatedPanelsForFinishing' before initialization" en la lógica de Cenefa.
 * - Corrección del cálculo de tornillos de 1/2" para muros: 4 tornillos por poste (Total_Postes_Simple por cada cara si es doble estructura, o Total_Postes_Simple si es simple estructura), distribuyendo la punta según el panel de cada cara.
 * - Confirmación del cálculo de tornillos de 1" para muros: 40 tornillos por cada cara (basado en paneles estimados por cara).
 * --- FIN CORRECCIONES SOLICITADAS ---
 */

document.addEventListener('DOMContentLoaded', () => {
    const itemsContainer = document.getElementById('items-container');
    const addItemBtn = document.getElementById('add-item-btn');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultsContent = document.getElementById('results-content');
    const downloadOptionsDiv = document.querySelector('.download-options');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    const generateExcelBtn = document.getElementById('generate-excel-btn');

    let itemCounter = 0; // To give unique IDs to item blocks

    // Variables to store the last calculated state (needed for PDF/Excel)
    let lastCalculatedTotalMaterials = {}; // Stores final rounded and adjusted totals for all materials
    let lastCalculatedTotalMetrajes = {}; // Stores the total calculated metrajes for the project
    let lastCalculatedItemsSpecs = []; // Specs of items included in calculation
    let lastErrorMessages = []; // Store errors as an array of strings
    let lastCalculatedWorkArea = ''; // Store the work area text


    // --- Constants ---
    const PANEL_RENDIMIENTO_M2 = 2.98; // m2 por panel (rendimiento estándar)
    // Umbral para considerar un área "pequeña" para la lógica de acumulación de paneles (basado en área unitaria del segmento)
    const SMALL_AREA_WIDTH_THRESHOLD_M = 0.60; // Ancho
    const SMALL_AREA_HEIGHT_THRESHOLD_M = 2.44; // Alto (para muros) o Largo (para cielos/cenefas si aplica)
    // Para cielos, la regla de "área pequeña" en la acumulación global se aplica a la AREA TOTAL del ítem vs un umbral.
    const SMALL_AREA_ITEM_THRESHOLD_M2 = 1.5; // Umbral total del ítem para contribuir a la suma fraccionaria global de paneles

    // Constantes de rendimientos y largos de materiales
    const CANAL_LARGO_M = 3.05;
    const POSTE_LARGO_MAX_M = 3.66; // Largo máximo común de poste para cálculo vertical
    const EMPALME_LONGITUD_M = 0.30; // Longitud para empalme de postes
    const CANAL_LISTON_LARGO_M = 3.66;
    const CANAL_SOPORTE_LARGO_M = 3.66; // Asumimos mismo largo que Canal Listón si no se especifica
    const ANGULAR_LAMINA_LARGO_M = 2.44;
    const ANGULAR_EMPALME_M = 0.15; // Solape para angular
    const CIELO_LISTON_ESPACIAMIENTO_M = 0.40; // Espaciamiento principal de Canal Listón en cielos
    const CIELO_SOPORTE_ESPACIAMIENTO_M = 0.90; // Espaciamiento de Canal Soporte y Soportes en cielos
    const CIELO_SOPORTE_EXTRA_M = 0.10; // Longitud extra por soporte/pata
    const PASTA_RENDIMIENTO_M2_CAJA = 22;
    const BASECOAT_RENDIMIENTO_M2_SACO = 8;
    const CINTA_RENDIMIENTO_ML_PANEL = 7; // Metros lineales de junta por panel (aprox)
    const LIJA_RENDIMIENTO_PANEL_PLIEGO = 0.5; // 0.5 panel por pliego (1 pliego por cada 2 paneles)
    const ESPONJA_RENDIMIENTO_PANEL_UND = 15; // 1 esponja por cada 15 paneles (para Basecoat)
    const MERMA_PORCENTAJE = 0.05; // 5% de merma (ejemplo)
    const CENEFA_ESTIMATED_PROFILE_HEIGHT_M = 0.30; // Altura asumida para estimar área de panel en cenefas (si ancho/alto no son válidos)


    // Definición de tipos de panel permitidos (deben coincidir con las opciones en el HTML)
    const PANEL_TYPES = [
        "Normal",
        "Resistente a la Humedad",
        "Resistente al Fuego",
        "Alta Resistencia",
        "Exterior" // Asociado comúnmente con Durock, pero aplicable si se usa ese tipo de panel en yeso especial
    ];

    // --- Definición de tipos de Poste ---
    const POSTE_TYPES = [
        "Poste 2 1/2\" x 8' cal 26", // 2.44m
        "Poste 2 1/2\" x 10' cal 26", // 3.05m
        "Poste 2 1/2\" x 12' cal 26", // 3.66m
        "Poste 2 1/2\" x 8' cal 20",  // 2.44m
        "Poste 2 1/2\" x 10' cal 20"  // 3.05m
        // Considerar añadir los de 1 5/8 si son relevantes y sus largos disponibles
        // "Poste 1 5/8\" x 8' cal 26",
        // "Poste 1 5/8\" x 10\' cal 26",
        // "Poste 1 5/8\" x 12\' cal 26"
    ];
    // --- Fin Definición de tipos de Poste ---

    // --- Definición de Tipos de Muro de Anclaje para Cenefa (NUEVO) ---
     const ANCHOR_WALL_TYPES = [
         "Mamposteria",
         "Muro Tablayeso"
     ];
     // --- Fin Definición Tipos de Muro de Anclaje ---

     // --- Definición de Orientación para Cenefa (NUEVO) ---
     const CENEFA_ORIENTATIONS = [
         "Horizontal",
         "Vertical"
     ];
     // --- Fin Definición de Orientación ---


     // --- Helper Function for Rounding Up Final Units (Applies to FINAL quantities after merma) ---
    // NOTA: Esta función ahora se usa para el redondeo final de TODOS los materiales después de la merma,
    // y también para redondear las cantidades de paneles en el acumulador 'suma_redondeada_otros'
    // y la suma final de 'suma_fraccionaria_pequenas'.
    const roundUpFinalUnit = (num) => Math.ceil(num);

    // --- Helper Function to get display name for item type ---
    const getItemTypeName = (typeValue) => {
        switch (typeValue) {
            case 'muro': return 'Muro';
            case 'cielo': return 'Cielo Falso';
            case 'cenefa': return 'Cenefa'; // --- NUEVO tipo Cenefa ---
            default: return 'Ítem Desconocido';
        }
    };

     // Helper to map item type internal value to a more descriptive name for inputs
     const getItemTypeDescription = (typeValue) => {
         switch (typeValue) {
             case 'muro': return 'Muro';
             case 'cielo': return 'Cielo Falso';
             case 'cenefa': return 'Cenefa'; // --- NUEVO tipo Cenefa ---
             default: return 'Ítem';
         }
     };


    // --- Helper Function to get the unit for a given material name ---
    const getMaterialUnit = (materialName) => {
         // Map specific names to units based on the new criterion
        // Material names can now include panel types, e.g., "Paneles de Normal"
        if (materialName.startsWith('Paneles de ')) return 'Und'; // Handle all panel types

        switch (materialName) {
            case 'Postes': return 'Und'; // Genérico, debería usarse el nombre específico ahora
            // Tipos de poste específicos
            case 'Poste 2 1/2" x 8\' cal 26': return 'Und';
            case 'Poste 2 1/2" x 10\' cal 26': return 'Und';
            case 'Poste 2 1/2" x 12\' cal 26': return 'Und';
            case 'Poste 2 1/2" x 8\' cal 20': return 'Und';
            case 'Poste 2 1/2" x 10\' cal 20': return 'Und';
             // Agregar tipos de poste 1 5/8 si se añaden a la lista de constantes
            // case 'Poste 1 5/8" x 8\' cal 26': return 'Und';
            // case 'Poste 1 5/8" x 10\' cal 26': return 'Und';
            // case 'Poste 1 5/8" x 12\' cal 26': return 'Und';

            case 'Canales': return 'Und'; // Genérico, debería usarse el nombre específico ahora
            case 'Canales Calibre 20': return 'Und'; // Asumiendo que solo hay un tipo de canal calibre 20 por ahora
            case 'Pasta': return 'Caja';
            case 'Cinta de Papel': return 'm';
            case 'Lija Grano 120': return 'Pliego';
            case 'Clavos con Roldana': return 'Und';
            case 'Fulminantes': return 'Und';
            case 'Tornillos de 1" punta fina': return 'Und';
            case 'Tornillos de 1/2" punta fina': return 'Und';
            case 'Canal Listón': return 'Und'; // Canal Listón (Principales + Vertical Cenefa)
            case 'Canal Soporte': return 'Und';
            case 'Angular de Lámina': return 'Und';
            case 'Tornillos de 1" punta broca': return 'Und';
            case 'Tornillos de 1/2" punta broca': return 'Und';
            case 'Patas': return 'Und'; // Nota: Patas es un cálculo intermedio, el material real viene del Canal Listón para Cuelgue
            case 'Canal Listón (para cuelgue)': return 'Und'; // Material del que se cortan las patas/cuelgues

            case 'Basecoat': return 'Saco'; // Associated with Durock-like panels
            case 'Cinta malla': return 'm'; // Associated with Durock-like panels
             case 'Esponja para acabado': return 'Und'; // --- NUEVO: Esponja para Basecoat ---

            default: return 'Und'; // Default unit if not specified
        }
    };

    // Helper function to get the associated finishing materials based on panel type
    // Returns an object with keys initialized to 0.
    // This is used to initialize the itemOtherMaterialsFloat object keys for finishing materials.
    const getFinishingMaterialKeys = (panelType) => {
         const finishing = {};
         // Associate finishing materials based on the panel type name or a category derived from it
         if (panelType === 'Normal' || panelType === 'Resistente a la Humedad' || panelType === 'Resistente al Fuego' || panelType === 'Alta Resistencia') {
             finishing['Pasta'] = 0;
             finishing['Cinta de Papel'] = 0;
             finishing['Lija Grano 120'] = 0;
         } else if (panelType === 'Exterior') { // Assuming 'Exterior' implies Durock or similar
             finishing['Basecoat'] = 0;
             finishing['Cinta malla'] = 0;
             finishing['Esponja para acabado'] = 0; // --- NUEVO: Esponja para Basecoat ---
         }
          // Fasteners are initialized separately as they are common across finishing types but specific in calculation.

         return finishing;
    };


    // --- Function to Populate Panel Type Selects ---
    const populatePanelTypes = (selectElement, selectedValue = 'Normal') => {
        if (!selectElement) return; // Safety check
        selectElement.innerHTML = ''; // Clear existing options
        PANEL_TYPES.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === selectedValue) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    };

    // --- Function to Populate Poste Type Selects ---
     const populatePosteTypes = (selectElement, selectedValue = "Poste 2 1/2\" x 8' cal 26") => {
         if (!selectElement) return; // Safety check
         selectElement.innerHTML = ''; // Clear existing options
         POSTE_TYPES.forEach(type => {
             const option = document.createElement('option');
             option.value = type;
             option.textContent = type;
             if (type === selectedValue) {
                 option.selected = true;
             }
             selectElement.appendChild(option);
         });
     };
    // --- Fin Function to Populate Poste Type Selects ---

    // --- Function to Populate Anchor Wall Type Selects (NUEVO) ---
     const populateAnchorWallTypes = (selectElement, selectedValue = "Mamposteria") => {
         if (!selectElement) return; // Safety check
         selectElement.innerHTML = ''; // Clear existing options
         ANCHOR_WALL_TYPES.forEach(type => {
             const option = document.createElement('option');
             option.value = type;
             option.textContent = type;
             if (type === selectedValue) {
                 option.selected = true;
             }
             selectElement.appendChild(option);
         });
     };
    // --- Fin Function to Populate Anchor Wall Type Selects ---

    // --- Function to Populate Cenefa Orientation Selects (NUEVO) ---
     const populateCenefaOrientations = (selectElement, selectedValue = "Horizontal") => {
         if (!selectElement) return; // Safety check
         selectElement.innerHTML = ''; // Clear existing options
         CENEFA_ORIENTATIONS.forEach(type => {
             const option = document.createElement('option');
             option.value = type;
             option.textContent = type;
             if (type === selectedValue) {
                 option.selected = true;
             }
             selectElement.appendChild(option);
         });
     };
    // --- Fin Function to Populate Cenefa Orientation Selects ---


     // --- Helper Function to update the summary details displayed within a segment block ---
     // This function now reads parent item options to update the segment summary.
     const updateSegmentItemSummary = (segmentBlock) => {
         const itemBlock = segmentBlock.closest('.item-block');
         if (!itemBlock) {
             console.error("Could not find parent item block for segment.");
             return; // Exit if parent not found
         }

         const segmentSummaryDiv = segmentBlock.querySelector('.segment-item-summary');
         if (!segmentSummaryDiv) {
              //console.error("Could not find segment summary div."); // This div doesn't exist for Cenefa, so don't error here
              return; // Exit if summary div not found (expected for cenefa)
         }

         const type = itemBlock.querySelector('.item-structure-type').value;
         const itemNumber = itemBlock.dataset.itemId.split('-')[1];

         let summaryText = `Ítem #${itemNumber} - `; // Start with Item number

         if (type === 'muro') {
             const facesInput = itemBlock.querySelector('.item-faces');
             const faces = facesInput && !facesInput.closest('.hidden') ? parseInt(facesInput.value) : 1;
             const cara1PanelSelect = itemBlock.querySelector('.item-cara1-panel-type');
             const cara1PanelType = cara1PanelSelect && !cara1PanelSelect.closest('.hidden') ? cara1PanelSelect.value : 'N/A';
             const cara2PanelSelect = itemBlock.querySelector('.item-cara2-panel-type');
             const cara2PanelType = (faces === 2 && cara2PanelSelect && !cara2PanelSelect.closest('.hidden')) ? cara2PanelSelect.value : 'N/A';
             const postSpacingInput = itemBlock.querySelector('.item-post-spacing');
             const postSpacing = postSpacingInput && !postSpacingInput.closest('.hidden') ? parseFloat(postSpacingInput.value) : 'N/A';
             const postTypeSelect = itemBlock.querySelector('.item-poste-type');
             const postType = postTypeSelect && !postTypeSelect.closest('.hidden') ? postTypeSelect.value : 'N/A';
             const isDoubleStructureInput = itemBlock.querySelector('.item-double-structure');
             const isDoubleStructure = isDoubleStructureInput && !isDoubleStructureInput.closest('.hidden') ? isDoubleStructureInput.checked : false;

             summaryText += `${faces} Cara${faces > 1 ? 's' : ''}, Panel C1: ${cara1PanelType}`;
             if (faces === 2) summaryText += `, Panel C2: ${cara2PanelType}`;
             if (postSpacing !== 'N/A' && !isNaN(postSpacing)) summaryText += `, Esp: ${postSpacing.toFixed(2)}m`;
             if (postType !== 'N/A') summaryText += `, Poste: ${postType}`;
             if (isDoubleStructure) summaryText += `, Doble Estructura`;

         } else if (type === 'cielo') {
             const cieloPanelSelect = itemBlock.querySelector('.item-cielo-panel-type');
             const cieloPanelType = cieloPanelSelect && !cieloPanelSelect.closest('.hidden') ? cieloPanelSelect.value : 'N/A';
             const plenumInput = itemBlock.querySelector('.item-plenum');
             const plenum = plenumInput && !plenumInput.closest('.hidden') ? parseFloat(plenumInput.value) : 'N/A';
             const angularDeductionInput = itemBlock.querySelector('.item-angular-deduction');
             const angularDeduction = angularDeductionInput && !angularDeductionInput.closest('.hidden') ? parseFloat(angularDeductionInput.value) : 'N/A';
              const cieloPanelWasteInput = itemBlock.querySelector('.item-cielo-panel-waste');
              const cieloPanelWaste = cieloPanelWasteInput && !cieloPanelWasteInput.closest('.hidden') ? parseFloat(cieloPanelWasteInput.value) : 'N/A';


             summaryText += `Panel: ${cieloPanelType}`;
             if (plenum !== 'N/A' && !isNaN(plenum)) summaryText += `, Pleno: ${plenum.toFixed(2)}m`;
             if (angularDeduction !== 'N/A' && !isNaN(angularDeduction) && angularDeduction > 0) summaryText += `, Desc. Ang: ${angularDeduction.toFixed(2)}m`;
              if (cieloPanelWaste !== 'N/A' && !isNaN(cieloPanelWaste)) summaryText += `, Desp. Panel: ${cieloPanelWaste.toFixed(0)}%`;

          } else if (type === 'cenefa') {
              // Para cenefa, el resumen detallado se muestra a nivel de ítem, no de segmento.
              // Ocultar o limpiar el div de resumen del segmento.
              summaryText = ''; // Clear the text for cenefa segments
         } else {
             summaryText += "Configuración Desconocida"; // Fallback for unknown type
         }

        // Update the text content of the dedicated summary div within the segment
        segmentSummaryDiv.textContent = summaryText;
     };


     // --- Function to Create a Muro Segment Input Block ---
    const createMuroSegmentBlock = (itemId, segmentNumber) => {
        const segmentHtml = `
            <div class="muro-segment" data-segment-id="${itemId}-mseg-${segmentNumber}">
                 <div class="segment-header-line"> <h4>Segmento ${segmentNumber}</h4>
                    <div class="segment-item-summary"></div>
                    <div class="segment-metraje-display"></div>
                    </div>
                 <button type="button" class="remove-segment-btn">X</button>
                 <div class="segment-inputs">
                     <div class="input-group">
                        <label for="mwidth-${itemId}-mseg-${segmentNumber}">Ancho (m):</label>
                        <input type="number" class="item-width" id="mwidth-${itemId}-mseg-${segmentNumber}" step="0.01" min="0" value="3.0">
                    </div>
                    <div class="input-group">
                        <label for="mheight-${itemId}-mseg-${segmentNumber}">Alto (m):</label>
                        <input type="number" class="item-height" id="mheight-${itemId}-mseg-${segmentNumber}" step="0.01" min="0" value="2.4">
                    </div>
                 </div>
            </div>
        `;
        const newElement = document.createElement('div');
        newElement.innerHTML = segmentHtml.trim();
        const segmentBlock = newElement.firstChild;

        // Add remove listener
        const removeButton = segmentBlock.querySelector('.remove-segment-btn');
         removeButton.addEventListener('click', () => {
            const segmentsContainer = segmentBlock.closest('.segments-list'); // Correct selector
            if (segmentsContainer.querySelectorAll('.muro-segment').length > 1) {
                 segmentBlock.remove();
                 // Re-number segments visually after removal
                 segmentsContainer.querySelectorAll('.muro-segment h4').forEach((h4, index) => {
                    h4.textContent = `Segmento ${index + 1}`;
                 });
                 // --- Recalcula y muestra el metraje del ítem después de eliminar un segmento ---
                 const itemBlock = segmentsContainer.closest('.item-block');
                 calculateAndDisplayItemMetraje(itemBlock); // Llama a la función de metraje del ítem
                 // --- Fin Recálculo Metraje Ítem ---

                 // Clear results and hide download buttons after removal
                 resultsContent.innerHTML = '<p>Segmento eliminado. Recalcula los materiales totales.</p>';
                 downloadOptionsDiv.classList.add('hidden');
                 lastCalculatedTotalMaterials = {};
                 lastCalculatedTotalMetrajes = {}; // Limpia metrajes totales almacenados
                 lastCalculatedItemsSpecs = [];
                 lastErrorMessages = [];
                 lastCalculatedWorkArea = ''; // Clear stored data on item removal
            } else {
                 alert("Un muro debe tener al menos un segmento.");
            }
         });

        // --- Agregar listeners a los inputs de dimensión del segmento para actualizar el metraje del ítem y el resumen del segmento ---
         const widthInput = segmentBlock.querySelector('.item-width');
         const heightInput = segmentBlock.querySelector('.item-height');
         const itemBlock = segmentBlock.closest('.item-block'); // Obtiene el bloque del ítem padre

         const updateDisplay = () => {
             updateSegmentItemSummary(segmentBlock); // Update segment summary when dimensions change
             calculateAndDisplayItemMetraje(itemBlock); // Calculate and display item metraje
         };

         widthInput.addEventListener('input', updateDisplay);
         heightInput.addEventListener('input', updateDisplay);
        // --- Fin Agregar listeners ---


        return segmentBlock;
    };

     // --- Function to Create a Cielo Segment Input Block ---
     const createCieloSegmentBlock = (itemId, segmentNumber) => {
         const segmentHtml = `
            <div class="cielo-segment" data-segment-id="${itemId}-cseg-${segmentNumber}">
                 <div class="segment-header-line"> <h4>Segmento ${segmentNumber}</h4>
                    <div class="segment-item-summary"></div>
                    <div class="segment-metraje-display"></div>
                    </div>
                 <button type="button" class="remove-segment-btn">X</button>
                 <div class="segment-inputs">
                     <div class="input-group">
                        <label for="cwidth-${itemId}-cseg-${segmentNumber}">Ancho (m):</label>
                        <input type="number" class="item-width" id="cwidth-${itemId}-cseg-${segmentNumber}" step="0.01" min="0" value="3.0">
                    </div>
                    <div class="input-group">
                        <label for="clength-${itemId}-cseg-${segmentNumber}">Largo (m):</label>
                        <input type="number" class="item-length" id="clength-${itemId}-cseg-${segmentNumber}" step="0.01" min="0" value="4.0">
                    </div>
                 </div>
            </div>
        `;
        const newElement = document.createElement('div');
        newElement.innerHTML = segmentHtml.trim();
        const segmentBlock = newElement.firstChild;

         // Add remove listener
         const removeButton = segmentBlock.querySelector('.remove-segment-btn');
         removeButton.addEventListener('click', () => {
             const segmentsContainer = segmentBlock.closest('.segments-list'); // Correct selector
             if (segmentsContainer.querySelectorAll('.cielo-segment').length > 1) {
                  segmentBlock.remove();
                  // Re-number segments visually after removal
                  segmentsContainer.querySelectorAll('.cielo-segment h4').forEach((h4, index) => {
                     h4.textContent = `Segmento ${index + 1}`;
                  });
                  // --- Recalcula y muestra el metraje del ítem después de eliminar un segmento ---
                  const itemBlock = segmentsContainer.closest('.item-block');
                  calculateAndDisplayItemMetraje(itemBlock); // Llama a la función de metraje del ítem
                  // --- Fin Recálculo Metraje Ítem ---


                  // Clear results and hide download buttons after adding a segment
                  resultsContent.innerHTML = '<p>Segmento de cielo agregado. Recalcula los materiales totales.</p>'; // Mensaje actualizado
                  downloadOptionsDiv.classList.add('hidden');
                  lastCalculatedTotalMaterials = {};
                  lastCalculatedTotalMetrajes = {}; // Limpia metrajes totales almacenados
                  lastCalculatedItemsSpecs = [];
                  lastErrorMessages = [];
                  lastCalculatedWorkArea = ''; // Clear stored data on adding/removing segment
             } else {
                  alert("Un cielo falso debe tener al menos un segmento.");
             }
         });

         // --- Agregar listeners a los inputs de dimensión del segmento para actualizar el metraje del ítem y el resumen del segmento ---
         const widthInput = segmentBlock.querySelector('.item-width');
         const lengthInput = segmentBlock.querySelector('.item-length'); // Usa .item-length para cielo
         const itemBlock = segmentBlock.closest('.item-block'); // Obtiene el bloque del ítem padre

         const updateDisplay = () => {
             updateSegmentItemSummary(segmentBlock); // Update segment summary when dimensions change
             calculateAndDisplayItemMetraje(itemBlock); // Calculate and display item metraje
         };

         widthInput.addEventListener('input', updateDisplay);
         lengthInput.addEventListener('input', updateDisplay);
         // --- Fin Agregar listeners ---

         return segmentBlock;
     };

    // --- Function to Create a Cenefa Input Block (NUEVO) ---
    const createCenefaInputs = (itemId) => {
         const cenefaHtml = `
             <div class="cenefa-inputs" data-item-id="${itemId}">
                 <div class="input-group">
                    <label for="cenefa-orientation-${itemId}">Orientación:</label>
                    <select class="item-cenefa-orientation" id="cenefa-orientation-${itemId}"></select>
                 </div>
                  <div class="input-group">
                     <label for="cenefa-length-${itemId}">Largo (m):</label>
                     <input type="number" class="item-length" id="cenefa-length-${itemId}" step="0.01" min="0" value="2.4">
                  </div>
                  <div class="input-group">
                     <label for="cenefa-width-${itemId}">Ancho (m):</label>
                     <input type="number" class="item-width" id="cenefa-width-${itemId}" step="0.01" min="0" value="0.30">
                  </div>
                  <div class="input-group">
                     <label for="cenefa-height-${itemId}">Alto (m):</label>
                     <input type="number" class="item-height" id="cenefa-height-${itemId}" step="0.01" min="0" value="0.40">
                  </div>
                 <div class="input-group">
                    <label for="cenefa-faces-${itemId}">Nº de Caras:</label>
                    <input type="number" class="item-faces" id="cenefa-faces-${itemId}" step="1" min="1" value="2">
                 </div>
                 <div class="input-group">
                    <label for="cenefa-panel-type-${itemId}">Tipo de Panel:</label>
                    <select class="item-cielo-panel-type" id="cenefa-panel-type-${itemId}"></select>
                 </div>
                 <div class="input-group">
                    <label for="cenefa-anchor-wall-type-${itemId}">Anclaje a:</label>
                    <select class="item-cenefa-anchor-wall-type" id="cenefa-anchor-wall-type-${itemId}"></select>
                 </div>
             </div>
         `;
        const newElement = document.createElement('div');
        newElement.innerHTML = cenefaHtml.trim();
        const cenefaInputsBlock = newElement.firstChild; // Get the actual div element

        // Populate selects immediately after creation
        const orientationSelect = cenefaInputsBlock.querySelector('.item-cenefa-orientation');
        const panelTypeSelect = cenefaInputsBlock.querySelector('.item-cielo-panel-type'); // Reutiliza clase
        const anchorWallTypeSelect = cenefaInputsBlock.querySelector('.item-cenefa-anchor-wall-type');

        if (orientationSelect) populateCenefaOrientations(orientationSelect);
        if (panelTypeSelect) populatePanelTypes(panelTypeSelect);
        if (anchorWallTypeSelect) populateAnchorWallTypes(anchorWallTypeSelect);


         // --- Agregar listeners a los inputs de la cenefa para actualizar el metraje del ítem (NUEVO) ---
         // NOTA: Los listeners para .item-length, .item-width, .item-height, .item-faces
         // y .item-cenefa-orientation, .item-cielo-panel-type, .item-cenefa-anchor-wall-type
         // deben llamar a calculateAndDisplayItemMetraje(itemBlock) y updateItemHeaderSummary(itemBlock)
         // Se añadirán a los elementos directamente después de que sean agregados al DOM en createItemBlock
         // porque createCenefaInputs solo crea el bloque, no lo adjunta.

         return cenefaInputsBlock;
    };
    // --- Fin Function to Create a Cenefa Input Block ---


     // --- Function to Update Input Visibility WITHIN an Item Block ---
    // Modificada para incluir el tipo Cenefa y sus inputs específicos
    const updateItemInputVisibility = (itemBlock) => {
        const structureTypeSelect = itemBlock.querySelector('.item-structure-type');
        const type = structureTypeSelect.value;

        // Common input groups (some are hidden/shown based on type)
        const facesInputGroup = itemBlock.querySelector('.item-faces-input'); // Usado para Muro (caras) y Cenefa (cantidad caras)
        const muroPanelTypesDiv = itemBlock.querySelector('.muro-panel-types');
        const cieloPanelTypeDiv = itemBlock.querySelector('.cielo-panel-type'); // Usado para Cielo y Cenefa panel type select
        const postSpacingInputGroup = itemBlock.querySelector('.item-post-spacing-input');
        const postTypeInputGroup = itemBlock.querySelector('.item-poste-type-input');
        const doubleStructureInputGroup = itemBlock.querySelector('.item-double-structure-input');
        const plenumInputGroup = itemBlock.querySelector('.item-plenum-input');
        const angularDeductionInputGroup = itemBlock.querySelector('.item-angular-deduction-input');
         const cieloPanelWasteInputGroup = itemBlock.querySelector('.item-cielo-panel-waste-input');


        // Type-specific dimension/segment/item-level input containers
        const muroSegmentsContainer = itemBlock.querySelector('.muro-segments');
        const cieloSegmentsContainer = itemBlock.querySelector('.cielo-segments');
        const cenefaInputsContainer = itemBlock.querySelector('.cenefa-inputs'); // Container for Cenefa-specific inputs


        // Reset visibility for ALL type-specific input groups within this block
        if (facesInputGroup) facesInputGroup.classList.add('hidden');
        if (muroPanelTypesDiv) muroPanelTypesDiv.classList.add('hidden');
        if (cieloPanelTypeDiv) cieloPanelTypeDiv.classList.add('hidden');
        if (postSpacingInputGroup) postSpacingInputGroup.classList.add('hidden');
        if (postTypeInputGroup) postTypeInputGroup.classList.add('hidden');
        if (doubleStructureInputGroup) doubleStructureInputGroup.classList.add('hidden');
        if (plenumInputGroup) plenumInputGroup.classList.add('hidden');
        if (muroSegmentsContainer) muroSegmentsContainer.classList.add('hidden');
        if (cieloSegmentsContainer) cieloSegmentsContainer.classList.add('hidden');
        if (angularDeductionInputGroup) angularDeductionInputGroup.classList.add('hidden');
        if (cenefaInputsContainer) cenefaInputsContainer.classList.add('hidden');
         if (cieloPanelWasteInputGroup) cieloPanelWasteInputGroup.classList.add('hidden');


         // Show/Hide Metraje display per segment based on type
         itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => {
             if (type === 'muro' || type === 'cielo') {
                 div.classList.remove('hidden');
             } else {
                 div.classList.add('hidden');
             }
         });


        // Set visibility based on selected type for THIS block
        if (type === 'muro') {
            if (facesInputGroup) facesInputGroup.classList.remove('hidden');
            if (muroPanelTypesDiv) muroPanelTypesDiv.classList.remove('hidden');
            if (postSpacingInputGroup) postSpacingInputGroup.classList.remove('hidden');
            if (postTypeInputGroup) postTypeInputGroup.classList.remove('hidden');
            if (doubleStructureInputGroup) doubleStructureInputGroup.classList.remove('hidden');
            if (muroSegmentsContainer) muroSegmentsContainer.classList.remove('hidden');

             // Update visibility of face-specific panel type selectors based on faces input
             const facesInput = itemBlock.querySelector('.item-faces');
             const cara2PanelTypeGroup = itemBlock.querySelector('.cara-2-panel-type-group');
             if (cara2PanelTypeGroup && facesInput) { // Ensure elements exist
                 if (parseInt(facesInput.value) === 2) {
                     cara2PanelTypeGroup.classList.remove('hidden');
                 } else {
                     cara2PanelTypeGroup.classList.add('hidden');
                 }
             }


        } else if (type === 'cielo') {
            if (cieloPanelTypeDiv) cieloPanelTypeDiv.classList.remove('hidden');
            if (plenumInputGroup) plenumInputGroup.classList.remove('hidden');
            if (cieloSegmentsContainer) cieloSegmentsContainer.classList.remove('hidden');
            if (angularDeductionInputGroup) angularDeductionInputGroup.classList.remove('hidden');
             if (cieloPanelWasteInputGroup) cieloPanelWasteInputGroup.classList.remove('hidden');


         } else if (type === 'cenefa') {
             if (cenefaInputsContainer) cenefaInputsContainer.classList.remove('hidden');
             // Cenefa inputs container now holds all specific inputs, including faces and panel type selects
             // We don't need to manage their visibility separately if they are inside the .cenefa-inputs block.

         }
        // No need for 'else' as all are hidden by default initially

         // After updating visibility, re-evaluate the segment summaries for muro/cielo if segments exist
         itemBlock.querySelectorAll('.muro-segment, .cielo-segment').forEach(segBlock => {
              updateSegmentItemSummary(segBlock);
         });

    };

    // --- Function to update the main item header summary (kept for consistency) ---
    const updateItemHeaderSummary = (itemBlock) => {
         const itemHeader = itemBlock.querySelector('h3');
         const type = itemBlock.querySelector('.item-structure-type').value;
         const itemNumber = itemBlock.dataset.itemId.split('-')[1]; // Get item number from item ID

         // Update the main header to show Type, Number, and potentially Cenefa orientation
          let headerText = `${getItemTypeDescription(type)} #${itemNumber}`;

          if (type === 'cenefa') {
              const orientationSelect = itemBlock.querySelector('.cenefa-inputs .item-cenefa-orientation'); // Get from cenefa-inputs
              const orientation = orientationSelect ? orientationSelect.value : '';
              if (orientation) {
                  headerText += ` (${orientation})`;
              }
          }

         itemHeader.textContent = headerText;
     };


    // --- Function to Create an Item Input Block ---
    // Modified to include the Cenefa type and its specific inputs within the main block structure
    const createItemBlock = () => {
        itemCounter++;
        const itemId = `item-${itemCounter}`;

        // Restructured HTML template to include all potential input groups, managed by visibility
        const itemHtml = `
            <div class="item-block" data-item-id="${itemId}">
                <h3>${getItemTypeDescription('muro')} #${itemCounter}</h3>
                <button class="remove-item-btn">Eliminar</button>

                <div class="item-metraje-display">Metraje calculado para este ítem: -</div>

                <div class="input-group">
                    <label for="type-${itemId}">Tipo de Estructura:</label>
                    <select class="item-structure-type" id="type-${itemId}">
                        <option value="muro">Muro</option>
                        <option value="cielo">Cielo Falso</option>
                        <option value="cenefa">Cenefa</option>
                    </select>
                </div>

                <div class="input-group item-faces-input">
                    <label for="faces-${itemId}">Nº de Caras:</label>
                    <input type="number" class="item-faces" id="faces-${itemId}" step="1" min="1" value="1">
                </div>

                <div class="muro-panel-types">
                    <div class="input-group cara-1-panel-type-group">
                        <label for="cara1-panel-type-${itemId}">Panel Cara 1:</label>
                        <select class="item-cara1-panel-type" id="cara1-panel-type-${itemId}"></select>
                    </div>
                    <div class="input-group cara-2-panel-type-group hidden">
                        <label for="cara2-panel-type-${itemId}">Panel Cara 2:</label>
                        <select class="item-cara2-panel-type" id="cara2-panel-type-${itemId}"></select>
                    </div>
                </div>

                <div class="input-group item-post-spacing-input">
                    <label for="post-spacing-${itemId}">Espaciamiento Postes (m):</label>
                    <input type="number" class="item-post-spacing" id="post-spacing-${itemId}" step="0.01" min="0.1" value="0.40">
                </div>

                 <div class="input-group item-poste-type-input">
                     <label for="poste-type-${itemId}">Tipo de Poste:</label>
                     <select class="item-poste-type" id="poste-type-${itemId}"></select>
                 </div>

                <div class="input-group item-double-structure-input">
                    <label for="double-structure-${itemId}">Estructura Doble:</label>
                    <input type="checkbox" class="item-double-structure" id="double-structure-${itemId}">
                </div>

                <div class="input-group cielo-panel-type">
                    <label for="cielo-panel-type-${itemId}">Tipo de Panel:</label>
                    <select class="item-cielo-panel-type" id="cielo-panel-type-${itemId}"></select>
                </div>

                <div class="input-group item-cielo-panel-waste-input hidden">
                     <label for="cielo-panel-waste-${itemId}">Desperdicio Paneles Cielo (%):</label>
                     <input type="number" class="item-cielo-panel-waste" id="cielo-panel-waste-${itemId}" step="1" min="0" value="10">
                </div>


                <div class="input-group item-plenum-input hidden">
                    <label for="plenum-${itemId}">Pleno del Cielo (m):</label>
                    <input type="number" class="item-plenum" id="plenum-${itemId}" step="0.01" min="0" value="0.5">
                </div>

                <div class="input-group item-angular-deduction-input hidden">
                    <label for="angular-deduction-${itemId}">Metros a descontar de Angular:</label>
                    <input type="number" class="item-angular-deduction" id="angular-deduction-${itemId}" step="0.01" min="0" value="0">
                </div>

                <div class="cenefa-inputs hidden">
                     </div>

                <div class="muro-segments">
                    <h4>Segmentos del Muro:</h4>
                     <div class="segments-list">
                         </div>
                    <button type="button" class="add-segment-btn">Agregar Segmento de Muro</button>
                </div>

                 <div class="cielo-segments hidden">
                    <h4>Segmentos del Cielo Falso:</h4>
                     <div class="segments-list">
                         </div>
                    <button type="button" class="add-segment-btn">Agregar Segmento de Cielo</button>
                 </div>

            </div>
        `;

        const newElement = document.createElement('div');
        newElement.innerHTML = itemHtml.trim();
        const itemBlock = newElement.firstChild; // Get the actual div element

        itemsContainer.appendChild(itemBlock);

        // Populate initial selects
        const cara1PanelSelect = itemBlock.querySelector('.item-cara1-panel-type');
        const cara2PanelSelect = itemBlock.querySelector('.item-cara2-panel-type');
        const cieloPanelSelect = itemBlock.querySelector('.item-cielo-panel-type'); // Used for Cielo and Cenefa
        const posteTypeSelect = itemBlock.querySelector('.item-poste-type');

        if(cara1PanelSelect) populatePanelTypes(cara1PanelSelect);
        if(cara2PanelSelect) populatePanelTypes(cara2PanelSelect);
        if(cieloPanelSelect) populatePanelTypes(cieloPanelSelect);
        if(posteTypeSelect) populatePosteTypes(posteTypeSelect);


        // Add an initial segment based on the DEFAULT type ('muro')
        const muroSegmentsListContainer = itemBlock.querySelector('.muro-segments .segments-list');
        if (muroSegmentsListContainer) {
             const initialSegment = createMuroSegmentBlock(itemId, 1);
             muroSegmentsListContainer.appendChild(initialSegment);
             updateSegmentItemSummary(initialSegment); // Update segment summary
        }

         // Add listener for "Agregar Segmento" button for muro
         const addMuroSegmentBtn = itemBlock.querySelector('.muro-segments .add-segment-btn');
         if (addMuroSegmentBtn) {
             addMuroSegmentBtn.addEventListener('click', () => {
                 const muroSegmentsListContainer = itemBlock.querySelector('.muro-segments .segments-list'); // Get container again
                 const currentSegments = muroSegmentsListContainer.querySelectorAll('.muro-segment').length;
                 const newSegment = createMuroSegmentBlock(itemId, currentSegments + 1);
                 muroSegmentsListContainer.appendChild(newSegment);
                 updateSegmentItemSummary(newSegment); // Update segment summary
                 calculateAndDisplayItemMetraje(itemBlock); // Calculate and display item metraje

                 // Clear results and hide download buttons after adding a segment
                 resultsContent.innerHTML = '<p>Segmento de muro agregado. Recalcula los materiales y metrajes totales.</p>';
                 downloadOptionsDiv.classList.add('hidden');
                 lastCalculatedTotalMaterials = {};
                 lastCalculatedTotalMetrajes = {};
                 lastCalculatedItemsSpecs = [];
                 lastErrorMessages = [];
                 lastCalculatedWorkArea = '';
             });
         }

         // Add listener for "Agregar Segmento" button for cielo (initially hidden)
         const cieloSegmentsListContainer = itemBlock.querySelector('.cielo-segments .segments-list');
          if (cieloSegmentsListContainer) {
             const addCieloSegmentBtn = itemBlock.querySelector('.cielo-segments .add-segment-btn');
             if (addCieloSegmentBtn) {
                 addCieloSegmentBtn.addEventListener('click', () => {
                     const cieloSegmentsListContainer = itemBlock.querySelector('.cielo-segments .segments-list'); // Get container again
                     const currentSegments = cieloSegmentsListContainer.querySelectorAll('.cielo-segment').length;
                     const newSegment = createCieloSegmentBlock(itemId, currentSegments + 1);
                     cieloSegmentsListContainer.appendChild(newSegment);
                     updateSegmentItemSummary(newSegment); // Update segment summary
                     calculateAndDisplayItemMetraje(itemBlock); // Calculate and display item metraje

                     // Clear results and hide download buttons after adding a segment
                     resultsContent.innerHTML = '<p>Segmento de cielo agregado. Recalcula los materiales totales.</p>';
                     downloadOptionsDiv.classList.add('hidden');
                     lastCalculatedTotalMaterials = {};
                     lastCalculatedTotalMetrajes = {};
                     lastCalculatedItemsSpecs = [];
                     lastErrorMessages = [];
                     lastCalculatedWorkArea = '';
                 });
             }
          }

         // Add listener for "Agregar Cenefa" logic to create its specific inputs when type changes
         // No initial inputs created here, they are created when the type is changed to 'cenefa'


        // Add event listener to the main structure type select IN THIS BLOCK
        const structureTypeSelect = itemBlock.querySelector('.item-structure-type');
        if (structureTypeSelect) {
            structureTypeSelect.addEventListener('change', (event) => {
                const selectedType = event.target.value;
                const itemId = itemBlock.dataset.itemId;

                updateItemHeaderSummary(itemBlock); // Update the main h3

                // Clear existing segments or cenefa inputs
                const muroSegmentsList = itemBlock.querySelector('.muro-segments .segments-list');
                const cieloSegmentsList = itemBlock.querySelector('.cielo-segments .segments-list');
                const cenefaInputsContainer = itemBlock.querySelector('.cenefa-inputs');


                if (muroSegmentsList) muroSegmentsList.innerHTML = '';
                if (cieloSegmentsList) cieloSegmentsList.innerHTML = '';
                if (cenefaInputsContainer) cenefaInputsContainer.innerHTML = '';


                // Add initial segment or cenefa inputs based on selected type
                if (selectedType === 'muro') {
                    if (muroSegmentsList) {
                        const newSegment = createMuroSegmentBlock(itemId, 1);
                        muroSegmentsList.appendChild(newSegment);
                        updateSegmentItemSummary(newSegment); // Update summary for newly created segment
                    }
                } else if (selectedType === 'cielo') {
                     if (cieloSegmentsList) {
                         const newSegment = createCieloSegmentBlock(itemId, 1);
                         cieloSegmentsList.appendChild(newSegment);
                         updateSegmentItemSummary(newSegment); // Update summary for newly created segment
                     }
                } else if (selectedType === 'cenefa') {
                     if (cenefaInputsContainer) {
                         // Create and append cenefa specific inputs
                         const cenefaInputs = createCenefaInputs(itemId);
                         cenefaInputsContainer.appendChild(cenefaInputs);
                         // Add listeners to the new cenefa inputs for real-time metraje/summary updates
                         addCenefaInputListeners(itemBlock); // Call helper to add listeners

                         // Set default values for cenefa specific inputs if needed and trigger change
                          const facesInput = itemBlock.querySelector('.item-faces'); // This is the shared faces input
                          if (facesInput) {
                              facesInput.value = 2; // Default to 2 faces for cenefa
                               const event = new Event('change');
                               facesInput.dispatchEvent(event); // Trigger change to update visibility/summary if needed
                           }
                         // Trigger input event on a cenefa dimension input to calculate/display initial metraje
                         const cenefaLengthInput = itemBlock.querySelector('.cenefa-inputs .item-length');
                          if (cenefaLengthInput) {
                               const event = new Event('input');
                               cenefaLengthInput.dispatchEvent(event); // Trigger input to calculate metraje
                           }


                     }
                }

                updateItemInputVisibility(itemBlock); // Update visibility after changing structure/clearing segments

                // --- Recalcula y muestra el metraje después del cambio de tipo ---
                 // This is already triggered by adding segments/cenefa inputs and dispatching events,
                 // but call it here too as a fallback in case the first segments/inputs fail to trigger.
                calculateAndDisplayItemMetraje(itemBlock);


                // Clear results and hide download buttons on type change
                 resultsContent.innerHTML = '<p>Tipo de ítem cambiado. Recalcula los materiales y metrajes totales.</p>';
                 downloadOptionsDiv.classList.add('hidden');
                 lastCalculatedTotalMaterials = {};
                 lastCalculatedTotalMetrajes = {};
                 lastCalculatedItemsSpecs = [];
                 lastErrorMessages = [];
                 lastCalculatedWorkArea = '';
            });
        }


         // --- Helper function to add listeners specifically to Cenefa inputs (called when Cenefa inputs are created) ---
         const addCenefaInputListeners = (itemBlock) => {
             const cenefaInputsContainer = itemBlock.querySelector('.cenefa-inputs');
              if (!cenefaInputsContainer) return; // Safety check

             const relevantCenefaInputs = cenefaInputsContainer.querySelectorAll(
                 '.item-cenefa-orientation, .item-length, .item-width, .item-height, ' +
                 '.item-faces, .item-cielo-panel-type, .item-cenefa-anchor-wall-type' // Include all relevant cenefa inputs
             );

             relevantCenefaInputs.forEach(input => {
                 const eventType = (input.tagName === 'SELECT' || input.type === 'checkbox' || input.type === 'number') ? 'change' : 'input';
                 input.addEventListener(eventType, () => {
                      // For Cenefa, changes in these inputs update the item header summary and the item metraje display
                      updateItemHeaderSummary(itemBlock); // Update header (shows orientation)
                      calculateAndDisplayItemMetraje(itemBlock); // Update metraje
                      // No segment summaries to update for cenefa
                 });
             });
         };


        // --- Agrega event listeners a inputs relevantes del ítem que afectan el resumen en CADA SEGMENTO (Muro/Cielo) Y EL METRAJE DEL ÍTEM (Todos los tipos) ---
         // Estos listeners son para los inputs a nivel de ITEM (ej: caras, espaciamiento, tipo de panel global, pleno, etc.)
         // Los listeners para inputs dentro de los SEGMENTOS (.item-width, .item-height, .item-length) y dentro de .cenefa-inputs ya se manejan en sus funciones de creación o helper.
         const relevantItemInputs = itemBlock.querySelectorAll(
             '.item-faces, .item-cara1-panel-type, .item-cara2-panel-type, ' +
             '.item-post-spacing, .item-poste-type, .item-double-structure, ' +
             '.item-cielo-panel-type, .item-plenum, .item-angular-deduction, .item-cielo-panel-waste' // Incluye el nuevo input de desperdicio de panel de cielo
         );

         relevantItemInputs.forEach(input => {
             const eventType = (input.tagName === 'SELECT' || input.type === 'checkbox' || input.type === 'number') ? 'change' : 'input';
             input.addEventListener(eventType, () => {
                 // Cuando un input relevante a nivel de ítem cambia, actualiza el resumen en TODOS los segmentos de este ítem
                 // (si aplica) y recalcula y muestra el metraje del ítem.
                 itemBlock.querySelectorAll('.muro-segment, .cielo-segment').forEach(segBlock => {
                     updateSegmentItemSummary(segBlock);
                 });

                  // Si el input que cambió es el de 'faces' (para muro), también necesitamos actualizar la visibilidad de los paneles de la Cara 2.
                 if (itemBlock.querySelector('.item-structure-type').value === 'muro' && input.classList.contains('item-faces')) {
                      updateItemInputVisibility(itemBlock); // This also calls updateSegmentItemSummary inside if type is muro.
                 }
                 // También actualiza el encabezado principal si es relevante (ej: si afecta el tipo de ítem como el número de caras de cenefa si usáramos ese input global)
                 // Aunque el tipo y número ya se actualizan en el listener principal de type, otros inputs pueden refinar el resumen del encabezado si decidimos mostrar más allí.
                 updateItemHeaderSummary(itemBlock);


                 // --- Recalcula y muestra el metraje del ítem completo en tiempo real con cada cambio relevante ---
                 calculateAndDisplayItemMetraje(itemBlock);
                 // --- Fin Recálculo Metraje Ítem ---

             });
         });
         // --- Fin Agregación de Event Listeners para Segmentos y Metraje de Ítem ---


        // Add event listener to the new remove button
        const removeButton = itemBlock.querySelector('.remove-item-btn');
        if (removeButton) {
            removeButton.addEventListener('click', () => {
                itemBlock.remove();
                 resultsContent.innerHTML = '<p>Ítem eliminado. Recalcula los materiales y metrajes totales.</p>';
                 downloadOptionsDiv.classList.add('hidden');
                 lastCalculatedTotalMaterials = {};
                 lastCalculatedTotalMetrajes = {};
                 lastCalculatedItemsSpecs = [];
                 lastErrorMessages = [];
                 lastCalculatedWorkArea = '';
                 toggleCalculateButtonState();
            });
        }


        // Set initial visibility for the inputs in the new block (defaults to muro)
        // This also calls updateSegmentItemSummary for initial segments if type is muro.
        updateItemInputVisibility(itemBlock);

        // --- Calcula y muestra el metraje inicial para el ítem recién creado (por defecto Muro con 1 segmento) ---
        calculateAndDisplayItemMetraje(itemBlock);

        // Re-evaluate if calculate button should be enabled (since an item was added)
        toggleCalculateButtonState();

        return itemBlock;
    };

     // --- NUEVA FUNCIÓN: Calcular y Mostrar Metraje por Ítem (en tiempo real) ---
     // Ahora usa la lógica de la regla "menor a 1 = 1" y muestra el metraje por segmento y el total del ítem.
     // Los valores calculados AQUÍ son SOLO para visualización en la UI. Los cálculos de metraje para materiales
     // se realizarán en la función calculateMaterials, usando los mismos principios pero sobre los datos validados.
     const calculateAndDisplayItemMetraje = (itemBlock) => {
         const type = itemBlock.querySelector('.item-structure-type').value;
         const itemMetrajeDisplay = itemBlock.querySelector('.item-metraje-display');
         let metrajeValue = 0; // Usaremos esta variable para el valor calculado del ÍTEM
         let metrajeUnit = ''; // Unidad del metraje (m² o m)

         // Limpia el contenido anterior del metraje del ÍTEM
          if (itemMetrajeDisplay) {
             itemMetrajeDisplay.textContent = 'Calculando metraje...';
             itemMetrajeDisplay.style.color = 'initial'; // Reset color
          } else {
              console.warn("Metraje display div not found for item", itemBlock.dataset.itemId);
              return; // Sale si no encuentra el div
          }

          // Limpia los divs de metraje por SEGMENTO (se actualizarán después si aplica)
          itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => {
              div.textContent = '';
              div.style.color = 'inherit';
          });


         try {
             if (type === 'muro') {
                 let itemMuroMetrajeAreaCalc = 0; // Metraje total del ítem muro
                 const segmentBlocks = itemBlock.querySelectorAll('.muro-segment');
                  // Oculta metrajes de segmentos si no hay segmentos (aunque el input group esté visible)
                  if (segmentBlocks.length === 0 && itemBlock.querySelector('.muro-segments:not(.hidden)')) {
                      itemMetrajeDisplay.textContent = 'Metraje: Agrega segmentos.';
                      itemMetrajeDisplay.style.color = 'orange';
                       // Asegura que los divs de segmento estén limpios
                       itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => div.textContent = '');
                      return; // No hay segmentos para calcular metraje visual
                  }

                 segmentBlocks.forEach((segBlock, index) => {
                     const segmentWidth = parseFloat(segBlock.querySelector('.item-width').value);
                     const segmentHeight = parseFloat(segBlock.querySelector('.item-height').value);
                     const segmentNumber = index + 1;


                     // --- Cálculo de Metraje para ESTE Segmento de Muro (NUEVO - Explicitly) ---
                     // Aplica la regla: si la dimensión es menor a 1 o NaN/<=0, usa 1 (o 0 if NaN/<=0).
                     // Si la dimensión es 0 o inválida, su contribución al metraje debe ser 0.
                     const metrajeWidth = isNaN(segmentWidth) || segmentWidth <= 0 ? 0 : Math.max(1, segmentWidth);
                     const metrajeHeight = isNaN(segmentHeight) || segmentHeight <= 0 ? 0 : Math.max(1, segmentHeight);

                     // Calcula el área del segmento usando las dimensiones ajustadas para metraje
                      const segmentMetrajeArea = metrajeWidth * metrajeHeight;

                     itemMuroMetrajeAreaCalc += segmentMetrajeArea; // Suma al metraje total del ítem muro

                     // Mostrar metraje por segmento
                     const segmentMetrajeDisplayDiv = segBlock.querySelector('.segment-metraje-display');
                     if (segmentMetrajeDisplayDiv) {
                          if (isNaN(segmentMetrajeArea)) { // Check if the result is NaN (e.g. from NaN * NaN)
                              segmentMetrajeDisplayDiv.textContent = 'Metraje Seg: Error';
                              segmentMetrajeDisplayDiv.style.color = 'red';
                          } else {
                               // Solo mostrar metraje si el segmento tuvo alguna dimensión > 0 ajustada
                                if (segmentMetrajeArea > 0) {
                                     segmentMetrajeDisplayDiv.textContent = `Metraje Seg: ${segmentMetrajeArea.toFixed(2)} m²`;
                                     segmentMetrajeDisplayDiv.style.color = 'inherit'; // Color por defecto
                                } else {
                                    segmentMetrajeDisplayDiv.textContent = ''; // Limpiar si el metraje es 0
                                }
                          }
                     }
                 });
                 metrajeValue = itemMuroMetrajeAreaCalc;
                 metrajeUnit = 'm²';

             } else if (type === 'cielo') {
                 let itemCieloMetrajeAreaCalc = 0; // Metraje total del ítem cielo
                 const segmentBlocks = itemBlock.querySelectorAll('.cielo-segment');
                  // Oculta metrajes de segmentos si no hay segmentos
                  if (segmentBlocks.length === 0 && itemBlock.querySelector('.cielo-segments:not(.hidden)')) {
                      itemMetrajeDisplay.textContent = 'Metraje: Agrega segmentos.';
                      itemMetrajeDisplay.style.color = 'orange';
                       // Asegura que los divs de segmento estén limpios
                      itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => div.textContent = '');
                      return; // No hay segmentos para calcular metraje visual
                  }

                 segmentBlocks.forEach((segBlock, index) => {
                      const segmentWidth = parseFloat(segBlock.querySelector('.item-width').value); // Ancho para cielo
                      const segmentLength = parseFloat(segBlock.querySelector('.item-length').value); // Largo para cielo
                      const segmentNumber = index + 1;

                       // --- Cálculo de Metraje para ESTE Segmento de Cielo (NUEVO) ---
                       // Aplica la regla: si la dimensión es menor a 1 o NaN/<=0, usa 1 (o 0 if NaN/<=0 initially).
                        const metrajeWidth = isNaN(segmentWidth) || segmentWidth <= 0 ? 0 : Math.max(1, segmentWidth);
                        const metrajeLength = isNaN(segmentLength) || segmentLength <= 0 ? 0 : Math.max(1, segmentLength);

                       // Calcula el área del segmento usando las dimensiones ajustadas para metraje
                       const segmentMetrajeArea = metrajeWidth * metrajeLength;

                      itemCieloMetrajeAreaCalc += segmentMetrajeArea; // Suma al metraje total del ítem cielo

                       // Mostrar metraje por segmento
                      const segmentMetrajeDisplayDiv = segBlock.querySelector('.segment-metraje-display');
                      if (segmentMetrajeDisplayDiv) {
                          if (isNaN(segmentMetrajeArea)) { // Check if the result is NaN
                               segmentMetrajeDisplayDiv.textContent = 'Metraje Seg: Error';
                               segmentMetrajeDisplayDiv.style.color = 'red';
                          } else {
                               // Solo mostrar metraje si el segmento tuvo alguna dimensión > 0 ajustada
                                if (segmentMetrajeArea > 0) {
                                    segmentMetrajeDisplayDiv.textContent = `Metraje Seg: ${segmentMetrajeArea.toFixed(2)} m²`;
                                    segmentMetrajeDisplayDiv.style.color = 'inherit'; // Color por defecto
                                } else {
                                     segmentMetrajeDisplayDiv.textContent = ''; // Limpiar si el metraje es 0
                                }
                          }
                      }
                  });
                 metrajeValue = itemCieloMetrajeAreaCalc;
                 metrajeUnit = 'm²';

             } else if (type === 'cenefa') { // --- NUEVO: Cálculo de metraje para Cenefa ---
                 const cenefaInputsContainer = itemBlock.querySelector('.cenefa-inputs');
                 const lengthInput = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-length') : null;
                 const facesInput = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-faces') : null;


                 const cenefaLength = parseFloat(lengthInput ? lengthInput.value : NaN);
                 const cenefaFaces = parseInt(facesInput ? facesInput.value : NaN);

                  if (isNaN(cenefaLength) || cenefaLength <= 0 || isNaN(cenefaFaces) || cenefaFaces <= 0) {
                      itemMetrajeDisplay.textContent = 'Metraje: Ingresa Largo y Nº Caras válidos (> 0).';
                      itemMetrajeDisplay.style.color = 'orange';
                       // Oculta los divs de metraje por segmento ya que cenefa no tiene segmentos
                      itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => div.textContent = '');
                      return; // Inputs inválidos para metraje visual
                  }

                  // Aplica la regla: si el largo es menor a 1, usa 1. Las caras no se ajustan con esta regla.
                  // Nota: La lógica original mencionó Ancho y Alto para metraje de cenefa, pero la fórmula
                  // y el uso típico de metraje lineal para cenefas sugiere Largo x Caras. Usaremos Largo x Caras.
                  const adjustedLength = isNaN(cenefaLength) || cenefaLength <= 0 ? 0 : Math.max(1, cenefaLength);

                  metrajeValue = adjustedLength * cenefaFaces;
                  metrajeUnit = 'm'; // Metraje lineal para cenefa

                 // Oculta los divs de metraje por segmento ya que cenefa no tiene segmentos
                 itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => div.textContent = '');


             } else {
                 itemMetrajeDisplay.textContent = 'Metraje: Tipo desconocido.';
                 itemMetrajeDisplay.style.color = 'red';
                  // Oculta metrajes de segmentos
                 itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => div.textContent = '');
                 return; // Tipo desconocido
             }

             // Muestra el metraje calculado para el ítem
             if (!isNaN(metrajeValue) && metrajeValue >= 0) { // Ensure metrajeValue is a non-negative number
                  itemMetrajeDisplay.textContent = `Metraje Total Ítem: ${metrajeValue.toFixed(2)} ${metrajeUnit}`;
                  itemMetrajeDisplay.style.color = 'inherit'; // Reset color to default
             } else {
                  // Esto debería ser manejado por la validación de inputs, pero es una seguridad
                  itemMetrajeDisplay.textContent = 'Metraje: Error en cálculo.';
                  itemMetrajeDisplay.style.color = 'red';
                   // Oculta metrajes de segmentos
                 itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => div.textContent = '');
             }


         } catch (error) {
             console.error(`Error calculando metraje para ítem ${itemBlock.dataset.itemId}:`, error);
             itemMetrajeDisplay.textContent = 'Metraje: Error en cálculo.';
             itemMetrajeDisplay.style.color = 'red';
              // Oculta metrajes de segmentos
             itemBlock.querySelectorAll('.segment-metraje-display').forEach(div => div.textContent = '');
         }
     };
     // --- Fin NUEVA FUNCIÓN: Calcular y Mostrar Metraje por Ítem ---


     // --- NUEVA FUNCIÓN: Lógica de Cálculo de Materiales y Metraje para UN SOLO ÍTEM ---
     // Esta función recibe un objeto con las especificaciones VALIDADAS del ítem.
     // Devuelve un objeto con las cantidades FLOAT de materiales (incluyendo fijaciones FLOAT) y el metraje del ítem (ya calculado y validado).
     const performSingleItemCalculations = (itemSpecs) => {
         const { id, number, type } = itemSpecs;

         // itemMetraje already contains the validated metrajeArea or metrajeLinear for this item
         // Stored as itemSpecs.metrajeArea or itemSpecs.metrajeLinear

         // Object to hold calculated *other* materials for THIS single item (initial floats)
         // Initialize finishing based on the primary panel type for the item
         let initialFinishingPanelType = null;
         if (type === 'muro') initialFinishingPanelType = itemSpecs.cara1PanelType;
         else if (type === 'cielo') initialFinishingPanelType = itemSpecs.cieloPanelType;
         else if (type === 'cenefa') initialFinishingPanelType = itemSpecs.cenefaPanelType;
         let itemOtherMaterialsFloat = getFinishingMaterialKeys(initialFinishingPanelType); // Get keys initialized to 0


         // Initialize fastener keys explicitly to 0 for all types that can appear,
         // to ensure they exist before summing, regardless of panel type initialization.
         itemOtherMaterialsFloat['Clavos con Roldana'] = (itemOtherMaterialsFloat['Clavos con Roldana'] || 0.0);
         // Fulminantes are global, calculated at the end. Do NOT initialize here.
         itemOtherMaterialsFloat['Tornillos de 1" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1" punta fina'] || 0.0);
         itemOtherMaterialsFloat['Tornillos de 1" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1" punta broca'] || 0.0);
         itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0);
         itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] || 0.0);
         // Patas and Canal Liston (para cuelgue) are intermediate or derived quantities, initialize to 0 if needed as keys for accumulation
         itemOtherMaterialsFloat['Patas'] = (itemOtherMaterialsFloat['Patas'] || 0.0);
         itemOtherMaterialsFloat['Canal Listón (para cuelgue)'] = (itemOtherMaterialsFloat['Canal Listón (para cuelgue)'] || 0.0);

         // Initialize Poste types to 0 explicitly
          POSTE_TYPES.forEach(posteType => {
               itemOtherMaterialsFloat[posteType] = (itemOtherMaterialsFloat[posteType] || 0.0);
          });
          // Initialize Canal types to 0 explicitly
          itemOtherMaterialsFloat['Canales'] = (itemOtherMaterialsFloat['Canales'] || 0.0); // Standard Canales
          itemOtherMaterialsFloat['Canales Calibre 20'] = (itemOtherMaterialsFloat['Canales Calibre 20'] || 0.0); // Calibre 20 Canales
          itemOtherMaterialsFloat['Canal Listón'] = (itemOtherMaterialsFloat['Canal Listón'] || 0.0); // Principales Canal Listón + Horizontal Cenefa
          itemOtherMaterialsFloat['Canal Soporte'] = (itemOtherMaterialsFloat['Canal Soporte'] || 0.0);
          itemOtherMaterialsFloat['Angular de Lámina'] = (itemOtherMaterialsFloat['Angular de Lámina'] || 0.0);


         // Details for updating global panel accumulators - This will store information needed to add to panelAccumulators later
         let itemPanelDetailsForAccumulator = {
             type: type, // Store item type
             segmentsOrItemAreaDetails: [] // Array to store details for panel accumulation based on type
         };


         if (type === 'muro') {
              const { faces, postSpacing, postType, isDoubleStructure, cara1PanelType, cara2PanelType, totalMuroArea, totalMuroWidth } = itemSpecs;
              // totalMuroArea and totalMuroWidth are sums of actual dimensions of VALID segments for materials


              // Store panel details for accumulator update
              itemPanelDetailsForAccumulator.segmentsOrItemAreaDetails = itemSpecs.segments.filter(seg => seg.isValidForMaterials).map(seg => ({
                   // For muro, store segment unit dimensions and panel types for the small area check logic
                   unitWidth: seg.width,
                   unitHeight: seg.height,
                   segmentArea: seg.area, // Use the actual area of the valid segment
                   panelType: cara1PanelType, // Store Cara 1 panel type for this segment area
                   panelTypeFace2: faces === 2 ? cara2PanelType : null // Include face 2 type only if 2 faces
              }));


              // --- Other Materials Calculation for THIS Muro Item (Structure, Finishing, Fasteners) ---
              // Structure calculation is based on the *total accumulated width* of all *valid* segments (using actual width)
              const totalMuroWidthForStructureCalc = totalMuroWidth;
              const totalMuroAreaForPanelsFinishingCalc = totalMuroArea; // Use sum of actual areas of valid segments

              // Postes (based on total valid width/height and SELECTED POSTE TYPE) - Implementing detailed logic
              // Variables used from itemSpecs (already destructured at the start of this block):
              // postSpacing, isDoubleStructure, postType
              // Derived variable:
              const ancho_muro = itemSpecs.totalMuroWidth; // Sum of widths of valid segments

              // Derive alto_muro from segments: use the maximum height among valid segments
              let maxSegmentHeight = 0;
              itemSpecs.segments.filter(seg => seg.isValidForMaterials).forEach(seg => {
                  if (seg.height > maxSegmentHeight) {
                      maxSegmentHeight = seg.height;
                  }
              });
              const alto_muro = maxSegmentHeight;

              // --- Start New Post Calculation Logic (based on user provided logic) ---
              // Lógica del Cálculo Horizontal de Postes (Num_Horizontal)
              let Num_Horizontal;
              if (ancho_muro <= 0) {
                  Num_Horizontal = 0;
              } else if (ancho_muro > 0 && ancho_muro < postSpacing) {
                  Num_Horizontal = 2;
              } else { // ancho_muro >= postSpacing
                  Num_Horizontal = Math.floor(ancho_muro / postSpacing) + 1;
              }

              // Cálculo del Número Total de Postes para Estructura Simple (Total_Postes_Simple) basándose en el alto_muro
              let Total_Postes_Simple;
              if (alto_muro <= 0 || Num_Horizontal === 0) {
                  Total_Postes_Simple = 0;
              } else if (alto_muro > 0 && alto_muro <= POSTE_LARGO_MAX_M) { // Use POSTE_LARGO_MAX_M constant
                  Total_Postes_Simple = Num_Horizontal;
              } else { // alto_muro > POSTE_LARGO_MAX_M
                  let alto_con_empalme = alto_muro + EMPALME_LONGITUD_M; // Use EMPALME_LONGITUD_M constant
                  // Usando la fórmula proporcionada para cantidad_paso2 (Num_Horizontal * alto_con_empalme):
                  let cantidad_paso2 = Num_Horizontal * alto_con_empalme;
                  Total_Postes_Simple = Math.ceil(cantidad_paso2 / POSTE_LARGO_MAX_M); // Use POSTE_LARGO_MAX_M constant
              }

              // Cálculo del Número Total de Postes Final (Total_Postes_Final) basándose en el tipo_estructura
              let Total_Postes_Final; // This is used for overall reporting/visualization if needed, not directly for 1/2" screws calc anymore
              if (isDoubleStructure) {
                  Total_Postes_Final = Total_Postes_Simple * 2;
              } else {
                  Total_Postes_Final = Total_Postes_Simple;
              }


              // Asigna la cantidad de postes (FLOAT) calculada al material específico (Poste por su tipo) - Usar Total_Postes_Final para el material de poste a comprar
              if (postType) {
                  itemOtherMaterialsFloat[postType] = (itemOtherMaterialsFloat[postType] || 0.0) + Total_Postes_Final; // Sumar la cantidad float (que aquí es entera)
              }
              // --- End New Post Calculation Logic ---


              // Canales (based on total valid width) - Implementing new logic
              // Formula: Sumatoria_Canales_Brutos = (Muro.Longitud * 2 / Largo_Canal) * (Muro.Es_Doble_Estructura ? 2 : 1)
              // We calculate this per item based on the item's total valid width and double structure
              let canalesBrutosThisItem = 0;
              if (totalMuroWidthForStructureCalc > 0) {
                  canalesBrutosThisItem = (totalMuroWidthForStructureCalc * 2) / CANAL_LARGO_M; // Use CANAL_LARGO_M constant
                  if (isDoubleStructure) canalesBrutosThisItem *= 2;
              }

              // Determine Canales type based on panel type of Cara 1
              // Add to the float total for this item
              itemOtherMaterialsFloat[cara1PanelType === 'Exterior' ? 'Canales Calibre 20' : 'Canales'] = (itemOtherMaterialsFloat[cara1PanelType === 'Exterior' ? 'Canales Calibre 20' : 'Canales'] || 0.0) + canalesBrutosThisItem;


              // Acabado (Pasta, Cinta, Lija / Basecoat, Cinta Malla, Esponja) - Based on total accumulated area of ALL *valid* segments
              // The primary panel type for finishing calculation is determined during the accumulation phase
              // based on the panel type associated with each segment's area contribution.
              // We calculate the estimated panels here based on the total valid area for use in fastener calculations.
               const estimatedPanelsForFinishing = totalMuroAreaForPanelsFinishingCalc > 0 ? totalMuroAreaForPanelsFinishingCalc / PANEL_RENDIMIENTO_M2 : 0; // Use PANEL_RENDIMIENTO_M2

              // Finishing material calculation is handled during the global accumulation phase based on panel types per segment/item area.
              // Initialize finishing keys to 0.0 earlier to ensure they exist in itemOtherMaterialsFloat.


              // --- Start Fastener Calculation Logic (Muro Item) - Uses FLOAT quantities ---

              // 1. Clavos con Roldana (Uso en Muros)
              // Formula: Cantidad Total de Canales (Muros Item) x 8
              // Usamos la cantidad float de canales calculada para este item (canalesBrutosThisItem) y multiplicamos por 8.
              itemOtherMaterialsFloat['Clavos con Roldana'] = (itemOtherMaterialsFloat['Clavos con Roldana'] || 0.0) + (canalesBrutosThisItem * 8);


              // 3. Tornillos de 1" (Uso en Muros - Fijación de Paneles)
              // Lógica: 40 tornillos por cada cara. Calcular tornillos por cada cara, sumando si el muro tiene 2 caras con distintos paneles.
              // Basado en Cantidad estimada de Paneles por Cara (Float) x 40.
              // Use the estimated float panel count for this item (estimatedPanelsForFinishing), and divide by the number of faces to get panels per face.
              if (estimatedPanelsForFinishing > 0 && faces > 0) {
                   const estimatedItemPanelsPerFaceFloat = estimatedPanelsForFinishing / faces;

                  // Calcula los tornillos para la Cara 1 (40 por la cantidad estimada de paneles para UNA cara)
                  if (cara1PanelType === 'Exterior') {
                      // Si la Cara 1 usa panel Exterior, agrega tornillos Punta Broca
                      itemOtherMaterialsFloat['Tornillos de 1" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1" punta broca'] || 0.0) + (estimatedItemPanelsPerFaceFloat * 40);
                  } else { // Asumiendo que es un tipo de panel Interior si no es Exterior
                      // Si la Cara 1 usa panel Interior, agrega tornillos Punta Fina
                      itemOtherMaterialsFloat['Tornillos de 1" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1" punta fina'] || 0.0) + (estimatedItemPanelsPerFaceFloat * 40);
                  }

                  // Calcula los tornillos para la Cara 2 (solo si el muro tiene 2 caras y se especificó un tipo de panel)
                  if (faces === 2 && cara2PanelType) { // Only calculate for Face 2 if 2 faces are selected and type exists
                       if (cara2PanelType === 'Exterior') {
                          // Si la Cara 2 usa panel Exterior, agrega tornillos Punta Broca
                          itemOtherMaterialsFloat['Tornillos de 1" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1" punta broca'] || 0.0) + (estimatedItemPanelsPerFaceFloat * 40);
                       } else { // Asumiendo que es un tipo de panel Interior si no es Exterior
                          // Si la Cara 2 usa panel Interior, agrega tornillos Punta Fina
                          itemOtherMaterialsFloat['Tornillos de 1" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1" punta fina'] || 0.0) + (estimatedItemPanelsPerFaceFloat * 40);
                       }
                  }
              }


              // 4. Tornillos de 1/2" (Uso en Muros - Fijación de Postes a Canales y Empalmes)
              // Lógica: 4 tornillos por poste.
              // Use la cantidad de postes calculada para estructura simple (Total_Postes_Simple).
              // Si es estructura simple, Total_Postes_Simple postes para ambas caras.
              // Si es estructura doble, Total_Postes_Simple postes para Cara 1, y Total_Postes_Simple para Cara 2.
              if (Total_Postes_Simple > 0) { // Check if there's structure
                 if (isDoubleStructure) {
                     // Doble estructura: 4 tornillos por cada Total_Postes_Simple para cada cara
                     if (cara1PanelType === 'Exterior') {
                          itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] || 0.0) + (Total_Postes_Simple * 4);
                     } else { // Cara 1 is Interior type
                          itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0) + (Total_Postes_Simple * 4);
                     }

                     if (faces === 2 && cara2PanelType) { // If there's a second face
                          if (cara2PanelType === 'Exterior') {
                              itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] || 0.0) + (Total_Postes_Simple * 4);
                          } else { // Cara 2 is Interior type
                               itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0) + (Total_Postes_Simple * 4);
                          }
                     }

                 } else {
                     // Estructura simple: 4 tornillos por cada Total_Postes_Simple para ambas caras
                     // Distribuir los tornillos basados en si hay panel exterior o interior.
                     let needsBroca = cara1PanelType === 'Exterior' || (faces === 2 && cara2PanelType === 'Exterior');
                     let needsFina = cara1PanelType !== 'Exterior' || (faces === 2 && cara2PanelType !== 'Exterior'); // Assuming anything not Exterior needs Fina

                     if (needsBroca) {
                         itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] || 0.0) + (Total_Postes_Simple * 4);
                     }
                     if (needsFina) {
                          // If both types are needed, add to fina as well.
                           itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0) + (Total_Postes_Simple * 4);
                     }
                     // Note: This might overcount if both panel types are present in a simple structure (e.g., Exterior on Cara 1, Interior on Cara 2).
                     // A more accurate interpretation for simple structure might be: if ANY exterior panel is present, add Total_Postes_Simple*4 to Broca. If ANY interior panel is present, add Total_Postes_Simple*4 to Fina.
                     // Let's refine the simple structure logic to avoid potential overcounting:
                     itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] || 0.0); // Reset current item's contribution
                     itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0); // Reset current item's contribution

                     if (cara1PanelType === 'Exterior' || (faces === 2 && cara2PanelType === 'Exterior')) {
                         // If Cara 1 OR Cara 2 is Exterior, add Total_Postes_Simple * 4 to Broca
                          itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] += (Total_Postes_Simple * 4);
                     }
                      if (cara1PanelType !== 'Exterior' || (faces === 2 && cara2PanelType !== 'Exterior')) {
                         // If Cara 1 OR Cara 2 is Interior type, add Total_Postes_Simple * 4 to Fina
                          itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] += (Total_Postes_Simple * 4);
                      }
                     // This still might overcount if one side needs fina and the other broca in a simple structure.
                     // The simplest interpretation of "4 tornillos por poste" for simple structure is Total_Postes_Simple * 4, and the punta type depends on the primary panel or needs both if both types are present.
                     // Let's revert to the initial interpretation based on Total_Postes_Final, as it accounts for double structure multiplication correctly at the poste count level.
                     // Total_Postes_Final already includes the double structure multiplication.
                     // So, 4 screws per Total_Postes_Final. Distribute based on panel types.
                     itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] || 0.0); // Reset current item's contribution
                     itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0); // Reset current item's contribution

                      if (cara1PanelType === 'Exterior' || (faces === 2 && cara2PanelType === 'Exterior')) {
                         // If Cara 1 OR Cara 2 is Exterior, add Total_Postes_Final * 4 to Broca
                          itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] += (Total_Postes_Final * 4);
                      }
                       if (cara1PanelType !== 'Exterior' || (faces === 2 && cara2PanelType !== 'Exterior')) {
                          // If Cara 1 OR Cara 2 is Interior type, add Total_Postes_Final * 4 to Fina
                           itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] += (Total_Postes_Final * 4);
                       }
                       // This logic seems the most consistent with "4 tornillos por poste" applied to the total number of required postes (Total_Postes_Final) and distributing the type based on which panel types are present in the item.

                 }
              }

              // --- End Fastener Calculation Logic (Muro Item) ---


         } else if (type === 'cielo') {
              const { plenum, angularDeduction, cieloPanelType, segments, totalCieloArea, totalCieloPerimeterSum, cieloPanelWaste, totalValidWidthForSoporte, totalValidLengthForSoporte } = itemSpecs;
              // totalCieloArea and totalCieloPerimeterSum are sums of actual dimensions of VALID segments for materials


              // Store panel details for accumulator update
              if (totalCieloArea > 0) {
                   itemPanelDetailsForAccumulator.segmentsOrItemAreaDetails = [{ // Cielo item total area is treated as one area for panel accumulation
                       segmentArea: totalCieloArea, // Use the actual total area of valid segments
                       panelType: cieloPanelType,
                       wastePercentage: cieloPanelWaste // Store waste percentage for this item
                   }];
               }


              // --- Other Materials Calculation for THIS Cielo Item (Structure, Finishing, Fasteners) ---
              const totalCieloAreaForPanelsFinishingCalc = totalCieloArea;
              const totalCieloPerimeterForAngularCalc = totalCieloPerimeterSum;

               // Canal Listón (Canales Principales) - Implementing detailed logic (based on area interpretation)
               let canalListonPrincipalesFloat = 0;
               if (totalCieloAreaForPanelsFinishingCalc > 0) {
                   // Reinterpreting steps based on area: (total area / 0.40 spacing) gives total linear needed of supports at 0.40 centers covering the area.
                   // Then divide by piece length to get number of bars.
                   // This matches the old logic: (total area / 0.40) / 3.66.
                   canalListonPrincipalesFloat = (totalCieloAreaForPanelsFinishingCalc / CIELO_LISTON_ESPACIAMIENTO_M) / CANAL_LISTON_LARGO_M; // Use constants
               }
               itemOtherMaterialsFloat['Canal Listón'] = (itemOtherMaterialsFloat['Canal Listón'] || 0.0) + canalListonPrincipalesFloat;


               // Canal Soporte - Implementing detailed logic
                let canalSoporteFloat = 0;
                const ancho_cielo_formula = totalValidWidthForSoporte; // Sum of actual widths of valid segments
                const largo_cielo_formula = totalValidLengthForSoporte; // Sum of actual lengths of valid segments

                if (ancho_cielo_formula > 0 && largo_cielo_formula > 0) {
                    // Paso 1: NumFilas = FLOOR(Ancho del cielo / 0.90)
                    const NumFilas = Math.floor(ancho_cielo_formula / CIELO_SOPORTE_ESPACIAMIENTO_M); // Use constant

                    // Paso 2: LongitudTotalTeorica = NumFilas * Largo del cielo
                    const LongitudTotalTeorica = NumFilas * largo_cielo_formula;

                    // Paso 3: NumeroSegmentosBaseTeorico = LongitudTotalTeorica / 3.66
                    const NumeroSegmentosBaseTeorico = LongitudTotalTeorica / CANAL_SOPORTE_LARGO_M; // Use constant

                    // Paso 4: CantidadAdicionalTeorica = 0.30 * NumeroSegmentosBaseTeorico SI Largo del cielo > 3.66
                    let CantidadAdicionalTeorica = 0;
                    if (largo_cielo_formula > CANAL_SOPORTE_LARGO_M) { // Use constant
                         CantidadAdicionalTeorica = 0.30 * NumeroSegmentosBaseTeorico;
                    }

                    // Paso 5: NumeroTotalTeoricoConBuffer = NumeroSegmentosBaseTeorico + CantidadAdicionalTeorica
                    const NumeroTotalTeoricoConBuffer = NumeroSegmentosBaseTeorico + CantidadAdicionalTeorica;

                    // Paso 6: Resultado Final = CEILING(NumeroTotalTeoricoConBuffer) - Apply global rounding later
                    canalSoporteFloat = NumeroTotalTeoricoConBuffer; // Store the float value before final global rounding
                }
               itemOtherMaterialsFloat['Canal Soporte'] = (itemOtherMaterialsFloat['Canal Soporte'] || 0.0) + canalSoporteFloat;


               // Patas (Soportes) - Calculation based on Canal Soporte quantity for THIS item AND the geometric formula
               // The logic describes calculating TotalSoportes = (L/Es) * (A/Es) AND says Patas come from Canal Soporte.
               // Let's use the geometric formula for TotalSoportes needed, which is then cut from Canal Listón.
               // So, TotalSoportes needed is calculated here, and the Canal Listón needed for Cuelgue is calculated below.
               let totalSoportesCalculated = 0;
               if (totalValidWidthForSoporte > 0 && totalValidLengthForSoporte > 0 && plenum >= 0 && !isNaN(plenum)) { // Ensure plenum is valid
                   // NumLineas_L = L / Es, NumLineas_A = A / Es, TotalSoportes = NumLineas_L * NumLineas_A
                   // Using totalValidLengthForSoporte as L and totalValidWidthForSoporte as A in the formula.
                   const NumLineas_L_cuelgue = totalValidLengthForSoporte / CIELO_SOPORTE_ESPACIAMIENTO_M; // Use constant
                   const NumLineas_A_cuelgue = totalValidWidthForSoporte / CIELO_SOPORTE_ESPACIAMIENTO_M; // Use constant
                    // Round NumLineas up? The formula doesn't specify, but you need a whole number of lines. Let's ceil.
                   totalSoportesCalculated = Math.ceil(NumLineas_L_cuelgue) * Math.ceil(NumLineas_A_cuelgue);
               }
               itemOtherMaterialsFloat['Patas'] = (itemOtherMaterialsFloat['Patas'] || 0.0) + totalSoportesCalculated; // Store the calculated number of patas (integer)


               // Canal Listón (para cuelgue) - Represents the number of 3.66m profiles needed to cut the hangers
               // Calculation based on calculated Patas quantity (totalSoportesCalculated) and Plenum for THIS item
                let canalListonCuelgueFloat = 0;
                if (totalSoportesCalculated > 0 && plenum >= 0 && !isNaN(plenum)) {
                   const longitudSoporte = plenum + CIELO_SOPORTE_EXTRA_M; // Use constant
                   const longitudTotalNecesaria = totalSoportesCalculated * longitudSoporte;
                   canalListonCuelgueFloat = longitudTotalNecesaria / CANAL_LISTON_LARGO_M; // Use constant
                }
               itemOtherMaterialsFloat['Canal Listón (para cuelgue)'] = (itemOtherMaterialsFloat['Canal Listón (para cuelgue)'] || 0.0) + canalListonCuelgueFloat;


               // Angular de Lámina - Implementing detailed logic
               // Based on sum of required perimeter lengths (totalCieloPerimeterSum - angularDeduction)
                let angularLaminaFloat = 0;
                if (totalCieloPerimeterForAngularCalc > 0) {
                    // --- Aplica el descuento antes de dividir ---
                    let adjustedPerimeter = totalCieloPerimeterForAngularCalc - (isNaN(angularDeduction) ? 0 : angularDeduction);
                    if (adjustedPerimeter < 0) adjustedPerimeter = 0;
                    // --- Fin aplicación de descuento ---

                    if (adjustedPerimeter > 0) {
                       // Logic: (Longitud Total Requerida Sin Empalmes + Longitud Total Adicional por Empalmes) / 2.44
                       // Longitud Total Requerida Sin Empalmes = adjustedPerimeter
                       const longitudTotalRequeridaSinEmpalmes = adjustedPerimeter;

                       // Estimación del Número de Piezas Inicial (Base para Empalmes) = RedondearArriba(Longitud Total Requerida Sin Empalmes / 2.44)
                       const numeroEstimadoInicialPiezas = Math.ceil(longitudTotalRequeridaSinEmpalmes / ANGULAR_LAMINA_LARGO_M); // Use constant

                       // Cantidad Estimada de Empalmes = max(0, Número Estimado Inicial de Piezas - 1)
                       const cantidadEstimadaEmpalmes = Math.max(0, numeroEstimadoInicialPiezas - 1);

                       // Longitud Total Adicional por Empalmes = Cantidad Estimada de Empalmes * 0.15
                       const longitudTotalAdicionalEmpalmes = cantidadEstimadaEmpalmes * ANGULAR_EMPALME_M; // Use constant

                       // Longitud Total de Material Necesario = Longitud Total Requerida Sin Empalmes + Longitud Total Adicional por Empalmes
                       const longitudTotalMaterialNecesario = longitudTotalRequeridaSinEmpalmes + longitudTotalAdicionalEmpalmes;

                       // Número Final de Piezas a Utilizar = Longitud Total de Material Necesario / 2.44
                       angularLaminaFloat = longitudTotalMaterialNecesario / ANGULAR_LAMINA_LARGO_M; // Use constant
                       // Redondeo final se aplica globalmente
                    }
                }
               itemOtherMaterialsFloat['Angular de Lámina'] = (itemOtherMaterialsFloat['Angular de Lámina'] || 0.0) + angularLaminaFloat;


               // Acabado (Pasta, Cinta de Papel, Lija / Basecoat, Cinta malla, Esponja) - Based on item total valid area
               // Handled during global accumulation based on panel type of the item area contribution.


               // --- Start Fastener Calculation Logic (Cielo Item) - Uses FLOAT quantities ---

               // 1. Clavos con Roldana (Uso en Cielos)
               // Formula: Cantidad Total de Angulares (Cielos Item) x 5 + Cantidad Total de Soportes o Patas (Cielos Item) x 2
               // Use float quantities calculated for this item.
               const angularLaminaFloatThisItem = itemOtherMaterialsFloat['Angular de Lámina'] || 0.0;
               const patasCountThisItem = itemOtherMaterialsFloat['Patas'] || 0; // Patas is a count

               itemOtherMaterialsFloat['Clavos con Roldana'] = (itemOtherMaterialsFloat['Clavos con Roldana'] || 0.0) + (angularLaminaFloatThisItem * 5) + (patasCountThisItem * 2);


               // 3. Tornillos de 1" (Uso en Cielos - Fijación de Paneles)
               // Always use punta fina for ceiling panels.
               // Formula: Cantidad Total de Paneles (Cielos Item) x 40
               // Use the estimated float panel count for this item (estimatedPanelsForFinishing)
               if (estimatedPanelsForFinishing > 0) {
                    itemOtherMaterialsFloat['Tornillos de 1" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1" punta fina'] || 0.0) + (estimatedPanelsForFinishing * 40);
               }


               // 4. Tornillos de 1/2" (Uso en Cielos - Fijación de Canales Listón a Estructura Principal y Elementos de Soporte)
               // Formula: Cantidad Total de Canales Listón Principales (Cielos Item) x 12 + Cantidad Total de Soportes o Patas (Cielos Item) x 2
                // Use float quantities calculated for this item.
               const canalListonPrincipalesFloatThisItem = itemOtherMaterialsFloat['Canal Listón'] || 0.0; // Only Canal Listón Principal gets screws at 12x
               const patasCountForTornillosThisItem = itemOtherMaterialsFloat['Patas'] || 0; // Patas count

               itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0) + (canalListonPrincipalesFloatThisItem * 12) + (patasCountForTornillosThisItem * 2);

               // Fulminantes (Global calculation, not per item) - Lógica movida al final de calculateMaterials

               // --- End Fastener Calculation Logic (Cielo Item) ---


           } else if (type === 'cenefa') { // --- Cálculo para Cenefa ---
                const { cenefaLength, cenefaWidth, cenefaHeight, cenefaFaces, cenefaPanelType, cenefaOrientation, cenefaAnchorWallType, metrajeLinear } = itemSpecs;
               // metrajeLinear is already calculated and validated

               // --- Corrección: Inicializar estimatedPanelsForFinishing ---
               let estimatedPanelsForFinishing = 0;
               // --- Fin Corrección ---


               // Store panel details for accumulator update
               // Estimate panel area for cenefa based on metrajeLinear and an assumed profile dimension (e.g., average of width and height, or a fixed value)
               // Using a fixed assumed height for consistency in estimation if profile dimensions are invalid:
                let estimatedCenefaAreaForPanels = 0;
                 if (metrajeLinear > 0) {
                     if (!isNaN(cenefaWidth) && !isNaN(cenefaHeight) && cenefaWidth > 0 && cenefaHeight > 0) {
                          // If dimensions are valid, use the sum of the areas of the faces
                          // Assuming a rectangular profile with 'faces' surfaces to cover.
                          // This is complex and depends on how faces are defined.
                          // Let's use the simpler estimation based on metrajeLinear and average profile dimension if dimensions are valid.
                          estimatedCenefaAreaForPanels = metrajeLinear * ((cenefaWidth + cenefaHeight) / 2); // Estimate based on avg profile dim * linear length
                     } else {
                          // Fallback to fixed assumed height if profile dimensions are invalid or 0
                          estimatedCenefaAreaForPanels = metrajeLinear * CENEFA_ESTIMATED_PROFILE_HEIGHT_M; // Use fixed assumed height
                     }
                 }

                // --- Corrección: Calcular estimatedPanelsForFinishing DESPUÉS de estimar el área ---
                if (estimatedCenefaAreaForPanels > 0 && !isNaN(estimatedCenefaAreaForPanels)) { // Ensure area is valid before dividing
                    estimatedPanelsForFinishing = estimatedCenefaAreaForPanels / PANEL_RENDIMIENTO_M2; // Use constant
                }
                // --- Fin Corrección ---


                if (estimatedCenefaAreaForPanels > 0 && !isNaN(estimatedCenefaAreaForPanels)) { // Use estimated area for accumulator
                   itemPanelDetailsForAccumulator.segmentsOrItemAreaDetails = [{ // Cenefa item estimated area is treated as one area
                       segmentArea: estimatedCenefaAreaForPanels, // Use the estimated area
                       panelType: cenefaPanelType
                       // Cenefa waste percentage will be applied during global accumulation
                   }];
                   console.log(`Cenefa #${number}: Área estimada para paneles (${estimatedCenefaAreaForPanels.toFixed(2)} m²).`);
               } else {
                   itemPanelDetailsForAccumulator.segmentsOrItemAreaDetails = []; // No area to contribute
                   console.log(`Cenefa #${number}: Área estimada para paneles es 0 o inválida. No contribuye a acumulador.`);
               }


               // --- Other Materials Calculation for THIS Cenefa Item (Structure, Finishing, Fasteners) ---

                // Acabado (Pasta, Cinta, Lija / Basecoat, Cinta Malla, Esponja) - Based on estimated panel area for this item
                // Handled during global accumulation based on panel type of the item estimated area contribution.
                // Use estimatedPanelsForFinishing in fastener calculations below where needed.


               // --- Start Structure and Fastener Calculation Logic (Cenefa Item) - Uses FLOAT quantities ---
               // Based on Orientation (Horizontal/Vertical) and specific formulas.

               if (cenefaOrientation === 'Horizontal') {
                   // Horizontal Cenefa Structure & Fasteners
                   const largo_cenefa = cenefaLength;
                   const ancho_cenefa = cenefaWidth; // Width of the profile
                   const alto_cenefa = cenefaHeight; // Height of the profile
                   const num_caras = cenefaFaces;

                    // Canal Listón (Horizontal Cenefa) - Implementing a plausible interpretation
                    // Assuming Canal Listón runs horizontally along the length, spaced vertically.
                    // Number of horizontal lines = (alto / spacing) + 1 (if ends included). Spacing 0.40.
                    let canalListonHorizontalFloat = 0;
                     if (largo_cenefa > 0 && alto_cenefa > 0) {
                         // Number of horizontal lines along Alto
                         const numHorizontalLines = Math.ceil(alto_cenefa / CIELO_LISTON_ESPACIAMIENTO_M); // Use constant
                         const totalLinearNeeded = numHorizontalLines * largo_cenefa; // Total length of these lines
                         canalListonHorizontalFloat = totalLinearNeeded / CANAL_LISTON_LARGO_M; // Convert to bars
                     }
                   itemOtherMaterialsFloat['Canal Listón'] = (itemOtherMaterialsFloat['Canal Listón'] || 0.0) + canalListonHorizontalFloat;


                   // Angular de Lámina (Horizontal Cenefa) - Implementing logic
                   // "fijado en los dos largos de la cenefa" -> runs along the length L on two sides.
                   // Logic: (Largo * 2 + Empalmes_Longitud) / 2.44
                   let angularHorizontalFloat = 0;
                   if (largo_cenefa > 0) {
                       const longitudTotalRequeridaSinEmpalmes = largo_cenefa * 2; // Two sides of length

                       // Estimación del Número de Piezas Inicial = RedondearArriba(Longitud Total Requerida Sin Empalmes / 2.44)
                       const numeroEstimadoInicialPiezas = Math.ceil(longitudTotalRequeridaSinEmpalmes / ANGULAR_LAMINA_LARGO_M); // Use constant

                       // Cantidad Estimada de Empalmes = max(0, Número Estimado Inicial de Piezas - 1)
                       const cantidadEstimadaEmpalmes = Math.max(0, numeroEstimadoInicialPiezas - 1);

                       // Longitud Total Adicional por Empalmes = Cantidad Estimada de Empalmes * 0.15
                       const longitudTotalAdicionalEmpalmes = cantidadEstimadaEmpalmes * ANGULAR_EMPALME_M; // Use constant

                       // Longitud Total de Material Necesario = Longitud Total Requerida Sin Empalmes + Longitud Total Adicional por Empalmes
                       const longitudTotalMaterialNecesario = longitudTotalRequeridaSinEmpalmes + longitudTotalAdicionalEmpalmes;

                       // Número Final de Piezas a Utilizar = Longitud Total de Material Necesario / 2.44
                       angularHorizontalFloat = longitudTotalMaterialNecesario / ANGULAR_LAMINA_LARGO_M; // Use constant
                       // Redondeo final se aplica globalmente
                   }
                   itemOtherMaterialsFloat['Angular de Lámina'] = (itemOtherMaterialsFloat['Angular de Lámina'] || 0.0) + angularHorizontalFloat;


                   // Fasteners (Horizontal Cenefa)
                   // Canal Listón: 2 tornillos 1/2" punta fina per piece (1 at each end). Use float quantity of Horizontal CL.
                   itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0) + (canalListonHorizontalFloat * 2);

                   // Angular de Lámina: 5 fasteners per angular piece (2.44m). Type depends on attachment wall type.
                   // Assuming 5 fasteners total per 2.44m piece of angular running along the length.
                    const totalAngularFasteners = angularHorizontalFloat * 5; // Total float fasteners for angular
                    if (cenefaAnchorWallType === 'Mamposteria') {
                         itemOtherMaterialsFloat['Clavos con Roldana'] = (itemOtherMaterialsFloat['Clavos con Roldana'] || 0.0) + totalAngularFasteners;
                    } else if (cenefaAnchorWallType === 'Muro Tablayeso') {
                         itemOtherMaterialsFloat['Tornillos de 1" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1" punta fina'] || 0.0) + totalAngularFasteners;
                    }
                    // Fulminantes calculation is global based on total Clavos con Roldana.


               } else if (cenefaOrientation === 'Vertical') {
                   // Vertical Cenefa Structure & Fasteners
                    const largo_cenefa = cenefaLength; // The length dimension
                    const ancho_cenefa = cenefaWidth; // The width dimension of the profile
                    const alto_cenefa = cenefaHeight; // The height dimension of the profile
                    const num_caras = cenefaFaces;

                    // Canal Listón (Vertical Cenefa) - Implementing a plausible interpretation
                    // Assuming Canal Listón runs vertically along the height, spaced horizontally along the length.
                    // Number of vertical lines = (largo / spacing) + 1 (if ends included). Spacing 0.90. Length of each line is alto + extra.
                    let canalListonVerticalFloat = 0;
                    if (largo_cenefa > 0 && alto_cenefa > 0) {
                         // Number of vertical lines spaced horizontally along Largo
                         const numVerticalLines = Math.ceil(largo_cenefa / CIELO_SOPORTE_ESPACIAMIENTO_M); // Use constant
                         const longitudVerticalPieceAdjusted = alto_cenefa + CIELO_SOPORTE_EXTRA_M; // Use constant
                         const totalLinearNeeded = numVerticalLines * longitudVerticalPieceAdjusted; // Total length of these lines
                         canalListonVerticalFloat = totalLinearNeeded / CANAL_LISTON_LARGO_M; // Convert to bars
                    }
                    itemOtherMaterialsFloat['Canal Listón'] = (itemOtherMaterialsFloat['Canal Listón'] || 0.0) + canalListonVerticalFloat;

                    // Angular de Lámina: No Angular calculation for Vertical Cenefas based on provided logic.


                    // Fasteners (Vertical Cenefa Canal Listón)
                    // 2 clavos con Roldana per piece in top, 1 tornillo 1/2" punta fina in bottom. Use float quantity of Vertical CL.
                    itemOtherMaterialsFloat['Clavos con Roldana'] = (itemOtherMaterialsFloat['Clavos con Roldana'] || 0.0) + (canalListonVerticalFloat * 2);
                    itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] || 0.0) + (canalListonVerticalFloat * 1);

                    // No Angular fasteners for Vertical Cenefa based on provided logic.

               }

               // Tornillos 1" (Cenefa - Fixing Panels)
               // Formula: Estimated Panels (Cenefa Item) x 40. Type depends on Cenefa Panel Type.
               // Use the estimated float panel count for this item (estimatedPanelsForFinishing)
               // --- Corrección: Check if estimatedPanelsForFinishing is valid and > 0 ---
               if (estimatedPanelsForFinishing > 0 && !isNaN(estimatedPanelsForFinishing)) {
               // --- Fin Corrección ---
                   if (cenefaPanelType === 'Exterior') {
                       itemOtherMaterialsFloat['Tornillos de 1" punta broca'] = (itemOtherMaterialsFloat['Tornillos de 1" punta broca'] || 0.0) + (estimatedPanelsForFinishing * 40);
                   } else { // Interior type
                       itemOtherMaterialsFloat['Tornillos de 1" punta fina'] = (itemOtherMaterialsFloat['Tornillos de 1" punta fina'] || 0.0) + (estimatedPanelsForFinishing * 40);
                   }
               }

               // Tornillos 1/2" (Cenefa - General Structure, aside from specific CL/Angular)
               // The logic provided for 1/2" screws in Cenefas was specific to Horizontal/Vertical Canal Listón and Horizontal Angular.
               // We've implemented those specific calculations.
               // No general 1/2" screw calculation based on a total structure count for Cenefas unless specified.

               // Fulminantes (Global calculation, not per item) - Lógica movida al final de calculateMaterials

           } else {
               // Unknown type - Should not happen with validation, but as a safeguard
               console.error(`Tipo de ítem desconocido en performSingleItemCalculations para ítem #${itemSpecs.number}: ${type}`);
               // Initialize fastener counts for this item to 0 explicitly if type is unknown, to ensure keys exist
               itemOtherMaterialsFloat['Clavos con Roldana'] = 0.0;
               itemOtherMaterialsFloat['Tornillos de 1" punta fina'] = 0.0;
               itemOtherMaterialsFloat['Tornillos de 1" punta broca'] = 0.0;
               itemOtherMaterialsFloat['Tornillos de 1/2" punta fina'] = 0.0;
               itemOtherMaterialsFloat['Tornillos de 1/2" punta broca'] = 0.0;
           }

           // Return the calculated float quantities for other materials and panel details for accumulator.
           return {
               otherMaterials: itemOtherMaterialsFloat, // Contains float quantities for this item
               panelDetailsForAccumulator: itemPanelDetailsForAccumulator // Details for adding to global panel accumulators
           };
       };
       // --- Fin NUEVA FUNCIÓN: Lógica de Cálculo de Materiales y Metraje para UN SOLO ÍTEM ---


    // --- Main Calculation Function for ALL Items (Refactored) ---
    // Now includes detailed validation, calls to performSingleItemCalculations,
    // global accumulation (FLOAT), and final adjustments (Rounding, Merma, etc.).
    const calculateMaterials = () => {
        console.log("Iniciando cálculo de materiales y metrajes (Refactorizado)...");
        const itemBlocks = itemsContainer.querySelectorAll('.item-block');

        // --- Lee el valor del nuevo input de Área de Trabajo ---
        const workAreaInput = document.getElementById('work-area');
        const workArea = workAreaInput ? workAreaInput.value.trim() : '';
        console.log(`Área de Trabajo: "${workArea}"`);


        // --- Accumulators for Panels (per panel type) based on Image Logic ---
        // This accumulates FLOAT for small areas and ALREADY ROUNDED UP integers for other areas.
        let panelAccumulators = {};
         PANEL_TYPES.forEach(type => {
            panelAccumulators[type] = {
                suma_fraccionaria_pequenas: 0.0, // Suma de cantidades FLOAT (con desperdicio si aplica) para áreas pequeñas
                suma_redondeada_otros: 0 // Suma de cantidades REDONDEADAS hacia arriba para áreas >= threshold
            };
        });
         console.log("Acumuladores de paneles inicializados:", panelAccumulators);

        // --- Accumulator for ALL other materials (summed as FLOAT per item) ---
        // Fijaciones, estructura (Postes, Canales, Angular, Listón, Soporte), acabado (Pasta, Cinta, etc.)
        let otherMaterialsTotal = {};
         // Initialize keys for ALL possible other materials to ensure they exist for summing, even if some items don't use them.
         const allPossibleOtherMaterialKeys = [
             // Structure
             ...POSTE_TYPES, // Specific Poste types
             'Canales', 'Canales Calibre 20', 'Canal Listón', 'Canal Soporte', 'Angular de Lámina',
             'Patas', 'Canal Listón (para cuelgue)',
             // Fasteners
             'Clavos con Roldana', 'Fulminantes', // Fulminantes calculated globally, initialized here for summing item contribs
             'Tornillos de 1" punta fina', 'Tornillos de 1" punta broca',
             'Tornillos de 1/2" punta fina', 'Tornillos de 1/2" punta broca',
             // Finishing
             'Pasta', 'Cinta de Papel', 'Lija Grano 120',
             'Basecoat', 'Cinta malla', 'Esponja para acabado'
         ];
         allPossibleOtherMaterialKeys.forEach(key => {
             otherMaterialsTotal[key] = 0.0; // Initialize as float
         });
        console.log("Acumulador de otros materiales inicializado:", otherMaterialsTotal);


        // --- NUEVOS Acumuladores para Metrajes Totales ---
        let totalMuroMetrajeAreaSum = 0;
        let totalCieloMetrajeAreaSum = 0;
        let totalCenefaMetrajeLinearSum = 0;


        let currentCalculatedItemsSpecs = []; // Array to store specs of validly calculated items
        let currentErrorMessages = []; // Use an array to collect validation error messages

        // --- Almacena el valor del Área de Trabajo con los resultados actuales ---
        let currentCalculatedWorkArea = workArea;

        // Clear previous results and hide download buttons initially
        resultsContent.innerHTML = '';
        downloadOptionsDiv.classList.add('hidden');

        if (itemBlocks.length === 0) {
            console.log("No hay ítems para calcular.");
            resultsContent.innerHTML = '<p style="color: orange; text-align: center; font-style: italic;">Por favor, agrega al menos un Muro, Cielo o Cenefa para calcular.</p>';
             lastCalculatedTotalMaterials = {};
             lastCalculatedTotalMetrajes = {};
             lastCalculatedItemsSpecs = [];
             lastErrorMessages = ['No hay ítems agregados para calcular.'];
             lastCalculatedWorkArea = '';
            return;
        }

        console.log(`Procesando ${itemBlocks.length} ítems.`);
        // Iterate through each item block and calculate its materials
        itemBlocks.forEach(itemBlock => {
             // --- Manejo de Errores a Nivel de Ítem ---
             try {
                const itemNumber = itemBlock.dataset.itemId.split('-')[1];
                const type = itemBlock.querySelector('.item-structure-type').value;
                const itemId = itemBlock.dataset.itemId;

                console.log(`Procesando Ítem #${itemNumber} (ID: ${itemId}): Tipo=${type}`);

                 // Basic Validation for Each Item
                 let itemSpecificErrors = [];
                 let itemValidatedSpecs = { // Store specs for all segments (valid or not for materials) and item details
                     id: itemId,
                     number: parseInt(itemNumber), // Store number as integer
                     type: type,
                     segments: [] // Array to store ALL segments (muro or cielo) with their details and metraje
                     // Cenefa specific specs added later if type is cenefa
                 };

                 // --- Calculate Item Metraje (NUEVO - Explicitly based on input values for validation) ---
                 // Calculate metraje area/linear for the item based on the *raw* input values and the >=1 rule.
                 // This result is stored in itemValidatedSpecs and passed to performSingleItemCalculations.
                 let itemMetrajeAreaCalc = 0; // For Muros and Cielos
                 let itemMetrajeLinearCalc = 0; // For Cenefas
                 let totalMuroAreaForPanelsFinishing = 0; // Area using actual dimensions for materials/finishing (sum of valid segments)
                 let totalMuroWidthForStructure = 0; // Width using actual dimensions for structure (sum of valid segments)
                 let totalCieloAreaForPanelsFinishing = 0; // Total actual area from valid segments
                 let totalCieloPerimeterForAngular = 0; // Sum of full actual perimeters of valid segments
                 let totalValidWidthForSoporte = 0; // Sum of actual widths of valid segments (used for Canal Soporte formula)
                 let totalValidLengthForSoporte = 0; // Sum of actual lengths of valid segments (used for Canal Soporte formula)
                 let hasValidSegmentForMaterials = false; // Flag if at least one segment is valid FOR MATERIAL calculation


                if (type === 'muro') {
                    // Read muro-specific values
                    const facesInput = itemBlock.querySelector('.item-faces');
                    const faces = facesInput && !facesInput.closest('.hidden') ? parseInt(facesInput.value) : NaN;
                    const postSpacingInput = itemBlock.querySelector('.item-post-spacing');
                    const postSpacing = postSpacingInput && !postSpacingInput.closest('.hidden') ? parseFloat(postSpacingInput.value) : NaN;
                     const postTypeSelect = itemBlock.querySelector('.item-poste-type');
                     const postType = postTypeSelect && !postTypeSelect.closest('.hidden') ? postTypeSelect.value : null;
                    const isDoubleStructureInput = itemBlock.querySelector('.item-double-structure');
                    const isDoubleStructure = isDoubleStructureInput && !isDoubleStructureInput.closest('.hidden') ? isDoubleStructureInput.checked : false;
                     const cara1PanelTypeSelect = itemBlock.querySelector('.item-cara1-panel-type');
                     const cara1PanelType = cara1PanelTypeSelect && !cara1PanelTypeSelect.closest('.hidden') ? cara1PanelTypeSelect.value : null;
                     const cara2PanelTypeSelect = itemBlock.querySelector('.item-cara2-panel-type');
                     const cara2PanelType = (faces === 2 && cara2PanelTypeSelect && !cara2PanelTypeSelect.closest('.hidden') && cara2PanelTypeSelect.value) ? cara2PanelTypeSelect.value : null;


                    const segmentBlocks = itemBlock.querySelectorAll('.muro-segment');
                    itemValidatedSpecs.segments = []; // Reset segments array for this item

                     if (segmentBlocks.length === 0) {
                         itemSpecificErrors.push('Muro debe tener al menos un segmento de medida.');
                     } else {
                          let currentItemMuroMetrajeArea = 0; // Accumulate metraje for the item from segments
                         segmentBlocks.forEach((segBlock, index) => {
                             const segmentWidth = parseFloat(segBlock.querySelector('.item-width').value);
                             const segmentHeight = parseFloat(segBlock.querySelector('.item-height').value);
                             const segmentNumber = index + 1;

                             const isSegmentValidForMaterials = !isNaN(segmentWidth) && segmentWidth > 0 && !isNaN(segmentHeight) && segmentHeight > 0;

                             // If segment dimensions are valid for material calculation
                             if (isSegmentValidForMaterials) {
                                  hasValidSegmentForMaterials = true; // Mark as valid if at least one segment is valid
                                  const segmentArea = segmentWidth * segmentHeight;
                                  totalMuroAreaForPanelsFinishing += segmentArea; // Sum area for panels/finishing (using actual dims)
                                  totalMuroWidthForStructure += segmentWidth; // Sum width for structure (using actual dims)
                               }

                                // --- Cálculo de Metraje para ESTE Segmento de Muro ---
                               // Aplica la regla: si la dimensión es menor a 1 o NaN/<=0, usa 1 (o 0 if NaN/<=0).
                               // Si la dimensión es 0 o inválida, su contribución al metraje debe ser 0.
                               const metrajeWidth = isNaN(segmentWidth) || segmentWidth <= 0 ? 0 : Math.max(1, segmentWidth);
                               const metrajeHeight = isNaN(segmentHeight) || segmentHeight <= 0 ? 0 : Math.max(1, segmentHeight);

                               // Calcula el área del segmento usando las dimensiones ajustadas para metraje
                               const segmentMetrajeArea = metrajeWidth * metrajeHeight;
                               currentItemMuroMetrajeArea += segmentMetrajeArea; // Sum metraje area for this segment to item total


                               // Store segment specs for report, regardless of material validity
                               itemValidatedSpecs.segments.push({
                                   number: segmentNumber,
                                   width: isNaN(segmentWidth) ? 0 : segmentWidth, // Store raw input, use 0 if NaN for consistency
                                   height: isNaN(segmentHeight) ? 0 : segmentHeight, // Store raw input
                                   area: isSegmentValidForMaterials ? segmentWidth * segmentHeight : 0, // Store actual area only if valid for materials
                                   metrajeArea: segmentMetrajeArea, // Store metraje area for this segment
                                   isValidForMaterials: isSegmentValidForMaterials // Flag if segment is valid for material calculation
                               });
                         }); // End of segmentBlocks.forEach

                         itemMetrajeAreaCalc = currentItemMuroMetrajeArea; // Store the total item metraje area


                         // Add validation specific to Muros AFTER processing segments
                         if (!hasValidSegmentForMaterials && itemBlock.querySelectorAll('.muro-segment').length > 0) {
                             itemSpecificErrors.push('Muro debe tener al menos un segmento de medida válido (> 0 en Ancho y Alto) para calcular materiales.');
                         }
                         if (isNaN(faces) || (faces !== 1 && faces !== 2)) itemSpecificErrors.push('Nº Caras inválido (debe ser 1 o 2)');
                         if (isNaN(postSpacing) || postSpacing <= 0) itemSpecificErrors.push('Espaciamiento Postes inválido (debe ser > 0)');
                         if (!cara1PanelType || !PANEL_TYPES.includes(cara1PanelType)) itemSpecificErrors.push('Tipo de Panel Cara 1 inválido.');
                         // Check cara2PanelType only if faces is 2
                         if (faces === 2 && (!cara2PanelType || !PANEL_TYPES.includes(cara2PanelType))) itemSpecificErrors.push('Tipo de Panel Cara 2 inválido para 2 caras.');
                         if (!postType || !POSTE_TYPES.includes(postType)) itemSpecificErrors.push('Tipo de Poste inválido.');

                         // Store total calculated values for muros (actual dimensions used for materials) and metraje
                         itemValidatedSpecs.faces = faces;
                         itemValidatedSpecs.cara1PanelType = cara1PanelType;
                         itemValidatedSpecs.cara2PanelType = cara2PanelType;
                         itemValidatedSpecs.postSpacing = postSpacing;
                         itemValidatedSpecs.postType = postType;
                         itemValidatedSpecs.isDoubleStructure = isDoubleStructure;
                         // totalMuroArea and totalMuroWidth are calculated from valid segments above
                         itemValidatedSpecs.metrajeArea = itemMetrajeAreaCalc; // Store the calculated item metraje area


                     } // End if segmentBlocks.length > 0


                } else if (type === 'cielo') {
                     // Get cielo-specific values
                    const plenumInput = itemBlock.querySelector('.item-plenum');
                    const plenum = plenumInput && !plenumInput.closest('.hidden') ? parseFloat(plenumInput.value) : NaN;
                    const angularDeductionInput = itemBlock.querySelector('.item-angular-deduction');
                    const angularDeduction = angularDeductionInput && !angularDeductionInput.closest('.hidden') ? parseFloat(angularDeductionInput.value) : NaN;
                    const cieloPanelTypeSelect = itemBlock.querySelector('.item-cielo-panel-type');
                    const cieloPanelType = cieloPanelTypeSelect && !cieloPanelTypeSelect.closest('.hidden') ? cieloPanelTypeSelect.value : null;
                    const cieloPanelWasteInput = itemBlock.querySelector('.item-cielo-panel-waste');
                    const cieloPanelWaste = cieloPanelWasteInput && !cieloPanelWasteInput.closest('.hidden') ? parseFloat(cieloPanelWasteInput.value) : NaN;


                     const segmentBlocks = itemBlock.querySelectorAll('.cielo-segment');
                     itemValidatedSpecs.segments = []; // Reset segments array for this item

                     if (segmentBlocks.length === 0) {
                         itemSpecificErrors.push('Cielo Falso debe tener al menos un segmento de medida.');
                     } else {
                          let currentItemCieloMetrajeArea = 0; // Accumulate metraje for the item from segments
                         segmentBlocks.forEach((segBlock, index) => {
                              const segmentWidth = parseFloat(segBlock.querySelector('.item-width').value);
                              const segmentLength = parseFloat(segBlock.querySelector('.item-length').value);
                              const segmentNumber = index + 1;

                              const isSegmentValidForMaterials = !isNaN(segmentWidth) && segmentWidth > 0 && !isNaN(segmentLength) && segmentLength > 0;

                              // If segment dimensions are valid for material calculation
                              if (isSegmentValidForMaterials) {
                                   hasValidSegmentForMaterials = true;
                                   const segmentArea = segmentWidth * segmentLength;
                                   totalCieloAreaForPanelsFinishing += segmentArea; // Sum actual area

                                   // --- CÁLCULO DEL PERÍMETRO COMPLETO POR SEGMENTO (usando actual dims) ---
                                   const segmentActualPerimeter = 2 * (segmentWidth + segmentLength);
                                   totalCieloPerimeterForAngular += segmentActualPerimeter; // Sum of full perimeters
                                   // --- FIN CÁLCULO ---

                                   // Sum actual dimensions for Canal Soporte formula input
                                    totalValidWidthForSoporte += segmentWidth;
                                    totalValidLengthForSoporte += segmentLength;

                              } else {
                                   // Add validation error for invalid segment dimensions for materials
                                  itemSpecificErrors.push(`Segmento ${segmentNumber}: Dimensiones inválidas para cálculo de materiales (Ancho y Largo deben ser > 0)`); // Mensaje más específico
                              }

                               // --- Cálculo de Metraje para ESTE Segmento de Cielo ---
                               // Aplica la regla: si la dimensión es menor a 1 o NaN/<=0, usa 1 (o 0 if NaN/<=0 initially).
                                const metrajeWidth = isNaN(segmentWidth) || segmentWidth <= 0 ? 0 : Math.max(1, segmentWidth);
                                const metrajeLength = isNaN(segmentLength) || segmentLength <= 0 ? 0 : Math.max(1, segmentLength);
                                const segmentMetrajeArea = metrajeWidth * metrajeLength;
                               currentItemCieloMetrajeArea += segmentMetrajeArea; // Sum metraje area for this segment to item total


                              // Store segment specs for report, regardless of material validity
                              itemValidatedSpecs.segments.push({
                                  number: segmentNumber,
                                  width: isNaN(segmentWidth) ? 0 : segmentWidth,
                                  length: isNaN(segmentLength) ? 0 : segmentLength,
                                  area: isSegmentValidForMaterials ? segmentWidth * segmentLength : 0, // Store actual area only if valid
                                  metrajeArea: segmentMetrajeArea, // Store metraje area for this segment
                                  isValidForMaterials: isSegmentValidForMaterials // Flag if segment is valid for material calculation
                              });
                         }); // End of segmentBlocks.forEach

                         itemMetrajeAreaCalc = currentItemCieloMetrajeArea; // Store the total item metraje area


                         // Add validation specific to Cielos AFTER processing segments
                         if (!hasValidSegmentForMaterials && itemBlock.querySelectorAll('.cielo-segment').length > 0) {
                              itemSpecificErrors.push('Cielo Falso debe tener al menos un segmento de medida válido (> 0 en Ancho y Largo) para calcular materiales.');
                         }
                         if (!cieloPanelType || !PANEL_TYPES.includes(cieloPanelType)) itemSpecificErrors.push('Tipo de Panel de Cielo inválido.');
                         if (isNaN(plenum) || plenum < 0) itemSpecificErrors.push('Pleno inválido (debe ser >= 0)');
                         if (isNaN(angularDeduction) || angularDeduction < 0) itemSpecificErrors.push('Metros a descontar de Angular inválido (debe ser >= 0).');
                          if (isNaN(cieloPanelWaste) || cieloPanelWaste < 0) itemSpecificErrors.push('Desperdicio de Paneles de Cielo inválido (debe ser >= 0).');


                         // Store validated specs for cielos (actual dimensions used for materials) and metraje
                         itemValidatedSpecs.cieloPanelType = cieloPanelType;
                         itemValidatedSpecs.plenum = plenum;
                         itemValidatedSpecs.angularDeduction = angularDeduction;
                         itemValidatedSpecs.cieloPanelWaste = cieloPanelWaste; // Store waste percentage
                         // totalCieloArea, totalCieloPerimeterSum, totalValidWidthForSoporte, totalValidLengthForSoporte
                         // are calculated from valid segments above and will be passed to performSingleItemCalculations
                         itemValidatedSpecs.metrajeArea = itemMetrajeAreaCalc; // Store the calculated item metraje area


                     } // End if segmentBlocks.length > 0 for cielo


                } else if (type === 'cenefa') { // --- NUEVO: Cálculo y Validación para Cenefa ---
                     const cenefaInputsContainer = itemBlock.querySelector('.cenefa-inputs');
                     const orientationSelect = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-cenefa-orientation') : null;
                     const lengthInput = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-length') : null;
                     const widthInput = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-width') : null;
                     const heightInput = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-height') : null;
                     const facesInput = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-faces') : null;
                     const panelTypeSelect = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-cielo-panel-type') : null; // Reutiliza la clase
                     const anchorWallTypeSelect = cenefaInputsContainer ? cenefaInputsContainer.querySelector('.item-cenefa-anchor-wall-type') : null;


                    const cenefaOrientation = orientationSelect ? orientationSelect.value : null;
                    const cenefaLength = parseFloat(lengthInput ? lengthInput.value : NaN);
                    const cenefaWidth = parseFloat(widthInput ? widthInput.value : NaN); // Ancho del perfil
                    const cenefaHeight = parseFloat(heightInput ? heightInput.value : NaN); // Alto del perfil
                    const cenefaFaces = parseInt(facesInput ? facesInput.value : NaN);
                    const cenefaPanelType = panelTypeSelect ? panelTypeSelect.value : null;
                    const cenefaAnchorWallType = anchorWallTypeSelect ? anchorWallTypeSelect.value : null;


                    // Validación específica de Cenefa
                    if (!cenefaOrientation || !CENEFA_ORIENTATIONS.includes(cenefaOrientation)) itemSpecificErrors.push('Orientación de Cenefa inválida.');
                    if (isNaN(cenefaLength) || cenefaLength <= 0) itemSpecificErrors.push('Largo inválido (debe ser > 0).');
                    if (isNaN(cenefaWidth) || cenefaWidth <= 0) itemSpecificErrors.push('Ancho inválido (debe ser > 0).');
                    if (isNaN(cenefaHeight) || cenefaHeight <= 0) itemSpecificErrors.push('Alto inválido (debe ser > 0).');
                    if (isNaN(cenefaFaces) || cenefaFaces <= 0) itemSpecificErrors.push('Nº de Caras inválido (debe ser > 0).');
                    if (!panelTypeSelect || !PANEL_TYPES.includes(cenefaPanelType)) itemSpecificErrors.push('Tipo de Panel de Cenefa inválido.');
                    if (!cenefaAnchorWallType || !ANCHOR_WALL_TYPES.includes(cenefaAnchorWallType)) itemSpecificErrors.push('Tipo de Muro de Anclaje inválido.');


                    // --- Calculate Item Metraje Linear for Cenefa (NUEVO - Explicitly) ---
                    // Aplica la regla: si el largo es menor a 1, usa 1. Las caras no se ajustan.
                    // Nota: Ignoramos Ancho/Alto en el cálculo de metraje lineal según la lógica del Largo x Caras.
                     let itemCenefaMetrajeLinear = 0; // Use a different variable name here
                     if (!isNaN(cenefaLength) && cenefaLength > 0 && !isNaN(cenefaFaces) && cenefaFaces > 0) {
                        const adjustedLengthForMetraje = Math.max(1, cenefaLength); // Apply >=1 rule to length
                        itemCenefaMetrajeLinear = adjustedLengthForMetraje * cenefaFaces;
                     }
                    itemMetrajeLinearCalc = itemCenefaMetrajeLinear; // Store the calculated metraje linear


                    // Store validated specs for cenefas and metraje
                    itemValidatedSpecs.cenefaOrientation = cenefaOrientation;
                    itemValidatedSpecs.cenefaLength = cenefaLength; // Store actual length
                    itemValidatedSpecs.cenefaWidth = cenefaWidth; // Store actual width
                    itemValidatedSpecs.cenefaHeight = cenefaHeight; // Store actual height
                    itemValidatedSpecs.cenefaFaces = cenefaFaces; // Store actual faces
                    itemValidatedSpecs.cenefaPanelType = cenefaPanelType;
                    itemValidatedSpecs.cenefaAnchorWallType = cenefaAnchorWallType;
                    itemValidatedSpecs.metrajeLinear = itemMetrajeLinearCalc; // Store the calculated metraje linear


                } else {
                    // Unknown type (shouldn't happen with validation)
                     itemSpecificErrors.push('Tipo de estructura desconocido.');
                }

                console.log(`Ítem #${itemNumber}: Errores de validación - ${itemSpecificErrors.length}`);


                // If item has errors, add to global error list and skip material calculation for this item
                // For Muro/Cielo, also check if there is at least one valid segment for materials.
                 const shouldCalculateMaterials = itemSpecificErrors.length === 0 &&
                                                  (type === 'cenefa' || hasValidSegmentForMaterials); // Cenefa doesn't need valid segments for material calc, Muro/Cielo need valid segments


                 if (!shouldCalculateMaterials) {
                     const errorTitle = `${getItemTypeName(type)} #${itemNumber}`;
                     currentErrorMessages.push(`Error en ${errorTitle}: ${itemSpecificErrors.join(', ')}. Revisa los inputs del ítem.`); // Mensaje más amigable
                     console.warn(`Item inválido o incompleto: ${errorTitle}. Errores: ${itemSpecificErrors.join(', ')}. Este ítem no se incluirá en el cálculo total de materiales.`);
                     // Do NOT add to currentCalculatedItemsSpecs if there are errors preventing material calculation
                     return; // Skip calculation and summing for this invalid item
                }


                 // --- If the item is valid (no itemSpecificErrors and valid segments/is cenefa), PROCEED TO DETAILED CALCULATION ---
                 // Now call the dedicated function to do the item-specific material calculations (returns FLOAT quantities)
                 // Pass necessary calculated values from validation step that are used in performSingleItemCalculations
                 const calculatedItemResults = performSingleItemCalculations({
                     ...itemValidatedSpecs,
                     totalMuroArea: totalMuroAreaForPanelsFinishing,
                     totalMuroWidth: totalMuroWidthForStructure,
                     totalCieloArea: totalCieloAreaForPanelsFinishing,
                     totalCieloPerimeterSum: totalCieloPerimeterForAngular,
                     totalValidWidthForSoporte: totalValidWidthForSoporte,
                     totalValidLengthForSoporte: totalValidLengthForSoporte,
                     metrajeArea: itemMetrajeAreaCalc, // Pass calculated metraje area
                     metrajeLinear: itemMetrajeLinearCalc // Pass calculated metraje linear
                 });
                 console.log(`Ítem #${itemNumber}: Resultados de cálculo detallado (float):`, calculatedItemResults);


                 // --- Update Global Accumulators using the results from calculatedItemResults ---

                 // Acumular Paneles (usando los detalles de paneles retornados) - Lógica mantenida
                  const panelDetailsForAccumulator = calculatedItemResults.panelDetailsForAccumulator;
                  if (panelDetailsForAccumulator && panelDetailsForAccumulator.segmentsOrItemAreaDetails) {
                      panelDetailsForAccumulator.segmentsOrItemAreaDetails.forEach(detail => {
                          if (!detail.segmentArea || detail.segmentArea <= 0 || !detail.panelType) {
                              console.warn(`Skipping panel accumulation for item ${itemNumber} due to invalid area (${detail.segmentArea}) or panel type (${detail.panelType}).`);
                              return; // Skip if area is invalid or 0, or panel type is missing
                          }

                          const panelesFloat = detail.segmentArea / PANEL_RENDIMIENTO_M2; // Use constant

                           // Apply waste factor for Cielo/Cenefa panels here before accumulation
                           let panelesFloatWithWaste = panelesFloat;
                           // Determine waste percentage: Use item's specific waste if Cielo, a default for Cenefa, or 0 for Muro
                           let wastePercentage = 0;
                           if (panelDetailsForAccumulator.type === 'cielo' && !isNaN(itemValidatedSpecs.cieloPanelWaste)) {
                               wastePercentage = itemValidatedSpecs.cieloPanelWaste;
                           } else if (panelDetailsForAccumulator.type === 'cenefa') {
                               // Use a default waste percentage for cenefa panels as no input was specified.
                               const defaultCenefaPanelWaste = 10; // 10% default waste for cenefa panels
                               wastePercentage = defaultCenefaPanelWaste;
                           }

                           if (wastePercentage > 0) {
                                panelesFloatWithWaste = panelesFloat * (1 + wastePercentage / 100);
                                console.log(`${panelDetailsForAccumulator.type} Item ${itemNumber}: Paneles FLOAT (${panelesFloat.toFixed(2)}), con ${wastePercentage}% desperdicio = ${panelesFloatWithWaste.toFixed(2)}.`);
                           } else {
                               console.log(`${panelDetailsForAccumulator.type} Item ${itemNumber}: Paneles FLOAT (${panelesFloat.toFixed(2)}), sin desperdicio adicional.`);
                           }


                          // Determine if this contribution is "small" or "other" for the accumulator based on the UNIT area dimensions (for Muro segments)
                          // or based on the TOTAL ITEM area (for Cielo/Cenefa estimated area)
                          let isSmallAreaContribution = false;
                          if (panelDetailsForAccumulator.type === 'muro') {
                              // For muro segments, check unit dimensions against thresholds
                               // Check if the segment's original dimensions were valid before applying the rule
                               const originalSegment = itemValidatedSpecs.segments.find(seg => seg.segmentArea === detail.segmentArea && seg.width === detail.unitWidth && seg.height === detail.unitHeight); // Find the original segment spec
                               if (originalSegment && originalSegment.isValidForMaterials) { // Only apply small area check if the original segment was valid for materials
                                  isSmallAreaContribution = originalSegment.width < SMALL_AREA_WIDTH_THRESHOLD_M && originalSegment.height < SMALL_AREA_HEIGHT_THRESHOLD_M; // Use original dimensions and constants
                               } else {
                                   // If the original segment wasn't valid for materials, it shouldn't contribute panels anyway, but as a safeguard...
                                   // console.warn(`Muro segment not found or invalid for materials check during panel accumulation for item ${itemNumber}.`);
                                   isSmallAreaContribution = false; // Treat as not small area or invalid
                               }
                          } else {
                              // For Cielo/Cenefa item area, check the total estimated area against the item threshold
                              isSmallAreaContribution = detail.segmentArea < SMALL_AREA_ITEM_THRESHOLD_M2; // Use constant threshold for item total area
                               // Note: The specific Cielo rounding rule (decimal < 0.5 down, >= 0.5 up, unless <= 1 then 1) is NOT applied here
                               // during accumulation, as it conflicts with the small fractional / rounded others model.
                               // The global accumulation logic takes precedence as described in the Muro panel section.
                          }


                          // Add to the correct accumulator based on the small area check
                          if (isSmallAreaContribution) {
                              // Add the float quantity (with waste if applicable) to the fractional sum
                              panelAccumulators[detail.panelType].suma_fraccionaria_pequenas += panelesFloatWithWaste;
                               console.log(`Item ${itemNumber} (${panelDetailsForAccumulator.type}) Panel (${detail.panelType}): Área pequeña (${detail.segmentArea.toFixed(2)}m2 or unit dims check). Sumando fraccional (${panelesFloatWithWaste.toFixed(2)}) a acumulador.`);

                          } else {
                              // Round up the float quantity (with waste if applicable) and add to the rounded sum
                              const panelesRounded = roundUpFinalUnit(panelesFloatWithWaste);
                              panelAccumulators[detail.panelType].suma_redondeada_otros += panelesRounded;
                              console.log(`Item ${itemNumber} (${panelDetailsForAccumulator.type}) Panel (${detail.panelType}): Área grande (${detail.segmentArea.toFixed(2)}m2 or unit dims check). Sumando redondeado (${panelesRounded}) a acumulador.`);
                          }

                           // If there's a second face for muro segments, handle it similarly
                           if (panelDetailsForAccumulator.type === 'muro' && detail.panelTypeFace2) {
                               const panelesFloatFace2 = detail.segmentArea / PANEL_RENDIMIENTO_M2; // Use constant
                                // Muros panel logic doesn't mention a waste factor per face/segment.
                                let panelesFloatFace2WithWaste = panelesFloatFace2; // Assume no additional waste per face/segment


                                if (isSmallAreaContribution) { // Use the same small area check determined for Face 1 based on segment dimensions
                                    panelAccumulators[detail.panelTypeFace2].suma_fraccionaria_pequenas += panelesFloatFace2WithWaste;
                                     console.log(`Muro Item ${itemNumber} Cara 2 Segmento (${detail.panelTypeFace2}): Área pequeña. Sumando fraccional (${panelesFloatFace2WithWaste.toFixed(2)}) a acumulador.`);
                                } else {
                                    const panelesRoundedFace2 = roundUpFinalUnit(panelesFloatFace2WithWaste);
                                    panelAccumulators[detail.panelTypeFace2].suma_redondeada_otros += panelesRoundedFace2;
                                     console.log(`Muro Item ${itemNumber} Cara 2 Segmento (${detail.panelTypeFace2}): Área grande. Sumando redondeado (${panelesRoundedFace2}) a acumulador.`);
                                }
                           }
                      });
                  }


                 // Acumular Otros Materiales (sumando los valores FLOAT retornados por performSingleItemCalculations)
                const itemOtherMaterialsFloat = calculatedItemResults.otherMaterials;
                for (const material in itemOtherMaterialsFloat) {
                    if (itemOtherMaterialsFloat.hasOwnProperty(material)) {
                        const floatQuantity = itemOtherMaterialsFloat[material];
                        // Ensure the value is a valid number before summing
                        if (!isNaN(floatQuantity)) {
                             otherMaterialsTotal[material] = (otherMaterialsTotal[material] || 0.0) + floatQuantity; // Sum as FLOAT
                        }
                    }
                }
                 console.log(`Ítem #${itemNumber}: Otros materiales calculados (float) y sumados a total. Total parcial otros materiales (FLOAT):`, otherMaterialsTotal);


                 // Acumular Metrajes Totales (usando el metraje calculado por ítem)
                 // itemValidatedSpecs already contains the calculated metrajeArea or metrajeLinear
                 if (type === 'muro' && !isNaN(itemValidatedSpecs.metrajeArea)) {
                      totalMuroMetrajeAreaSum += itemValidatedSpecs.metrajeArea;
                 } else if (type === 'cielo' && !isNaN(itemValidatedSpecs.metrajeArea)) {
                      totalCieloMetrajeAreaSum += itemValidatedSpecs.metrajeArea;
                 } else if (type === 'cenefa' && !isNaN(itemValidatedSpecs.metrajeLinear)) {
                     totalCenefaMetrajeLinearSum += itemValidatedSpecs.metrajeLinear;
                 }
                console.log(`Ítem #${itemNumber}: Metraje acumulado. Totales parciales de Metraje:`, {totalMuroMetrajeAreaSum, totalCieloMetrajeAreaSum, totalCenefaMetrajeLinearSum});


                // Store the validated specs for this item (segments already pushed for muro/cielo)
                // Push only if calculation was successful for this item
                currentCalculatedItemsSpecs.push(itemValidatedSpecs);


             } catch (error) {
                 // --- Captura y reporta errores inesperados durante el procesamiento de un ítem ---
                 const itemIdentifier = itemBlock.dataset.itemId ? `#${itemBlock.dataset.itemId.split('-')[1]}` : '(ID desconocido)';
                 const itemType = itemBlock.querySelector('.item-structure-type') ? getItemTypeName(itemBlock.querySelector('.item-structure-type').value) : 'Desconocido';
                 const errorMessage = `Error inesperado procesando Ítem ${itemType} ${itemIdentifier}: ${error.message}. Revisa la consola para más detalles.`;
                 currentErrorMessages.push(errorMessage);
                 console.error(errorMessage, error);
             }


        }); // End of itemBlocks.forEach

        console.log("Fin del procesamiento de ítems.");
        console.log("Acumuladores de paneles finales (fraccional/redondeado):", panelAccumulators);
        console.log("Otros materiales totales (FLOAT) antes de ajustes finales:", otherMaterialsTotal);
        console.log("Errores totales encontrados:", currentErrorMessages);
        console.log("Totales de Metraje acumulados:", {totalMuroMetrajeAreaSum, totalCieloMetrajeAreaSum, totalCenefaMetrajeLinearSum});


        // --- Final Calculation of Panels from Accumulators ---
        let finalPanelTotals = {};
         for (const type in panelAccumulators) {
             if (panelAccumulators.hasOwnProperty(type)) {
                 const acc = panelAccumulators[type];
                 // Apply ceiling only to the fractional sum before adding to the rounded sum
                 const totalPanelsForType = roundUpFinalUnit(acc.suma_fraccionaria_pequenas) + acc.suma_redondeada_otros;

                 if (totalPanelsForType > 0) {
                      // Store final rounded panel total with descriptive name
                      finalPanelTotals[`Paneles de ${type}`] = totalPanelsForType;
                 }
             }
         }
         console.log("Totales finales de paneles (redondeo aplicado a fraccional + suma de redondeados):", finalPanelTotals);

        // --- Combine Final Panels with Other Materials Total (now float) ---
        // otros materiales total contiene ahora las cantidades FLOAT acumuladas
        let rawTotalMaterialsFloat = { ...otherMaterialsTotal, ...finalPanelTotals }; // Combine Others (FLOAT) and Panels (already rounded)
        console.log("Total de materiales combinados (Otros FLOAT + Paneles REDONDEADOS):", rawTotalMaterialsFloat);


        // --- Start Global Fastener Calculations (based on Total Project logic) ---
        // Fulminantes = Total Clavos con Roldana (Proyecto) - Se calcula sobre el total FLOAT de clavos acumulado de todos los ítems.
        // Ensure Fulminantes is added to the float total before applying rounding/merma
        // otherMaterialsTotal already has Clavos con Roldana accumulated as float
        rawTotalMaterialsFloat['Fulminantes'] = (rawTotalMaterialsFloat['Clavos con Roldana'] || 0.0); // Assign the total FLOAT of clavos

        // --- Implement Fase 4: Redondeo, Merma, Empaque a los totales GLOBALES ---
        // This applies to ALL materials in rawTotalMaterialsFloat.
        // Paneles were rounded during their finalization. Other materials are currently FLOAT.
        // Apply Merma and a final rounding step to ALL quantities.

        const mermaPercentage = MERMA_PORCENTAJE; // Use constant
        let finalAdjustedMaterials = {};

        for (const material in rawTotalMaterialsFloat) {
            if (rawTotalMaterialsFloat.hasOwnProperty(material)) {
                const quantity = rawTotalMaterialsFloat[material]; // This could be rounded (Panels) or float (Others)

                // Only process if the quantity is a valid number (handle potential NaNs from calculations)
                if (!isNaN(quantity)) {
                     // 1. Redondeo hacia Arriba (This step primarily affects the initial float quantities of Other Materials)
                     //    Panels are already effectively rounded from their accumulation logic, but applying ceil again is harmless.
                     let roundedQuantity1 = Math.ceil(quantity);

                     // 2. Aplicar Merma y Redondear de Nuevo
                     let quantityWithMerma = roundedQuantity1 * (1 + mermaPercentage);
                     let roundedQuantity2 = Math.ceil(quantityWithMerma);

                     // 3. Ajuste por Empaque/Unidades de Venta (Paso conceptual - requires defining packaging sizes)
                     // This is a placeholder. For now, the result is the merma-adjusted, rounded quantity.
                     let finalQuantityAdjustedForPackaging = roundedQuantity2;

                     // Only include material in the final list if the final quantity is > 0
                     if (finalQuantityAdjustedForPackaging > 0) {
                        finalAdjustedMaterials[material] = finalQuantityAdjustedForPackaging;
                        console.log(`Material: ${material}. Cantidad (Raw): ${quantity.toFixed(2)}. Redondeo1: ${roundedQuantity1}. Con Merma (${mermaPercentage*100}%): ${quantityWithMerma.toFixed(2)}. Redondeo2 (Final): ${roundedQuantity2}.`);
                     }
                } else {
                     console.warn(`Skipping final adjustment for material "${material}" due to invalid quantity: ${quantity}`);
                }
            }
        }

        // The final totals to display and download are now 'finalAdjustedMaterials'
        console.log(`Totales finales ajustados (Redondeo Global + ${mermaPercentage*100}% Merma + Empaque Placeholder):`, finalAdjustedMaterials);

        // --- End Global Fastener Calculations and Fase 4 ---


        // --- Store Final Metraje Totales ---
        const finalTotalMetrajes = {
             'Muro Área Total Metraje (m²)' : totalMuroMetrajeAreaSum,
             'Cielo Área Total Metraje (m²)' : totalCieloMetrajeAreaSum,
             'Cenefa Lineal Total Metraje (m)' : totalCenefaMetrajeLinearSum
        };
        console.log("Totales finales de Metraje para mostrar y almacenar:", finalTotalMetrajes);


        // --- Display Results ---
        // If there are validation errors or unexpected errors, only show the errors.
        if (currentErrorMessages.length > 0) {
            console.log("Mostrando mensajes de error.");
             resultsContent.innerHTML = '<div class="error-message"><h2>Errores Encontrados:</h2>' +
                                        currentErrorMessages.map(msg => `<p>${msg}</p>`).join('') +
                                        '<p>Por favor, corrige los errores indicados y vuelve a calcular.</p></div>';
             downloadOptionsDiv.classList.add('hidden');
             lastCalculatedTotalMaterials = {};
             lastCalculatedTotalMetrajes = {};
             lastCalculatedItemsSpecs = [];
             lastErrorMessages = currentErrorMessages; // Store errors for potential future handling
             lastCalculatedWorkArea = '';
            return;
        }

        // If no errors and there are validly calculated items OR positive total metrajes OR positive adjusted materials
        if (currentCalculatedItemsSpecs.length > 0 ||
            finalTotalMetrajes['Muro Área Total Metraje (m²)'] > 0 ||
            finalTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0 ||
            finalTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0 ||
            Object.keys(finalAdjustedMaterials).some(material => finalAdjustedMaterials[material] > 0)) {
            console.log("No se encontraron errores de validación. Generando resultados HTML.");

            let resultsHtml = '<div class="report-header">';
            resultsHtml += '<h2>Resumen de Materiales y Metrajes</h2>';
            // --- Muestra el Área de Trabajo en el resumen HTML ---
            if (currentCalculatedWorkArea) {
                 resultsHtml += `<p><strong>Área de Trabajo:</strong> <span>${currentCalculatedWorkArea}</span></p>`;
            }
            resultsHtml += `<p>Fecha del cálculo: ${new Date().toLocaleDateString('es-ES')}</p>`;
            resultsHtml += '</div>';
            resultsHtml += '<hr>';

            // Display individual item summaries for valid items
            if (currentCalculatedItemsSpecs.length > 0) {
                console.log("Generando resumen de ítems calculados.");
                resultsHtml += '<h3>Detalle de Ítems Calculados:</h3>';
                currentCalculatedItemsSpecs.forEach(item => {
                    resultsHtml += `<div class="item-summary">`;
                    resultsHtml += `<h4>${getItemTypeName(item.type)} #${item.number}</h4>`;
                    resultsHtml += `<p><strong>Tipo:</strong> <span>${getItemTypeName(item.type)}</span></p>`;

                     // --- Muestra el Metraje calculado para este ítem en el resumen principal ---
                     if (item.type === 'muro' && !isNaN(item.metrajeArea)) {
                         resultsHtml += `<p><strong>Metraje (Área):</strong> <span>${item.metrajeArea.toFixed(2)} m²</span></p>`;
                     } else if (item.type === 'cielo' && !isNaN(item.metrajeArea)) {
                         resultsHtml += `<p><strong>Metraje (Área):</strong> <span>${item.metrajeArea.toFixed(2)} m²</span></p>`;
                     } else if (item.type === 'cenefa' && !isNaN(item.metrajeLinear)) {
                         resultsHtml += `<p><strong>Metraje (Lineal):</strong> <span>${item.metrajeLinear.toFixed(2)} m</span></p>`;
                     }


                    if (item.type === 'muro') {
                        if (!isNaN(item.faces)) resultsHtml += `<p><strong>Nº Caras:</strong> <span>${item.faces}</span></p>`;
                        if (item.cara1PanelType) resultsHtml += `<p><strong>Panel Cara 1:</strong> <span>${item.cara1PanelType}</span></p>`;
                        if (item.faces === 2 && item.cara2PanelType) resultsHtml += `<p><strong>Panel Cara 2:</strong> <span>${item.cara2PanelType}</span></p>`;
                        if (!isNaN(item.postSpacing)) resultsHtml += `<p><strong>Espaciamiento Postes:</strong> <span>${item.postSpacing.toFixed(2)} m</span></p>`;
                         if (item.postType) resultsHtml += `<p><strong>Tipo de Poste:</strong> <span>${item.postType}</span></p>`;
                        resultsHtml += `<p><strong>Estructura Doble:</strong> <span>${item.isDoubleStructure ? 'Sí' : 'No'}</span></p>`;

                        // Segmentos
                         resultsHtml += `<p><strong>Segmentos:</strong></p>`;
                        if (item.segments && item.segments.length > 0) {
                            item.segments.forEach(seg => {
                                 let segmentLine = `- Seg ${seg.number}: ${seg.width.toFixed(2)}m x ${seg.height.toFixed(2)}m (Real)`;
                                 if (!seg.isValidForMaterials) {
                                     segmentLine += ' (Inválido para Materiales)';
                                 }
                                 if (!isNaN(seg.metrajeArea)) {
                                      segmentLine += ` - Metraje: ${seg.metrajeArea.toFixed(2)} m²`;
                                 }
                                resultsHtml += `<p style="margin-left: 20px;">${segmentLine}</p>`;
                            });
                             if (item.totalMuroArea > 0) {
                                  resultsHtml += `<p style="margin-left: 20px;"><strong>Área Total Segmentos (Usada para Materiales):</strong> ${item.totalMuroArea.toFixed(2)} m²</p>`;
                             }
                             if (item.totalMuroWidth > 0) {
                                 resultsHtml += `<p style="margin-left: 20px;"><strong>Ancho Total Segmentos (Usado para Materiales):</strong> ${item.totalMuroWidth.toFixed(2)} m</p>`;
                             }
                        } else {
                             resultsHtml += `<p style="margin-left: 20px;">- Sin segmentos ingresados o válidos</p>`;
                        }


                    } else if (item.type === 'cielo') {
                         if (item.cieloPanelType) resultsHtml += `<p><strong>Tipo de Panel:</strong> <span>${item.cieloPanelType}</span></p>`;
                         if (!isNaN(item.cieloPanelWaste)) resultsHtml += `<p><strong>Desperdicio Paneles:</strong> <span>${item.cieloPanelWaste.toFixed(0)} %</span></p>`;
                         if (!isNaN(item.plenum)) resultsHtml += `<p><strong>Pleno:</strong> <span>${item.plenum.toFixed(2)} m</span></p>`;
                         if (!isNaN(item.angularDeduction) && item.angularDeduction > 0) {
                             resultsHtml += `<p><strong>Descuento Angular:</strong> <span>${item.angularDeduction.toFixed(2)} m</span></p>`;
                         }

                         // Segmentos
                         resultsHtml += `<p><strong>Segmentos:</strong></p>`;
                         if (item.segments && item.segments.length > 0) {
                             item.segments.forEach(seg => {
                                 let segmentLine = `- Seg ${seg.number}: ${seg.width.toFixed(2)}m x ${seg.length.toFixed(2)}m (Real)`;
                                  if (!seg.isValidForMaterials) {
                                       segmentLine += ' (Inválido para Materiales)';
                                  }
                                  if (!isNaN(seg.metrajeArea)) {
                                       segmentLine += ` - Metraje: ${seg.metrajeArea.toFixed(2)} m²`;
                                  }
                                 resultsHtml += `<p style="margin-left: 20px;">${segmentLine}</p>`;
                             });
                              if (item.totalCieloArea > 0) {
                                 resultsHtml += `<p style="margin-left: 20px;"><strong>Área Total Segmentos (Usada para Materiales):</strong> ${item.totalCieloArea.toFixed(2)} m²</p>`;
                             }
                              if (item.totalCieloPerimeterSum > 0) {
                                 resultsHtml += `<p style="margin-left: 20px;"><strong>Suma Perímetros Segmentos (Usada para Materiales):</strong> ${item.totalCieloPerimeterSum.toFixed(2)} m</p>`;
                             }
                              // Add display for total valid width/length used for Canal Soporte formula if useful
                              // if (item.totalValidWidthForSoporte > 0 || item.totalValidLengthForSoporte > 0) {
                              //      resultsHtml += `<p style="margin-left: 20px;"><strong>Dimensiones Totales (Usadas para Canal Soporte):</strong> ${item.totalValidWidthForSoporte.toFixed(2)}m (Ancho) x ${item.totalValidLengthForSoporte.toFixed(2)}m (Largo)</p>`;
                              // }
                         } else {
                             resultsHtml += `<p style="margin-left: 20px;">- Sin segmentos ingresados o válidos</p>`;
                         }
                    } else if (item.type === 'cenefa') {
                        if (item.cenefaOrientation) resultsHtml += `<p><strong>Orientación:</strong> <span>${item.cenefaOrientation}</span></p>`;
                        if (!isNaN(item.cenefaLength)) resultsHtml += `<p><strong>Largo (Real):</strong> <span>${item.cenefaLength.toFixed(2)} m</span></p>`;
                        if (!isNaN(item.cenefaWidth)) resultsHtml += `<p><strong>Ancho (Real):</strong> <span>${item.cenefaWidth.toFixed(2)} m</span></p>`;
                        if (!isNaN(item.cenefaHeight)) resultsHtml += `<p><strong>Alto (Real):</strong> <span>${item.cenefaHeight.toFixed(2)} m</span></p>`;
                        if (!isNaN(item.cenefaFaces)) resultsHtml += `<p><strong>Nº de Caras:</strong> <span>${item.cenefaFaces}</span></p>`;
                        if (item.cenefaPanelType) resultsHtml += `<p><strong>Tipo de Panel:</strong> <span>${item.cenefaPanelType}</span></p>`;
                        if (item.cenefaAnchorWallType) resultsHtml += `<p><strong>Anclaje a:</strong> <span>${item.cenefaAnchorWallType}</span></p>`;
                        // Metraje lineal already shown at the start of item summary
                    }
                    resultsHtml += `</div>`;
                });
                resultsHtml += '<hr>';
            } else {
                 // Only add vertical space if there are metraje totals to follow
                 if (finalTotalMetrajes['Muro Área Total Metraje (m²)'] > 0 ||
                     finalTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0 ||
                     finalTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {
                      resultsHtml += '<p>No hay ítems con dimensiones válidas para el cálculo detallado de materiales, pero se calcularon metrajes totales.</p>';
                      resultsHtml += '<hr>';
                 }
            }


            // --- Totales de Metraje ---
             if (finalTotalMetrajes['Muro Área Total Metraje (m²)'] > 0 ||
                 finalTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0 ||
                 finalTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {

                  resultsHtml += '<h3>Totales de Metraje:</h3>';
                  resultsHtml += '<ul>';
                  if (finalTotalMetrajes['Muro Área Total Metraje (m²)'] > 0) {
                      resultsHtml += `<li><strong>Muro Área Total:</strong> ${finalTotalMetrajes['Muro Área Total Metraje (m²)'].toFixed(2)} m²</li>`;
                  }
                   if (finalTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0) {
                      resultsHtml += `<li><strong>Cielo Área Total:</strong> ${finalTotalMetrajes['Cielo Área Total Metraje (m²)'].toFixed(2)} m²</li>`;
                   }
                   if (finalTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {
                       resultsHtml += `<li><strong>Cenefa Lineal Total:</strong> ${finalTotalMetrajes['Cenefa Lineal Total Metraje (m)'].toFixed(2)} m</li>`;
                   }
                  resultsHtml += '</ul>';
                  resultsHtml += '<hr>';
             }


            // Tabla de Totales de Materiales
             if (Object.keys(finalAdjustedMaterials).some(material => finalAdjustedMaterials[material] > 0)) {
                 resultsHtml += '<h3>Totales de Materiales (Cantidades a Comprar):</h3>';

                 const sortedMaterials = Object.keys(finalAdjustedMaterials).sort();

                resultsHtml += '<table><thead><tr><th>Material</th><th>Cantidad</th><th>Unidad</th></tr></thead><tbody>';

                sortedMaterials.forEach(material => {
                    const cantidad = finalAdjustedMaterials[material];
                     if (cantidad > 0) { // Only add rows for materials with quantity > 0
                         const unidad = getMaterialUnit(material);
                         resultsHtml += `<tr><td>${material}</td><td>${cantidad}</td><td>${unidad}</td></tr>`;
                     }
                });

                 if (sortedMaterials.every(material => finalAdjustedMaterials[material] <= 0)) { // Check if filtering removed all items
                     resultsHtml += `<tr><td colspan="3" style="text-align: center;">No se calcularon cantidades positivas de materiales.</td></tr>`;
                 }

                resultsHtml += '</tbody></table>';
                downloadOptionsDiv.classList.remove('hidden');

             } else {
                 // If no materials have a positive final adjusted quantity
                 resultsHtml += '<p>No se calcularon cantidades positivas de materiales con las dimensiones ingresadas.</p>';
             }


            resultsContent.innerHTML = resultsHtml;

            lastCalculatedTotalMaterials = finalAdjustedMaterials;
            lastCalculatedTotalMetrajes = finalTotalMetrajes;
            lastCalculatedItemsSpecs = currentCalculatedItemsSpecs;
            lastErrorMessages = []; // Clear errors if calculation was successful
            lastCalculatedWorkArea = currentCalculatedWorkArea;

        } else {
             resultsContent.innerHTML = '<p>No se pudieron calcular materiales ni metrajes con las dimensiones ingresadas. Revisa los valores y si hay errores de validación.</p>';
             downloadOptionsDiv.classList.add('hidden');
             lastCalculatedTotalMaterials = {};
             lastCalculatedTotalMetrajes = {};
             lastCalculatedItemsSpecs = [];
             lastCalculatedWorkArea = '';
        }

    };

    // --- Helper function to toggle the state of the calculate button ---
    const toggleCalculateButtonState = () => {
         const hasItems = itemsContainer.querySelectorAll('.item-block').length > 0;
         if (calculateBtn) {
             calculateBtn.disabled = !hasItems;
             if (hasItems) {
                 calculateBtn.classList.remove('disabled');
             } else {
                 calculateBtn.classList.add('disabled');
             }
         }
     };


    // --- PDF Generation Function ---
    const generatePDF = () => {
        console.log("Iniciando generación de PDF...");
       // Check if there are calculated results to report (materials, metrajes, or valid items)
       if ((Object.keys(lastCalculatedTotalMaterials).length === 0) &&
           (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] <= 0 &&
            lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] <= 0 &&
            lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] <= 0) &&
           lastCalculatedItemsSpecs.length === 0 &&
           lastErrorMessages.length === 0) // Also check if there were errors preventing calculation
       {
           console.warn("No hay resultados calculados (materiales ajustados, metrajes o ítems válidos) ni errores para reportar en el PDF.");
           alert("Por favor, realiza un cálculo válido antes de generar el PDF.");
           return;
       }

        // If there were errors in the last calculation, only show the errors in the PDF.
        if (lastErrorMessages.length > 0) {
             console.log("Generando PDF con mensajes de error.");
             const { jsPDF } = window.jspdf;
             const doc = new jsPDF();
             doc.setFontSize(16);
             doc.setTextColor(255, 0, 0); // Red color for errors
             doc.text("Errores Encontrados:", 14, 22);
             doc.setFontSize(10);
             doc.setTextColor(0, 0, 0); // Black color for error messages
             let currentY = 30;
             lastErrorMessages.forEach(msg => {
                 const lines = doc.splitTextToSize(msg, doc.internal.pageSize.getWidth() - 28); // Wrap text
                 doc.text(lines, 14, currentY);
                 currentY += (lines.length * 7) + 3; // Move down based on number of lines
             });
             doc.save(`Errores_Calculo_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`);
             return; // Stop here if only errors are reported
        }


       // Initialize jsPDF
       const { jsPDF } = window.jspdf;
       const doc = new jsPDF();

       // Define colors in RGB from CSS variables (using approximations)
       const primaryOliveRGB = [85, 107, 47]; // #556B2F
       const secondaryOliveRGB = [128, 128, 0]; // #808000
       const darkGrayRGB = [51, 51, 51]; // #333
       const mediumGrayRGB = [102, 102, 102]; // #666
       const lightGrayRGB = [224, 224, 224]; // #e0e0e0
       const extraLightGrayRGB = [248, 248, 248]; // #f8f8f8


       // --- Add Header ---
       doc.setFontSize(18);
       doc.setTextColor(primaryOliveRGB[0], primaryOliveRGB[1], primaryOliveRGB[2]);
       doc.setFont("helvetica", "bold");
       doc.text("Resumen de Materiales y Metrajes Tablayeso", 14, 22);

       doc.setFontSize(10);
       doc.setTextColor(mediumGrayRGB[0], mediumGrayRGB[1], mediumGrayRGB[2]);
        doc.setFont("helvetica", "normal");
       doc.text(`Fecha del cálculo: ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

        let currentY = 35;
        if (lastCalculatedWorkArea) {
             doc.text(`Área de Trabajo: ${lastCalculatedWorkArea}`, 14, currentY);
             currentY += 7;
        }
        let finalY = currentY;


       // --- Add Item Summaries ---
       if (lastCalculatedItemsSpecs.length > 0) {
            console.log("Añadiendo resumen de ítems al PDF.");
            doc.setFontSize(14);
            doc.setTextColor(secondaryOliveRGB[0], secondaryOliveRGB[1], secondaryOliveRGB[2]);
           doc.setFont("helvetica", "bold");
            doc.text("Detalle de Ítems Calculados:", 14, finalY + 10);
            finalY += 15;

           const itemSummaryLineHeight = 5;
           const itemBlockSpacing = 8;

            lastCalculatedItemsSpecs.forEach(item => {
                doc.setFontSize(10);
                doc.setTextColor(primaryOliveRGB[0], primaryOliveRGB[1], primaryOliveRGB[2]);
                doc.setFont("helvetica", "bold");
                 doc.text(`${getItemTypeName(item.type)} #${item.number}:`, 14, finalY + itemSummaryLineHeight);
                finalY += itemSummaryLineHeight * 1.5;

                doc.setFontSize(9);
                doc.setTextColor(darkGrayRGB[0], darkGrayRGB[1], darkGrayRGB[2]);
                doc.setFont("helvetica", "normal");

                doc.text(`Tipo: ${getItemTypeName(item.type)}`, 20, finalY + itemSummaryLineHeight);
                finalY += itemSummaryLineHeight;

                 if (item.type === 'muro' && !isNaN(item.metrajeArea)) {
                      doc.text(`Metraje (Área): ${item.metrajeArea.toFixed(2)} m²`, 20, finalY + itemSummaryLineHeight);
                      finalY += itemSummaryLineHeight;
                 } else if (item.type === 'cielo' && !isNaN(item.metrajeArea)) {
                      doc.text(`Metraje (Área): ${item.metrajeArea.toFixed(2)} m²`, 20, finalY + itemSummaryLineHeight);
                      finalY += itemSummaryLineHeight;
                 } else if (item.type === 'cenefa' && !isNaN(item.metrajeLinear)) {
                      doc.text(`Metraje (Lineal): ${item.metrajeLinear.toFixed(2)} m`, 20, finalY + itemSummaryLineHeight);
                      finalY += itemSummaryLineHeight;
                 }


                if (item.type === 'muro') {
                     if (!isNaN(item.faces)) {
                          doc.text(`Nº Caras: ${item.faces}`, 20, finalY + itemSummaryLineHeight);
                          finalY += itemSummaryLineHeight;
                     }
                     if (item.cara1PanelType) {
                          doc.text(`Panel Cara 1: ${item.cara1PanelType}`, 20, finalY + itemSummaryLineHeight);
                          finalY += itemSummaryLineHeight;
                     }
                     if (item.faces === 2 && item.cara2PanelType) {
                          doc.text(`Panel Cara 2: ${item.cara2PanelType}`, 20, finalY + itemSummaryLineHeight);
                          finalY += itemSummaryLineHeight;
                     }
                      if (!isNaN(item.postSpacing)) {
                         doc.text(`Espaciamiento Postes: ${item.postSpacing.toFixed(2)} m`, 20, finalY + itemSummaryLineHeight);
                          finalY += itemSummaryLineHeight;
                     }
                     if (item.postType) {
                         doc.text(`Tipo de Poste: ${item.postType}`, 20, finalY + itemSummaryLineHeight);
                         finalY += itemSummaryLineHeight;
                     }
                      doc.text(`Estructura Doble: ${item.isDoubleStructure ? 'Sí' : 'No'}`, 20, finalY + itemSummaryLineHeight);
                       finalY += itemSummaryLineHeight;

                     doc.text(`Segmentos:`, 20, finalY + itemSummaryLineHeight);
                     finalY += itemSummaryLineHeight;
                      if (item.segments && item.segments.length > 0) {
                         item.segments.forEach(seg => {
                              let segmentLine = `- Seg ${seg.number}: ${seg.width.toFixed(2)}m x ${seg.height.toFixed(2)}m (Real)`;
                              if (!seg.isValidForMaterials) {
                                  segmentLine += ' (Inválido para Materiales)';
                              }
                              if (!isNaN(seg.metrajeArea)) {
                                   segmentLine += ` - Metraje: ${seg.metrajeArea.toFixed(2)} m²`;
                              }
                             doc.text(segmentLine, 25, finalY + itemSummaryLineHeight);
                             finalY += itemSummaryLineHeight;
                         });
                           if (item.totalMuroArea > 0) {
                                doc.text(`- Área Total Segmentos (Usada para Materiales): ${item.totalMuroArea.toFixed(2)} m²`, 25, finalY + itemSummaryLineHeight);
                                finalY += itemSummaryLineHeight;
                           }
                            if (item.totalMuroWidth > 0) {
                                doc.text(`- Ancho Total Segmentos (Usado para Materiales): ${item.totalMuroWidth.toFixed(2)} m`, 25, finalY + itemSummaryLineHeight);
                                finalY += itemSummaryLineHeight;
                           }
                      } else {
                           doc.text(`- Sin segmentos ingresados o válidos`, 25, finalY + itemSummaryLineHeight);
                           finalY += itemSummaryLineHeight;
                      }


                } else if (item.type === 'cielo') {
                     if (item.cieloPanelType) {
                          doc.text(`Tipo de Panel: ${item.cieloPanelType}`, 20, finalY + itemSummaryLineHeight);
                          finalY += itemSummaryLineHeight;
                     }
                     if (!isNaN(item.cieloPanelWaste)) {
                         doc.text(`Desperdicio Paneles: ${item.cieloPanelWaste.toFixed(0)} %`, 20, finalY + itemSummaryLineHeight);
                          finalY += itemSummaryLineHeight;
                     }
                    if (!isNaN(item.plenum)) {
                        doc.text(`Pleno: ${item.plenum.toFixed(2)} m`, 20, finalY + itemSummaryLineHeight);
                         finalY += itemSummaryLineHeight;
                    }
                    if (!isNaN(item.angularDeduction) && item.angularDeduction > 0) {
                        doc.text(`Descuento Angular: ${item.angularDeduction.toFixed(2)} m`, 20, finalY + itemSummaryLineHeight);
                        finalY += itemSummaryLineHeight;
                    }

                     doc.text(`Segmentos:`, 20, finalY + itemSummaryLineHeight);
                     finalY += itemSummaryLineHeight;
                     if (item.segments && item.segments.length > 0) {
                         item.segments.forEach(seg => {
                             let segmentLine = `- Seg ${seg.number}: ${seg.width.toFixed(2)}m x ${seg.length.toFixed(2)}m (Real)`;
                              if (!seg.isValidForMaterials) {
                                   segmentLine += ' (Inválido para Materiales)';
                              }
                              if (!isNaN(seg.metrajeArea)) {
                                   segmentLine += ` - Metraje: ${seg.metrajeArea.toFixed(2)} m²`;
                              }
                             doc.text(segmentLine, 25, finalY + itemSummaryLineHeight);
                             finalY += itemSummaryLineHeight;
                         });
                          if (item.totalCieloArea > 0) {
                             doc.text(`- Área Total Segmentos (Usada para Materiales): ${item.totalCieloArea.toFixed(2)} m²`, 25, finalY + itemSummaryLineHeight);
                             finalY += itemSummaryLineHeight;
                         }
                          if (item.totalCieloPerimeterSum > 0) {
                             doc.text(`- Suma Perímetros Segmentos (Usada para Materiales): ${item.totalCieloPerimeterSum.toFixed(2)} m`, 25, finalY + itemSummaryLineHeight);
                             finalY += itemSummaryLineHeight;
                         }
                          // if (item.totalValidWidthForSoporte > 0 || item.totalValidLengthForSoporte > 0) {
                          //      doc.text(`- Dimensiones Totales (Usadas para Canal Soporte): ${item.totalValidWidthForSoporte.toFixed(2)}m (Ancho) x ${item.totalValidLengthForSoporte.toFixed(2)}m (Largo)`, 25, finalY + itemSummaryLineHeight);
                          //      finalY += itemSummaryLineHeight;
                          // }

                     } else {
                         doc.text(`- Sin segmentos ingresados o válidos`, 25, finalY + itemSummaryLineHeight);
                         finalY += itemSummaryLineHeight;
                     }
                } else if (item.type === 'cenefa') {
                    if (item.cenefaOrientation) {
                        doc.text(`Orientación: ${item.cenefaOrientation}`, 20, finalY + itemSummaryLineHeight);
                        finalY += itemSummaryLineHeight;
                    }
                    if (!isNaN(item.cenefaLength)) {
                        doc.text(`Largo (Real): ${item.cenefaLength.toFixed(2)} m`, 20, finalY + itemSummaryLineHeight);
                        finalY += itemSummaryLineHeight;
                    }
                     if (!isNaN(item.cenefaWidth)) {
                         doc.text(`Ancho (Real): ${item.cenefaWidth.toFixed(2)} m`, 20, finalY + itemSummaryLineHeight);
                         finalY += itemSummaryLineHeight;
                     }
                      if (!isNaN(item.cenefaHeight)) {
                         doc.text(`Alto (Real): ${item.cenefaHeight.toFixed(2)} m`, 20, finalY + itemSummaryLineHeight);
                         finalY += itemSummaryLineHeight;
                     }
                    if (!isNaN(item.cenefaFaces)) {
                        doc.text(`Nº de Caras: ${item.cenefaFaces}`, 20, finalY + itemSummaryLineHeight);
                        finalY += itemSummaryLineHeight;
                    }
                    if (item.cenefaPanelType) {
                        doc.text(`Tipo de Panel: ${item.cenefaPanelType}`, 20, finalY + itemSummaryLineHeight);
                        finalY += itemSummaryLineHeight;
                    }
                     if (item.cenefaAnchorWallType) {
                         doc.text(`Anclaje a: ${item.cenefaAnchorWallType}`, 20, finalY + itemSummaryLineHeight);
                         finalY += itemSummaryLineHeight;
                     }
                }
                finalY += itemBlockSpacing;
            });
            finalY += 5;
       } else {
             // Only add vertical space if there are metraje totals to follow
             if (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] > 0 ||
                 lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0 ||
                 lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {
                  finalY += 10;
             }
       }


        // --- Totales de Metraje en PDF ---
        if (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] > 0 ||
            lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0 ||
            lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {

             doc.setFontSize(14);
             doc.setTextColor(secondaryOliveRGB[0], secondaryOliveRGB[1], secondaryOliveRGB[2]);
             doc.setFont("helvetica", "bold");
             doc.text("Totales de Metraje:", 14, finalY + 10);
             finalY += 15;

             doc.setFontSize(9);
             doc.setTextColor(darkGrayRGB[0], darkGrayRGB[1], darkGrayRGB[2]);
             doc.setFont("helvetica", "normal");

             const metrajeLineHeight = 5;
              if (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] > 0) {
                  doc.text(`Muro Área Total: ${lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'].toFixed(2)} m²`, 20, finalY + metrajeLineHeight);
                  finalY += metrajeLineHeight;
              }
               if (lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0) {
                  doc.text(`Cielo Área Total: ${lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'].toFixed(2)} m²`, 20, finalY + metrajeLineHeight);
                   finalY += metrajeLineHeight;
               }
               if (lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {
                   doc.text(`Cenefa Lineal Total: ${lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'].toFixed(2)} m`, 20, finalY + metrajeLineHeight);
                   finalY += metrajeLineHeight;
               }
             finalY += 8;
        }


       // --- Add Total Materials Table ---
        if (Object.keys(lastCalculatedTotalMaterials).some(material => lastCalculatedTotalMaterials[material] > 0)) {
             doc.setFontSize(14);
             doc.setTextColor(secondaryOliveRGB[0], secondaryOliveRGB[1], secondaryOliveRGB[2]);
             doc.setFont("helvetica", "bold");
             doc.text("Totales de Materiales (Cantidades a Comprar):", 14, finalY + 10);
             finalY += 15;

            const tableColumn = ["Material", "Cantidad", "Unidad"];
            const tableRows = [];

            const sortedMaterials = Object.keys(lastCalculatedTotalMaterials).sort();
            sortedMaterials.forEach(material => {
                const cantidad = lastCalculatedTotalMaterials[material];
                if (cantidad > 0) { // Only add rows for materials with quantity > 0
                     const unidad = getMaterialUnit(material);
                     tableRows.push([material, cantidad, unidad]);
                }
            });

             if (tableRows.length === 0 && Object.keys(lastCalculatedTotalMaterials).length > 0) { // If there were materials but all were 0 after adjustment
                  tableRows.push([{ content: "No se calcularon cantidades positivas de materiales.", colSpan: 3, styles: { halign: 'center', fontStyle: 'italic' } }]);
             } else if (Object.keys(lastCalculatedTotalMaterials).length === 0) { // If there were no materials calculated at all
                   tableRows.push([{ content: "No se calcularon cantidades de materiales.", colSpan: 3, styles: { halign: 'center', fontStyle: 'italic' } }]);
             }


             doc.autoTable({
                 head: [tableColumn],
                 body: tableRows,
                 startY: finalY,
                 theme: 'plain',
                 headStyles: {
                     fillColor: lightGrayRGB,
                     textColor: darkGrayRGB,
                     fontStyle: 'bold',
                     halign: 'center',
                     valign: 'middle',
                     lineWidth: 0.1,
                     lineColor: lightGrayRGB,
                     fontSize: 10
                 },
                 bodyStyles: {
                     textColor: darkGrayRGB,
                     lineWidth: 0.1,
                     lineColor: lightGrayRGB,
                     fontSize: 9
                 },
                  alternateRowStyles: {
                     fillColor: extraLightGrayRGB,
                 },
                  columnStyles: {
                     1: {
                         halign: 'right',
                         fontStyle: 'bold',
                         textColor: primaryOliveRGB
                     },
                      2: {
                         halign: 'center'
                     }
                 },
                 margin: { top: 10, right: 14, bottom: 14, left: 14 },
                  didDrawPage: function (data) {
                    doc.setFontSize(8);
                    doc.setTextColor(mediumGrayRGB[0], mediumGrayRGB[1], mediumGrayRGB[2]);
                    const footerText = '© 2025 PROPUL - Calculadora de Materiales Tablayeso v2.0';
                    const textWidth = doc.getStringUnitWidth(footerText) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                    const centerX = (doc.internal.pageSize.getWidth() - textWidth) / 2;
                    doc.text(footerText, centerX, doc.internal.pageSize.height - 10);

                    const pageNumberText = `Página ${data.pageNumber}`;
                    const pageNumberWidth = doc.getStringUnitWidth(pageNumberText) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                    const pageNumberX = doc.internal.pageSize.getWidth() - data.settings.margin.right - pageNumberWidth;
                    doc.text(pageNumberText, pageNumberX, doc.internal.pageSize.height - 10);
                 }
             });

            finalY = doc.autoTable.previous.finalY;

            console.log("PDF generated.");
            doc.save(`Calculo_Materiales_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`);

       } else {
              console.log("PDF generado (solo resumen de ítems y metrajes si aplica).");
             // If there are metraje totals but no materials, save the PDF with just metrajes
              if (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] > 0 ||
                  lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0 ||
                  lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0 ||
                  lastCalculatedItemsSpecs.length > 0) { // Save if there was anything valid to report
                  doc.save(`Calculo_Materiales_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`);
              } else {
                 // If absolutely nothing was calculated (no valid items, no metrajes, no materials)
                  console.warn("No hay resultados para guardar en PDF.");
                  alert("No hay resultados válidos para generar el PDF.");
              }
       }
   };


// --- Excel Generation Function ---
const generateExcel = () => {
    console.log("Iniciando generación de Excel...");
    // Check if there are calculated results to report (materials, metrajes, or valid items)
    if ((Object.keys(lastCalculatedTotalMaterials).length === 0) &&
        (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] <= 0 &&
         lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] <= 0 &&
         lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] <= 0) &&
        lastCalculatedItemsSpecs.length === 0 &&
        lastErrorMessages.length === 0) // Also check if there were errors preventing calculation
    {
         console.warn("No hay resultados calculados (materiales ajustados, metrajes o ítems válidos) ni errores para reportar en el Excel.");
         alert("Por favor, realiza un cálculo válido antes de generar el Excel.");
         return;
      }

   if (typeof XLSX === 'undefined') {
        console.error("La librería xlsx no está cargada.");
        alert("Error al generar Excel: Librería xlsx no encontrada.");
        return;
   }


   let sheetData = [];

   sheetData.push(["Calculadora de Materiales y Metrajes Tablayeso"]);
   sheetData.push([`Fecha del cálculo: ${new Date().toLocaleDateString('es-ES')}`]);
   if (lastCalculatedWorkArea) {
       sheetData.push([`Área de Trabajo: ${lastCalculatedWorkArea}`]);
   }
   sheetData.push([]);


   // Add Item Summaries or Errors Section
   if (lastErrorMessages.length > 0) {
        console.log("Añadiendo errores al Excel.");
        sheetData.push(["Errores Encontrados:"]);
        lastErrorMessages.forEach(msg => {
            sheetData.push([msg]); // Each error message in a new row
        });
        sheetData.push([]); // Blank line after errors
   }


   if (lastCalculatedItemsSpecs.length > 0) {
        console.log("Añadiendo resumen de ítems al Excel.");
       sheetData.push(["Detalle de Ítems Calculados:"]);
       // --- ENCABEZADOS DE LA TABLA DE DETALLE DE ÍTEMS ---
       sheetData.push([
           "Tipo Item", "Número Item", "Detalle/Dimensiones",
           "Nº Caras (Muro)", // Etiqueta actualizada para Muro
           "Panel Cara 1 (Muro)",
           "Panel Cara 2 (Muro)",
           "Tipo Panel (Cielo)", // Etiqueta más específica para Cielo
           "Espaciamiento Postes (m)", "Tipo de Poste",
           "Estructura Doble",
           "Pleno (m)", "Metros Descuento Angular (m)", "Desperdicio Paneles Cielo (%)", // --- NUEVA columna Desperdicio Cielo ---
            "Orientación (Cenefa)", "Largo (Cenefa) (m)", "Ancho (Cenefa) (m)", "Alto (Cenefa) (m)", "Nº Caras (Cenefa)", "Tipo Panel (Cenefa)", "Anclaje a (Cenefa)", // --- NUEVAS columnas para Cenefa ---
           "Suma Perímetros Segmentos (Usada para Materiales) (m)",
           "Ancho Total (Usado para Materiales) (m)", // Ancho total segmentos muro real
           "Área Total Segmentos (Usada para Materiales) (m²)", // Área total segmentos muro/cielo real
           "Metraje (Área Muro/Cielo) (m²)", // Metraje ítem con >=1 regla
           "Metraje (Lineal Cenefa) (m)" // Metraje ítem con >=1 regla
       ]);
       // --- FIN ENCABEZADOS ---


       lastCalculatedItemsSpecs.forEach(item => {
            if (item.type === 'muro') {
                // Aseguramos que el array tenga el tamaño correcto para todas las columnas.
                const muroRowBase = [
                    getItemTypeName(item.type), // 0
                    item.number,                 // 1
                    '',                          // 2: Placeholder para Detalle/Dimensiones
                    !isNaN(item.faces) ? item.faces : '', // 3: Nº Caras (Muro)
                    item.cara1PanelType ? item.cara1PanelType : '', // 4: Panel Cara 1 (Muro)
                    item.faces === 2 && item.cara2PanelType ? item.cara2PanelType : '', // 5: Panel Cara 2 (Muro)
                    '',                          // 6: Tipo Panel (Cielo) (vacío para muro)
                    !isNaN(item.postSpacing) ? item.postSpacing.toFixed(2) : '', // 7: Espaciamiento Postes
                    item.postType ? item.postType : '', // 8: Tipo de Poste
                    item.isDoubleStructure ? 'Sí' : 'No', // 9: Estructura Doble
                    '', '', '',                  // 10, 11, 12: Pleno, Descuento Angular, Desperdicio Cielo (vacío para muro)
                    '', '', '', '', '', '', ''   // 13-19: Columnas de Cenefa (vacío para muro)
                    // Las columnas de Totales Reales y Metrajes por Ítem empiezan después (20, 21, 22, 23, 24)
                ];
                // Fila principal con opciones y totales del ítem
                const muroSummaryRow = [...muroRowBase]; // Copia los detalles comunes
                muroSummaryRow[2] = 'Opciones:'; // Etiqueta en la columna de detalle
                // Agrega celdas vacías para columnas 20-22
                 muroSummaryRow.push(''); // 20: Suma Perímetros Segmentos (Real) (vacío para Muro)
                 muroSummaryRow.push(!isNaN(item.totalMuroWidth) ? item.totalMuroWidth.toFixed(2) : ''); // 21: Ancho Total (Muro Real)
                 muroSummaryRow.push(!isNaN(item.totalMuroArea) ? item.totalMuroArea.toFixed(2) : ''); // 22: Área Total Segmentos (Usada para Materiales)

                // --- Agrega Metraje del Ítem ---
                muroSummaryRow.push(
                   !isNaN(item.metrajeArea) ? item.metrajeArea.toFixed(2) : '',        // 23: Metraje (Área Muro/Cielo)
                   ''                                                              // 24: Metraje (Lineal Cenefa) (vacío para muro)
                );
                sheetData.push(muroSummaryRow);

                // Fila que etiqueta la sección de Segmentos
                 const muroSegmentsLabelRow = [...muroRowBase];
                 muroSegmentsLabelRow[2] = 'Segmentos:'; // Etiqueta "Segmentos:"
                 // Agrega celdas vacías para las columnas restantes (20-24)
                 muroSegmentsLabelRow.push('', '', '', '', '');
                 sheetData.push(muroSegmentsLabelRow);


                 if (item.segments && item.segments.length > 0) {
                     item.segments.forEach(seg => {
                          // Fila para cada Segmento individual
                          const segmentRow = [...muroRowBase]; // Copia los detalles comunes para esta fila
                          let segmentDetails = `Seg ${seg.number}: ${seg.width.toFixed(2)}m x ${seg.height.toFixed(2)}m (Real)`;
                          if (!seg.isValidForMaterials) {
                              segmentDetails += ' (Inválido para Materiales)';
                          }
                          segmentRow[2] = segmentDetails; // Dimensiones reales del segmento
                           // Agrega celdas vacías para las columnas restantes (20-24)
                           segmentRow.push('', '', '', '', '');
                           // Agrega el metraje del segmento a la columna de Metraje Área
                           if (!isNaN(seg.metrajeArea)) {
                                // Encuentra la columna 23 (Metraje Área Muro/Cielo)
                                const metrajeAreaColumnIndex = muroRowBase.length + 3; // Base length + 3 cols before metraje area
                                segmentRow[metrajeAreaColumnIndex] = seg.metrajeArea.toFixed(2);
                           }

                          sheetData.push(segmentRow);
                     });
                  } else {
                       // Fila para "Sin segmentos ingresados o válidos"
                       const noSegmentsRow = [...muroRowBase];
                       noSegmentsRow[2] = `- Sin segmentos ingresados o válidos`;
                        // Agrega celdas vacías para las columnas restantes (20-24)
                        noSegmentsRow.push('', '', '', '', '');
                        sheetData.push(noSegmentsRow);
                  }


            } else if (item.type === 'cielo') {
                // Aseguramos que el array tenga el tamaño correcto, llenando las columnas de Muro/Cenefa con vacío.
                const cieloRowBase = [
                    getItemTypeName(item.type), // 0
                    item.number,                 // 1
                    '',                          // 2: Placeholder para Detalle/Dimensiones
                    '',                          // 3: Nº Caras (Muro) (vacío)
                    '', '',                     // 4, 5: Panel Cara 1, Cara 2 (Muro) (vacío)
                    item.cieloPanelType ? item.cieloPanelType : '', // 6: Tipo Panel (Cielo)
                    '',                          // 7: Espaciamiento Postes (vacío)
                    '',                          // 8: Tipo de Poste (vacío)
                    ''                           // 9: Estructura Doble (vacío)
                    // Las columnas de Pleno, Descuento Angular, Desperdicio Cielo, y las de Cenefa y Totales Reales/Metrajes por Ítem empiezan después (10, 11, 12, 13-19, 20, 21, 22, 23, 24)
                ];

                 // Fila principal con opciones y totales del ítem
                const cieloSummaryRow = [...cieloRowBase]; // Copia los detalles comunes
                cieloSummaryRow[2] = 'Opciones:'; // Etiqueta en la columna de detalle
                // Agrega Pleno, Descuento Angular, Desperdicio Cielo
                cieloSummaryRow.push(
                     !isNaN(item.plenum) ? item.plenum.toFixed(2) : '', // 10: Pleno
                     !isNaN(item.angularDeduction) ? item.angularDeduction.toFixed(2) : '', // 11: Metros Descuento Angular
                     !isNaN(item.cieloPanelWaste) ? item.cieloPanelWaste.toFixed(0) : '' // 12: Desperdicio Paneles Cielo
                 );
                // Agrega celdas vacías para las columnas de Cenefa (13-19)
                 cieloSummaryRow.push('', '', '', '', '', '', '');
                // --- Agrega los Totales Reales del Cielo y Metraje del Ítem ---
                cieloSummaryRow.push(
                   !isNaN(item.totalCieloPerimeterSum) ? item.totalCieloPerimeterSum.toFixed(2) : '', // 20: Suma Perímetros Segmentos (Real)
                   '',                                                              // 21: Ancho Total (Muro Real) - Vacío para Cielo
                   !isNaN(item.totalCieloArea) ? item.totalCieloArea.toFixed(2) : '', // 22: Área Total Segmentos (Usada para Materiales)
                   !isNaN(item.metrajeArea) ? item.metrajeArea.toFixed(2) : '',        // 23: Metraje (Área Muro/Cielo)
                   ''                                                              // 24: Metraje (Lineal Cenefa) (vacío)
                );
                sheetData.push(cieloSummaryRow);

                // Fila que etiqueta la sección de Segmentos
                 const cieloSegmentsLabelRow = [...cieloRowBase];
                 cieloSegmentsLabelRow[2] = 'Segmentos:'; // Etiqueta "Segmentos:"
                  // Agrega celdas vacías para Pleno, Descuento, Desperdicio Cielo, Cenefa, totales reales y metrajes (10-24)
                  cieloSegmentsLabelRow.push('', '', '', '', '', '', '', '', '', '', '', '', '', '', '');
                  sheetData.push(cieloSegmentsLabelRow);


                  if (item.segments && item.segments.length > 0) {
                      item.segments.forEach(seg => {
                          // Fila para cada Segmento individual
                          const segmentRow = [...cieloRowBase]; // Copia los detalles comunes para esta fila
                          let segmentDetails = `Seg ${seg.number}: ${seg.width.toFixed(2)}m x ${seg.length.toFixed(2)}m (Real)`;
                           if (!seg.isValidForMaterials) {
                                segmentDetails += ' (Inválido para Materiales)';
                           }
                           segmentRow[2] = segmentDetails; // Dimensiones reales del segmento
                           // Agrega celdas vacías para Pleno, Descuento, Desperdicio Cielo, Cenefa, totales reales y metrajes (10-24)
                           segmentRow.push('', '', '', '', '', '', '', '', '', '', '', '', '', '', '');
                           // Agrega el metraje del segmento a la columna de Metraje Área
                           if (!isNaN(seg.metrajeArea)) {
                                // Encuentra la columna 23 (Metraje Área Muro/Cielo)
                                const metrajeAreaColumnIndex = cieloRowBase.length + 3; // Base length + 3 cols before metraje area
                                segmentRow[metrajeAreaColumnIndex] = seg.metrajeArea.toFixed(2);
                           }
                          sheetData.push(segmentRow);
                      });
                   } else {
                       // Fila para "Sin segmentos ingresados o válidos"
                       const noSegmentsRow = [...cieloRowBase];
                       noSegmentsRow[2] = `- Sin segmentos ingresados o válidos`;
                        // Agrega celdas vacías para Pleno, Descuento, Desperdicio Cielo, Cenefa, totales reales y metrajes (10-24)
                        noSegmentsRow.push('', '', '', '', '', '', '', '', '', '', '', '', '', '', '');
                        sheetData.push(noSegmentsRow);
                   }

            } else if (item.type === 'cenefa') {
                // Aseguramos que el array tenga el tamaño correcto.
                 const cenefaRowBase = [
                     getItemTypeName(item.type), // 0
                     item.number,                 // 1
                     'Opciones:',                 // 2: Etiqueta para opciones
                     '',                          // 3: Nº Caras (Muro) (vacío)
                     '', '',                      // 4, 5: Panel Cara 1, Cara 2 (Muro) (vacío)
                     '',                         // 6: Tipo Panel (Cielo) (vacío)
                     '', '',                      // 7, 8: Espaciamiento Postes, Tipo de Poste (vacío)
                     ''                            // 9: Estructura Doble (vacío)
                     // Las columnas de Pleno, Descuento Angular, Desperdicio Cielo (10, 11, 12) también vacías.
                 ];

                 const cenefaSummaryRow = [...cenefaRowBase]; // Copia los detalles comunes
                 // Agrega celdas vacías para Pleno, Descuento Angular, Desperdicio Cielo (10, 11, 12)
                 cenefaSummaryRow.push('', '', '');

                 // --- Agrega las columnas específicas de Cenefa (13-19) ---
                 cenefaSummaryRow.push(
                     item.cenefaOrientation ? item.cenefaOrientation : '', // 13: Orientación
                     !isNaN(item.cenefaLength) ? item.cenefaLength.toFixed(2) : '', // 14: Largo (Real)
                     !isNaN(item.cenefaWidth) ? item.cenefaWidth.toFixed(2) : '',   // 15: Ancho (Real)
                     !isNaN(item.cenefaHeight) ? item.cenefaHeight.toFixed(2) : '', // 16: Alto (Real)
                     !isNaN(item.cenefaFaces) ? item.cenefaFaces : '',           // 17: Nº Caras (Cenefa)
                     item.cenefaPanelType ? item.cenefaPanelType : '',             // 18: Tipo Panel (Cenefa)
                     item.cenefaAnchorWallType ? item.cenefaAnchorWallType : ''     // 19: Anclaje a (Cenefa)
                 );

                 // --- Agrega celdas vacías para los Totales Reales Muro/Cielo y Metraje Área Muro/Cielo (20, 21, 22, 23) ---
                 cenefaSummaryRow.push('', '', '', '');

                 // --- Agrega el Metraje Lineal de Cenefa (24) ---
                 cenefaSummaryRow.push(!isNaN(item.metrajeLinear) ? item.metrajeLinear.toFixed(2) : '');

                 sheetData.push(cenefaSummaryRow);

                 // Cenefas no tienen segmentos, así que no hay sección de segmentos detallada.
            }
       });
       sheetData.push([]); // Fila en blanco para espaciar

   } else {
        // Mostrar un mensaje si no hay ítems válidos calculados pero sí hay totales de metraje (ej: solo cenefas válidas)
        if (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] > 0 ||
            lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0 ||
            lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {
             sheetData.push(['']); // Fila en blanco
             sheetData.push(['No hay ítems de Muro o Cielo con dimensiones válidas para el cálculo detallado de materiales, pero se calcularon metrajes totales.']);
             sheetData.push(['']); // Fila en blanco
        }
   }


    // --- Totales de Metraje en Excel ---
    if (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] > 0 ||
        lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0 ||
        lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {

         sheetData.push(["Totales de Metraje:"]);
         if (lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'] > 0) {
             sheetData.push(['Muro Área Total', lastCalculatedTotalMetrajes['Muro Área Total Metraje (m²)'].toFixed(2), 'm²']);
         }
         if (lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'] > 0) {
              sheetData.push(['Cielo Área Total', lastCalculatedTotalMetrajes['Cielo Área Total Metraje (m²)'].toFixed(2), 'm²']);
         }
          if (lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'] > 0) {
              sheetData.push(['Cenefa Lineal Total', lastCalculatedTotalMetrajes['Cenefa Lineal Total Metraje (m)'].toFixed(2), 'm']);
          }
         sheetData.push([]);
    }


   // Tabla de Totales de Materiales
    if (Object.keys(lastCalculatedTotalMaterials).some(material => lastCalculatedTotalMaterials[material] > 0)) {
         sheetData.push(["Totales de Materiales (Cantidades a Comprar):"]);
         sheetData.push(["Material", "Cantidad", "Unidad"]);

         const sortedMaterials = Object.keys(lastCalculatedTotalMaterials).sort();
         sortedMaterials.forEach(material => {
             const cantidad = lastCalculatedTotalMaterials[material];
             if (cantidad > 0) {
                 const unidad = getMaterialUnit(material);
                  sheetData.push([material, cantidad, unidad]);
             }
         });
         sheetData.push([]);
    }


   const wb = XLSX.utils.book_new();
   const ws = XLSX.utils.aoa_to_sheet(sheetData);

    const col_widths = [];
    const maxCols = Math.max(...sheetData.map(row => row.length));
    for(let i = 0; i < maxCols; i++) {
        col_widths[i] = 0;
    }

    sheetData.forEach(row => {
        row.forEach((cell, colIndex) => {
            const cellLength = cell ? cell.toString().length : 0;
            col_widths[colIndex] = Math.max(col_widths[colIndex] || 0, cellLength * 1.2);
        });
    });
    // Adjust width for the Material column in the totals table.
    // Find the starting column index of the "Material" header in the totals table.
    let materialHeaderIndex = -1;
     for (let i = 0; i < sheetData.length; i++) {
         const row = sheetData[i];
         // Find the row that starts with "Totales de Materiales (Cantidades a Comprar):"
         if (row[0] === "Totales de Materiales (Cantidades a Comprar):") {
             // The next row should be the header row ["Material", "Cantidad", "Unidad"]
              if (i + 1 < sheetData.length && sheetData[i+1][0] === "Material") {
                  materialHeaderIndex = 0; // Material column is the first one in this section
                  break;
              }
         }
     }

    if (materialHeaderIndex !== -1 && col_widths[materialHeaderIndex]) {
         col_widths[materialHeaderIndex] = Math.max(col_widths[materialHeaderIndex], 30); // Ensure Material column is wide enough
    }


    ws['!cols'] = col_widths.map(w => ({ wch: w }));


   XLSX.utils.book_append_sheet(wb, ws, "CalculoMateriales");

   XLSX.writeFile(wb, `Calculo_Materiales_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.xlsx`);
   console.log("Excel generado.");
};


// --- Event Listeners ---
if (addItemBtn) addItemBtn.addEventListener('click', createItemBlock);
if (calculateBtn) calculateBtn.addEventListener('click', calculateMaterials);
if (generatePdfBtn) generatePdfBtn.addEventListener('click', generatePDF);
if (generateExcelBtn) generateExcelBtn.addEventListener('click', generateExcel);

// --- Configuración Inicial ---
createItemBlock();
toggleCalculateButtonState();


});

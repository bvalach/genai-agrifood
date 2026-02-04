document.addEventListener('DOMContentLoaded', () => {
    const paperGrid = document.getElementById('paper-grid');
    const modal = document.getElementById('modal');
    const closeButton = document.querySelector('.close-button');
    const modalTitle = document.getElementById('modal-title');
    const modalAuthors = document.getElementById('modal-authors');
    const modalDate = document.getElementById('modal-date');
    const modalDoi = document.getElementById('modal-doi');
    const modalAbstract = document.getElementById('modal-abstract');
    const modalLink = document.getElementById('modal-link');

    // FUNCIONES DE SEGURIDAD
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function sanitizeUrl(url) {
        if (!url) return '#';
        
        // Permitir solo URLs HTTPS/HTTP válidas
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol === 'https:' || urlObj.protocol === 'http:') {
                return url;
            }
        } catch (e) {
            console.warn('Invalid URL detected:', url);
        }
        return '#';
    }

    function sanitizeDoi(doi) {
        if (!doi) return '';
        // DOI debe seguir el formato estándar: 10.xxxx/xxxxx
        const doiPattern = /^10\.\d{4,}\/[^\s]+$/;
        return doiPattern.test(doi) ? doi : '';
    }

    function truncateText(text, maxLength = 1000) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // Timeline elements
    const dateSliderMin = document.getElementById('date-slider-min');
    const dateSliderMax = document.getElementById('date-slider-max');
    const selectedRange = document.getElementById('selected-range');
    const resetButton = document.getElementById('reset-timeline');
    const minDateLabel = document.getElementById('min-date');
    const maxDateLabel = document.getElementById('max-date');

    // Source filter elements
    const sourceFiltersContainer = document.getElementById('source-filters');
    const selectAllSourcesBtn = document.getElementById('select-all-sources');
    const clearAllSourcesBtn = document.getElementById('clear-all-sources');

    // Category filter elements
    const categoryFiltersContainer = document.getElementById('category-filters');
    const selectAllBtn = document.getElementById('select-all-categories');
    const clearAllBtn = document.getElementById('clear-all-categories');

    // Persistence elements
    const exportJsonBtn = document.getElementById('export-json');
    const exportCsvBtn = document.getElementById('export-csv');
    const exportMarkdownBtn = document.getElementById('export-markdown');
    const saveLocalBtn = document.getElementById('save-local');
    const loadLocalBtn = document.getElementById('load-local');
    const saveStatus = document.getElementById('save-status');

    let allPapers = [];
    let filteredPapers = []; // Papers filtrados por categoría
    let selectedCategories = new Set(); // Categorías seleccionadas
    let dateRange = { min: 0, max: 48 }; // Índices de meses
    let actualDateRange = { minDate: null, maxDate: null }; // Fechas reales
    let availableCategories = new Set(); // Categorías disponibles
    let availableSources = new Set(); // Fuentes disponibles
    let selectedSources = new Set(); // Fuentes seleccionadas

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Categorías para auto-etiquetado
    const categoryKeywords = {
        'Synthetic Data': ['synthetic data', 'synthetic images', 'data augmentation', 'simulation'],
        'Disease Detection': ['disease detection', 'plant disease', 'crop disease', 'leaf disease', 'plant pathology', 'pest detection'],
        'Crop Prediction': ['crop yield', 'yield prediction', 'weather forecasting', 'climate simulation'],
        'Robotics & Automation': ['robot', 'autonomous', 'path planning', 'grasping', 'agricultural robot'],
        'Livestock & Animal Health': ['livestock', 'animal health', 'animal nutrition', 'feed formulation'],
        'Food Safety & Quality': ['food safety', 'food security', 'food quality', 'inspection', 'traceability', 'supply chain'],
        'Sustainability': ['sustainable agriculture', 'carbon footprint', 'climate', 'environmental'],
        'Smart Agriculture': ['precision agriculture', 'IoT sensors', 'sensor fusion', 'vertical farming', 'hydroponics'],
        'AI Assistants': ['large language model', 'chatbot', 'virtual assistant', 'farm management', 'advisory', 'AI-powered'],
        'Plant Breeding': ['plant breeding', 'crop genetics', 'genetic algorithm', 'sequence generation', 'genetic engineering']
    };

    const coreGenAiTerms = [
        'generative ai',
        'foundation model',
        'large language model',
        'small language model',
        'llm',
        'diffusion model',
        'generative adversarial',
        'gan',
        'text-to-image',
        'text to image',
        'multimodal',
        'vision-language',
        'synthetic data',
        'prompt'
    ];

    const agriFoodTerms = [
        'agriculture',
        'agricultural',
        'agrifood',
        'agri-food',
        'farming',
        'farm',
        'crop',
        'soil',
        'plant',
        'horticulture',
        'livestock',
        'dairy',
        'aquaculture',
        'food industry',
        'food processing',
        'food safety',
        'food quality',
        'supply chain',
        'agro'
    ];

    function isRelevantPaper(paper) {
        const text = `${paper.title || ''} ${paper.abstract || ''}`.toLowerCase();
        const hasGenAi = coreGenAiTerms.some(term => text.includes(term));
        const hasAgriFood = agriFoodTerms.some(term => text.includes(term));
        return hasGenAi && hasAgriFood;
    }

    // Función para auto-etiquetar papers
    function categorizePaper(paper) {
        const text = `${paper.title} ${paper.abstract}`.toLowerCase();
        const categories = [];
        
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
                categories.push(category);
            }
        }
        
        return categories.length > 0 ? categories : ['Other'];
    }

    // Funciones de filtrado por fuente
    function initializeSourceFilters() {
        availableSources.clear();
        allPapers.forEach(paper => {
            if (paper.source) {
                availableSources.add(paper.source);
            }
        });

        sourceFiltersContainer.innerHTML = '';
        const hasSavedSelection = selectedSources.size > 0;

        availableSources.forEach(source => {
            const button = document.createElement('button');
            button.className = 'source-filter-btn';
            button.textContent = source;
            button.dataset.source = source;

            button.addEventListener('click', () => toggleSource(source));
            sourceFiltersContainer.appendChild(button);

            if (!hasSavedSelection) {
                selectedSources.add(source); // Inicialmente todas seleccionadas
            }
        });

        updateSourceButtons();
    }

    function toggleSource(source) {
        if (selectedSources.has(source)) {
            selectedSources.delete(source);
        } else {
            selectedSources.add(source);
        }

        updateSourceButtons();
        applyFilters();
    }

    function updateSourceButtons() {
        const buttons = sourceFiltersContainer.querySelectorAll('.source-filter-btn');
        buttons.forEach(button => {
            const source = button.dataset.source;
            if (selectedSources.has(source)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    function selectAllSources() {
        availableSources.forEach(src => selectedSources.add(src));
        updateSourceButtons();
        applyFilters();
    }

    function clearAllSources() {
        selectedSources.clear();
        updateSourceButtons();
        applyFilters();
    }

    // Funciones de filtrado por categorías
    function initializeCategoryFilters() {
        // Recopilar todas las categorías disponibles
        availableCategories.clear();
        allPapers.forEach(paper => {
            if (paper.categories) {
                paper.categories.forEach(cat => availableCategories.add(cat));
            }
        });

        // Crear botones de filtro
        categoryFiltersContainer.innerHTML = '';
        const hasSavedSelection = selectedCategories.size > 0;
        availableCategories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'category-filter-btn';
            button.textContent = category;
            button.dataset.category = category;
            
            button.addEventListener('click', () => toggleCategory(category));
            categoryFiltersContainer.appendChild(button);
            
            if (!hasSavedSelection) {
                selectedCategories.add(category); // Inicialmente todas seleccionadas
            }
        });

        updateCategoryButtons();
    }

    function toggleCategory(category) {
        if (selectedCategories.has(category)) {
            selectedCategories.delete(category);
        } else {
            selectedCategories.add(category);
        }
        
        updateCategoryButtons();
        applyFilters();
    }

    function updateCategoryButtons() {
        const buttons = categoryFiltersContainer.querySelectorAll('.category-filter-btn');
        buttons.forEach(button => {
            const category = button.dataset.category;
            if (selectedCategories.has(category)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    function selectAllCategories() {
        availableCategories.forEach(cat => selectedCategories.add(cat));
        updateCategoryButtons();
        applyFilters();
    }

    function clearAllCategories() {
        selectedCategories.clear();
        updateCategoryButtons();
        applyFilters();
    }

    function applyFilters() {
        // Filtrar por fuentes
        const sourceFiltered = allPapers.filter(paper => {
            if (selectedSources.size === 0) return false;
            return paper.source && selectedSources.has(paper.source);
        });

        // Filtrar por categorías
        const categoryFiltered = sourceFiltered.filter(paper => {
            if (selectedCategories.size === 0) return false;
            return paper.categories && paper.categories.some(cat => selectedCategories.has(cat));
        });

        // Aplicar filtros de fecha también
        const minVal = parseInt(dateSliderMin.value);
        const maxVal = parseInt(dateSliderMax.value);
        const baseYear = actualDateRange.minDate ? actualDateRange.minDate.getFullYear() : 2025;
        const minDate = monthIndexToDate(minVal, baseYear);
        const maxDate = monthIndexToDate(maxVal + 1, baseYear);

        const fullyFiltered = categoryFiltered.filter(paper => {
            if (!paper.date) return false;
            const paperDate = new Date(paper.date);
            return paperDate >= minDate && paperDate < maxDate;
        });

        displayPapers(fullyFiltered);
    }

    // Funciones de persistencia de datos
    function showSaveStatus(message, isSuccess = true) {
        saveStatus.textContent = message;
        saveStatus.className = `save-status ${isSuccess ? 'success' : 'error'}`;
        setTimeout(() => {
            saveStatus.textContent = '';
            saveStatus.className = 'save-status';
        }, 3000);
    }

    function exportToJson() {
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                totalPapers: allPapers.length,
                dateRange: actualDateRange,
                categories: Array.from(availableCategories),
                papers: allPapers.map(paper => ({
                    ...paper,
                    exportNote: 'Generated by foodAI Living Review System'
                }))
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `foodAI-living-review-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            showSaveStatus('JSON exported successfully!');
        } catch (error) {
            console.error('Error exporting JSON:', error);
            showSaveStatus('Error exporting JSON', false);
        }
    }

    function exportToCsv() {
        try {
            const headers = ['Title', 'Authors', 'Date', 'Categories', 'DOI', 'URL', 'Abstract'];
            const csvRows = [headers.join(',')];

            allPapers.forEach(paper => {
                const row = [
                    `"${(paper.title || '').replace(/"/g, '""')}"`,
                    `"${Array.isArray(paper.authors) ? paper.authors.join('; ') : ''}"`,
                    `"${paper.date || ''}"`,
                    `"${paper.categories ? paper.categories.join('; ') : ''}"`,
                    `"${paper.doi || ''}"`,
                    `"${paper.url || ''}"`,
                    `"${(paper.abstract || '').replace(/"/g, '""').substring(0, 500)}"`
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            const dataBlob = new Blob([csvContent], { type: 'text/csv' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `foodAI-living-review-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            showSaveStatus('CSV exported successfully!');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            showSaveStatus('Error exporting CSV', false);
        }
    }

    function exportToMarkdown() {
        try {
            const today = new Date().toLocaleDateString();
            let markdown = `# foodAI - Living Review on Generative AI in AgriFood\n\n`;
            markdown += `**Generated:** ${today}  \n`;
            markdown += `**Total Papers:** ${allPapers.length}  \n`;
            markdown += `**Date Range:** ${actualDateRange.minDate?.toLocaleDateString()} - ${actualDateRange.maxDate?.toLocaleDateString()}  \n\n`;

            // Categorías disponibles
            markdown += `## Categories\n\n`;
            Array.from(availableCategories).sort().forEach(category => {
                const count = allPapers.filter(p => p.categories?.includes(category)).length;
                markdown += `- **${category}**: ${count} papers\n`;
            });
            markdown += `\n`;

            // Papers por categoría
            Array.from(availableCategories).sort().forEach(category => {
                const categoryPapers = allPapers.filter(p => p.categories?.includes(category));
                if (categoryPapers.length === 0) return;

                markdown += `## ${category} (${categoryPapers.length} papers)\n\n`;
                
                categoryPapers.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(paper => {
                    markdown += `### ${paper.title || 'Untitled'}\n\n`;
                    markdown += `**Authors:** ${Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A'}  \n`;
                    markdown += `**Date:** ${paper.date || 'N/A'}  \n`;
                    if (paper.doi) markdown += `**DOI:** [${paper.doi}](https://doi.org/${paper.doi})  \n`;
                    if (paper.url && paper.url !== '#') markdown += `**URL:** [Paper Link](${paper.url})  \n`;
                    markdown += `**Categories:** ${paper.categories ? paper.categories.join(', ') : 'N/A'}  \n\n`;
                    
                    if (paper.abstract) {
                        markdown += `**Abstract:**  \n${paper.abstract}\n\n`;
                    }
                    markdown += `---\n\n`;
                });
            });

            const dataBlob = new Blob([markdown], { type: 'text/markdown' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `foodAI-living-review-${new Date().toISOString().split('T')[0]}.md`;
            link.click();
            
            showSaveStatus('Markdown exported successfully!');
        } catch (error) {
            console.error('Error exporting Markdown:', error);
            showSaveStatus('Error exporting Markdown', false);
        }
    }

    function saveToLocal() {
        try {
            const saveData = {
                timestamp: new Date().toISOString(),
                papers: allPapers,
                categories: Array.from(availableCategories),
                dateRange: actualDateRange,
                selectedCategories: Array.from(selectedCategories),
                sources: Array.from(availableSources),
                selectedSources: Array.from(selectedSources)
            };

            localStorage.setItem('foodAI-living-review', JSON.stringify(saveData));
            // No mostrar mensaje al guardar automáticamente
        } catch (error) {
            console.error('Error saving locally:', error);
            showSaveStatus('Error saving data automatically', false);
        }
    }

    function loadFromLocal() {
        try {
            const savedData = localStorage.getItem('foodAI-living-review');
            if (!savedData) {
                return null;
            }

            const data = JSON.parse(savedData);
            allPapers = data.papers || [];
            availableCategories = new Set(data.categories || []);
            actualDateRange = data.dateRange || { minDate: null, maxDate: null };
            selectedCategories = new Set(data.selectedCategories || []);
            availableSources = new Set(data.sources || []);
            selectedSources = new Set(data.selectedSources || []);

            initializeTimeline(allPapers);
            initializeSourceFilters();
            initializeCategoryFilters();
            applyFilters();

            showSaveStatus(`Loaded ${allPapers.length} papers from cache.`, true);
            return data; // Devolver los datos cargados

        } catch (error) {
            console.error('Error loading from local:', error);
            showSaveStatus('Error loading cached data', false);
            localStorage.removeItem('foodAI-living-review'); // Limpiar caché corrupta
            return null;
        }
    }

    // Convertir fecha a índice de mes (0 = Jan 2025, 12 = Jan 2026, etc.)
    function dateToMonthIndex(date, baseYear) {
        const year = date.getFullYear();
        const month = date.getMonth();
        return (year - baseYear) * 12 + month;
    }

    // Convertir índice de mes a fecha
    function monthIndexToDate(index, baseYear) {
        const year = baseYear + Math.floor(index / 12);
        const month = index % 12;
        return new Date(year, month, 1);
    }

    // Formatear fecha para mostrar
    function formatMonthYear(index, baseYear) {
        const date = monthIndexToDate(index, baseYear);
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }

    // Timeline functionality
    function updateDateRange() {
        const minVal = parseInt(dateSliderMin.value);
        const maxVal = parseInt(dateSliderMax.value);
        
        // Ensure min doesn't exceed max
        if (minVal > maxVal) {
            dateSliderMin.value = maxVal;
        }
        if (maxVal < minVal) {
            dateSliderMax.value = minVal;
        }
        
        const finalMin = parseInt(dateSliderMin.value);
        const finalMax = parseInt(dateSliderMax.value);
        
        const baseYear = actualDateRange.minDate ? actualDateRange.minDate.getFullYear() : 2025;
        const minText = formatMonthYear(finalMin, baseYear);
        const maxText = formatMonthYear(finalMax, baseYear);
        
        selectedRange.textContent = `${minText} - ${maxText}`;
        filterPapersByDateRange(finalMin, finalMax, baseYear);
    }

    function filterPapersByDateRange(minIndex, maxIndex, baseYear) {
        // Usar la nueva función de filtros combinados
        applyFilters();
    }

    function initializeTimeline(papers) {
        if (papers.length === 0) return;
        
        const dates = papers
            .filter(paper => paper.date)
            .map(paper => new Date(paper.date))
            .filter(date => !isNaN(date));
        
        if (dates.length === 0) return;
        
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        actualDateRange = { minDate, maxDate };
        
        const baseYear = minDate.getFullYear();
        const minIndex = dateToMonthIndex(minDate, baseYear);
        const maxIndex = dateToMonthIndex(maxDate, baseYear);
        
        dateRange = { min: minIndex, max: maxIndex };
        
        // Update slider attributes
        dateSliderMin.min = minIndex;
        dateSliderMin.max = maxIndex;
        dateSliderMin.value = minIndex;
        
        dateSliderMax.min = minIndex;
        dateSliderMax.max = maxIndex;
        dateSliderMax.value = maxIndex;
        
        // Update labels
        minDateLabel.textContent = formatMonthYear(minIndex, baseYear);
        maxDateLabel.textContent = formatMonthYear(maxIndex, baseYear);
        selectedRange.textContent = `${formatMonthYear(minIndex, baseYear)} - ${formatMonthYear(maxIndex, baseYear)}`;
    }

    function resetTimeline() {
        dateSliderMin.value = dateRange.min;
        dateSliderMax.value = dateRange.max;
        updateDateRange();
    }

    // Mejorar el estado de carga
    function showLoadingState() {
        paperGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #D6F06E; border-top: 4px solid #BCEB38; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
                <p style="font-size: 1.2rem; color: #848484; margin: 0;">Loading latest research papers...</p>
                <p style="font-size: 1rem; color: #848484; margin: 0.5rem 0 0 0; opacity: 0.8;">This may take a few moments</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    function showErrorState(message) {
        paperGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <div style="font-size: 1rem; margin-bottom: 1rem;">⚠️</div>
                <p style="font-size: 1.2rem; color: #848484; margin: 0;">${message}</p>
                <button onclick="location.reload()" style="
                    background: #D6F06E;
                    color: #2c2c2c;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 50px;
                    font-weight: 500;
                    margin-top: 1.5rem;
                    cursor: pointer;
                    transition: transform 0.3s ease;
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    Try Again
                </button>
            </div>
        `;
    }

    async function searchSemanticScholar() {
        const queries = [
            'generative AI agriculture',
            'generative AI agrifood',
            'foundation model agriculture',
            'large language model agriculture',
            'large language model agrifood',
            'diffusion model agriculture',
            'generative adversarial network agriculture',
            'synthetic data agriculture',
            'synthetic data crop',
            'vision-language model agriculture',
            'multimodal model agriculture',
            'food industry generative AI',
            'food processing generative AI',
            'food safety generative AI',
            'precision agriculture generative model',
        ];
        
        const allPapers = [];
        const fields = 'title,authors,year,abstract,url,publicationDate,externalIds';

        console.log(`Starting Semantic Scholar search with ${queries.length} individual queries.`);

        try {
            for (const query of queries) {
                const encodedQuery = encodeURIComponent(query);
                const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&fields=${fields}&limit=50&year=2023-`;

                console.log(`Querying Semantic Scholar for: "${query}"`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.warn(`Semantic Scholar query for "${query}" failed with status: ${response.status}`);
                    continue; // Skip to the next query if this one fails
                }

                const data = await response.json();
                
                if (data && data.data) {
                    const papers = data.data.map(paper => {
                        const processedPaper = {
                            title: truncateText(paper.title || '', 300),
                            authors: Array.isArray(paper.authors) ? paper.authors.slice(0, 10).map(a => truncateText(a.name || '', 100)) : [],
                            date: paper.publicationDate || (paper.year ? `${paper.year}-01-01` : null),
                            abstract: truncateText(paper.abstract || '', 3000),
                            url: sanitizeUrl(paper.url),
                            doi: paper.externalIds && paper.externalIds.DOI ? sanitizeDoi(paper.externalIds.DOI) : null,
                            source: 'SemanticScholar'
                        };
                        processedPaper.categories = categorizePaper(processedPaper);
                        return processedPaper;
                    }).filter(isRelevantPaper);
                    allPapers.push(...papers);
                }

                // Small delay to be polite to the API
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            console.log('Semantic Scholar total papers found:', allPapers.length);
            return allPapers;

        } catch (error) {
            console.error("Error during Semantic Scholar fetch loop:", error);
            return allPapers; // Return what we have so far
        }
    }

    
    async function searchCrossref() {
        const queries = [
            'generative AI agriculture',
            'generative AI agrifood',
            'foundation model agriculture',
            'large language model agriculture',
            'diffusion model agriculture',
            'generative adversarial network agriculture',
            'synthetic data agriculture',
            'food industry generative AI',
            'food processing generative AI',
            'food safety generative AI'
        ];
        
        const allPapers = [];
        const mailto = "bvalach@doctor.upv.es"; // Good practice for Crossref polite pool
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds

        console.log("Starting Crossref search.");
    
        try {
            for (const query of queries) {
                let success = false;
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        const encodedQuery = encodeURIComponent(query);
                        const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=100&filter=from-pub-date:2023-01-01&mailto=${mailto}`;
                        
                        console.log(`Querying Crossref for: "${query}" (Attempt ${attempt})`);
                        
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => {
                            controller.abort();
                            console.warn(`Crossref query for "${query}" timed out.`);
                        }, 15000);

                        const response = await fetch(url, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            throw new Error(`Crossref query failed with status: ${response.status}`);
                        }

                        const data = await response.json();
                        
                        if (data.status === 'ok' && data.message && data.message.items) {
                            const papers = data.message.items.map(item => {
                                const authors = item.author ? item.author.map(a => `${a.given || ''} ${a.family || ''}`).filter(name => name.trim()) : [];
                                
                                let publicationDate = null;
                                if (item.published && item.published['date-parts'] && item.published['date-parts'][0]) {
                                    const year = item.published['date-parts'][0][0];
                                    const month = item.published['date-parts'][0][1] || 1;
                                    const day = item.published['date-parts'][0][2] || 1;
                                    publicationDate = new Date(Date.UTC(year, month - 1, day));
                                }
                                const isValidDate = publicationDate && !isNaN(publicationDate);

                                const processedPaper = {
                                    title: item.title && item.title.length > 0 ? item.title[0] : 'No title available',
                                    authors: authors,
                                    date: isValidDate ? publicationDate.toISOString().split('T')[0] : null,
                                    abstract: item.abstract ? truncateText(item.abstract.replace(/<\/?[^>]+(>|$)/g, ""), 3000) : 'No abstract available.',
                                    url: sanitizeUrl(item.URL),
                                    doi: item.DOI ? sanitizeDoi(item.DOI) : null,
                                    source: 'Crossref'
                                };
                                processedPaper.categories = categorizePaper(processedPaper);
                                return processedPaper;
                            }).filter(p => p.date).filter(isRelevantPaper);

                            allPapers.push(...papers);
                        }
                        success = true;
                        break; // Salir del bucle de reintentos si tiene éxito

                    } catch (error) {
                        console.warn(`Attempt ${attempt} for "${query}" failed:`, error.message);
                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                        } else {
                            console.error(`All ${maxRetries} attempts failed for Crossref query: "${query}"`);
                        }
                    }
                }
                if (success) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Be polite to the API
                }
            }
            
            console.log('Crossref search completed. Total unique papers from Crossref:', allPapers.length);
            return allPapers;
    
        } catch (error) {
            console.error("Error fetching from Crossref:", error);
            return [];
        }
    }

    async function searchArxiv() {
        const query = `(
            all:("generative ai" OR "foundation model" OR "large language model" OR "diffusion model" OR "generative adversarial" OR GAN)
            AND
            all:(agriculture OR agrifood OR farming OR crop OR "food industry" OR "food processing" OR "food safety")
        )`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://export.arxiv.org/api/query?search_query=${encodedQuery}&sortBy=submittedDate&sortOrder=descending&max_results=100`;
        
        console.log('ArXiv query length:', query.length);
        console.log('ArXiv URL:', url.substring(0, 200) + '...');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const xmlText = await response.text();
            
            console.log('ArXiv response status:', response.status);
            console.log('ArXiv response length:', xmlText.length);
            
            // Validar que sea XML válido
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
                throw new Error('Invalid XML response');
            }

            const entries = xmlDoc.getElementsByTagName("entry");
            console.log('ArXiv entries found:', entries.length);
            const papers = [];
            
            // Limitar número de entradas procesadas
            const maxEntries = Math.min(entries.length, 100);
            
            for (let i = 0; i < maxEntries; i++) {
                const entry = entries[i];
                try {
                    const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || '';
                    const abstract = entry.getElementsByTagName("summary")[0]?.textContent?.trim() || '';
                    const authors = Array.from(entry.getElementsByTagName("author"))
                        .slice(0, 10) // Límite de autores
                        .map(a => a.getElementsByTagName("name")[0]?.textContent?.trim() || '')
                        .filter(name => name);
                    const date = entry.getElementsByTagName("published")[0]?.textContent?.trim() || null;
                    const url = entry.getElementsByTagName("id")[0]?.textContent?.trim() || '';
                    
                    const arxivId = url.split('/abs/')[1];
                    const doi = null; // Los papers de arXiv no tienen DOI real
                    
                    const processedPaper = { 
                        title: truncateText(title, 300),
                        authors,
                        date,
                        abstract: truncateText(abstract, 3000),
                        url: sanitizeUrl(url),
                        doi: null, // No DOI para arXiv
                        source: 'arXiv' // Añadir identificador de origen
                    };
                    
                    // Añadir categorías automáticamente
                    processedPaper.categories = categorizePaper(processedPaper);
                    if (isRelevantPaper(processedPaper)) {
                        papers.push(processedPaper);
                    }
                } catch (e) {
                    console.warn('Error processing arXiv entry:', e);
                    continue;
                }
            }
            
            return papers;
            
        } catch (error) {
            console.error("Error fetching from arXiv:", error);
            console.error("Error type:", error.name);
            console.error("Error message:", error.message);
            return [];
        }
    }

    async function loadAllPapers(isBackgroundRefresh = false) {
        if (!isBackgroundRefresh) {
            showLoadingState();
        }
        
        try {
            const [scholarPapers, arxivPapers, crossrefPapers] = await Promise.all([
                searchSemanticScholar(),
                searchArxiv(),
                searchCrossref()
            ]);

            console.log('Semantic Scholar papers:', scholarPapers.length);
            console.log('ArXiv papers:', arxivPapers.length);
            console.log('Crossref papers:', crossrefPapers.length);

            allPapers = [...scholarPapers, ...arxivPapers, ...crossrefPapers];

            console.log('Total papers before filtering:', allPapers.length);

            if (allPapers.length === 0) {
                console.log('No papers found from APIs');
                showErrorState('No papers could be loaded from the APIs. Please check your internet connection and try again.');
                return;
            }

            // Eliminar duplicados basándose en títulos similares
            const uniquePapers = Array.from(
                new Map(allPapers.map(p => [p.title.toLowerCase().trim(), p])).values()
            );

            console.log('Unique papers after deduplication:', uniquePapers.length);

            // Filtrar por fecha (papers desde 2023)
            const filterDate = new Date('2023-01-01');
            const filteredPapers = uniquePapers.filter(paper => {
                if (!paper.date || isNaN(new Date(paper.date))) {
                    return false;
                }
                const paperDate = new Date(paper.date);
                return paperDate >= filterDate;
            });
            
            console.log('Papers after date filtering (2023+):', filteredPapers.length);
            
            filteredPapers.sort((a, b) => new Date(b.date) - new Date(a.date));

            allPapers = filteredPapers;
            
            initializeTimeline(allPapers);
            initializeSourceFilters();
            initializeCategoryFilters(); // Inicializar filtros de categorías

            if (allPapers.length === 0) {
                paperGrid.innerHTML = '<p>No papers found matching the criteria (published after January 2023).</p>';
                return;
            }
            applyFilters(); // Usar filtros en lugar de displayPapers directo

            // Guardar los resultados en el almacenamiento local después de una carga exitosa
            saveToLocal();
            if (isBackgroundRefresh) {
                showSaveStatus(`Update complete. Total papers: ${allPapers.length}`, true);
            }

        } catch (error) {
            console.error('Error loading papers:', error);
            if (!isBackgroundRefresh) {
                showErrorState('An unexpected error occurred while loading papers. Please try again.');
            } else {
                showSaveStatus('Failed to update papers in the background.', false);
            }
        }
    }

    function displayPapers(papers) {
        paperGrid.innerHTML = '';
        if (papers.length === 0) {
            paperGrid.innerHTML = '<p>No papers found matching the selected criteria.</p>';
            return;
        }
        papers.forEach(createPaperCard);
    }

    function createPaperCard(paper) {
        const card = document.createElement('div');
        card.className = 'paper-card';
        
        // Sanitizar datos
        const safeTitle = escapeHtml(truncateText(paper.title, 200));
        const safeAuthors = escapeHtml(truncateText(Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A', 150));
        const safeDate = paper.date ? escapeHtml(new Date(paper.date).toLocaleDateString()) : 'N/A';
        const safeDoi = sanitizeDoi(paper.doi);

        // Crear elementos de forma segura
        const titleElement = document.createElement('h3');
        titleElement.textContent = paper.title || 'Untitled';

        const authorsElement = document.createElement('p');
        authorsElement.textContent = Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A';

        const dateElement = document.createElement('p');
        dateElement.textContent = safeDate;

        // Añadir etiquetas de fuente y categoría
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'paper-tags';
        tagsContainer.style.cssText = 'margin-top: 0.5rem; margin-bottom: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;';

        if (paper.source) {
            const sourceTag = document.createElement('span');
            sourceTag.className = 'source-tag';
            sourceTag.textContent = paper.source;
            sourceTag.style.cssText = `
                padding: 0.2rem 0.6rem;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 600;
            `;

            let bgColor, fgColor;
            switch (paper.source) {
                case 'arXiv':
                    bgColor = '#FDECDF'; fgColor = '#B75C09'; break;
                case 'SemanticScholar':
                    bgColor = '#DDEBFF'; fgColor = '#0052CC'; break;
                case 'Crossref':
                    bgColor = '#E3FCEF'; fgColor = '#006644'; break;
                default:
                    bgColor = '#EBECF0'; fgColor = '#42526E';
            }
            sourceTag.style.backgroundColor = bgColor;
            sourceTag.style.color = fgColor;
            tagsContainer.appendChild(sourceTag);
        }
        
        if (paper.categories && paper.categories.length > 0) {
            paper.categories.forEach(category => {
                const categoryTag = document.createElement('span');
                categoryTag.className = 'category-tag';
                categoryTag.textContent = category;
                categoryTag.style.cssText = `
                    background: var(--primary-green);
                    color: #2c2c2c;
                    padding: 0.2rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 500;
                `;
                tagsContainer.appendChild(categoryTag);
            });
        }
        
        if (tagsContainer.hasChildNodes()) {
            card.appendChild(tagsContainer);
        }

        // Añadir elementos al card
        card.appendChild(titleElement);
        card.appendChild(authorsElement);
        card.appendChild(dateElement);

        // DOI solo si es válido
        if (safeDoi) {
            const doiElement = document.createElement('p');
            doiElement.className = 'paper-doi';
            doiElement.textContent = safeDoi;
            card.appendChild(doiElement);
        }

        card.addEventListener('click', () => openModal({ 
            ...paper, 
            title: paper.title || 'Untitled',
            authors: Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A',
            date: safeDate 
        }));
        
        paperGrid.appendChild(card);
    }

    function openModal(paper) {
        // Sanitizar todos los datos del modal
        modalTitle.textContent = truncateText(paper.title || 'Untitled', 300);
        modalAuthors.textContent = 'Authors: ' + truncateText(paper.authors || 'N/A', 200);
        modalDate.textContent = 'Date: ' + (paper.date || 'N/A');

        const safeDoi = sanitizeDoi(paper.doi);
        if (safeDoi) {
            // Crear enlace DOI de forma segura
            modalDoi.innerHTML = '';
            const doiLink = document.createElement('a');
            doiLink.href = `https://doi.org/${safeDoi}`;
            doiLink.target = '_blank';
            doiLink.rel = 'noopener noreferrer'; // Seguridad adicional
            doiLink.textContent = safeDoi;
            modalDoi.appendChild(doiLink);
            modalDoi.style.display = 'block';
        } else {
            modalDoi.style.display = 'none';
        }

        modalAbstract.textContent = truncateText(paper.abstract || 'No abstract available.', 2000);
        
        const safeUrl = sanitizeUrl(paper.url);
        modalLink.href = safeUrl;
        if (safeUrl === '#') {
            modalLink.style.display = 'none';
        } else {
            modalLink.style.display = 'inline-block';
            modalLink.rel = 'noopener noreferrer'; // Seguridad adicional
        }

        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restaurar scroll del body
    }

    // Event listeners mejorados
    closeButton.addEventListener('click', closeModal);
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Soporte para teclado
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });

    // Event listeners for timeline
    dateSliderMin.addEventListener('input', updateDateRange);
    dateSliderMax.addEventListener('input', updateDateRange);
    resetButton.addEventListener('click', resetTimeline);

    // Event listeners for category filters
    selectAllBtn.addEventListener('click', selectAllCategories);
    clearAllBtn.addEventListener('click', clearAllCategories);

    // Event listeners for source filters
    selectAllSourcesBtn.addEventListener('click', selectAllSources);
    clearAllSourcesBtn.addEventListener('click', clearAllSources);

    // Event listeners for data persistence
    exportJsonBtn.addEventListener('click', exportToJson);
    exportCsvBtn.addEventListener('click', exportToCsv);
    exportMarkdownBtn.addEventListener('click', exportToMarkdown);
    saveLocalBtn.addEventListener('click', saveToLocal);
    loadLocalBtn.addEventListener('click', loadFromLocal);

    // Inicializar la aplicación
    function initialize() {
        const cachedData = loadFromLocal();

        if (cachedData) {
            // Si hay caché, comprobar si es antigua (más de 12 horas)
            const cacheAge = new Date() - new Date(cachedData.timestamp);
            const twelveHours = 12 * 60 * 60 * 1000;

            if (cacheAge > twelveHours) {
                showSaveStatus('Cache is old. Checking for updates in the background...', true);
                loadAllPapers(true); // Actualizar en segundo plano
            }
        } else {
            // Si no hay caché, hacer la carga inicial completa
            loadAllPapers(false);
        }
    }

    initialize();
});

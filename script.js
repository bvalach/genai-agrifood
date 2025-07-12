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

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Categorías para auto-etiquetado
    const categoryKeywords = {
        'Synthetic Data': ['synthetic data', 'synthetic images', 'data augmentation', 'simulation'],
        'Disease Detection': ['disease detection', 'plant disease', 'crop disease', 'leaf disease', 'plant pathology', 'pest detection'],
        'Crop Prediction': ['crop yield', 'yield prediction', 'weather forecasting', 'climate simulation'],
        'Robotics & Automation': ['robot', 'autonomous', 'path planning', 'grasping', 'agricultural robot'],
        'Livestock & Animal Health': ['livestock', 'animal health', 'animal nutrition', 'feed formulation'],
        'Food Safety & Quality': ['food safety', 'food quality', 'inspection', 'traceability', 'supply chain'],
        'Sustainability': ['sustainable agriculture', 'carbon footprint', 'climate', 'environmental'],
        'Smart Agriculture': ['precision agriculture', 'IoT sensors', 'sensor fusion', 'vertical farming', 'hydroponics'],
        'AI Assistants': ['large language model', 'chatbot', 'virtual assistant', 'farm management', 'advisory'],
        'Plant Breeding': ['plant breeding', 'crop genetics', 'genetic algorithm', 'sequence generation']
    };

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
        availableCategories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'category-filter-btn active';
            button.textContent = category;
            button.dataset.category = category;
            
            button.addEventListener('click', () => toggleCategory(category));
            categoryFiltersContainer.appendChild(button);
            
            selectedCategories.add(category); // Inicialmente todas seleccionadas
        });
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
        // Filtrar por categorías
        const categoryFiltered = allPapers.filter(paper => {
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
                selectedCategories: Array.from(selectedCategories)
            };

            localStorage.setItem('foodAI-living-review', JSON.stringify(saveData));
            showSaveStatus('Data saved locally!');
        } catch (error) {
            console.error('Error saving locally:', error);
            showSaveStatus('Error saving locally', false);
        }
    }

    function loadFromLocal() {
        try {
            const savedData = localStorage.getItem('foodAI-living-review');
            if (!savedData) {
                showSaveStatus('No saved data found', false);
                return;
            }

            const data = JSON.parse(savedData);
            allPapers = data.papers || [];
            availableCategories = new Set(data.categories || []);
            actualDateRange = data.dateRange || { minDate: null, maxDate: null };
            selectedCategories = new Set(data.selectedCategories || []);

            initializeTimeline(allPapers);
            initializeCategoryFilters();
            applyFilters();

            showSaveStatus(`Loaded ${allPapers.length} papers from ${new Date(data.timestamp).toLocaleDateString()}`);
        } catch (error) {
            console.error('Error loading from local:', error);
            showSaveStatus('Error loading saved data', false);
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
                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #ECF6CE; border-top: 4px solid #F4FA58; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
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
                    background: linear-gradient(135deg, #ECF6CE, #F4FA58);
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
            // Versión simplificada para evitar queries demasiado complejas
            'synthetic data agriculture',
            'generative AI agriculture',
            'large language model agriculture',
            'plant disease synthetic images',
            'crop yield prediction generative',
            'precision agriculture synthetic',
            'agricultural robot generative',
            'food safety generative AI',
            'livestock monitoring AI',
            'vertical farming generative',
            'plant breeding generative',
            'generative adversarial network agriculture',
            'diffusion model agriculture',
            'farm management language model',
            'agricultural advisory AI',
            'generative AI agrifood',
            'synthetic data generation farming',
            'AI agriculture generative model'
        ];
        
        const query = queries.join(' | ');
        const fields = 'title,authors,year,abstract,url,publicationDate,externalIds';
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodedQuery}&fields=${fields}&limit=100`;
        
        console.log('Semantic Scholar query length:', query.length);
        console.log('Semantic Scholar URL:', url.substring(0, 200) + '...');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            console.log('Semantic Scholar response status:', response.status);
            console.log('Semantic Scholar response data keys:', Object.keys(data));
            
            // Validar estructura de respuesta
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format');
            }

            const papers = data.data || data || [];
            console.log('Semantic Scholar raw papers count:', papers.length);
            
            // Validar y sanitizar cada paper
            return papers
                .filter(paper => paper && typeof paper === 'object')
                .slice(0, 100) // Límite de seguridad aumentado
                .map(paper => {
                    const processedPaper = {
                        title: truncateText(paper.title || '', 300),
                        authors: Array.isArray(paper.authors) ? 
                            paper.authors.slice(0, 10).map(a => truncateText(a.name || '', 100)) : [],
                        date: paper.publicationDate || paper.year || null,
                        abstract: truncateText(paper.abstract || '', 3000),
                        url: sanitizeUrl(paper.url),
                        doi: paper.externalIds && paper.externalIds.DOI ? 
                            sanitizeDoi(paper.externalIds.DOI) : null
                    };
                    // Añadir categorías automáticamente
                    processedPaper.categories = categorizePaper(processedPaper);
                    return processedPaper;
                });

        } catch (error) {
            console.error("Error fetching from Semantic Scholar:", error);
            console.error("Error type:", error.name);
            console.error("Error message:", error.message);
            return [];
        }
    }

    async function searchArxiv() {
        const query = `(all:agriculture AND all:"generative AI") OR (all:agriculture AND all:"synthetic data") OR (all:agriculture AND all:"language model") OR (all:farming AND all:"generative") OR (all:agri* AND all:GAN) OR (all:"food safety" AND all:"generative") OR (all:"precision agriculture") OR (all:"plant disease" AND all:"synthetic")`;
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
                    papers.push(processedPaper);
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

    async function loadAllPapers() {
        showLoadingState();
        
        try {
            const [scholarPapers, arxivPapers] = await Promise.all([
                searchSemanticScholar(),
                searchArxiv()
            ]);

            console.log('Semantic Scholar papers:', scholarPapers.length);
            console.log('ArXiv papers:', arxivPapers.length);

            allPapers = [...scholarPapers, ...arxivPapers];

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
            initializeCategoryFilters(); // Inicializar filtros de categorías

            if (allPapers.length === 0) {
                paperGrid.innerHTML = '<p>No papers found matching the criteria (published after January 2023).</p>';
                return;
            }
            applyFilters(); // Usar filtros en lugar de displayPapers directo

        } catch (error) {
            console.error('Error loading papers:', error);
            showErrorState('An unexpected error occurred while loading papers. Please try again.');
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

        // Añadir categorías si existen
        if (paper.categories && paper.categories.length > 0) {
            const categoriesElement = document.createElement('div');
            categoriesElement.className = 'paper-categories';
            categoriesElement.style.cssText = 'margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem;';
            
            paper.categories.forEach(category => {
                const categoryTag = document.createElement('span');
                categoryTag.className = 'category-tag';
                categoryTag.textContent = category;
                categoryTag.style.cssText = `
                    background: linear-gradient(135deg, #ECF6CE, #F4FA58);
                    color: #2c2c2c;
                    padding: 0.2rem 0.5rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 500;
                `;
                categoriesElement.appendChild(categoryTag);
            });
            
            card.appendChild(categoriesElement);
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

    // Event listeners for data persistence
    exportJsonBtn.addEventListener('click', exportToJson);
    exportCsvBtn.addEventListener('click', exportToCsv);
    exportMarkdownBtn.addEventListener('click', exportToMarkdown);
    saveLocalBtn.addEventListener('click', saveToLocal);
    loadLocalBtn.addEventListener('click', loadFromLocal);

    // Inicializar la carga de papers
    loadAllPapers();
});


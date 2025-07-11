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

    let allPapers = [];
    let dateRange = { min: 0, max: 23 }; // Índices de meses
    let actualDateRange = { minDate: null, maxDate: null }; // Fechas reales

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
        const minDate = monthIndexToDate(minIndex, baseYear);
        const maxDate = monthIndexToDate(maxIndex + 1, baseYear); // +1 para incluir todo el mes
        
        const filteredPapers = allPapers.filter(paper => {
            if (!paper.date) return false;
            const paperDate = new Date(paper.date);
            return paperDate >= minDate && paperDate < maxDate;
        });
        
        displayPapers(filteredPapers);
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
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
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
            '(+"synthetic data generation" +"agriculture" +("generative adversarial network" | GAN))',
            '(+"synthetic images" +("plant disease" | "crop disease" | "leaf disease"))',
            '(+"data augmentation" +"precision agriculture" +("GAN" | "VAE"))',
            '(+"crop yield prediction" +("generative adversarial network" | "diffusion model"))',
            '(+"weather forecasting" +"agriculture" +"generative AI")',
            '(+"large language model" +("farm management" | "agricultural advisory" | "farmer decision support"))',
            '(+"pest detection" +"natural language processing" +report)',
            '(+"robot grasping" +("fruit" | "vegetable" | "crop") +("generative model" | "simulation"))',
            '(+"path planning" +"autonomous tractor" +GAN)'
        ];
        
        const query = queries.join(' | ');
        const fields = 'title,authors,year,abstract,url,publicationDate,externalIds';
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodedQuery}&fields=${fields}&limit=50`;

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
            
            // Validar estructura de respuesta
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format');
            }

            const papers = data.data || data || [];
            
            // Validar y sanitizar cada paper
            return papers
                .filter(paper => paper && typeof paper === 'object')
                .slice(0, 50) // Límite de seguridad
                .map(paper => ({
                    title: truncateText(paper.title || '', 300),
                    authors: Array.isArray(paper.authors) ? 
                        paper.authors.slice(0, 10).map(a => truncateText(a.name || '', 100)) : [],
                    date: paper.publicationDate || paper.year || null,
                    abstract: truncateText(paper.abstract || '', 3000),
                    url: sanitizeUrl(paper.url),
                    doi: paper.externalIds && paper.externalIds.DOI ? 
                        sanitizeDoi(paper.externalIds.DOI) : null
                }));

        } catch (error) {
            console.error("Error fetching from Semantic Scholar:", error);
            return [];
        }
    }

    async function searchArxiv() {
        const query = `(all:agri* AND all:"language model") OR (all:agri* AND all:"generative adversarial network") OR (all:agri* AND all:gan) OR (all:agri* AND all:vae)`;
        const encodedQuery = encodeURIComponent(query);
        const url = `http://export.arxiv.org/api/query?search_query=${encodedQuery}&sortBy=submittedDate&sortOrder=descending&max_results=50`;

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
            
            // Validar que sea XML válido
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
                throw new Error('Invalid XML response');
            }

            const entries = xmlDoc.getElementsByTagName("entry");
            const papers = [];
            
            // Limitar número de entradas procesadas
            const maxEntries = Math.min(entries.length, 50);
            
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
                    const doi = arxivId ? sanitizeDoi(`10.48550/arXiv.${arxivId}`) : null;
                    
                    papers.push({ 
                        title: truncateText(title, 300),
                        authors,
                        date,
                        abstract: truncateText(abstract, 3000),
                        url: sanitizeUrl(url),
                        doi
                    });
                } catch (e) {
                    console.warn('Error processing arXiv entry:', e);
                    continue;
                }
            }
            
            return papers;
            
        } catch (error) {
            console.error("Error fetching from arXiv:", error);
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

            allPapers = [...scholarPapers, ...arxivPapers];
            
            initializeTimeline(allPapers);

            if (allPapers.length === 0) {
                showErrorState('No papers could be loaded from the APIs. Please check your internet connection and try again.');
                return;
            }

            // Eliminar duplicados basándose en títulos similares
            const uniquePapers = Array.from(
                new Map(allPapers.map(p => [p.title.toLowerCase().trim(), p])).values()
            );

            // Filtrar por fecha (papers desde 2025)
            const filterDate = new Date('2025-01-01');
            const filteredPapers = uniquePapers.filter(paper => {
                if (!paper.date || isNaN(new Date(paper.date))) {
                    return false;
                }
                const paperDate = new Date(paper.date);
                return paperDate >= filterDate;
            });
            
            filteredPapers.sort((a, b) => new Date(b.date) - new Date(a.date));

            allPapers = filteredPapers;
            
            initializeTimeline(allPapers);

            if (allPapers.length === 0) {
                paperGrid.innerHTML = '<p>No papers found matching the criteria (published after January 2025).</p>';
                return;
            }
            displayPapers(allPapers);

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

    // Inicializar la carga de papers
    loadAllPapers();
});


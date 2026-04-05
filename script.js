document.addEventListener('DOMContentLoaded', () => {
    // --- DOM References ---
    const paperGrid = document.getElementById('paper-grid');
    const searchInput = document.getElementById('paper-search');

    // Modal elements
    const modalBackdrop = document.getElementById('modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalAuthors = document.getElementById('modal-authors');
    const modalDate = document.getElementById('modal-date');
    const modalDoi = document.getElementById('modal-doi');
    const modalSource = document.getElementById('modal-source');
    const modalCategories = document.getElementById('modal-categories');
    const modalAbstract = document.getElementById('modal-abstract');
    const modalLink = document.getElementById('modal-link');
    const modalCiteBtn = document.getElementById('modal-cite');
    const modalCopyDoiBtn = document.getElementById('modal-copy-doi');

    // Filter elements
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    const filterSourceSelect = document.getElementById('filter-source');
    const filterCategorySelect = document.getElementById('filter-category');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const resetFiltersBtn = document.getElementById('reset-filters');

    // Source & category chip containers
    const sourceFiltersContainer = document.getElementById('source-filters');
    const categoryFiltersContainer = document.getElementById('category-filters');
    const selectAllSourcesBtn = document.getElementById('select-all-sources');
    const clearAllSourcesBtn = document.getElementById('clear-all-sources');
    const selectAllCategoriesBtn = document.getElementById('select-all-categories');
    const clearAllCategoriesBtn = document.getElementById('clear-all-categories');

    // Export elements
    const exportToggleBtn = document.getElementById('export-toggle');
    const exportMenu = document.getElementById('export-menu');
    const exportJsonBtn = document.getElementById('export-json');
    const exportCsvBtn = document.getElementById('export-csv');
    const exportMarkdownBtn = document.getElementById('export-markdown');
    const exportRisBtn = document.getElementById('export-ris');
    const saveLocalBtn = document.getElementById('save-local');
    const loadLocalBtn = document.getElementById('load-local');
    const mobileExportBtn = document.getElementById('mobile-export-btn');

    // Stats
    const statTotal = document.getElementById('stat-total');
    const statSources = document.getElementById('stat-sources');
    const statCategories = document.getElementById('stat-categories');

    // Other
    const refreshBtn = document.getElementById('refresh-btn');
    const statusToast = document.getElementById('status-toast');
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');

    // --- Security Functions ---
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
        const doiPattern = /^10\.\d{4,}\/[^\s]+$/;
        return doiPattern.test(doi) ? doi : '';
    }

    function truncateText(text, maxLength = 1000) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    async function fetchWithCorsFallback(url, options = {}) {
        try {
            return await fetch(url, options);
        } catch (error) {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            return await fetch(proxyUrl, options);
        }
    }

    // --- State ---
    let allPapers = [];
    let selectedCategories = new Set();
    let availableCategories = new Set();
    let availableSources = new Set();
    let selectedSources = new Set();
    let searchTerm = '';
    let currentModalPaper = null; // For cite/copy DOI

    // Date range state
    let actualDateRange = { minDate: null, maxDate: null };
    let filterDateFrom = null; // Date object or null
    let filterDateTo = null;

    // --- Category Keywords ---
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
        'generative ai', 'foundation model', 'large language model', 'small language model',
        'llm', 'diffusion model', 'generative adversarial', 'gan', 'text-to-image',
        'text to image', 'multimodal', 'vision-language', 'synthetic data', 'prompt'
    ];

    const agriFoodTerms = [
        'agriculture', 'agricultural', 'agrifood', 'agri-food', 'farming', 'farm',
        'crop', 'soil', 'plant', 'horticulture', 'livestock', 'dairy', 'aquaculture',
        'food industry', 'food processing', 'food safety', 'food quality', 'supply chain', 'agro'
    ];

    function isRelevantPaper(paper) {
        const text = `${paper.title || ''} ${paper.abstract || ''}`.toLowerCase();
        const hasGenAi = coreGenAiTerms.some(term => text.includes(term));
        const hasAgriFood = agriFoodTerms.some(term => text.includes(term));
        return hasGenAi && hasAgriFood;
    }

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

    // --- Stats ---
    function updateStats() {
        if (statTotal) statTotal.textContent = allPapers.length || '--';
        if (statSources) statSources.textContent = availableSources.size || '--';
        if (statCategories) statCategories.textContent = availableCategories.size || '--';
    }

    // --- Status Toast ---
    let toastTimeout = null;
    function showStatus(message, isSuccess = true) {
        if (!statusToast) return;
        statusText.textContent = message;
        statusIcon.textContent = isSuccess ? 'check_circle' : 'error';
        statusToast.classList.toggle('error', !isSuccess);
        statusToast.classList.add('visible');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            statusToast.classList.remove('visible');
        }, 3500);
    }

    // --- Export Dropdown ---
    function toggleExportMenu() {
        exportMenu.classList.toggle('open');
    }

    function closeExportMenu() {
        exportMenu.classList.remove('open');
    }

    // Close export menu on outside click
    document.addEventListener('click', (e) => {
        if (exportMenu && !exportMenu.contains(e.target) && e.target !== exportToggleBtn && !exportToggleBtn.contains(e.target)) {
            closeExportMenu();
        }
    });

    // --- Source Filters ---
    function initializeSourceFilters() {
        availableSources.clear();
        allPapers.forEach(paper => {
            if (paper.source) availableSources.add(paper.source);
        });

        // Populate chip buttons
        sourceFiltersContainer.innerHTML = '';
        const hasSavedSelection = selectedSources.size > 0;

        availableSources.forEach(source => {
            const button = document.createElement('button');
            button.className = 'source-filter-btn';
            button.textContent = source;
            button.dataset.source = source;
            button.type = 'button';
            button.addEventListener('click', () => toggleSource(source));
            sourceFiltersContainer.appendChild(button);

            if (!hasSavedSelection) {
                selectedSources.add(source);
            }
        });
        updateSourceButtons();

        // Populate dropdown select
        if (filterSourceSelect) {
            const currentVal = filterSourceSelect.value;
            filterSourceSelect.innerHTML = '<option value="all">All Sources</option>';
            availableSources.forEach(source => {
                const opt = document.createElement('option');
                opt.value = source;
                opt.textContent = source;
                filterSourceSelect.appendChild(opt);
            });
            filterSourceSelect.value = currentVal || 'all';
        }
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
            button.classList.toggle('active', selectedSources.has(source));
        });
    }

    function selectAllSources() {
        availableSources.forEach(src => selectedSources.add(src));
        if (filterSourceSelect) filterSourceSelect.value = 'all';
        updateSourceButtons();
        applyFilters();
    }

    function clearAllSources() {
        selectedSources.clear();
        updateSourceButtons();
        applyFilters();
    }

    // --- Category Filters ---
    function initializeCategoryFilters() {
        availableCategories.clear();
        allPapers.forEach(paper => {
            if (paper.categories) {
                paper.categories.forEach(cat => availableCategories.add(cat));
            }
        });

        // Populate chip buttons
        categoryFiltersContainer.innerHTML = '';
        const hasSavedSelection = selectedCategories.size > 0;
        availableCategories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'category-filter-btn';
            button.textContent = category;
            button.dataset.category = category;
            button.type = 'button';
            button.addEventListener('click', () => toggleCategory(category));
            categoryFiltersContainer.appendChild(button);

            if (!hasSavedSelection) {
                selectedCategories.add(category);
            }
        });
        updateCategoryButtons();

        // Populate dropdown select
        if (filterCategorySelect) {
            const currentVal = filterCategorySelect.value;
            filterCategorySelect.innerHTML = '<option value="all">All Categories</option>';
            Array.from(availableCategories).sort().forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                filterCategorySelect.appendChild(opt);
            });
            filterCategorySelect.value = currentVal || 'all';
        }
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
            button.classList.toggle('active', selectedCategories.has(category));
        });
    }

    function selectAllCategories() {
        availableCategories.forEach(cat => selectedCategories.add(cat));
        if (filterCategorySelect) filterCategorySelect.value = 'all';
        updateCategoryButtons();
        applyFilters();
    }

    function clearAllCategories() {
        selectedCategories.clear();
        updateCategoryButtons();
        applyFilters();
    }

    // --- Date Filtering ---
    function initializeDateRange(papers) {
        if (papers.length === 0) return;

        const dates = papers
            .filter(p => p.date)
            .map(p => new Date(p.date))
            .filter(d => !isNaN(d));
        if (dates.length === 0) return;

        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        actualDateRange = { minDate, maxDate };

        // Set month input defaults
        if (dateFromInput) {
            dateFromInput.value = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}`;
        }
        if (dateToInput) {
            dateToInput.value = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}`;
        }
        filterDateFrom = null;
        filterDateTo = null;
    }

    // --- Combined Filter Logic ---
    function applyFilters() {
        // Source filter
        let result = allPapers.filter(paper => {
            if (selectedSources.size === 0) return false;
            return paper.source && selectedSources.has(paper.source);
        });

        // Category filter
        result = result.filter(paper => {
            if (selectedCategories.size === 0) return false;
            return paper.categories && paper.categories.some(cat => selectedCategories.has(cat));
        });

        // Date filter (from month inputs)
        if (filterDateFrom) {
            result = result.filter(paper => {
                if (!paper.date) return false;
                return new Date(paper.date) >= filterDateFrom;
            });
        }
        if (filterDateTo) {
            const endOfMonth = new Date(filterDateTo.getFullYear(), filterDateTo.getMonth() + 1, 0, 23, 59, 59);
            result = result.filter(paper => {
                if (!paper.date) return false;
                return new Date(paper.date) <= endOfMonth;
            });
        }

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(paper => {
                const searchable = [
                    paper.title || '',
                    Array.isArray(paper.authors) ? paper.authors.join(' ') : '',
                    paper.abstract || '',
                    paper.doi || '',
                    paper.categories ? paper.categories.join(' ') : '',
                    paper.source || ''
                ].join(' ').toLowerCase();
                return searchable.includes(term);
            });
        }

        displayPapers(result);
    }

    function applyBarFilters() {
        // Read from month inputs
        if (dateFromInput && dateFromInput.value) {
            const parts = dateFromInput.value.split('-');
            filterDateFrom = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        } else {
            filterDateFrom = null;
        }
        if (dateToInput && dateToInput.value) {
            const parts = dateToInput.value.split('-');
            filterDateTo = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        } else {
            filterDateTo = null;
        }

        // Source dropdown
        if (filterSourceSelect && filterSourceSelect.value !== 'all') {
            selectedSources.clear();
            selectedSources.add(filterSourceSelect.value);
            updateSourceButtons();
        }

        // Category dropdown
        if (filterCategorySelect && filterCategorySelect.value !== 'all') {
            selectedCategories.clear();
            selectedCategories.add(filterCategorySelect.value);
            updateCategoryButtons();
        }

        applyFilters();
    }

    function resetAllFilters() {
        // Reset dates
        filterDateFrom = null;
        filterDateTo = null;
        if (dateFromInput && actualDateRange.minDate) {
            dateFromInput.value = `${actualDateRange.minDate.getFullYear()}-${String(actualDateRange.minDate.getMonth() + 1).padStart(2, '0')}`;
        }
        if (dateToInput && actualDateRange.maxDate) {
            dateToInput.value = `${actualDateRange.maxDate.getFullYear()}-${String(actualDateRange.maxDate.getMonth() + 1).padStart(2, '0')}`;
        }

        // Reset dropdowns
        if (filterSourceSelect) filterSourceSelect.value = 'all';
        if (filterCategorySelect) filterCategorySelect.value = 'all';

        // Reset chips (select all)
        selectAllSources();
        selectAllCategories();

        // Reset search
        searchTerm = '';
        if (searchInput) searchInput.value = '';

        applyFilters();
    }

    // --- Export Functions ---
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
            closeExportMenu();
            showStatus('JSON exported successfully!');
        } catch (error) {
            console.error('Error exporting JSON:', error);
            showStatus('Error exporting JSON', false);
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
            closeExportMenu();
            showStatus('CSV exported successfully!');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            showStatus('Error exporting CSV', false);
        }
    }

    function exportToMarkdown() {
        try {
            const today = new Date().toLocaleDateString();
            let markdown = `# foodAI - Living Review on Generative AI in AgriFood\n\n`;
            markdown += `**Generated:** ${today}  \n`;
            markdown += `**Total Papers:** ${allPapers.length}  \n`;
            markdown += `**Date Range:** ${actualDateRange.minDate?.toLocaleDateString()} - ${actualDateRange.maxDate?.toLocaleDateString()}  \n\n`;

            markdown += `## Categories\n\n`;
            Array.from(availableCategories).sort().forEach(category => {
                const count = allPapers.filter(p => p.categories?.includes(category)).length;
                markdown += `- **${category}**: ${count} papers\n`;
            });
            markdown += `\n`;

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
                    if (paper.abstract) markdown += `**Abstract:**  \n${paper.abstract}\n\n`;
                    markdown += `---\n\n`;
                });
            });

            const dataBlob = new Blob([markdown], { type: 'text/markdown' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `foodAI-living-review-${new Date().toISOString().split('T')[0]}.md`;
            link.click();
            closeExportMenu();
            showStatus('Markdown exported successfully!');
        } catch (error) {
            console.error('Error exporting Markdown:', error);
            showStatus('Error exporting Markdown', false);
        }
    }

    function formatRisDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (isNaN(date)) return null;
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return { year, date: `${year}/${month}/${day}` };
    }

    function exportToRis() {
        try {
            const lines = [];
            allPapers.forEach(paper => {
                lines.push('TY  - JOUR');
                if (paper.title) lines.push(`TI  - ${paper.title}`);
                if (Array.isArray(paper.authors)) {
                    paper.authors.forEach(author => {
                        if (author) lines.push(`AU  - ${author}`);
                    });
                }
                const risDate = formatRisDate(paper.date);
                if (risDate) {
                    lines.push(`PY  - ${risDate.year}`);
                    lines.push(`DA  - ${risDate.date}`);
                }
                if (paper.doi) lines.push(`DO  - ${paper.doi}`);
                if (paper.url && paper.url !== '#') lines.push(`UR  - ${paper.url}`);
                if (paper.abstract) lines.push(`AB  - ${paper.abstract}`);
                if (Array.isArray(paper.categories)) {
                    paper.categories.forEach(cat => {
                        if (cat) lines.push(`KW  - ${cat}`);
                    });
                }
                lines.push('ER  -');
                lines.push('');
            });

            const risContent = lines.join('\r\n');
            const dataBlob = new Blob([risContent], { type: 'application/x-research-info-systems' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `foodAI-living-review-${new Date().toISOString().split('T')[0]}.ris`;
            link.click();
            closeExportMenu();
            showStatus('RIS exported successfully!');
        } catch (error) {
            console.error('Error exporting RIS:', error);
            showStatus('Error exporting RIS', false);
        }
    }

    // --- Local Persistence ---
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
        } catch (error) {
            console.error('Error saving locally:', error);
            showStatus('Error saving data', false);
        }
    }

    function saveToLocalExplicit() {
        saveToLocal();
        showStatus(`Saved ${allPapers.length} papers locally.`);
    }

    function loadFromLocal() {
        try {
            const savedData = localStorage.getItem('foodAI-living-review');
            if (!savedData) return null;

            const data = JSON.parse(savedData);
            allPapers = data.papers || [];
            availableCategories = new Set(data.categories || []);
            actualDateRange = data.dateRange || { minDate: null, maxDate: null };
            selectedCategories = new Set(data.selectedCategories || []);
            availableSources = new Set(data.sources || []);
            selectedSources = new Set(data.selectedSources || []);

            initializeDateRange(allPapers);
            initializeSourceFilters();
            initializeCategoryFilters();
            updateStats();
            applyFilters();

            showStatus(`Loaded ${allPapers.length} papers from cache.`);
            return data;
        } catch (error) {
            console.error('Error loading from local:', error);
            showStatus('Error loading cached data', false);
            localStorage.removeItem('foodAI-living-review');
            return null;
        }
    }

    // --- Grid States ---
    function showLoadingState() {
        paperGrid.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'grid-state';
        const spinner = document.createElement('div');
        spinner.className = 'grid-spinner';
        const title = document.createElement('p');
        title.className = 'grid-title';
        title.textContent = 'Loading latest research papers...';
        const subtitle = document.createElement('p');
        subtitle.className = 'grid-subtitle';
        subtitle.textContent = 'This may take a few moments';
        container.appendChild(spinner);
        container.appendChild(title);
        container.appendChild(subtitle);
        paperGrid.appendChild(container);
    }

    function showErrorState(message) {
        paperGrid.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'grid-state';
        const icon = document.createElement('div');
        icon.className = 'grid-icon';
        icon.textContent = '\u26A0\uFE0F';
        const msg = document.createElement('p');
        msg.className = 'grid-title';
        msg.textContent = message;
        const button = document.createElement('button');
        button.className = 'grid-retry';
        button.type = 'button';
        button.textContent = 'Try Again';
        button.addEventListener('click', () => window.location.reload());
        container.appendChild(icon);
        container.appendChild(msg);
        container.appendChild(button);
        paperGrid.appendChild(container);
    }

    function showGridMessage(message) {
        paperGrid.innerHTML = '';
        const messageEl = document.createElement('p');
        messageEl.className = 'grid-message';
        messageEl.textContent = message;
        paperGrid.appendChild(messageEl);
    }

    // --- Display Papers ---
    function displayPapers(papers) {
        paperGrid.innerHTML = '';
        if (papers.length === 0) {
            showGridMessage('No papers found matching the selected criteria.');
            return;
        }
        papers.forEach(createPaperCard);
    }

    function createPaperCard(paper) {
        const card = document.createElement('div');
        card.className = 'paper-card';
        card.tabIndex = 0;

        const safeDate = paper.date ? new Date(paper.date).toLocaleDateString() : 'N/A';
        const safeDoi = sanitizeDoi(paper.doi);

        // Tags
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'paper-tags';

        if (paper.source) {
            const sourceTag = document.createElement('span');
            const sourceClass = paper.source.toLowerCase().replace(/\s/g, '');
            sourceTag.className = `source-tag source-${sourceClass}`;
            sourceTag.textContent = paper.source;
            tagsContainer.appendChild(sourceTag);
        }

        if (paper.categories && paper.categories.length > 0) {
            paper.categories.forEach(category => {
                const categoryTag = document.createElement('span');
                categoryTag.className = 'category-tag';
                categoryTag.textContent = category;
                tagsContainer.appendChild(categoryTag);
            });
        }

        if (tagsContainer.hasChildNodes()) card.appendChild(tagsContainer);

        // Title
        const titleElement = document.createElement('h3');
        titleElement.textContent = paper.title || 'Untitled';
        card.appendChild(titleElement);

        // Authors
        const authorsElement = document.createElement('p');
        authorsElement.className = 'paper-authors';
        authorsElement.textContent = Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A';
        card.appendChild(authorsElement);

        // Date
        const dateElement = document.createElement('p');
        dateElement.className = 'paper-date';
        dateElement.textContent = safeDate;
        card.appendChild(dateElement);

        // DOI
        if (safeDoi) {
            const doiElement = document.createElement('p');
            doiElement.className = 'paper-doi';
            doiElement.textContent = safeDoi;
            card.appendChild(doiElement);
        }

        const openFn = () => openModal(paper);
        card.addEventListener('click', openFn);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFn();
            }
        });

        paperGrid.appendChild(card);
    }

    // --- Modal ---
    function openModal(paper) {
        currentModalPaper = paper;

        // Title
        modalTitle.textContent = truncateText(paper.title || 'Untitled', 300);

        // Authors
        modalAuthors.textContent = Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A';

        // Date
        const safeDate = paper.date ? new Date(paper.date).toLocaleDateString() : 'N/A';
        modalDate.textContent = safeDate;

        // Source
        if (modalSource) modalSource.textContent = paper.source || '--';

        // DOI
        const safeDoi = sanitizeDoi(paper.doi);
        if (safeDoi) {
            modalDoi.textContent = safeDoi;
            modalDoi.style.display = 'block';
        } else {
            modalDoi.textContent = '--';
        }

        // Categories
        if (modalCategories) {
            modalCategories.innerHTML = '';
            if (paper.categories && paper.categories.length > 0) {
                paper.categories.forEach(cat => {
                    const pill = document.createElement('span');
                    pill.className = 'modal-cat-pill';
                    pill.textContent = cat;
                    modalCategories.appendChild(pill);
                });
            }
        }

        // Abstract
        modalAbstract.textContent = truncateText(paper.abstract || 'No abstract available.', 2000);

        // Link
        const safeUrl = sanitizeUrl(paper.url);
        modalLink.href = safeUrl;
        if (safeUrl === '#') {
            modalLink.style.display = 'none';
        } else {
            modalLink.style.display = 'flex';
        }

        modalBackdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalBackdrop.classList.remove('open');
        document.body.style.overflow = '';
        currentModalPaper = null;
    }

    // Cite function
    function citePaper() {
        if (!currentModalPaper) return;
        const p = currentModalPaper;
        const authors = Array.isArray(p.authors) ? p.authors.join(', ') : 'Unknown';
        const year = p.date ? new Date(p.date).getFullYear() : 'n.d.';
        const title = p.title || 'Untitled';
        const doi = p.doi ? ` https://doi.org/${p.doi}` : '';
        const citation = `${authors} (${year}). ${title}.${doi}`;

        navigator.clipboard.writeText(citation).then(() => {
            showStatus('Citation copied to clipboard!');
        }).catch(() => {
            showStatus('Failed to copy citation', false);
        });
    }

    // Copy DOI function
    function copyDoi() {
        if (!currentModalPaper || !currentModalPaper.doi) {
            showStatus('No DOI available', false);
            return;
        }
        navigator.clipboard.writeText(currentModalPaper.doi).then(() => {
            showStatus('DOI copied to clipboard!');
        }).catch(() => {
            showStatus('Failed to copy DOI', false);
        });
    }

    // --- API Functions ---
    async function searchSemanticScholar() {
        const queries = [
            'generative AI agriculture', 'generative AI agrifood',
            'foundation model agriculture', 'large language model agriculture',
            'large language model agrifood', 'diffusion model agriculture',
            'generative adversarial network agriculture', 'synthetic data agriculture',
            'synthetic data crop', 'vision-language model agriculture',
            'multimodal model agriculture', 'food industry generative AI',
            'food processing generative AI', 'food safety generative AI',
            'precision agriculture generative model',
        ];

        const papers = [];
        const fields = 'title,authors,year,abstract,url,publicationDate,externalIds';

        try {
            for (const query of queries) {
                const encodedQuery = encodeURIComponent(query);
                const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&fields=${fields}&limit=50&year=2023-`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetchWithCorsFallback(url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) continue;

                const data = await response.json();
                if (data && data.data) {
                    const results = data.data.map(paper => {
                        const processed = {
                            title: truncateText(paper.title || '', 300),
                            authors: Array.isArray(paper.authors) ? paper.authors.slice(0, 10).map(a => truncateText(a.name || '', 100)) : [],
                            date: paper.publicationDate || (paper.year ? `${paper.year}-01-01` : null),
                            abstract: truncateText(paper.abstract || '', 3000),
                            url: sanitizeUrl(paper.url),
                            doi: paper.externalIds && paper.externalIds.DOI ? sanitizeDoi(paper.externalIds.DOI) : null,
                            source: 'SemanticScholar'
                        };
                        processed.categories = categorizePaper(processed);
                        return processed;
                    }).filter(isRelevantPaper);
                    papers.push(...results);
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            return papers;
        } catch (error) {
            console.error("Error during Semantic Scholar fetch:", error);
            return papers;
        }
    }

    async function searchCrossref() {
        const queries = [
            'generative AI agriculture', 'generative AI agrifood',
            'foundation model agriculture', 'large language model agriculture',
            'diffusion model agriculture', 'generative adversarial network agriculture',
            'synthetic data agriculture', 'food industry generative AI',
            'food processing generative AI', 'food safety generative AI'
        ];

        const papers = [];
        const mailto = "bvalach@doctor.upv.es";
        const maxRetries = 3;
        const retryDelay = 2000;

        try {
            for (const query of queries) {
                let success = false;
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        const encodedQuery = encodeURIComponent(query);
                        const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=100&filter=from-pub-date:2023-01-01&mailto=${mailto}`;

                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 15000);
                        const response = await fetch(url, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!response.ok) throw new Error(`Status: ${response.status}`);

                        const data = await response.json();
                        if (data.status === 'ok' && data.message && data.message.items) {
                            const results = data.message.items.map(item => {
                                const authors = item.author ? item.author.map(a => `${a.given || ''} ${a.family || ''}`).filter(name => name.trim()) : [];
                                let publicationDate = null;
                                if (item.published && item.published['date-parts'] && item.published['date-parts'][0]) {
                                    const year = item.published['date-parts'][0][0];
                                    const month = item.published['date-parts'][0][1] || 1;
                                    const day = item.published['date-parts'][0][2] || 1;
                                    publicationDate = new Date(Date.UTC(year, month - 1, day));
                                }
                                const isValidDate = publicationDate && !isNaN(publicationDate);
                                const processed = {
                                    title: item.title && item.title.length > 0 ? item.title[0] : 'No title available',
                                    authors,
                                    date: isValidDate ? publicationDate.toISOString().split('T')[0] : null,
                                    abstract: item.abstract ? truncateText(item.abstract.replace(/<\/?[^>]+(>|$)/g, ""), 3000) : 'No abstract available.',
                                    url: sanitizeUrl(item.URL),
                                    doi: item.DOI ? sanitizeDoi(item.DOI) : null,
                                    source: 'Crossref'
                                };
                                processed.categories = categorizePaper(processed);
                                return processed;
                            }).filter(p => p.date).filter(isRelevantPaper);
                            papers.push(...results);
                        }
                        success = true;
                        break;
                    } catch (error) {
                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                        }
                    }
                }
                if (success) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            return papers;
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

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetchWithCorsFallback(url, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
                throw new Error('Invalid XML response');
            }

            const entries = xmlDoc.getElementsByTagName("entry");
            const papers = [];
            const maxEntries = Math.min(entries.length, 100);

            for (let i = 0; i < maxEntries; i++) {
                const entry = entries[i];
                try {
                    const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || '';
                    const abstract = entry.getElementsByTagName("summary")[0]?.textContent?.trim() || '';
                    const authors = Array.from(entry.getElementsByTagName("author"))
                        .slice(0, 10)
                        .map(a => a.getElementsByTagName("name")[0]?.textContent?.trim() || '')
                        .filter(name => name);
                    const date = entry.getElementsByTagName("published")[0]?.textContent?.trim() || null;
                    const entryUrl = entry.getElementsByTagName("id")[0]?.textContent?.trim() || '';

                    const processed = {
                        title: truncateText(title, 300),
                        authors,
                        date,
                        abstract: truncateText(abstract, 3000),
                        url: sanitizeUrl(entryUrl),
                        doi: null,
                        source: 'arXiv'
                    };
                    processed.categories = categorizePaper(processed);
                    if (isRelevantPaper(processed)) papers.push(processed);
                } catch (e) {
                    continue;
                }
            }
            return papers;
        } catch (error) {
            console.error("Error fetching from arXiv:", error);
            return [];
        }
    }

    async function enrichMissingAbstracts(papers) {
        const needEnrichment = papers.filter(p =>
            (!p.abstract || p.abstract === '' || p.abstract === 'No abstract available.') && p.doi
        );
        if (needEnrichment.length === 0) return;

        const batchSize = 200;
        for (let i = 0; i < needEnrichment.length; i += batchSize) {
            const batch = needEnrichment.slice(i, i + batchSize);
            const ids = batch.map(p => `DOI:${p.doi}`);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const response = await fetch('https://api.semanticscholar.org/graph/v1/paper/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids, fields: 'abstract' }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) continue;
                const results = await response.json();
                results.forEach((result, index) => {
                    if (result && result.abstract) {
                        batch[index].abstract = truncateText(result.abstract, 3000);
                    }
                });
                if (i + batchSize < needEnrichment.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.warn('Abstract enrichment batch error:', error.message);
            }
        }
    }

    // --- Main Load ---
    async function loadAllPapers(isBackgroundRefresh = false) {
        if (!isBackgroundRefresh) showLoadingState();

        // Show spinning refresh icon
        if (refreshBtn) refreshBtn.classList.add('spinning');

        try {
            const [scholarPapers, arxivPapers, crossrefPapers] = await Promise.all([
                searchSemanticScholar(),
                searchArxiv(),
                searchCrossref()
            ]);

            allPapers = [...scholarPapers, ...arxivPapers, ...crossrefPapers];

            if (allPapers.length === 0) {
                showErrorState('No papers could be loaded from the APIs. Please check your internet connection and try again.');
                return;
            }

            // Deduplicate
            const paperMap = new Map();
            allPapers.forEach(p => {
                const key = p.title.toLowerCase().trim();
                const existing = paperMap.get(key);
                if (!existing) {
                    paperMap.set(key, p);
                } else {
                    const existingHasAbstract = existing.abstract && existing.abstract !== '' && existing.abstract !== 'No abstract available.';
                    const newHasAbstract = p.abstract && p.abstract !== '' && p.abstract !== 'No abstract available.';
                    if (!existingHasAbstract && newHasAbstract) existing.abstract = p.abstract;
                    if (!existing.doi && p.doi) existing.doi = p.doi;
                    if ((!existing.url || existing.url === '#') && p.url && p.url !== '#') existing.url = p.url;
                    if (p.categories) {
                        const cats = new Set([...(existing.categories || []), ...p.categories]);
                        existing.categories = Array.from(cats);
                    }
                }
            });
            const uniquePapers = Array.from(paperMap.values());

            await enrichMissingAbstracts(uniquePapers);

            // Filter by date (2023+)
            const filterDate = new Date('2023-01-01');
            const filteredPapers = uniquePapers.filter(paper => {
                if (!paper.date || isNaN(new Date(paper.date))) return false;
                return new Date(paper.date) >= filterDate;
            });

            filteredPapers.sort((a, b) => new Date(b.date) - new Date(a.date));
            allPapers = filteredPapers;

            initializeDateRange(allPapers);
            initializeSourceFilters();
            initializeCategoryFilters();
            updateStats();

            if (allPapers.length === 0) {
                showGridMessage('No papers found matching the criteria (published after January 2023).');
                return;
            }
            applyFilters();

            saveToLocal();
            if (isBackgroundRefresh) {
                showStatus(`Update complete. ${allPapers.length} papers.`);
            }
        } catch (error) {
            console.error('Error loading papers:', error);
            if (!isBackgroundRefresh) {
                showErrorState('An unexpected error occurred while loading papers. Please try again.');
            } else {
                showStatus('Failed to update papers.', false);
            }
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        }
    }

    // --- Event Listeners ---

    // Modal
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) closeModal();
    });

    // Modal actions
    if (modalCiteBtn) modalCiteBtn.addEventListener('click', citePaper);
    if (modalCopyDoiBtn) modalCopyDoiBtn.addEventListener('click', copyDoi);

    // Search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.trim();
            applyFilters();
        });
    }

    // Filter bar
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyBarFilters);
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetAllFilters);

    // Source/category chip actions
    if (selectAllSourcesBtn) selectAllSourcesBtn.addEventListener('click', selectAllSources);
    if (clearAllSourcesBtn) clearAllSourcesBtn.addEventListener('click', clearAllSources);
    if (selectAllCategoriesBtn) selectAllCategoriesBtn.addEventListener('click', selectAllCategories);
    if (clearAllCategoriesBtn) clearAllCategoriesBtn.addEventListener('click', clearAllCategories);

    // Export dropdown
    if (exportToggleBtn) exportToggleBtn.addEventListener('click', toggleExportMenu);
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportToJson);
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
    if (exportMarkdownBtn) exportMarkdownBtn.addEventListener('click', exportToMarkdown);
    if (exportRisBtn) exportRisBtn.addEventListener('click', exportToRis);

    // Save/Load
    if (saveLocalBtn) saveLocalBtn.addEventListener('click', saveToLocalExplicit);
    if (loadLocalBtn) loadLocalBtn.addEventListener('click', loadFromLocal);

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAllPapers(false);
        });
    }

    // Mobile export button opens export menu
    if (mobileExportBtn) {
        mobileExportBtn.addEventListener('click', () => {
            // Quick mobile export: download JSON
            exportToJson();
        });
    }

    // --- Initialize ---
    function initialize() {
        const cachedData = loadFromLocal();

        if (cachedData) {
            const cacheAge = new Date() - new Date(cachedData.timestamp);
            const twelveHours = 12 * 60 * 60 * 1000;
            if (cacheAge > twelveHours) {
                showStatus('Cache is old. Checking for updates...');
                loadAllPapers(true);
            }
        } else {
            loadAllPapers(false);
        }
    }

    initialize();
});

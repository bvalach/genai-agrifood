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
        const url = `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodeURIComponent(query)}&fields=${fields}&limit=50`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Semantic Scholar API error: ${response.status}`);
            }
            const data = await response.json();
            const papers = data.data || data || [];
            return papers.map(paper => ({
                title: paper.title,
                authors: paper.authors ? paper.authors.map(a => a.name) : ['Unknown'],
                date: paper.publicationDate || paper.year || 'N/A',
                abstract: paper.abstract || 'No abstract available.',
                url: paper.url,
                doi: paper.externalIds && paper.externalIds.DOI ? paper.externalIds.DOI : null,
                source: 'Semantic Scholar'
            }));
        } catch (error) {
            console.error("Could not fetch papers from Semantic Scholar:", error);
            return [];
        }
    }

    async function searchArxiv() {
        const query = `(all:agri* AND all:"language model") OR (all:agri* AND all:"generative adversarial network") OR (all:agri* AND all:gan) OR (all:agri* AND all:vae)`;
        const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=50`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`ArXiv API error: ${response.status}`);
            }
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const entries = xmlDoc.getElementsByTagName("entry");
            const papers = [];
            
            for (let entry of entries) {
                const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() || 'Untitled';
                const abstract = entry.getElementsByTagName("summary")[0]?.textContent?.trim() || 'No abstract available.';
                const authors = Array.from(entry.getElementsByTagName("author")).map(a => 
                    a.getElementsByTagName("name")[0]?.textContent || 'Unknown'
                );
                const date = entry.getElementsByTagName("published")[0]?.textContent || 'N/A';
                const url = entry.getElementsByTagName("id")[0]?.textContent || '';
                const arxivId = url.split('/abs/')[1];
                const doi = arxivId ? `10.48550/arXiv.${arxivId}` : null;
                
                papers.push({ 
                    title, 
                    authors: authors.length > 0 ? authors : ['Unknown'], 
                    date, 
                    abstract, 
                    url, 
                    doi,
                    source: 'arXiv'
                });
            }
            return papers;
        } catch (error) {
            console.error("Could not fetch papers from arXiv:", error);
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

            const allPapers = [...scholarPapers, ...arxivPapers];
            
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
                if (!paper.date || paper.date === 'N/A') {
                    return false;
                }
                const paperDate = new Date(paper.date);
                return !isNaN(paperDate) && paperDate >= filterDate;
            });
            
            // Ordenar por fecha (más recientes primero)
            filteredPapers.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA;
            });

            paperGrid.innerHTML = '';
            
            if (filteredPapers.length === 0) {
                paperGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                        <p style="font-size: 1.2rem; color: #848484; margin: 0;">No papers found matching the criteria</p>
                        <p style="font-size: 1rem; color: #848484; margin: 0.5rem 0 0 0; opacity: 0.8;">Looking for papers published after January 2025</p>
                    </div>
                `;
                return;
            }

            // Crear las tarjetas con animación escalonada
            filteredPapers.forEach((paper, index) => {
                setTimeout(() => createPaperCard(paper), index * 100);
            });

        } catch (error) {
            console.error('Error loading papers:', error);
            showErrorState('An unexpected error occurred while loading papers. Please try again.');
        }
    }

    function createPaperCard(paper) {
        const card = document.createElement('div');
        card.className = 'paper-card';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A';
        const date = paper.date && paper.date !== 'N/A' ? new Date(paper.date).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'Date not available';
        const doiText = paper.doi ? `DOI: ${paper.doi}` : 'DOI: Not available';
        const sourceTag = paper.source ? `<span style="background: #ECF6CE; color: #2c2c2c; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">${paper.source}</span>` : '';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <h3 style="margin: 0; flex: 1;">${paper.title}</h3>
                ${sourceTag}
            </div>
            <p style="margin: 0.5rem 0; font-weight: 500;">${authors}</p>
            <p style="margin: 0.5rem 0; color: #848484;">${date}</p>
            <p class="paper-doi">${doiText}</p>
        `;
        
        card.addEventListener('click', () => openModal({ ...paper, authors, date }));
        
        // Añadir efecto de aparición suave
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(-8px) scale(1)';
        });
        
        paperGrid.appendChild(card);
        
        // Animación de aparición
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 50);
    }

    function openModal(paper) {
        modalTitle.textContent = paper.title;
        modalAuthors.textContent = 'Authors: ' + paper.authors;
        modalDate.textContent = 'Published: ' + paper.date;

        if (paper.doi && paper.doi !== 'DOI: Not available') {
            const doiValue = paper.doi.replace('DOI: ', '');
            modalDoi.innerHTML = `DOI: <a href="https://doi.org/${doiValue}" target="_blank" style="color: #F4FA58; text-decoration: none;">${doiValue}</a>`;
        } else {
            modalDoi.textContent = 'DOI: Not available';
        }

        modalAbstract.textContent = paper.abstract || 'No abstract available.';
        modalLink.href = paper.url || '#';
        modalLink.textContent = paper.url ? 'Read Full Paper' : 'Link not available';
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevenir scroll del body
        
        // Focus en el modal para accesibilidad
        modal.focus();
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

    // Inicializar la carga de papers
    loadAllPapers();
});


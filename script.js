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
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const papers = data.data || data || [];
            return papers.map(paper => ({
                title: paper.title,
                authors: paper.authors.map(a => a.name),
                date: paper.publicationDate || paper.year || 'N/A',
                abstract: paper.abstract,
                url: paper.url,
                doi: paper.externalIds && paper.externalIds.DOI ? paper.externalIds.DOI : null
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const entries = xmlDoc.getElementsByTagName("entry");
            const papers = [];
            for (let entry of entries) {
                const title = entry.getElementsByTagName("title")[0].textContent.trim();
                const abstract = entry.getElementsByTagName("summary")[0].textContent.trim();
                const authors = Array.from(entry.getElementsByTagName("author")).map(a => a.getElementsByTagName("name")[0].textContent);
                const date = entry.getElementsByTagName("published")[0].textContent;
                const url = entry.getElementsByTagName("id")[0].textContent;
                const arxivId = url.split('/abs/')[1];
                const doi = arxivId ? `10.48550/arXiv.${arxivId}` : null;
                papers.push({ title, authors, date, abstract, url, doi });
            }
            return papers;
        } catch (error) {
            console.error("Could not fetch papers from arXiv:", error);
            return [];
        }
    }


    async function loadAllPapers() {
        paperGrid.innerHTML = '<p>Loading papers...</p>';
        const [scholarPapers, arxivPapers] = await Promise.all([
            searchSemanticScholar(),
            searchArxiv()
        ]);

        const allPapers = [...scholarPapers, ...arxivPapers];
        const uniquePapers = Array.from(new Map(allPapers.map(p => [p.title.toLowerCase(), p])).values());

        const filterDate = new Date('2025-01-01');
        const filteredPapers = uniquePapers.filter(paper => {
            if (!paper.date || isNaN(new Date(paper.date))) {
                return false;
            }
            const paperDate = new Date(paper.date);
            return paperDate >= filterDate;
        });
        
        filteredPapers.sort((a, b) => new Date(b.date) - new Date(a.date));

        paperGrid.innerHTML = '';
        if (filteredPapers.length === 0) {
            paperGrid.innerHTML = '<p>No papers found matching the criteria (published after January 2025).</p>';
            return;
        }
        filteredPapers.forEach(createPaperCard);
    }


    function createPaperCard(paper) {
        const card = document.createElement('div');
        card.className = 'paper-card';
        
        const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : 'N/A';
        const date = paper.date ? new Date(paper.date).toLocaleDateString() : 'N/A';
        const doiText = paper.doi ? `DOI: ${paper.doi}` : 'DOI: N/A';

        card.innerHTML = `
            <h3>${paper.title}</h3>
            <p>${authors}</p>
            <p>${date}</p>
            <p class="paper-doi">${doiText}</p>
        `;
        card.addEventListener('click', () => openModal({ ...paper, authors, date }));
        paperGrid.appendChild(card);
    }

    function openModal(paper) {
        modalTitle.textContent = paper.title;
        modalAuthors.textContent = 'Authors: ' + paper.authors;
        modalDate.textContent = 'Date: ' + paper.date;

        if (paper.doi) {
            modalDoi.innerHTML = `DOI: <a href="https://doi.org/${paper.doi}" target="_blank">${paper.doi}</a>`;
        } else {
            modalDoi.textContent = 'DOI: N/A';
        }

        modalAbstract.textContent = paper.abstract || 'No abstract available.';
        modalLink.href = paper.url;
        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeModal();
        }
    });

    loadAllPapers();
}); 
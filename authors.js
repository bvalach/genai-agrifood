document.addEventListener('DOMContentLoaded', () => {
    const authorList = document.getElementById('author-list');
    const searchInput = document.getElementById('author-search');
    const sortSelect = document.getElementById('sort-authors');
    const statAuthors = document.getElementById('stat-authors');
    const statTotal = document.getElementById('stat-total');
    const showingCount = document.getElementById('showing-count');

    let allAuthors = []; // { name, papers: [{title, date, url}], count, lastDate }
    let filteredAuthors = [];

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function loadData() {
        try {
            const savedData = localStorage.getItem('foodAI-living-review');
            if (!savedData) return null;
            return JSON.parse(savedData);
        } catch {
            return null;
        }
    }

    function buildAuthorIndex(papers) {
        const authorMap = new Map();

        papers.forEach(paper => {
            if (!Array.isArray(paper.authors)) return;
            paper.authors.forEach(authorName => {
                if (!authorName || authorName.trim() === '') return;
                const key = authorName.trim().toLowerCase();
                if (!authorMap.has(key)) {
                    authorMap.set(key, {
                        name: authorName.trim(),
                        papers: [],
                        count: 0,
                        lastDate: null
                    });
                }
                const entry = authorMap.get(key);
                entry.papers.push({
                    title: paper.title || 'Untitled',
                    date: paper.date || null,
                    url: paper.url || '#',
                    source: paper.source || ''
                });
                entry.count++;
                if (paper.date) {
                    const d = new Date(paper.date);
                    if (!entry.lastDate || d > entry.lastDate) {
                        entry.lastDate = d;
                    }
                }
            });
        });

        return Array.from(authorMap.values());
    }

    function sortAuthors(authors, criteria) {
        const sorted = [...authors];
        switch (criteria) {
            case 'papers':
                sorted.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
                break;
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'recent':
                sorted.sort((a, b) => {
                    if (!a.lastDate && !b.lastDate) return 0;
                    if (!a.lastDate) return 1;
                    if (!b.lastDate) return -1;
                    return b.lastDate - a.lastDate;
                });
                break;
        }
        return sorted;
    }

    function renderAuthors(authors) {
        authorList.innerHTML = '';

        if (authors.length === 0) {
            authorList.innerHTML = `
                <div class="view-empty">
                    <span class="material-symbols-outlined">person_off</span>
                    <p>No authors found.</p>
                </div>`;
            return;
        }

        authors.forEach((author, index) => {
            const wrapper = document.createElement('div');

            // Author row
            const row = document.createElement('div');
            row.className = 'author-row';

            const rank = document.createElement('span');
            rank.className = `author-rank${index < 3 ? ' top-3' : ''}`;
            rank.textContent = `#${index + 1}`;

            const info = document.createElement('div');
            info.className = 'author-info';

            const name = document.createElement('div');
            name.className = 'author-name';
            name.textContent = author.name;

            const meta = document.createElement('div');
            meta.className = 'author-meta';
            const latest = author.lastDate ? `Latest: ${author.lastDate.toLocaleDateString()}` : '';
            meta.textContent = latest;

            info.appendChild(name);
            info.appendChild(meta);

            const count = document.createElement('div');
            count.className = 'author-count';
            count.innerHTML = `<span class="material-symbols-outlined">article</span> ${author.count}`;

            row.appendChild(rank);
            row.appendChild(info);
            row.appendChild(count);

            // Papers list (hidden by default)
            const papers = document.createElement('div');
            papers.className = 'author-papers';

            author.papers
                .sort((a, b) => {
                    if (!a.date && !b.date) return 0;
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    return new Date(b.date) - new Date(a.date);
                })
                .forEach(paper => {
                    const link = document.createElement('a');
                    link.className = 'author-paper-link';
                    link.href = paper.url && paper.url !== '#' ? paper.url : '#';
                    if (paper.url && paper.url !== '#') {
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    }

                    const icon = document.createElement('span');
                    icon.className = 'material-symbols-outlined';
                    icon.textContent = 'description';

                    const title = document.createElement('span');
                    title.textContent = paper.title;

                    const date = document.createElement('span');
                    date.className = 'author-paper-date';
                    date.textContent = paper.date ? new Date(paper.date).toLocaleDateString() : '';

                    link.appendChild(icon);
                    link.appendChild(title);
                    link.appendChild(date);
                    papers.appendChild(link);
                });

            // Toggle on click
            row.addEventListener('click', () => {
                papers.classList.toggle('open');
            });

            wrapper.appendChild(row);
            wrapper.appendChild(papers);
            authorList.appendChild(wrapper);
        });

        if (showingCount) {
            showingCount.textContent = `Showing ${authors.length} of ${allAuthors.length} authors`;
        }
    }

    function applySearch() {
        const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
        if (!term) {
            filteredAuthors = [...allAuthors];
        } else {
            filteredAuthors = allAuthors.filter(a => a.name.toLowerCase().includes(term));
        }
        const sorted = sortAuthors(filteredAuthors, sortSelect ? sortSelect.value : 'papers');
        renderAuthors(sorted);
    }

    // Event listeners
    if (searchInput) searchInput.addEventListener('input', applySearch);
    if (sortSelect) sortSelect.addEventListener('change', applySearch);

    // Initialize
    const data = loadData();
    if (data && data.papers && data.papers.length > 0) {
        allAuthors = buildAuthorIndex(data.papers);
        filteredAuthors = [...allAuthors];

        if (statAuthors) statAuthors.textContent = allAuthors.length;
        if (statTotal) statTotal.textContent = data.papers.length;

        const sorted = sortAuthors(allAuthors, 'papers');
        renderAuthors(sorted);
    } else {
        authorList.innerHTML = `
            <div class="view-empty">
                <span class="material-symbols-outlined">database</span>
                <p>No data yet. Load the library first to see authors.</p>
                <a href="index.html"><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span> Go to Library</a>
            </div>`;
    }
});

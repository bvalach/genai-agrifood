document.addEventListener('DOMContentLoaded', () => {
    const topicsGrid = document.getElementById('topics-grid');
    const statTopics = document.getElementById('stat-topics');
    const statTotal = document.getElementById('stat-total');

    function loadData() {
        try {
            const savedData = localStorage.getItem('foodAI-living-review');
            if (!savedData) return null;
            return JSON.parse(savedData);
        } catch {
            return null;
        }
    }

    function buildTopicIndex(papers) {
        const topicMap = new Map();

        papers.forEach(paper => {
            if (!Array.isArray(paper.categories)) return;
            paper.categories.forEach(cat => {
                if (!cat) return;
                if (!topicMap.has(cat)) {
                    topicMap.set(cat, {
                        name: cat,
                        papers: [],
                        count: 0
                    });
                }
                const entry = topicMap.get(cat);
                entry.papers.push({
                    title: paper.title || 'Untitled',
                    authors: Array.isArray(paper.authors) ? paper.authors.join(', ') : '',
                    date: paper.date || null,
                    url: paper.url || '#',
                    source: paper.source || ''
                });
                entry.count++;
            });
        });

        return Array.from(topicMap.values()).sort((a, b) => b.count - a.count);
    }

    function renderTopics(topics, totalPapers) {
        topicsGrid.innerHTML = '';

        if (topics.length === 0) {
            topicsGrid.innerHTML = `
                <div class="view-empty">
                    <span class="material-symbols-outlined">category</span>
                    <p>No topics found.</p>
                </div>`;
            return;
        }

        const maxCount = Math.max(...topics.map(t => t.count));

        topics.forEach(topic => {
            const card = document.createElement('div');
            card.className = 'topic-card';

            // Header
            const header = document.createElement('div');
            header.className = 'topic-header';

            const nameEl = document.createElement('span');
            nameEl.className = 'topic-name';
            nameEl.textContent = topic.name;

            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.alignItems = 'center';
            right.style.gap = '.5rem';

            const count = document.createElement('div');
            count.className = 'topic-count';
            count.innerHTML = `<span class="material-symbols-outlined">article</span> ${topic.count}`;

            const chevron = document.createElement('span');
            chevron.className = 'material-symbols-outlined topic-chevron';
            chevron.textContent = 'expand_more';

            right.appendChild(count);
            right.appendChild(chevron);

            header.appendChild(nameEl);
            header.appendChild(right);

            // Progress bar
            const bar = document.createElement('div');
            bar.className = 'topic-bar';
            const fill = document.createElement('div');
            fill.className = 'topic-bar-fill';
            fill.style.width = `${(topic.count / maxCount) * 100}%`;
            bar.appendChild(fill);

            // Papers list
            const papers = document.createElement('div');
            papers.className = 'topic-papers';

            topic.papers
                .sort((a, b) => {
                    if (!a.date && !b.date) return 0;
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    return new Date(b.date) - new Date(a.date);
                })
                .forEach(paper => {
                    const item = document.createElement('div');
                    item.className = 'topic-paper-item';

                    const icon = document.createElement('span');
                    icon.className = 'material-symbols-outlined';
                    icon.textContent = 'description';

                    const content = document.createElement('div');
                    content.style.flex = '1';

                    const title = document.createElement('div');
                    title.className = 'topic-paper-title';
                    if (paper.url && paper.url !== '#') {
                        const link = document.createElement('a');
                        link.href = paper.url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = paper.title;
                        link.style.color = 'inherit';
                        link.style.textDecoration = 'none';
                        link.addEventListener('mouseenter', () => { link.style.color = 'var(--primary)'; });
                        link.addEventListener('mouseleave', () => { link.style.color = 'inherit'; });
                        title.appendChild(link);
                    } else {
                        title.textContent = paper.title;
                    }

                    const authors = document.createElement('div');
                    authors.className = 'topic-paper-authors';
                    const authorsText = paper.authors || '';
                    const dateText = paper.date ? new Date(paper.date).toLocaleDateString() : '';
                    authors.textContent = [authorsText, dateText].filter(Boolean).join(' \u00B7 ');

                    content.appendChild(title);
                    content.appendChild(authors);

                    item.appendChild(icon);
                    item.appendChild(content);
                    papers.appendChild(item);
                });

            // Toggle
            card.addEventListener('click', (e) => {
                // Don't toggle if clicking a link
                if (e.target.tagName === 'A') return;
                card.classList.toggle('open');
            });

            card.appendChild(header);
            card.appendChild(bar);
            card.appendChild(papers);
            topicsGrid.appendChild(card);
        });
    }

    // Initialize
    const data = loadData();
    if (data && data.papers && data.papers.length > 0) {
        const topics = buildTopicIndex(data.papers);

        if (statTopics) statTopics.textContent = topics.length;
        if (statTotal) statTotal.textContent = data.papers.length;

        renderTopics(topics, data.papers.length);
    } else {
        topicsGrid.innerHTML = `
            <div class="view-empty">
                <span class="material-symbols-outlined">database</span>
                <p>No data yet. Load the library first to see topics.</p>
                <a href="index.html"><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span> Go to Library</a>
            </div>`;
    }
});

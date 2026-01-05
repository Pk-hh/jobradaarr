const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRE3ZsrgLEanTuBQy_Gx_ni0d2VHnjW_WdErPgVarPH2iDXh8kLRFdvuup71A7IAsxPxV1Al7TBYmh8/pub?output=csv';
let allJobs = [];
let activeFilters = { search: '', types: new Set(), sectors: new Set(), location: 'all' };
let mouseX = 0, mouseY = 0;

const els = {
    grid: document.getElementById('jobs-grid'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    countBadge: document.getElementById('count-badge'),
    typeContainer: document.getElementById('type-filters-container'),
    sectorContainer: document.getElementById('sector-filters-container'),
    locSelect: document.getElementById('location-select'),
    modal: document.getElementById('job-modal'),
    backdrop: document.getElementById('modal-backdrop'),
    modalContent: document.getElementById('modal-content'),
    applyBtn: document.getElementById('apply-link-btn'),
    categoryContainer: document.getElementById('category-container'),
    emptyState: document.getElementById('empty-state'),
    toastContainer: document.getElementById('toast-container')
};

window.addEventListener('DOMContentLoaded', () => {
    try { initThreeJS(); } catch (e) { console.error('ThreeJS Error:', e); }
    try { renderSkeletons(); } catch (e) { console.error('Skeleton Error:', e); }

    fetchData();
    setupEventListeners();
    renderCategories();

    try { initCursor(); } catch (e) { console.warn('Cursor Init Error:', e); }
    try { initScrollReveal(); } catch (e) { console.warn('ScrollReveal Error:', e); }

    // Logo Animation Logic
    const loaderStatus = document.getElementById('loader-status');
    const overlay = document.getElementById('landing-overlay');

    // Fail-safe: Force remove overlay after 4 seconds max
    setTimeout(() => {
        if (overlay && overlay.parentElement) {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            setTimeout(() => overlay.remove(), 500);
        }
    }, 4000);

    if (loaderStatus && overlay) {
        const checkSteps = [
            'System Check...',
            'Loading Assets...',
            'Ready'
        ];

        let step = 0;

        const updateStatus = () => {
            if (step < checkSteps.length) {
                loaderStatus.textContent = checkSteps[step];
                step++;
                // Faster delay: 300-600ms per step
                setTimeout(updateStatus, Math.random() * 300 + 300);
            } else {
                // Done
                setTimeout(() => {
                    overlay.classList.add('loaded');
                    setTimeout(() => overlay.remove(), 800);
                }, 200);
            }
        };

        setTimeout(updateStatus, 500);
    } else {
        if (overlay) overlay.style.display = 'none';
    }

    // Handle Android Back Button
    if (window.Capacitor) {
        // Capacitor v3+ Plugins accessed via global or import.
        const App = window.Capacitor.Plugins.App;
        if (App) {
            App.addListener('backButton', ({ canGoBack }) => {
                const isModalOpen = !els.modal.classList.contains('translate-y-full');
                const isFilterOpen = !document.getElementById('mobile-filter-modal').classList.contains('hidden');
                const isMenuOpen = !document.getElementById('mobile-menu').classList.contains('translate-x-full');

                if (isModalOpen) {
                    closeModal();
                } else if (isFilterOpen) {
                    document.getElementById('mobile-filter-modal').classList.add('hidden');
                } else if (isMenuOpen) {
                    document.getElementById('mobile-menu').classList.add('translate-x-full');
                } else {
                    App.exitApp();
                }
            });
        }
    }
});

function initCursor() {
    if (matchMedia('(pointer: coarse)').matches) return;

    const dot = document.getElementById('cursor-dot');
    const outline = document.getElementById('cursor-outline');

    let mouseX = 0, mouseY = 0;
    let outlineX = 0, outlineY = 0;

    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    });

    function animateCursor() {
        outlineX += (mouseX - outlineX) * 0.15;
        outlineY += (mouseY - outlineY) * 0.15;
        outline.style.transform = `translate(${outlineX}px, ${outlineY}px) translate(-50%, -50%)`;
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    const addHover = () => document.body.classList.add('hovering');
    const removeHover = () => document.body.classList.remove('hovering');

    document.body.addEventListener('mouseover', e => {
        if (e.target.closest('a, button, input, select, .job-card, [role="button"]')) {
            addHover();
        }
    });
    document.body.addEventListener('mouseout', e => {
        if (e.target.closest('a, button, input, select, .job-card, [role="button"]')) {
            removeHover();
        }
    });
}

function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    const elementsToReveal = [
        ...document.querySelectorAll('section'),
        document.querySelector('.relative.group'),
        document.querySelector('footer')
    ];

    elementsToReveal.forEach(el => {
        if (el) {
            el.classList.add('reveal-blur');
            observer.observe(el);
        }
    });

    window.observeReveal = (el) => {
        el.classList.add('reveal-blur');
        observer.observe(el);
    };
}

function initThreeJS() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const count = 80;
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 35;
        positions[i + 1] = (Math.random() - 0.5) * 20;
        positions[i + 2] = (Math.random() - 0.5) * 15;
        velocities.push({
            x: (Math.random() - 0.5) * 0.01,
            y: (Math.random() - 0.5) * 0.01
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // Orange Tint for particles
    const material = new THREE.PointsMaterial({ size: 0.15, color: 0xf97316, transparent: true, opacity: 0.6 });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.08 });
    const linesGeometry = new THREE.BufferGeometry();
    const lines = new THREE.LineSegments(linesGeometry, lineMaterial);
    scene.add(lines);

    camera.position.z = 5;

    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        time += 0.005;

        camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.02;
        camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.02;
        camera.lookAt(scene.position);

        const pos = particles.geometry.attributes.position.array;
        const linePos = [];

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            pos[i3] += velocities[i].x;
            pos[i3 + 1] += velocities[i].y;
            pos[i3 + 1] += Math.sin(time + pos[i3] * 0.5) * 0.002;

            if (pos[i3] < -20) pos[i3] = 20;
            if (pos[i3] > 20) pos[i3] = -20;
            if (pos[i3 + 1] < -12) pos[i3 + 1] = 12;
            if (pos[i3 + 1] > 12) pos[i3 + 1] = -12;

            for (let j = i + 1; j < count; j++) {
                const j3 = j * 3;
                const dx = pos[i3] - pos[j3];
                const dy = pos[i3 + 1] - pos[j3 + 1];
                const dz = pos[i3 + 2] - pos[j3 + 2];
                const dist = dx * dx + dy * dy + dz * dz;

                if (dist < 20) {
                    linePos.push(pos[i3], pos[i3 + 1], pos[i3 + 2], pos[j3], pos[j3 + 1], pos[j3 + 2]);
                }
            }
        }

        particles.geometry.attributes.position.needsUpdate = true;
        lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
        renderer.render(scene, camera);
    }
    animate();
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}


async function fetchData() {
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(SHEET_URL)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const csvText = await response.text();
        allJobs = parseCSV(csvText);

        // Extract News
        const newsItems = allJobs
            .map(job => job.news)
            .filter(news => news && news.trim().length > 0);

        // Urgent deadlines (next 48 hours)
        const now = new Date();
        const urgentJobs = allJobs.filter(j => {
            if (!j.deadline) return false;
            const hourDiff = (j.deadline - now) / (1000 * 60 * 60);
            return hourDiff > 0 && hourDiff <= 48;
        });

        const urgentNews = urgentJobs.map(j => `⚠️ Last Chance: ${j.title} closes on ${formatDate(j.deadline)}!`);

        // Combine: Urgent first, then CSV news
        const finalNews = [...urgentNews, ...newsItems];

        if (finalNews.length > 0) {
            updateTicker(finalNews);
        }

        populateFilters(allJobs);
        filterJobs();
    } catch (err) {
        console.error(err);
        els.grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="inline-block p-4 bg-orange-50 rounded-full text-brand-500 mb-3"><i class="fas fa-wifi text-xl"></i></div>
                <p class="text-gray-500 font-medium">Unable to load opportunities.</p>
                <button onclick="location.reload()" class="mt-4 text-brand-600 font-bold text-sm hover:underline">Try Again</button>
            </div>`;
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const findCol = (patterns) => headers.findIndex(h => patterns.some(p => h.includes(p)));

    return lines.slice(1).map((line, idx) => {
        const values = [];
        let match;
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        while ((match = regex.exec(line)) !== null) {
            if (match.index === regex.lastIndex) regex.lastIndex++;
            if (match[1] !== undefined) {
                values.push(match[1].replace(/^"|"$/g, '').replace(/""/g, '"').trim());
            }
        }

        const entry = headers.reduce((obj, h, i) => {
            obj[h] = values[i] || '';
            return obj;
        }, {});

        const deadlineStr = entry.deadline || entry['apply by'] || entry.applyby || entry.expires || '';
        let deadline = null;
        if (deadlineStr) {
            deadline = new Date(deadlineStr);
            if (isNaN(deadline.getTime())) deadline = null;
        }

        return {
            id: idx,
            title: entry.title || 'Position',
            company: entry.company || 'Company',
            location: entry.location || 'Remote',
            type: entry.type || 'Full-time',
            salary: entry.salary || 'Not disclosed',
            tags: entry.tags ? entry.tags.split(';').map(t => t.trim()).filter(Boolean) : [],
            image: entry.imageurl,
            featured: entry.featured?.toLowerCase() === 'true',
            posted: entry.posteddate ? new Date(entry.posteddate) : new Date(),
            deadline: deadline,
            deadlineRaw: deadlineStr,
            applyLink: entry.applylink,
            desc: entry.description,
            eligibility: entry.eligibility,
            materials: entry.materials,
            notification: entry.notification,
            desc: entry.description,
            eligibility: entry.eligibility,
            materials: entry.materials,
            notification: entry.notification,
            docs: entry.documents,
            docs: entry.documents,
            news: entry.news || entry.updates, // Capture news column
            fee: entry.fee || entry.fees,
            sector: entry.sector || ''
        };
    }).filter(job => job.title);
}

function filterJobs() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const searchTerm = activeFilters.search.toLowerCase();

    let results = allJobs.filter(j => {
        const matchesSearch = !searchTerm ||
            j.title.toLowerCase().includes(searchTerm) ||
            j.company.toLowerCase().includes(searchTerm) ||
            j.sector.toLowerCase().includes(searchTerm) ||
            j.tags.some(t => t.toLowerCase().includes(searchTerm));

        const matchesType = activeFilters.types.size === 0 || activeFilters.types.has(j.type);
        const matchesSector = activeFilters.sectors.size === 0 || activeFilters.sectors.has(j.sector);
        const matchesLoc = activeFilters.location === 'all' || j.location === activeFilters.location;
        // Fix: Ensure deadline comparison covers the entire day
        let isNotExpired = true;
        if (j.deadline) {
            const deadlineDate = new Date(j.deadline);
            deadlineDate.setHours(23, 59, 59, 999); // End of the deadline day
            isNotExpired = deadlineDate >= now;
        }
        return matchesSearch && matchesType && matchesSector && matchesLoc && isNotExpired;
    });

    results.sort((a, b) => {
        // Strict "Latest on Top"
        return b.posted - a.posted;
    });

    renderJobs(results);
}


function renderJobs(jobs) {
    els.countBadge.textContent = `(${jobs.length})`;
    els.countBadge.classList.remove('opacity-0');

    if (jobs.length === 0) {
        els.grid.classList.add('hidden');
        els.emptyState.classList.remove('hidden');
        return;
    }
    els.emptyState.classList.add('hidden');
    els.grid.classList.remove('hidden');

    els.grid.innerHTML = jobs.map((job, i) => {
        let imgUrl;
        if (job.image) {
            if (job.image.includes('drive.google')) {
                imgUrl = `https://drive.google.com/uc?export=view&id=${job.image.match(/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]}`;
            } else if (job.image.startsWith('http')) {
                imgUrl = job.image;
            } else {
                imgUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=f3f4f6&color=6b7280&size=128&font-size=0.33`;
            }
        } else {
            imgUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=f3f4f6&color=6b7280&size=128&font-size=0.33`;
        }

        const isNew = (new Date() - job.posted) / (1000 * 60 * 60 * 24) < 7;
        const delay = Math.min(i * 50, 300);

        let deadlineBadge = '';
        if (job.deadline) {
            const daysLeft = Math.ceil((job.deadline - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 3 && daysLeft >= 0) {
                deadlineBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">Expires soon</span>`;
            } else {
                deadlineBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200">Apply by: ${formatDate(job.deadline)}</span>`;
            }
        }

        return `
        <div class="bg-white rounded-xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer animate-slide-up group" style="animation-delay: ${delay}ms" onclick="openModal(${job.id})">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center p-1">
                        <img src="${imgUrl}" class="w-full h-full object-contain rounded-md" alt="${job.company}" onerror="this.src='https://ui-avatars.com/api/?name=${job.company.charAt(0)}'">
                    </div>
                    <div>
                        <h3 class="font-bold text-base text-black leading-snug group-hover:text-brand-600 transition-colors">${job.title}</h3>
                        <div class="text-xs font-semibold text-gray-500 mt-0.5 flex items-center gap-2">
                            ${job.company} 
                            ${isNew ? '<span class="px-1.5 py-0.5 bg-brand-500 text-white text-[10px] uppercase font-bold rounded ml-2 animate-flash">New</span>' : ''}
                        </div>
                    </div>
                </div>
                ${deadlineBadge}
            </div>
            
            <div class="flex flex-wrap gap-2 mb-6">
                ${job.tags.slice(0, 3).map(tag => `<span class="px-2.5 py-1 rounded-md bg-gray-50 text-gray-600 text-[10px] font-bold uppercase tracking-wide">${tag}</span>`).join('')}
            </div>

            <div class="flex items-center justify-between pt-4 border-t border-gray-50 text-xs font-medium text-gray-500">
                <div class="flex gap-4">
                    <span class="flex items-center gap-1.5"><i class="fas fa-map-marker-alt text-gray-400"></i> ${job.location}</span>
                    <span class="flex items-center gap-1.5"><i class="fas fa-wallet text-gray-400"></i> ${job.salary}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}
function resetAllFilters() {
    activeFilters = { search: '', types: new Set(), sectors: new Set(), location: 'all' };
    els.searchInput.value = '';
    els.locSelect.value = 'all';
    els.clearSearch.classList.add('hidden');
    syncFilters();
    filterJobs();
    showToast('All filters cleared');
}

window.openModal = (id) => {
    const job = allJobs.find(j => j.id === id);
    if (!job) return;
    const format = (t) => t ? t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/;/g, '<br class="mb-1 block">') : '';

    let bannerUrl = null;
    if (job.image) {
        if (job.image.includes('drive.google')) {
            bannerUrl = `https://drive.google.com/uc?export=view&id=${job.image.match(/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]}`;
        } else if (job.image.startsWith('http')) {
            bannerUrl = job.image;
        }
    }

    els.modalContent.innerHTML = `
        ${bannerUrl ? `
        <div class="mb-8 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
            <img src="${bannerUrl}" class="w-full h-auto max-h-[250px] object-contain mx-auto" alt="${job.title}" onerror="this.parentElement.style.display='none'">
        </div>
        ` : ''}
        <div class="mb-8">
            <div class="flex gap-2 mb-3">
                <span class="bg-brand-50 text-brand-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">${job.type}</span>
                ${job.featured ? '<span class="bg-black text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">Featured</span>' : ''}
            </div>
            <h2 class="text-2xl md:text-3xl font-bold text-black mb-2">${job.title}</h2>
            <div class="text-lg text-gray-500 font-medium">${job.company}</div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-8">
            <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Salary</div>
                <div class="font-bold text-black">${job.salary}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Location</div>
                <div class="font-bold text-black">${job.location}</div>
            </div>
             <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Posted On</div>
                <div class="font-bold text-black">${job.posted ? formatDate(job.posted) : 'Recently'}</div>
            </div>
             <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Application Fee</div>
                <div class="font-bold text-black">${job.fee ? format(job.fee) : 'No Fee / Not Specified'}</div>
            </div>
             <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Apply By</div>
                <div class="font-bold text-black">${job.deadline ? formatDate(job.deadline) : (job.deadlineRaw || 'N/A')}</div>
            </div>
        </div>

        <div class="space-y-8">
            <div>
                <h3 class="text-base font-bold text-black mb-3">About the Role</h3>
                <div class="text-gray-600 leading-relaxed text-sm">${format(job.desc)}</div>
            </div>
            ${job.eligibility ? `<div>
                <h3 class="text-base font-bold text-black mb-3">Who can apply?</h3>
                <div class="bg-orange-50 p-5 rounded-xl text-gray-700 leading-relaxed text-sm border border-orange-100">${format(job.eligibility)}</div>
            </div>` : ''}
            ${job.materials ? `<div>
                <h3 class="text-base font-bold text-black mb-3">Study Materials</h3>
                <div class="flex flex-wrap gap-2">
                    ${job.materials.split(';').map(m => {
        const parts = m.split('|');
        const label = parts[0] || m;
        const url = parts[1] || '#';
        return `<a href="${url}" target="_blank" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700 transition-colors flex items-center gap-2"><i class="fas fa-file-alt"></i> ${label.trim()}</a>`;
    }).join('')}
                </div>
            </div>` : ''}
            ${job.notification ? `<div>
                <h3 class="text-base font-bold text-black mb-3">Official Notification</h3>
                <div class="flex flex-wrap gap-2">
                    ${job.notification.split(';').map(n => {
        const parts = n.split('|');
        let label = n;
        let url = '#';
        if (parts.length === 2) {
            label = parts[0];
            url = parts[1];
        } else if (n.startsWith('http')) {
            label = 'View Notification';
            url = n;
        }
        return `<a href="${url}" target="_blank" class="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"><i class="fas fa-file-alt"></i> ${label.trim()}</a>`;
    }).join('')}
                </div>
            </div>` : ''}
            ${job.docs ? `<div>
                 <h3 class="text-lg font-bold text-black mb-3">Required Documents</h3>
                <div class="flex flex-wrap gap-2">
                    ${job.docs.split(';').map(d => `<span class="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">${d.trim()}</span>`).join('')}
                </div>
            </div>` : ''}
        </div>
    `;
    els.applyBtn.href = job.applyLink || '#';
    document.getElementById('share-btn').onclick = () => shareJob(job);
    els.backdrop.classList.remove('hidden');
    els.modal.classList.remove('translate-y-full', 'md:translate-x-full');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => els.backdrop.classList.remove('opacity-0'));
};

window.closeModal = () => {
    els.modal.classList.add('translate-y-full', 'md:translate-x-full');
    els.backdrop.classList.add('opacity-0');
    setTimeout(() => {
        els.backdrop.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
};

async function shareJob(job) {
    const data = { title: job.title, text: `Check out this ${job.title} role at ${job.company} `, url: window.location.href };
    if (navigator.share) {
        try { await navigator.share(data); } catch { }
    } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard');
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-check-circle text-brand-500"></i> ${msg}`;
    els.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function setupEventListeners() {
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    els.searchInput.addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        els.clearSearch.classList.toggle('hidden', !e.target.value);
        debounce(filterJobs, 300)();
    });
    els.clearSearch.onclick = () => {
        els.searchInput.value = '';
        activeFilters.search = '';
        els.clearSearch.classList.add('hidden');
        filterJobs();
    };
    els.locSelect.onchange = (e) => { activeFilters.location = e.target.value; filterJobs(); };
    document.getElementById('reset-filters').onclick = resetAllFilters;
    document.getElementById('clear-empty-state').onclick = resetAllFilters;
    document.getElementById('mobile-menu-btn').onclick = () => document.getElementById('mobile-menu').classList.remove('translate-x-full');
    document.getElementById('close-mobile-menu').onclick = () => document.getElementById('mobile-menu').classList.add('translate-x-full');
    document.querySelectorAll('.mobile-link').forEach(l => l.onclick = () => document.getElementById('mobile-menu').classList.add('translate-x-full'));
    const mModal = document.getElementById('mobile-filter-modal');
    document.getElementById('mobile-filter-toggle').onclick = () => {
        const content = document.getElementById('mobile-filter-content');
        content.innerHTML = '';
        const tClone = els.typeContainer.cloneNode(true);
        tClone.querySelectorAll('input').forEach(i => {
            i.checked = activeFilters.types.has(i.value);
            i.onchange = (e) => { toggleType(e.target.value); };
        });

        // Clone Sector Filters
        const sClone = els.sectorContainer.cloneNode(true);
        sClone.querySelectorAll('input').forEach(i => {
            i.checked = activeFilters.sectors.has(i.value);
            i.onchange = (e) => { toggleSector(e.target.value); };
        });

        const lClone = els.locSelect.cloneNode(true);
        lClone.value = activeFilters.location;
        lClone.onchange = (e) => { activeFilters.location = e.target.value; els.locSelect.value = e.target.value; };
        content.append(label('Job Type'), tClone, document.createElement('hr'), label('Sector'), sClone, document.createElement('hr'), label('Location'), lClone);
        mModal.classList.remove('hidden');
    };
    function label(txt) {
        const l = document.createElement('h4');
        l.className = 'font-bold text-black mb-4 text-sm uppercase tracking-wide';
        l.textContent = txt;
        return l;
    }
    document.getElementById('apply-mobile-filters').onclick = () => { filterJobs(); mModal.classList.add('hidden'); };
    document.getElementById('newsletter-form').onsubmit = (e) => {
        e.preventDefault();
        showToast('Subscribed successfully!');
        e.target.reset();
    };
    els.backdrop.onclick = closeModal;
}

function renderSkeletons() {
    els.grid.innerHTML = Array(4).fill(0).map(() => `
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
            <div class="flex gap-5 mb-6">
                <div class="w-16 h-16 rounded-xl shimmer"></div>
                <div class="flex-1 space-y-2.5 py-1">
                    <div class="h-5 w-3/4 shimmer rounded-lg"></div>
                    <div class="h-4 w-1/3 shimmer rounded-lg"></div>
                </div>
            </div>
            <div class="h-4 w-full shimmer rounded-lg mb-2"></div>
            <div class="h-4 w-2/3 shimmer rounded-lg mb-8"></div>
            <div class="flex justify-between mt-4">
                <div class="h-6 w-20 shimmer rounded-lg"></div>
                <div class="h-6 w-20 shimmer rounded-lg"></div>
            </div>
        </div>
    `).join('');
}

function renderCategories() {
    const cats = [
        { name: 'Tech', icon: 'fa-code' },
        { name: 'Design', icon: 'fa-pen-nib' },
        { name: 'Marketing', icon: 'fa-bullhorn' },
        { name: 'Finance', icon: 'fa-chart-line' },
        { name: 'Sales', icon: 'fa-headset' },
        { name: 'HR', icon: 'fa-users' },
    ];
    els.categoryContainer.innerHTML = cats.map((c, i) => `
        <button onclick="selectCategory('${c.name.toLowerCase()}')" class="bg-gray-50 flex flex-col items-center justify-center p-6 rounded-2xl hover:bg-white hover:shadow-md hover:border-brand-200 border border-transparent transition-all duration-300 group animate-slide-up" style="animation-delay: ${i * 50}ms">
            <div class="w-12 h-12 bg-white text-gray-400 rounded-xl flex items-center justify-center text-lg mb-3 group-hover:text-brand-500 group-hover:scale-110 transition-all shadow-sm">
                <i class="fas ${c.icon}"></i>
            </div>
            <span class="text-xs font-bold text-gray-500 group-hover:text-black tracking-wider uppercase transition-colors">${c.name}</span>
        </button>
    `).join('');
}

function populateFilters(jobs) {
    const types = [...new Set(jobs.map(j => j.type).filter(Boolean))];
    els.typeContainer.innerHTML = types.map(type => `
        <label class="flex items-center gap-3 cursor-pointer group">
            <div class="relative flex items-center">
                <input type="checkbox" value="${type}" class="peer sr-only" onchange="toggleType('${type}')">
                <div class="w-5 h-5 border border-gray-300 rounded-md peer-checked:bg-brand-500 peer-checked:border-brand-500 transition-all group-hover:border-brand-400"></div>
                <i class="fas fa-check text-white text-[10px] absolute left-1 top-1 opacity-0 peer-checked:opacity-100 transition-opacity"></i>
            </div>
            <span class="text-sm text-gray-500 font-medium group-hover:text-brand-600 transition-colors">${type}</span>
        </label>
    `).join('');


    // Populate Sectors
    const sectors = [...new Set(jobs.map(j => j.sector).filter(Boolean))];
    if (els.sectorContainer) {
        if (sectors.length === 0) {
            els.sectorContainer.parentElement.style.display = 'none';
        } else {
            els.sectorContainer.parentElement.style.display = 'block';
            els.sectorContainer.innerHTML = sectors.map(sector => `
            <label class="flex items-center gap-3 cursor-pointer group">
                <div class="relative flex items-center">
                    <input type="checkbox" value="${sector}" class="peer sr-only" onchange="toggleSector('${sector}')">
                    <div class="w-5 h-5 border border-gray-300 rounded-md peer-checked:bg-brand-500 peer-checked:border-brand-500 transition-all group-hover:border-brand-400"></div>
                    <i class="fas fa-check text-white text-[10px] absolute left-1 top-1 opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                </div>
                <span class="text-sm text-gray-500 font-medium group-hover:text-brand-600 transition-colors">${sector}</span>
            </label>
           `).join('');
        }
    }

    const locs = [...new Set(jobs.map(j => j.location).filter(Boolean))];
    locs.sort().forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = loc;
        els.locSelect.appendChild(opt);
    });
}

function toggleType(type) {
    activeFilters.types.has(type) ? activeFilters.types.delete(type) : activeFilters.types.add(type);
    syncFilters();
    filterJobs();
}

function toggleSector(sector) {
    activeFilters.sectors.has(sector) ? activeFilters.sectors.delete(sector) : activeFilters.sectors.add(sector);
    syncFilters();
    filterJobs();
}

function syncFilters() {
    document.querySelectorAll('input[type="checkbox"]').forEach(inp => {
        // We need to differentiate between type and sector checkboxes if they share values, 
        // but here we just check against both sets for simplicity or use context.
        // Better: check which set it belongs to based on parent.
        const val = inp.value;
        if (inp.closest('#type-filters-container') || inp.closest('#mobile-filter-content')) {
            // Logic simplified: just check if it's in either. 
            // Actually, let's keep it specific if we can.
            // For now, relies on unique values or just simple check:
            inp.checked = activeFilters.types.has(val) || activeFilters.sectors.has(val);
        }
    });
}

function selectCategory(cat) {
    els.searchInput.value = cat;
    activeFilters.search = cat;
    els.clearSearch.classList.remove('hidden');
    filterJobs();
    document.getElementById('opportunities').scrollIntoView({ behavior: 'smooth' });
}

function updateTicker(newsItems) {
    const tickerContainer = document.querySelector('.animate-marquee');
    if (!tickerContainer) return;

    // cycle through icons
    const icons = ['fa-bolt', 'fa-star', 'fa-bullhorn', 'fa-clock'];

    // Create HTML for news items
    const tickerHTML = newsItems.map((item, index) => {
        const icon = icons[index % icons.length];
        return `
            <span class="flex items-center gap-2">
                <i class="fas ${icon}"></i> ${item}
            </span>
        `;
    }).join('');

    // Duplicate content to ensure smooth seamless scrolling if content is short
    tickerContainer.innerHTML = tickerHTML + tickerHTML + tickerHTML;
}

function formatDate(date) {
    if (!date) return '';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

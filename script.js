/**
 * BetTracker Pro - Moteur Logique Autonome
 */

let config = {
    initialCapital: 30000,
    targetObjective: 150000,
    challengeDays: 30
};

let coupons = [];
let currentFilter = 'ALL';
let searchQuery = '';

const dom = {
    couponForm: document.getElementById('coupon-form'),
    settingsForm: document.getElementById('settings-form'),
    cardsContainer: document.getElementById('coupons-cards-container'),
    daysGrid: document.getElementById('challenge-days-grid'),
    searchInput: document.getElementById('search-input'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    toastContainer: document.getElementById('toast-container'),
    
    // KPIs
    currentCapital: document.getElementById('kpi-current-capital'),
    initialCapitalLabel: document.getElementById('kpi-initial-capital'),
    totalProfit: document.getElementById('kpi-total-profit'),
    roi: document.getElementById('kpi-roi'),
    targetObjective: document.getElementById('kpi-target-objective'),
    progressPercent: document.getElementById('kpi-progress-percent'),
    winRate: document.getElementById('kpi-win-rate'),
    ratio: document.getElementById('kpi-ratio'),
    challengeDayLabel: document.getElementById('challenge-day-label'),
    challengeProgressText: document.getElementById('challenge-progress-text'),
    challengeProgressBar: document.getElementById('challenge-progress-bar'),

    // Stats
    statSafe: document.getElementById('stat-count-safe'),
    statFun: document.getElementById('stat-count-fun'),
    statBestOdds: document.getElementById('stat-best-odds'),
    statMaxStake: document.getElementById('stat-max-stake'),
    statMaxGain: document.getElementById('stat-max-gain'),
    statTotalStaked: document.getElementById('stat-total-staked'),
    statStreakWin: document.getElementById('stat-streak-win'),
    statStreakLoss: document.getElementById('stat-streak-loss'),
    
    // Graphique
    chartLine: document.getElementById('chart-line-path'),
    chartArea: document.getElementById('chart-area-path'),
    chartDots: document.getElementById('chart-dots'),
    chartGrid: document.getElementById('grid-lines'),
    chartEmptyMsg: document.getElementById('chart-empty-msg')
};

document.addEventListener('DOMContentLoaded', () => {
    loadLocalStorageData();
    initSettingsFormInputs();
    setupEventListeners();
    executeDataPipeline();
});

function loadLocalStorageData() {
    const savedConfig = localStorage.getItem('bt_config');
    if (savedConfig) config = JSON.parse(savedConfig);
    else localStorage.setItem('bt_config', JSON.stringify(config));

    const savedCoupons = localStorage.getItem('bt_coupons');
    if (savedCoupons) coupons = JSON.parse(savedCoupons);
    
    document.getElementById('coupon-date').value = new Date().toISOString().split('T')[0];
}

function saveCouponsToStorage() {
    localStorage.setItem('bt_coupons', JSON.stringify(coupons));
}

function initSettingsFormInputs() {
    document.getElementById('set-initial').value = config.initialCapital;
    document.getElementById('set-target').value = config.targetObjective;
    document.getElementById('set-days').value = config.challengeDays;
}

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'danger') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

function setupEventListeners() {
    dom.couponForm.addEventListener('submit', handleCouponSubmit);
    
    dom.settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        config.initialCapital = parseFloat(document.getElementById('set-initial').value) || 0;
        config.targetObjective = parseFloat(document.getElementById('set-target').value) || 0;
        config.challengeDays = parseInt(document.getElementById('set-days').value) || 30;
        localStorage.setItem('bt_config', JSON.stringify(config));
        showNotification('Paramètres mis à jour avec succès !', 'success');
        executeDataPipeline();
    });

    dom.filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            dom.filterButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.getAttribute('data-filter');
            renderCouponsCards();
        });
    });

    dom.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderCouponsCards();
    });

    document.getElementById('cancel-edit').addEventListener('click', resetFormState);

    document.getElementById('reset-challenge').addEventListener('click', () => {
        if (confirm('⚠️ Réinitialiser l\'entièreté du challenge ?')) {
            coupons = [];
            saveCouponsToStorage();
            showNotification('Challenge réinitialisé.', 'danger');
            resetFormState();
            executeDataPipeline();
        }
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        document.querySelector('#theme-toggle i').className = nextTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    });

    // Accordéon pour le Formulaire d'Ajout de Coupon
    document.getElementById('toggle-form-btn').addEventListener('click', () => {
        const content = document.getElementById('form-collapsible-content');
        const icon = document.getElementById('toggle-form-icon');
        content.classList.toggle('collapsed');
        icon.classList.toggle('rotated');
    });

    // Accordéon pour les Paramètres
    document.getElementById('toggle-settings-btn').addEventListener('click', () => {
        const content = document.getElementById('settings-collapsible-content');
        const icon = document.getElementById('toggle-settings-icon');
        content.classList.toggle('collapsed');
        icon.classList.toggle('rotated');
    });

    // Accordéon pour l'Historique
    document.getElementById('toggle-history-btn').addEventListener('click', () => {
        const content = document.getElementById('history-collapsible-content');
        const icon = document.getElementById('toggle-history-icon');
        content.classList.toggle('collapsed');
        icon.classList.toggle('rotated');
    });

    // Accordéon pour la Matrice Temporelle
    document.getElementById('toggle-grid-btn').addEventListener('click', () => {
        const content = document.getElementById('grid-collapsible-content');
        const icon = document.getElementById('toggle-grid-icon');
        content.classList.toggle('collapsed');
        icon.classList.toggle('rotated');
    });

    document.getElementById('export-csv').addEventListener('click', exportToCSV);
    document.getElementById('export-pdf').addEventListener('click', () => { window.print(); });
}

function executeDataPipeline() {
    coupons.sort((a, b) => new Date(a.date) - new Date(b.date));
    calculateMetricsAndRenderKPIs();
    renderTimeGrid();
    renderCouponsCards();
}

function calculateMetricsAndRenderKPIs() {
    let currentCapital = config.initialCapital;
    let totalStaked = 0;
    let totalWonGains = 0;
    let countWon = 0;
    let countLost = 0;
    let countSafe = 0, countFun = 0;
    let bestOddsWon = 1.00, maxStake = 0, maxNetGain = 0;
    let currentWinStreak = 0, maxWinStreak = 0, currentLossStreak = 0, maxLossStreak = 0;

    coupons.forEach(coupon => {
        const stake = parseFloat(coupon.stake);
        const odds = parseFloat(coupon.odds);
        totalStaked += stake;
        if (stake > maxStake) maxStake = stake;
        if (coupon.type === 'SAFE') countSafe++;
        if (coupon.type === 'FUN') countFun++;

        if (coupon.status === 'WON') {
            const grossGain = stake * odds;
            const netGain = grossGain - stake;
            totalWonGains += grossGain;
            currentCapital += netGain;
            countWon++;
            if (odds > bestOddsWon) bestOddsWon = odds;
            if (netGain > maxNetGain) maxNetGain = netGain;
            currentWinStreak++; maxWinStreak = Math.max(maxWinStreak, currentWinStreak); currentLossStreak = 0;
        } else {
            currentCapital -= stake;
            countLost++;
            currentLossStreak++; maxLossStreak = Math.max(maxLossStreak, currentLossStreak); currentWinStreak = 0;
        }
    });

    const totalCoupons = coupons.length;
    const profitTotal = currentCapital - config.initialCapital;
    const winRate = totalCoupons > 0 ? (countWon / totalCoupons) * 100 : 0;
    
    // VRAI ROI basé sur l'argent misé
    const roi = totalStaked > 0 ? (profitTotal / totalStaked) * 100 : 0;
    
    // Progression réelle par rapport au capital global initial
    const capitalProgress = config.initialCapital > 0 ? (profitTotal / config.initialCapital) * 100 : 0;
    const uniqueDates = [...new Set(coupons.map(c => c.date))].sort();
    const currentDayProgress = Math.min(uniqueDates.length || 1, config.challengeDays);

    dom.currentCapital.textContent = `${currentCapital.toFixed(2)} F CFA`;
    dom.initialCapitalLabel.textContent = `Départ: ${config.initialCapital.toFixed(2)} F CFA`;
    dom.totalProfit.textContent = `${profitTotal >= 0 ? '+' : ''}${profitTotal.toFixed(2)} F CFA`;
    dom.totalProfit.className = profitTotal >= 0 ? 'text-success' : 'text-danger';
    dom.roi.textContent = `ROI: ${roi.toFixed(1)}%`;
    dom.targetObjective.textContent = `${config.targetObjective.toFixed(2)} F CFA`;
    
    dom.progressPercent.textContent = `Progression: ${capitalProgress >= 0 ? '+' : ''}${capitalProgress.toFixed(1)}%`;
    
    dom.winRate.textContent = `${winRate.toFixed(1)}%`;
    dom.ratio.textContent = `${countWon} V / ${countLost} D (Total: ${totalCoupons})`;
    dom.challengeDayLabel.textContent = `Jour ${currentDayProgress} sur ${config.challengeDays}`;
    
    const timeProgress = Math.min((currentDayProgress / config.challengeDays) * 100, 100);
    dom.challengeProgressText.textContent = `${timeProgress.toFixed(0)}% du temps validé`;
    dom.challengeProgressBar.style.width = `${timeProgress}%`;

    dom.statSafe.textContent = countSafe; dom.statFun.textContent = countFun;
    dom.statBestOdds.textContent = bestOddsWon.toFixed(2);
    dom.statMaxStake.textContent = `${maxStake.toFixed(0)} F`;
    dom.statMaxGain.textContent = `${maxNetGain.toFixed(0)} F`;
    dom.statTotalStaked.textContent = `${totalStaked.toFixed(0)} F`;
    dom.statStreakWin.textContent = maxWinStreak; dom.statStreakLoss.textContent = maxLossStreak;

    generateEvolutionChart(config.initialCapital);
}

function renderTimeGrid() {
    dom.daysGrid.innerHTML = '';
    const uniqueDates = [...new Set(coupons.map(c => c.date))].sort();

    for (let i = 1; i <= config.challengeDays; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        const assocDate = uniqueDates[i - 1];
        let dayCoupons = assocDate ? coupons.filter(c => c.date === assocDate) : [];

        cell.innerHTML = `<span class="day-nr">J${i}</span>`;
        if (i === (uniqueDates.length || 1)) cell.classList.add('active-day');

        if (dayCoupons.length > 0) {
            cell.classList.add('completed');
            const dotContainer = document.createElement('div');
            dotContainer.className = 'coupon-dot-indicator';
            if (dayCoupons.some(c => c.type === 'SAFE')) { const d = document.createElement('span'); d.className = 'dot safe'; dotContainer.appendChild(d); }
            if (dayCoupons.some(c => c.type === 'FUN')) { const d = document.createElement('span'); d.className = 'dot fun'; dotContainer.appendChild(d); }
            cell.appendChild(dotContainer);
        }
        dom.daysGrid.appendChild(cell);
    }
}

function renderCouponsCards() {
    dom.cardsContainer.innerHTML = '';
    let filtered = coupons.filter(c => {
        if (currentFilter === 'SAFE' && c.type !== 'SAFE') return false;
        if (currentFilter === 'FUN' && c.type !== 'FUN') return false;
        if (currentFilter === 'WON' && c.status !== 'WON') return false;
        if (currentFilter === 'LOST' && c.status !== 'LOST') return false;
        if (currentFilter === 'TODAY' && c.date !== new Date().toISOString().split('T')[0]) return false;
        if (currentFilter === 'MONTH' && new Date(c.date).getMonth() !== new Date().getMonth()) return false;
        
        if (searchQuery) {
            const match = `${c.type} ${c.odds} ${c.stake} ${c.status === 'WON' ? 'gagné' : 'perdu'}`.toLowerCase();
            if (!match.includes(searchQuery)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        document.getElementById('cards-empty-msg').classList.remove('hidden');
        return;
    }
    document.getElementById('cards-empty-msg').classList.add('hidden');

    filtered.slice().reverse().forEach(c => {
        const card = document.createElement('div');
        card.className = `coupon-card type-${c.type.toLowerCase()}`;
        const gain = c.status === 'WON' ? (c.stake * c.odds) : 0;
        
        card.innerHTML = `
            <div class="card-top">
                <span class="card-date"><i class="fa-regular fa-calendar"></i> ${new Date(c.date).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}</span>
                <div>
                    <span class="badge badge-${c.type.toLowerCase()}">${c.type}</span>
                    <span class="badge badge-${c.status.toLowerCase()}">${c.status === 'WON' ? '✅' : '❌'}</span>
                </div>
            </div>
            <div class="card-main-info">
                <div class="info-item"><span class="label">Cote</span><span class="val">@${parseFloat(c.odds).toFixed(2)}</span></div>
                <div class="info-item"><span class="label">Mise</span><span class="val">${parseFloat(c.stake)} F</span></div>
                <div class="info-item" style="grid-column: span 2; margin-top:4px;"><span class="label">Gain</span><span class="val ${gain>0?'text-success':''}">${gain.toFixed(2)} F</span></div>
            </div>
            <div class="card-actions">
                <button onclick="triggerEditCoupon('${c.id}')" class="btn-icon edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="triggerDeleteCoupon('${c.id}')" class="btn-icon delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        dom.cardsContainer.appendChild(card);
    });
}

function generateEvolutionChart(initialCap) {
    if (coupons.length === 0) {
        dom.chartLine.setAttribute('d', ''); dom.chartArea.setAttribute('d', '');
        dom.chartDots.innerHTML = ''; dom.chartGrid.innerHTML = '';
        dom.chartEmptyMsg.classList.remove('hidden'); return;
    }
    dom.chartEmptyMsg.classList.add('hidden');

    let capPoints = [initialCap], rollingCap = initialCap;
    coupons.forEach(c => {
        rollingCap += c.status === 'WON' ? (c.stake * c.odds) - c.stake : -c.stake;
        capPoints.push(rollingCap);
    });

    const width = 600, height = 220, paddingX = 40, paddingY = 30;
    const minCap = Math.min(...capPoints) * 0.95, maxCap = Math.max(...capPoints) * 1.05, capRange = maxCap - minCap || 1;
    const stepX = (width - (paddingX * 2)) / (capPoints.length - 1);
    
    let pathData = "", areaData = `M ${paddingX} ${height - paddingY}`, dotsHtml = "", gridHtml = "";

    for (let i = 0; i <= 3; i++) {
        const yVal = paddingY + ((height - (paddingY * 2)) / 3) * i;
        gridHtml += `<line x1="${paddingX}" y1="${yVal}" x2="${width - paddingX}" y2="${yVal}" stroke="var(--border-color)" stroke-dasharray="4,4"/>`;
    }

    capPoints.forEach((cap, idx) => {
        const x = paddingX + (idx * stepX);
        const y = height - paddingY - ((cap - minCap) / capRange) * (height - (paddingY * 2));
        if (idx === 0) pathData += `M ${x} ${y}`; else pathData += ` L ${x} ${y}`;
        areaData += ` L ${x} ${y}`;
        if(idx > 0 || capPoints.length < 15) {
            dotsHtml += `<circle cx="${x}" cy="${y}" r="4" fill="${cap >= initialCap ? 'var(--color-won)':'var(--color-lost)'}" stroke="var(--bg-card)" stroke-width="1.5"/>`;
        }
    });

    areaData += ` L ${paddingX + ((capPoints.length - 1) * stepX)} ${height - paddingY} Z`;
    dom.chartLine.setAttribute('d', pathData); dom.chartArea.setAttribute('d', areaData);
    dom.chartDots.innerHTML = dotsHtml; dom.chartGrid.innerHTML = gridHtml;
}

function handleCouponSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('edit-id').value;
    const date = document.getElementById('coupon-date').value;
    const type = document.getElementById('coupon-type').value;
    const odds = parseFloat(document.getElementById('coupon-odds').value);
    const stake = parseFloat(document.getElementById('coupon-stake').value);
    const status = document.querySelector('input[name="coupon-status"]:checked').value;

    if (editId) {
        const idx = coupons.findIndex(c => c.id === editId);
        if (idx !== -1) coupons[idx] = { id: editId, date, type, odds, stake, status };
        showNotification('Coupon mis à jour.', 'success');
    } else {
        coupons.push({ id: 'cp_' + Math.random().toString(36).substr(2, 9), date, type, odds, stake, status });
        showNotification('Coupon ajouté !', 'success');
    }
    saveCouponsToStorage(); resetFormState(); executeDataPipeline();
}

window.triggerDeleteCoupon = function(id) {
    if (confirm('Supprimer ce coupon ?')) {
        coupons = coupons.filter(c => c.id !== id);
        saveCouponsToStorage(); showNotification('Coupon supprimé.', 'info'); executeDataPipeline();
    }
};

window.triggerEditCoupon = function(id) {
    const c = coupons.find(c => c.id === id);
    if (!c) return;
    document.getElementById('edit-id').value = c.id;
    document.getElementById('coupon-date').value = c.date;
    document.getElementById('coupon-type').value = c.type;
    document.getElementById('coupon-odds').value = c.odds;
    document.getElementById('coupon-stake').value = c.stake;
    document.querySelector(`input[name="coupon-status"][value="${c.status}"]`).checked = true;
    document.getElementById('form-title').innerHTML = "<i class='fa-solid fa-pen-to-square'></i> Modifier le Coupon";
    document.getElementById('cancel-edit').classList.remove('hidden');
    
    // Ouvre automatiquement le formulaire s'il était fermé
    const content = document.getElementById('form-collapsible-content');
    const icon = document.getElementById('toggle-form-icon');
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        icon.classList.remove('rotated');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function resetFormState() {
    document.getElementById('edit-id').value = ''; dom.couponForm.reset();
    document.getElementById('coupon-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('form-title').innerHTML = "<i class='fa-solid fa-circle-plus'></i> Ajouter un Coupon";
    document.getElementById('cancel-edit').classList.add('hidden');
}

function exportToCSV() {
    if (coupons.length === 0) return showNotification('Aucune donnée', 'danger');
    let csv = "ID;Date;Type;Cote;Mise;Resultat;Gain\n";
    coupons.forEach(c => { csv += `${c.id};${c.date};${c.type};${c.odds};${c.stake};${c.status};${c.status==='WON'?c.stake*c.odds:0}\n`; });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", "Export_Challenge.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

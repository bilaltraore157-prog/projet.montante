/**
 * BetTracker Pro - Suivi des Failles par Résultats Individuels de Matchs
 */

let config = {
    initialCapital: 30000,
    targetObjective: 150000,
    challengeDays: 30
};

let coupons = [];
let currentFilter = 'ALL';
let searchQuery = '';

const marketLabels = {
    'DC': 'Double Chance',
    'PLUS': 'Plus (Total)',
    'MOINS': 'Moins (Total)',
    'H_PLUS': 'Handicap Plus',
    'H_MOINS': 'Handicap Moins',
    'NONE': 'Aucun'
};

const dom = {
    couponForm: document.getElementById('coupon-form'),
    settingsForm: document.getElementById('settings-form'),
    cardsContainer: document.getElementById('coupons-cards-container'),
    daysGrid: document.getElementById('challenge-days-grid'),
    searchInput: document.getElementById('search-input'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    toastContainer: document.getElementById('toast-container'),
    
    // Éléments du formulaire dynamique
    couponType: document.getElementById('coupon-type'),
    matchSelectionRow: document.getElementById('match-selection-row'),
    globalStatusBlock: document.getElementById('global-status-block'),
    
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

    // Stats Avancées
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
    toggleFormFieldsLayout();
    executeDataPipeline();
});

function loadLocalStorageData() {
    const savedConfig = localStorage.getItem('bt_config');
    if (savedConfig) config = JSON.parse(savedConfig);

    const savedCoupons = localStorage.getItem('bt_coupons');
    if (savedCoupons) {
        coupons = JSON.parse(savedCoupons);
        // Rétrocompatibilité intelligente des statuts de matchs
        coupons.forEach(c => {
            if (!c.market1) c.market1 = 'PLUS';
            if (!c.market2) c.market2 = 'NONE';
            if (!c.market3) c.market3 = 'NONE';
            if (!c.status1) c.status1 = c.status || 'WON';
            if (!c.status2) c.status2 = c.status || 'WON';
            if (!c.status3) c.status3 = c.status || 'WON';
        });
    }
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

function toggleFormFieldsLayout() {
    if (dom.couponType.value === 'FUN') {
        dom.matchSelectionRow.classList.add('hidden');
        dom.globalStatusBlock.classList.remove('hidden');
    } else {
        dom.matchSelectionRow.classList.remove('hidden');
        dom.globalStatusBlock.classList.add('hidden');
    }
}

function setupEventListeners() {
    dom.couponForm.addEventListener('submit', handleCouponSubmit);
    dom.couponType.addEventListener('change', toggleFormFieldsLayout);
    
    dom.settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        config.initialCapital = parseFloat(document.getElementById('set-initial').value) || 0;
        config.targetObjective = parseFloat(document.getElementById('set-target').value) || 0;
        config.challengeDays = parseInt(document.getElementById('set-days').value) || 30;
        localStorage.setItem('bt_config', JSON.stringify(config));
        showNotification('Paramètres mis à jour !', 'success');
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

    const setupAccordion = (btnId, contentId, iconId) => {
        const btn = document.getElementById(btnId);
        if(btn) {
            btn.addEventListener('click', () => {
                document.getElementById(contentId).classList.toggle('collapsed');
                document.getElementById(iconId).classList.toggle('rotated');
            });
        }
    };
    setupAccordion('toggle-form-btn', 'form-collapsible-content', 'toggle-form-icon');
    setupAccordion('toggle-settings-btn', 'settings-collapsible-content', 'toggle-settings-icon');
    setupAccordion('toggle-history-btn', 'history-collapsible-content', 'toggle-history-icon');
    setupAccordion('toggle-grid-btn', 'grid-collapsible-content', 'toggle-grid-icon');

    document.getElementById('export-csv').addEventListener('click', exportToCSV);
    document.getElementById('export-pdf').addEventListener('click', () => { window.print(); });
}

function executeDataPipeline() {
    coupons.sort((a, b) => new Date(a.date) - new Date(b.date));
    calculateMetricsAndRenderKPIs();
    updateOptionsAnalysis();
    renderTimeGrid();
    renderCouponsCards();
}

function calculateMetricsAndRenderKPIs() {
    let currentCapital = config.initialCapital;
    let totalStaked = 0;
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
            const netGain = (stake * odds) - stake;
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
    const roi = totalStaked > 0 ? (profitTotal / totalStaked) * 100 : 0;
    const capitalProgress = config.initialCapital > 0 ? (profitTotal / config.initialCapital) * 100 : 0;
    
    const uniqueDates = [...new Set(coupons.map(c => c.date))].sort();
    const currentDayProgress = Math.min(uniqueDates.length || 1, config.challengeDays);

    dom.currentCapital.textContent = `${currentCapital.toFixed(0)} F CFA`;
    dom.initialCapitalLabel.textContent = `Départ: ${config.initialCapital.toFixed(0)} F CFA`;
    dom.totalProfit.textContent = `${profitTotal >= 0 ? '+' : ''}${profitTotal.toFixed(0)} F CFA`;
    dom.totalProfit.className = profitTotal >= 0 ? 'text-success' : 'text-danger';
    dom.roi.textContent = `ROI: ${roi.toFixed(1)}%`;
    dom.targetObjective.textContent = `${config.targetObjective.toFixed(0)} F CFA`;
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

// ANALYSE ULTRA-PRÉCISE : On compte l'exact résultat de chaque option
function updateOptionsAnalysis() {
    const markets = ['DC', 'PLUS', 'MOINS', 'H_PLUS', 'H_MOINS'];
    const safeCoupons = coupons.filter(c => c.type === 'SAFE');
    
    markets.forEach(m => {
        let total = 0;
        let won = 0;

        safeCoupons.forEach(c => {
            if (c.market1 === m) { total++; if(c.status1 === 'WON') won++; }
            if (c.market2 === m && c.market2 !== 'NONE') { total++; if(c.status2 === 'WON') won++; }
            if (c.market3 === m && c.market3 !== 'NONE') { total++; if(c.status3 === 'WON') won++; }
        });

        const lost = total - won;
        const rate = total > 0 ? (won / total) * 100 : 0;
        
        const cardElement = document.getElementById(`analysis-${m.toLowerCase()}`);
        if(cardElement) {
            const rateElement = cardElement.querySelector('.option-rate');
            const detailsElement = cardElement.querySelector('.option-details');
            
            rateElement.textContent = `${rate.toFixed(1)}%`;
            detailsElement.textContent = `${won} V / ${lost} D (Total: ${total})`;
            
            cardElement.classList.remove('good', 'bad');
            if (total > 0) {
                if (rate >= 60) cardElement.classList.add('good');
                else if (rate <= 45) cardElement.classList.add('bad');
            }
        }
    });
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
        
        let comboText = "Ticket FUN (Sans détails)";
        if (c.type === 'SAFE') {
            let list = [];
            list.push(`${marketLabels[c.market1]} (${c.status1 === 'WON' ? '✔️' : '❌'})`);
            if(c.market2 && c.market2 !== 'NONE') list.push(`${marketLabels[c.market2]} (${c.status2 === 'WON' ? '✔️' : '❌'})`);
            if(c.market3 && c.market3 !== 'NONE') list.push(`${marketLabels[c.market3]} (${c.status3 === 'WON' ? '✔️' : '❌'})`);
            comboText = list.join(' + ');
        }
        
        card.innerHTML = `
            <div class="card-top">
                <span class="card-date"><i class="fa-regular fa-calendar"></i> ${new Date(c.date).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}</span>
                <span class="combo-markets" style="font-size:0.8rem;">${comboText}</span>
                <div style="display:flex; gap:3px; margin-top:4px;">
                    <span class="badge badge-${c.type.toLowerCase()}">${c.type}</span>
                    <span class="badge badge-${c.status.toLowerCase()}">${c.status === 'WON' ? 'Gagné' : 'Perdu'}</span>
                </div>
            </div>
            <div class="card-main-info">
                <div class="info-item"><span class="label">Cote</span><span class="val">@${parseFloat(c.odds).toFixed(2)}</span></div>
                <div class="info-item"><span class="label">Mise</span><span class="val">${parseFloat(c.stake)} F</span></div>
                <div class="info-item"><span class="label">Gain</span><span class="val ${gain>0?'text-success':''}">${gain.toFixed(0)} F</span></div>
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
            dotsHtml += `<circle cx="${x}" cy="${y}" r="4" fill="${cap >= initialCap ? 'var(--success-color)':'var(--danger-color)'}" stroke="var(--bg-card)" stroke-width="1.5"/>`;
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

    let market1 = 'NONE', market2 = 'NONE', market3 = 'NONE';
    let status1 = 'WON', status2 = 'WON', status3 = 'WON';
    let finalStatus = 'LOST';

    if (type === 'SAFE') {
        market1 = document.getElementById('coupon-market-1').value;
        market2 = document.getElementById('coupon-market-2').value;
        market3 = document.getElementById('coupon-market-3').value;

        status1 = document.getElementById('coupon-status-1').value;
        status2 = document.getElementById('coupon-status-2').value;
        status3 = document.getElementById('coupon-status-3').value;

        // CALCUL LOGIQUE AUTOMATIQUE : Si un seul match actif est perdu, le coupon est perdu
        let isM1Passed = (status1 === 'WON');
        let isM2Passed = (market2 === 'NONE' || status2 === 'WON');
        let isM3Passed = (market3 === 'NONE' || status3 === 'WON');

        if (isM1Passed && isM2Passed && isM3Passed) {
            finalStatus = 'WON';
        }
    } else {
        // En mode FUN, on prend directement la valeur du bouton radio global
        finalStatus = document.querySelector('input[name="coupon-status"]:checked').value;
    }

    if (editId) {
        const idx = coupons.findIndex(c => c.id === editId);
        if (idx !== -1) {
            coupons[idx] = { id: editId, date, type, market1, market2, market3, status1, status2, status3, odds, stake, status: finalStatus };
        }
        showNotification('Coupon mis à jour.', 'success');
    } else {
        coupons.push({ id: 'cp_' + Math.random().toString(36).substr(2, 9), date, type, market1, market2, market3, status1, status2, status3, odds, stake, status: finalStatus });
        showNotification('Coupon enregistré !', 'success');
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
    
    dom.couponType.value = c.type;
    toggleFormFieldsLayout();
    
    document.getElementById('coupon-market-1').value = c.market1 || 'PLUS';
    document.getElementById('coupon-market-2').value = c.market2 || 'NONE';
    document.getElementById('coupon-market-3').value = c.market3 || 'NONE';

    document.getElementById('coupon-status-1').value = c.status1 || 'WON';
    document.getElementById('coupon-status-2').value = c.status2 || 'WON';
    document.getElementById('coupon-status-3').value = c.status3 || 'WON';

    document.getElementById('coupon-odds').value = c.odds;
    document.getElementById('coupon-stake').value = c.stake;
    
    if (c.type === 'FUN') {
        document.querySelector(`input[name="coupon-status"][value="${c.status}"]`).checked = true;
    }
    
    document.getElementById('form-title').innerHTML = "<i class='fa-solid fa-pen-to-square'></i> Modifier le Coupon";
    document.getElementById('cancel-edit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function resetFormState() {
    document.getElementById('edit-id').value = ''; dom.couponForm.reset();
    document.getElementById('coupon-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('form-title').innerHTML = "<i class='fa-solid fa-circle-plus'></i> Ajouter un Coupon";
    document.getElementById('cancel-edit').classList.add('hidden');
    toggleFormFieldsLayout();
}

function exportToCSV() {
    if (coupons.length === 0) return showNotification('Aucune donnée', 'danger');
    let csv = "ID;Date;Type;Match_1;Statut_1;Match_2;Statut_2;Match_3;Statut_3;Cote;Mise;Resultat_Global;Gain\n";
    coupons.forEach(c => { csv += `${c.id};${c.date};${c.type};${marketLabels[c.market1]};${c.status1};${marketLabels[c.market2]};${c.status2};${marketLabels[c.market3]};${c.status3};${c.odds};${c.stake};${c.status};${c.status==='WON'?c.stake*c.odds:0}\n`; });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", "Export_Challenge_Failles.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

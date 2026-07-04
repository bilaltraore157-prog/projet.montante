
// ==========================================================================
// CONFIGURATION ET STATE GENERAL
// ==========================================================================
let config = {
    initialCapital: 30000,
    targetCapital: 150000,
    durationDays: 30,
    defaultStake: 2000
};

let coupons = [];
let editingCouponId = null; // Stocke l'ID du coupon en cours de modification

// Liste mise à jour avec OUI et NON pour "Les 2 équipes marquent"
const PRESET_OPTIONS = [
    "Double Chance",
    "Plus (Total Buts)",
    "Moins (Total Buts)",
    "Les 2 équipes marquent : OUI",
    "Les 2 équipes marquent : NON",
    "Handicap Plus",
    "Handicap Moins"
];

// ==========================================================================
// INITIALISATION DE L'APPLICATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    initTheme();
    setupEventListeners();
    setDefaultDate();
    toggleMatchSelectors(); // Vérification au démarrage
    updateDashboard();
});

// Thème Clair / Sombre
function initTheme() {
    const savedTheme = localStorage.getItem("bet-tracker-theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    const icon = document.querySelector("#theme-toggle i");
    if (savedTheme === "dark" && icon) {
        icon.className = "fas fa-sun";
    }
}

// Fonction pour afficher/masquer les matchs selon le type de gestion
function toggleMatchSelectors() {
    const typeSelect = document.getElementById("coupon-type");
    const matchBlock = document.querySelector(".match-selectors-block");
    
    if (!typeSelect || !matchBlock) return;

    if (typeSelect.value === "FUN") {
        matchBlock.style.display = "none";
        // Réinitialise les sélections quand on masque
        document.querySelectorAll(".match-option-select").forEach(s => s.value = "");
    } else {
        matchBlock.style.display = "flex";
    }
}

function setupEventListeners() {
    // Écouteur sur le changement de type (SAFE / FUN)
    const typeSelect = document.getElementById("coupon-type");
    if (typeSelect) {
        typeSelect.addEventListener("change", toggleMatchSelectors);
    }

    // Thème toggle
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("bet-tracker-theme", newTheme);
            const icon = themeBtn.querySelector("i");
            if (icon) icon.className = newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
        });
    }

    // Sections pliables / Accordéons
    setupCollapsible("toggle-form-coupon", "form-coupon-content");
    setupCollapsible("toggle-params", "params-content");
    setupCollapsible("toggle-matrix", "matrix-content");
    setupCollapsible("toggle-history", "history-content"); 

    // Formulaire d'ajout / modification de coupon
    const couponForm = document.getElementById("coupon-form");
    if (couponForm) {
        couponForm.addEventListener("submit", (e) => {
            e.preventDefault();
            saveCoupon();
        });
    }

    // Formulaire de configuration
    const saveConfigBtn = document.getElementById("btn-save-config");
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener("click", () => {
            config.initialCapital = parseFloat(document.getElementById("param-initial-capital").value) || 30000;
            config.targetCapital = parseFloat(document.getElementById("param-target-capital").value) || 150000;
            config.durationDays = parseInt(document.getElementById("param-duration").value) || 30;
            saveData();
            updateDashboard();
            alert("Configuration mise à jour avec succès !");
        });
    }

    // Bouton de réinitialisation complète
    const resetBtn = document.getElementById("btn-reset");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (confirm("Attention ! Es-tu sûr de vouloir réinitialiser tout le challenge ? Toutes les données seront perdues.")) {
                coupons = [];
                localStorage.removeItem("bet_tracker_coupons");
                updateDashboard();
            }
        });
    }

    // Filtrage de l'historique
    const filterBtns = document.querySelectorAll(".filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            filterBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            renderHistory(e.target.getAttribute("data-filter"));
        });
    });

    // Export & Import JSON
    const exportBtn = document.getElementById("btn-export");
    if (exportBtn) exportBtn.addEventListener("click", exportData);

    const importTrigger = document.getElementById("btn-import-trigger");
    if (importTrigger) {
        importTrigger.addEventListener("click", () => {
            document.getElementById("file-import").click();
        });
    }

    const fileImport = document.getElementById("file-import");
    if (fileImport) fileImport.addEventListener("change", importData);
}

// Fonction de pliage optimisée pour le clic sur les icônes
function setupCollapsible(triggerId, contentId) {
    const trigger = document.getElementById(triggerId);
    const content = document.getElementById(contentId);
    if (!trigger || !content) return;

    trigger.addEventListener("click", (e) => {
        content.classList.toggle("collapsed");
        
        const icon = trigger.querySelector(".btn-toggle-icon i");
        if (icon) {
            icon.classList.toggle("rotated");
        }
    });
}

function setDefaultDate() {
    const couponDate = document.getElementById("coupon-date");
    if (couponDate) {
        const today = new Date().toISOString().split('T')[0];
        couponDate.value = today;
    }
}

// ==========================================================================
// CALCULS ET LOGIQUE DES METRIQUES
// ==========================================================================
function updateDashboard() {
    coupons.sort((a, b) => new Date(a.date) - new Date(b.date));

    let currentCapital = config.initialCapital;
    let totalStaked = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let bestOdds = 1.0;
    let maxStake = 0;
    let maxNetGain = 0;

    let safeCount = 0;
    let funCount = 0;

    let optionStats = {};
    PRESET_OPTIONS.forEach(opt => optionStats[opt] = { wins: 0, total: 0 });

    coupons.forEach(cp => {
        totalStaked += cp.stake;
        if (cp.stake > maxStake) maxStake = cp.stake;
        if (cp.type === "SAFE") safeCount++;
        if (cp.type === "FUN") funCount++;

        if (cp.result === "Gagné") {
            // CORRECTION ICI : Le capital évolue avec le bénéfice net réel pour le solde général (Gain - Mise)
            let gainNetReel = (cp.stake * cp.odds) - cp.stake;
            currentCapital += gainNetReel;
            
            // Pour les statistiques du plus gros gain
            let gainTotalBrut = cp.stake * cp.odds;
            if (gainTotalBrut > maxNetGain) maxNetGain = gainTotalBrut;
            if (cp.odds > bestOdds) bestOdds = cp.odds;

            totalWins++;
            currentWinStreak++;
            if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
            currentLossStreak = 0;
        } else {
            currentCapital -= cp.stake;
            totalLosses++;
            currentLossStreak++;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
            currentWinStreak = 0;
        }

        if (cp.matches && Array.isArray(cp.matches)) {
            cp.matches.forEach(m => {
                if (m.name && optionStats[m.name]) {
                    optionStats[m.name].total++;
                    if (m.status === "Gagné") {
                        optionStats[m.name].wins++;
                    }
                }
            });
        }
    });

    let profitTotal = currentCapital - config.initialCapital;
    let roi = totalStaked > 0 ? (profitTotal / totalStaked) * 100 : 0.0;
    let winRate = coupons.length > 0 ? (totalWins / coupons.length) * 100 : 0.0;
    let progressPercent = Math.min(((currentCapital - config.initialCapital) / (config.targetCapital - config.initialCapital)) * 100, 100);
    if (progressPercent < 0) progressPercent = 0;

    if(document.getElementById("kpi-capital")) document.getElementById("kpi-capital").innerText = currentCapital.toFixed(0) + " F CFA";
    if(document.getElementById("kpi-initial-label")) document.getElementById("kpi-initial-label").innerText = "Départ: " + config.initialCapital + " F";
    
    const profitEl = document.getElementById("kpi-profit");
    if (profitEl) {
        if (profitTotal >= 0) {
            profitEl.innerText = "+" + profitTotal.toFixed(0) + " F CFA";
            profitEl.className = "text-success";
        } else {
            profitEl.innerText = profitTotal.toFixed(0) + " F CFA";
            profitEl.className = "text-danger";
        }
    }
    
    if(document.getElementById("kpi-roi")) document.getElementById("kpi-roi").innerText = "ROI: " + roi.toFixed(1) + "%";
    if(document.getElementById("kpi-target")) document.getElementById("kpi-target").innerText = config.targetCapital + " F CFA";
    if(document.getElementById("kpi-progress-percent")) document.getElementById("kpi-progress-percent").innerText = "Progression: " + progressPercent.toFixed(1) + "%";
    if(document.getElementById("kpi-winrate")) document.getElementById("kpi-winrate").innerText = winRate.toFixed(1) + "%";
    if(document.getElementById("kpi-coupons-count")) document.getElementById("kpi-coupons-count").innerText = `${totalWins} V / ${totalLosses} D (Total: ${coupons.length})`;

    let distinctDaysCount = new Set(coupons.map(c => c.date)).size;
    let dayProgressPercent = Math.min((distinctDaysCount / config.durationDays) * 100, 100);
    if(document.getElementById("progress-day-label")) document.getElementById("progress-day-label").innerText = `Jour ${distinctDaysCount} sur ${config.durationDays}`;
    if(document.getElementById("progress-time-percent")) document.getElementById("progress-time-percent").innerText = `${dayProgressPercent.toFixed(0)}% du temps validé`;
    if(document.getElementById("progress-bar-fill")) document.getElementById("progress-bar-fill").style.width = dayProgressPercent + "%";

    if(document.getElementById("stat-safe-count")) document.getElementById("stat-safe-count").innerText = safeCount;
    if(document.getElementById("stat-fun-count")) document.getElementById("stat-fun-count").innerText = funCount;
    if(document.getElementById("stat-best-odds")) document.getElementById("stat-best-odds").innerText = bestOdds.toFixed(3);
    if(document.getElementById("stat-max-stake")) document.getElementById("stat-max-stake").innerText = maxStake.toFixed(0) + " F";
    if(document.getElementById("stat-max-gain")) document.getElementById("stat-max-gain").innerText = maxNetGain.toFixed(0) + " F";
    if(document.getElementById("stat-total-volume")) document.getElementById("stat-total-volume").innerText = totalStaked.toFixed(0) + " F";
    if(document.getElementById("stat-streak-win")) document.getElementById("stat-streak-win").innerText = maxWinStreak;
    if(document.getElementById("stat-streak-loss")) document.getElementById("stat-streak-loss").innerText = maxLossStreak;

    renderOptionsAnalysis(optionStats);
    renderTemporalMatrix();
    renderChart();
    renderHistory("all");
}

// ==========================================================================
// RENDU DES COMPOSANTS
// ==========================================================================
function renderOptionsAnalysis(stats) {
    const container = document.getElementById("options-analysis-container");
    if (!container) return;
    container.innerHTML = "";

    PRESET_OPTIONS.forEach(opt => {
        let optData = stats[opt];
        let rate = optData.total > 0 ? (optData.wins / optData.total) * 100 : 0.0;
        
        let statusClass = "";
        if (optData.total >= 2) {
            statusClass = rate >= 70 ? "good" : (rate <= 45 ? "bad" : "");
        }

        const card = document.createElement("div");
        card.className = `option-analysis-card ${statusClass}`;
        card.innerHTML = `
            <span class="option-name">${opt}</span>
            <span class="option-rate">${rate.toFixed(1)}%</span>
            <span class="option-details">${optData.wins} V / ${optData.total - optData.wins} D (Total: ${optData.total})</span>
        `;
        container.appendChild(card);
    });
}

function renderTemporalMatrix() {
    const grid = document.getElementById("challenge-days-grid");
    if (!grid) return;
    grid.innerHTML = "";

    let couponsByDate = {};
    coupons.forEach(c => {
        if (!couponsByDate[c.date]) couponsByDate[c.date] = [];
        couponsByDate[c.date].push(c);
    });

    let uniqueDatesSorted = Object.keys(couponsByDate).sort((a, b) => new Date(a) - new Date(b));

    for (let i = 1; i <= config.durationDays; i++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";

        let dateForThisDay = uniqueDatesSorted[i - 1];

        if (dateForThisDay) {
            cell.classList.add("completed");
            let dayCoupons = couponsByDate[dateForThisDay];
            
            let dotsHtml = '<div class="coupon-dot-indicator">';
            dayCoupons.forEach(cp => {
                let dotClass = cp.type === "SAFE" ? "safe" : "fun";
                dotsHtml += `<span class="dot ${dotClass}"></span>`;
            });
            dotsHtml += '</div>';

            cell.innerHTML = `<span class="day-nr">J${i}</span>${dotsHtml}`;
            cell.title = `${dateForThisDay} : ${dayCoupons.length} coupon(s)`;
        } else {
            if (i === uniqueDatesSorted.length + 1) {
                cell.classList.add("active-day");
            }
            cell.innerHTML = `<span class="day-nr">J${i}</span>`;
        }

        grid.appendChild(cell);
    }
}

function renderChart() {
    const svg = document.getElementById("main-chart");
    if (!svg) return;
    svg.innerHTML = "";

    if (coupons.length === 0) {
        svg.innerHTML = `<text x="250" y="75" text-anchor="middle" fill="var(--text-muted)" font-size="12">Aucune donnée disponible</text>`;
        return;
    }

    let current = config.initialCapital;
    let capitalPoints = [current];

    coupons.forEach(cp => {
        if (cp.result === "Gagné") {
            current += (cp.stake * cp.odds) - cp.stake;
        } else {
            current -= cp.stake;
        }
        capitalPoints.push(current);
    });

    let width = 500;
    let height = 150;
    let padding = 15;

    let maxVal = Math.max(...capitalPoints, config.initialCapital);
    let minVal = Math.min(...capitalPoints, config.initialCapital);

    if (maxVal === minVal) {
        maxVal += 5000;
        minVal -= 5000;
    }

    let valRange = (maxVal - minVal) * 1.1;
    let midVal = (maxVal + minVal) / 2;
    let adjustedMin = midVal - valRange / 2;
    let adjustedMax = midVal + valRange / 2;

    let coords = capitalPoints.map((val, idx) => {
        let x = padding + (idx / (capitalPoints.length - 1)) * (width - padding * 2);
        let y = height - padding - ((val - adjustedMin) / (adjustedMax - adjustedMin)) * (height - padding * 2);
        return { x, y, value: val };
    });

    let defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--primary-color, #2563eb)" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="var(--primary-color, #2563eb)" stop-opacity="0.00"/>
        </linearGradient>
    `;
    svg.appendChild(defs);

    let startY = height - padding - ((config.initialCapital - adjustedMin) / (adjustedMax - adjustedMin)) * (height - padding * 2);
    let baseLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    baseLine.setAttribute("x1", padding);
    baseLine.setAttribute("y1", startY);
    baseLine.setAttribute("x2", width - padding);
    baseLine.setAttribute("y2", startY);
    baseLine.setAttribute("stroke", "#94a3b8");
    baseLine.setAttribute("stroke-dasharray", "4,4");
    baseLine.setAttribute("stroke-width", "1");
    baseLine.setAttribute("opacity", "0.5");
    svg.appendChild(baseLine);

    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
        pathD += ` L ${coords[i].x} ${coords[i].y}`;
    }

    let polyline = document.createElementNS("http://www.w3.org/2000/svg", "path");
    polyline.setAttribute("d", pathD);
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "var(--primary-color, #2563eb)");
    polyline.setAttribute("stroke-width", "3");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");
    svg.appendChild(polyline);

    let areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;
    let areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    areaPath.setAttribute("d", areaD);
    areaPath.setAttribute("fill", "url(#chart-gradient)");
    svg.appendChild(areaPath);

    coords.forEach((pt, idx) => {
        if (coords.length < 15 || idx === 0 || idx === coords.length - 1 || idx % Math.floor(coords.length / 5) === 0) {
            let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", pt.x);
            circle.setAttribute("cy", pt.y);
            circle.setAttribute("r", "4");
            circle.setAttribute("fill", idx === coords.length - 1 ? "var(--success-color, #10b981)" : "#ffffff");
            circle.setAttribute("stroke", "var(--primary-color, #2563eb)");
            circle.setAttribute("stroke-width", "2");

            let title = document.createElementNS("http://www.w3.org/2000/svg", "title");
            title.textContent = `Étape ${idx} : ${Math.round(pt.value)} F CFA`;
            circle.appendChild(title);

            svg.appendChild(circle);
        }
    });
}

function renderHistory(filterType) {
    const list = document.getElementById("coupons-history-list");
    if (!list) return;
    list.innerHTML = "";

    let filtered = [...coupons].reverse();

    if (filterType !== "all") {
        if (filterType === "SAFE" || filterType === "FUN") {
            filtered = filtered.filter(c => c.type === filterType);
        } else {
            filtered = filtered.filter(c => c.result === filterType);
        }
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state">Aucun coupon ne correspond.</div>`;
        return;
    }

    filtered.forEach(cp => {
        const card = document.createElement("div");
        card.className = `coupon-card type-${cp.type.toLowerCase()}`;
        
        let optionsText = "Aucune option spécifiée";
        if (cp.matches && cp.matches.length > 0) {
            optionsText = cp.matches.map(m => `${m.name} (${m.status})`).join(" + ");
        }

        // CORRECTION ICI : Si gagné, affiche le gain complet (Mise * Cote) au lieu du gain net (-mise)
        let gainText = cp.result === "Gagné" ? `+${(cp.stake * cp.odds).toFixed(0)} F` : `-${cp.stake} F`;
        let gainClass = cp.result === "Gagné" ? "text-success" : "text-danger";

        card.innerHTML = `
            <div class="card-top">
                <span class="card-date">${formatDateStr(cp.date)}</span>
                <div class="combo-markets">${optionsText}</div>
                <div style="margin-top: 4px;">
                    <span class="badge badge-${cp.type.toLowerCase()}">${cp.type}</span>
                    <span class="badge badge-${cp.result === 'Gagné' ? 'won' : 'lost'}">${cp.result}</span>
                </div>
            </div>
            <div class="card-main-info">
                <div class="info-item"><span class="label">COTE</span><span class="val">${cp.odds.toFixed(3)}</span></div>
                <div class="info-item"><span class="label">MISE</span><span class="val">${cp.stake} F</span></div>
                <div class="info-item"><span class="label">GAIN RETOUR</span><span class="val ${gainClass}">${gainText}</span></div>
            </div>
            <div class="card-actions" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                <button class="btn-icon edit" onclick="editCoupon('${cp.id}')" title="Modifier" style="color: var(--primary-color); background: rgba(59, 130, 246, 0.1); border: none; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer;"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="deleteCoupon('${cp.id}')" title="Supprimer" style="color: var(--danger-color); background: rgba(239, 68, 68, 0.1); border: none; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer;"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        list.appendChild(card);
    });
}

// ==========================================================================
// ACTIONS DE SAISIE, MODIFICATION ET PERSISTANCE
// ==========================================================================
function editCoupon(id) {
    const coupon = coupons.find(c => c.id === id);
    if (!coupon) return;

    editingCouponId = id;

    document.getElementById("coupon-date").value = coupon.date;
    document.getElementById("coupon-type").value = coupon.type;
    document.getElementById("coupon-odds").value = coupon.odds;
    document.getElementById("coupon-stake").value = coupon.stake;

    const radioResult = document.querySelector(`input[name="coupon-result"][value="${coupon.result}"]`);
    if (radioResult) radioResult.checked = true;

    toggleMatchSelectors();

    if (coupon.type !== "FUN" && coupon.matches) {
        coupon.matches.forEach((m, idx) => {
            let matchNr = idx + 1;
            let optSelect = document.querySelector(`.match-option-select[data-match="${matchNr}"]`);
            let statSelect = document.querySelector(`.match-status-select[data-match="${matchNr}"]`);
            if (optSelect) optSelect.value = m.name;
            if (statSelect) statSelect.value = m.status;
        });
    }

    const submitBtn = document.querySelector("#coupon-form button[type='submit']");
    if (submitBtn) {
        submitBtn.innerHTML = `<i class="fas fa-save"></i> Mettre à jour le Coupon`;
        submitBtn.style.background = "var(--primary-color)";
    }

    const formContent = document.getElementById("form-coupon-content");
    if (formContent && formContent.classList.contains("collapsed")) {
        formContent.classList.remove("collapsed");
        const triggerIcon = document.querySelector("#toggle-form-coupon .btn-toggle-icon i");
        if (triggerIcon) triggerIcon.classList.remove("rotated");
    }

    document.getElementById("toggle-form-coupon").scrollIntoView({ behavior: 'smooth' });
}

function saveCoupon() {
    const date = document.getElementById("coupon-date").value;
    const type = document.getElementById("coupon-type").value;
    const odds = parseFloat(document.getElementById("coupon-odds").value);
    const stake = parseFloat(document.getElementById("coupon-stake").value) || config.defaultStake;
    const resultElement = document.querySelector('input[name="coupon-result"]:checked');
    const result = resultElement ? resultElement.value : "Gagné";

    let matches = [];
    if (type !== "FUN") {
        for (let i = 1; i <= 3; i++) {
            let optSelect = document.querySelector(`.match-option-select[data-match="${i}"]`);
            let statSelect = document.querySelector(`.match-status-select[data-match="${i}"]`);
            if (optSelect && optSelect.value) {
                matches.push({
                    name: optSelect.value,
                    status: statSelect ? statSelect.value : "Gagné"
                });
            }
        }
    }

    if (editingCouponId) {
        const index = coupons.findIndex(c => c.id === editingCouponId);
        if (index !== -1) {
            coupons[index] = { id: editingCouponId, date, type, odds, stake, result, matches };
        }
        editingCouponId = null;
        
        const submitBtn = document.querySelector("#coupon-form button[type='submit']");
        if (submitBtn) submitBtn.innerHTML = `<i class="fas fa-plus-circle"></i> Ajouter au Historique`;
    } else {
        const id = Date.now().toString();
        const newCoupon = { id, date, type, odds, stake, result, matches };
        coupons.push(newCoupon);
    }
    
    saveData();
    updateDashboard();

    document.getElementById("coupon-odds").value = "";
    document.querySelectorAll(".match-option-select").forEach(s => s.value = "");
    
    toggleMatchSelectors();
    setDefaultDate();
}

function deleteCoupon(id) {
    if (confirm("Supprimer ce coupon définitivement ?")) {
        if (editingCouponId === id) {
            editingCouponId = null;
            const submitBtn = document.querySelector("#coupon-form button[type='submit']");
            if (submitBtn) submitBtn.innerHTML = `<i class="fas fa-plus-circle"></i> Ajouter au Historique`;
        }
        coupons = coupons.filter(c => c.id !== id);
        saveData();
        updateDashboard();
    }
}

function saveData() {
    localStorage.setItem("bet_tracker_coupons", JSON.stringify(coupons));
    localStorage.setItem("bet_tracker_config", JSON.stringify(config));
}

function loadData() {
    const savedCoupons = localStorage.getItem("bet_tracker_coupons");
    const savedConfig = localStorage.getItem("bet_tracker_config");

    if (savedCoupons) coupons = JSON.parse(savedCoupons);
    if (savedConfig) {
        config = JSON.parse(savedConfig);
        if(document.getElementById("param-initial-capital")) document.getElementById("param-initial-capital").value = config.initialCapital;
        if(document.getElementById("param-target-capital")) document.getElementById("param-target-capital").value = config.targetCapital;
        if(document.getElementById("param-duration")) document.getElementById("param-duration").value = config.durationDays;
    }
}

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ config, coupons }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bettracker_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importData(e) {
    const fileReader = new FileReader();
    fileReader.onload = function (event) {
        try {
            const parsed = JSON.parse(event.target.result);
            if (parsed.config) config = parsed.config;
            if (parsed.coupons) coupons = parsed.coupons;
            saveData();
            updateDashboard();
            alert("Données importées avec succès !");
        } catch (err) {
            alert("Erreur lors de la lecture du fichier JSON.");
        }
    };
    if (e.target.files[0]) {
        fileReader.readAsText(e.target.files[0]);
    }
}

function formatDateStr(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

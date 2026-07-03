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

// Fonction corrigée pour afficher/masquer les matchs selon le type de gestion
function toggleMatchSelectors() {
    const typeSelect = document.getElementById("coupon-type");
    const matchBlock = document.querySelector(".match-selectors-block");
    
    if (!typeSelect || !matchBlock) return;

    if (typeSelect.value === "FUN") {
        matchBlock.style.display = "none";
        // Réinitialise les sélections quand on masque
        document.querySelectorAll(".match-option-select").forEach(s => s.value = "");
    } else {
        matchBlock.style.display = "flex"; // <-- Correction ici (un seul .style)
    }
}

function setupEventListeners() {
    // Écouteur sur le changement de type (SAFE / FUN)
    document.getElementById("coupon-type").addEventListener("change", toggleMatchSelectors);

    // Thème toggle
    document.getElementById("theme-toggle").addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("bet-tracker-theme", newTheme);
        document.querySelector("#theme-toggle i").className = newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
    });

    // Sections pliables / Accordéons
    setupCollapsible("toggle-form-coupon", "form-coupon-content");
    setupCollapsible("toggle-params", "params-content");
    setupCollapsible("toggle-matrix", "matrix-content");

    // Formulaire d'ajout de coupon
    document.getElementById("coupon-form").addEventListener("submit", (e) => {
        e.preventDefault();
        saveCoupon();
    });

    // Formulaire de configuration
    document.getElementById("btn-save-config").addEventListener("click", () => {
        config.initialCapital = parseFloat(document.getElementById("param-initial-capital").value) || 30000;
        config.targetCapital = parseFloat(document.getElementById("param-target-capital").value) || 150000;
        config.durationDays = parseInt(document.getElementById("param-duration").value) || 30;
        saveData();
        updateDashboard();
        alert("Configuration mise à jour avec succès !");
    });

    // Bouton de réinitialisation complète
    document.getElementById("btn-reset").addEventListener("click", () => {
        if (confirm("Attention ! Es-tu sûr de vouloir réinitialiser tout le challenge ? Toutes les données seront perdues.")) {
            coupons = [];
            localStorage.removeItem("bet_tracker_coupons");
            updateDashboard();
        }
    });

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
    document.getElementById("btn-export").addEventListener("click", exportData);
    document.getElementById("btn-import-trigger").addEventListener("click", () => {
        document.getElementById("file-import").click();
    });
    document.getElementById("file-import").addEventListener("change", importData);
}

function setupCollapsible(triggerId, contentId) {
    const trigger = document.getElementById(triggerId);
    const content = document.getElementById(contentId);
    if (!trigger || !content) return;

    trigger.addEventListener("click", () => {
        content.classList.toggle("collapsed");
        const icon = trigger.querySelector(".btn-toggle-icon i");
        if (icon) icon.classList.toggle("rotated");
    });
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("coupon-date").value = today;
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
            let gainNet = (cp.stake * cp.odds) - cp.stake;
            currentCapital += gainNet;
            if (gainNet > maxNetGain) maxNetGain = gainNet;
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

    document.getElementById("kpi-capital").innerText = currentCapital.toFixed(0) + " F CFA";
    document.getElementById("kpi-initial-label").innerText = "Départ: " + config.initialCapital + " F";
    
    const profitEl = document.getElementById("kpi-profit");
    if (profitTotal >= 0) {
        profitEl.innerText = "+" + profitTotal.toFixed(0) + " F CFA";
        profitEl.className = "text-success";
    } else {
        profitEl.innerText = profitTotal.toFixed(0) + " F CFA";
        profitEl.className = "text-danger";
    }
    
    document.getElementById("kpi-roi").innerText = "ROI: " + roi.toFixed(1) + "%";
    document.getElementById("kpi-target").innerText = config.targetCapital + " F CFA";
    document.getElementById("kpi-progress-percent").innerText = "Progression: " + progressPercent.toFixed(1) + "%";
    document.getElementById("kpi-winrate").innerText = winRate.toFixed(1) + "%";
    document.getElementById("kpi-coupons-count").innerText = `${totalWins} V / ${totalLosses} D (Total: ${coupons.length})`;

    let distinctDaysCount = new Set(coupons.map(c => c.date)).size;
    let dayProgressPercent = Math.min((distinctDaysCount / config.durationDays) * 100, 100);
    document.getElementById("progress-day-label").innerText = `Jour ${distinctDaysCount} sur ${config.durationDays}`;
    document.getElementById("progress-time-percent").innerText = `${dayProgressPercent.toFixed(0)}% du temps validé`;
    document.getElementById("progress-bar-fill").style.width = dayProgressPercent + "%";

    document.getElementById("stat-safe-count").innerText = safeCount;
    document.getElementById("stat-fun-count").innerText = funCount;
    document.getElementById("stat-best-odds").innerText = bestOdds.toFixed(3);
    document.getElementById("stat-max-stake").innerText = maxStake.toFixed(0) + " F";
    document.getElementById("stat-max-gain").innerText = maxNetGain.toFixed(0) + " F";
    document.getElementById("stat-total-volume").innerText = totalStaked.toFixed(0) + " F";
    document.getElementById("stat-streak-win").innerText = maxWinStreak;
    document.getElementById("stat-streak-loss").innerText = maxLossStreak;

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
    svg.innerHTML = "";

    if (coupons.length === 0) {
        svg.innerHTML = `<text x="250" y="75" text-anchor="middle" fill="var(--text-muted)" font-size="12">Aucune donnée disponible</text>`;
        return;
    }

    let capitalPoints = [config.initialCapital];
    let current = config.initialCapital;
    coupons.forEach(cp => {
        if (cp.result === "Gagné") {
            current += (cp.stake * cp.odds) - cp.stake;
        } else {
            current -= cp.stake;
        }
        capitalPoints.push(current);
    });

    let maxVal = Math.max(...capitalPoints, config.targetCapital) * 1.1;
    let minVal = Math.min(...capitalPoints, config.initialCapital) * 0.9;
    if (minVal < 0) minVal = 0;

    let width = 500;
    let height = 150;
    let padding = 20;

    let pointsStr = "";

    capitalPoints.forEach((val, idx) => {
        let x = padding + (idx / (capitalPoints.length - 1)) * (width - padding * 2);
        let y = height - padding - ((val - minVal) / (maxVal - minVal)) * (height - padding * 2);
        pointsStr += `${x},${y} `;
        
        if (idx === 0 || idx === capitalPoints.length - 1) {
            let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", "4");
            circle.setAttribute("fill", idx === 0 ? "var(--text-muted)" : "var(--success-color)");
            svg.appendChild(circle);
        }
    });

    let polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", pointsStr);
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "var(--primary-color)");
    polyline.setAttribute("stroke-width", "3");
    svg.appendChild(polyline);

    let targetY = height - padding - ((config.targetCapital - minVal) / (maxVal - minVal)) * (height - padding * 2);
    if (targetY >= 0 && targetY <= height) {
        let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", padding);
        line.setAttribute("y1", targetY);
        line.setAttribute("x2", width - padding);
        line.setAttribute("y2", targetY);
        line.setAttribute("stroke", "var(--danger-color)");
        line.setAttribute("stroke-dasharray", "4,4");
        line.setAttribute("stroke-width", "1");
        svg.appendChild(line);
    }
}

function renderHistory(filterType) {
    const list = document.getElementById("coupons-history-list");
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

        let gainText = cp.result === "Gagné" ? `+${((cp.stake * cp.odds) - cp.stake).toFixed(0)} F` : `-${cp.stake} F`;
        let gainClass = cp.result === "Gagné" ? "text-success" : "text-danger";

        card.innerHTML = `
            <div class="card-top">
                <span class="card-date">${formatDateStr(cp.date)}</span>
                <div class="combo-markets">${optionsText}</div>
                <div>
                    <span class="badge badge-${cp.type.toLowerCase()}">${cp.type}</span>
                    <span class="badge badge-${cp.result === 'Gagné' ? 'won' : 'lost'}">${cp.result}</span>
                </div>
            </div>
            <div class="card-main-info">
                <div class="info-item"><span class="label">COTE</span><span class="val">${cp.odds.toFixed(3)}</span></div>
                <div class="info-item"><span class="label">MISE</span><span class="val">${cp.stake} F</span></div>
                <div class="info-item"><span class="label">BILAN NET</span><span class="val ${gainClass}">${gainText}</span></div>
            </div>
            <div class="card-actions">
                <button class="btn-icon delete" onclick="deleteCoupon('${cp.id}')" title="Supprimer"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        list.appendChild(card);
    });
}

// ==========================================================================
// ACTIONS DE SAISIE ET PERSISTANCE
// ==========================================================================
function saveCoupon() {
    const id = Date.now().toString();
    const date = document.getElementById("coupon-date").value;
    const type = document.getElementById("coupon-type").value;
    const odds = parseFloat(document.getElementById("coupon-odds").value);
    const stake = parseFloat(document.getElementById("coupon-stake").value) || config.defaultStake;
    const result = document.querySelector('input[name="coupon-result"]:checked').value;

    let matches = [];
    // On ne récupère les matchs que si on n'est pas en mode FUN
    if (type !== "FUN") {
        for (let i = 1; i <= 3; i++) {
            let optSelect = document.querySelector(`.match-option-select[data-match="${i}"]`);
            let statSelect = document.querySelector(`.match-status-select[data-match="${i}"]`);
            if (optSelect && optSelect.value) {
                matches.push({
                    name: optSelect.value,
                    status: statSelect.value
                });
            }
        }
    }

    const newCoupon = { id, date, type, odds, stake, result, matches };
    coupons.push(newCoupon);
    
    saveData();
    updateDashboard();

    document.getElementById("coupon-odds").value = "";
    document.querySelectorAll(".match-option-select").forEach(s => s.value = "");
    
    // Rétablir l'affichage de base si nécessaire
    toggleMatchSelectors();
    setDefaultDate();
}

function deleteCoupon(id) {
    if (confirm("Supprimer ce coupon définitivement ?")) {
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
        document.getElementById("param-initial-capital").value = config.initialCapital;
        document.getElementById("param-target-capital").value = config.targetCapital;
        document.getElementById("param-duration").value = config.durationDays;
    }
}

// Export & Import
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

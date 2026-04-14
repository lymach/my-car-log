const STORAGE_KEY = 'carLogApp_data_v1';

const defaultData = {
    currentOdo: 0,
    logs: [], // { id, type, date, odo, val1, val2, memo }
    settings: {
        insuranceDate: '',
        specs: {
            wiper: '운전석 650mm / 조수석 400mm',
            oil: '1.6 터보 전용 4.8L (초저점도 0W-20)',
            tireSize: '215/60 R17',
            tirePress: '전후륜 36 psi (승차감)~ 38 psi (연비)',
            filter: '코나 SX2 전용 규격'
        }
    }
};

let carData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData;
if (!carData.logs) carData.logs = [];
if (!carData.settings.specs) {
    carData.settings.specs = defaultData.settings.specs; // Migration for existing users
} else {
    // Force specific requested updates for existing users
    carData.settings.specs.oil = '1.6 터보 전용 4.8L (초저점도 0W-20)';
    carData.settings.specs.tireSize = '215/60 R17';
}

const app = {
    init() {
        ui.init();
        this.refreshDashboard();
        this.renderSettings();
    },

    saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(carData));
        this.refreshDashboard();
    },

    refreshDashboard() {
        document.getElementById('dash-odo-value').innerText = carData.currentOdo.toLocaleString();
        
        const fuels = carData.logs.filter(l => l.type === 'fuel').sort((a,b) => new Date(b.date) - new Date(a.date));
        const washes = carData.logs.filter(l => l.type === 'wash').sort((a,b) => new Date(b.date) - new Date(a.date));
        
        document.getElementById('dash-last-fuel').innerText = fuels.length ? fuels[0].date : '-';
        document.getElementById('dash-last-wash').innerText = washes.length ? washes[0].date : '-';

        // Fuel Economy Calculation Component
        const feContainer = document.getElementById('dash-fe-container');
        const feValueBox = document.getElementById('dash-fe-value');
        if (fuels.length >= 2) {
            // Calculate FE based on the most recent two fuel logs assuming it was fully filled
            const latestFuel = fuels[0];
            const prevFuel = fuels[1];
            
            // To be accurate, we assume val2 is the liters pumped in the *latestFuel*.
            // Wait, the distance covered is `latestFuel.odo - prevFuel.odo`
            // The gas burned is approx the liters pumped at `latestFuel` if filling up full each time.
            let dist = Number(latestFuel.odo) - Number(prevFuel.odo);
            let liters = Number(latestFuel.val2);
            if (liters > 0 && dist > 0) {
                let fe = (dist / liters).toFixed(1);
                feValueBox.innerText = fe;
                feContainer.style.display = 'block';
            } else {
                feContainer.style.display = 'none';
            }
        } else {
            feContainer.style.display = 'none';
        }

        this.checkMaintenanceAlerts();
        this.renderLogs('all');
    },

    checkMaintenanceAlerts() {
        const container = document.getElementById('dash-alerts');
        container.innerHTML = '';
        let alerts = [];

        const maintIntervals = {
            'oil': { dist: 10000, name: '엔진오일', icon: 'oil_barrel' },
            'filter': { dist: 10000, name: '에어컨 필터', icon: 'air_purifier' },
            'brake_pad': { dist: 40000, name: '브레이크 패드', icon: 'stop_circle' },
            'tire': { dist: 50000, name: '타이어', icon: 'tire_repair' },
            'mission': { dist: 80000, name: '미션 오일', icon: 'settings' }
        };

        Object.keys(maintIntervals).forEach(key => {
            let lastLog = carData.logs.filter(l => l.type === 'maint' && l.val1 === key).sort((a,b) => b.odo - a.odo)[0];
            let itemDef = maintIntervals[key];
            
            if (lastLog) {
                let due = Number(lastLog.odo) + itemDef.dist;
                let left = due - carData.currentOdo;
                if (left <= itemDef.dist * 0.1 && left >= 0) {
                    alerts.push({ type: 'danger', text: `${itemDef.name} 교체 임박 (${left.toLocaleString()}km 남음)`, icon: itemDef.icon });
                } else if (left < 0) {
                    alerts.push({ type: 'danger', text: `${itemDef.name} 교체 필요! (주기 초과)`, icon: itemDef.icon });
                } else if (left <= itemDef.dist * 0.2) {
                    alerts.push({ type: 'warning', text: `${itemDef.name} 점검 준비 (${left.toLocaleString()}km 남음)`, icon: itemDef.icon });
                }
            } else {
                if(key === 'oil') alerts.push({ type: 'warning', text: `기록이 없어요. 현재 주행거리에 맞춰 ${itemDef.name}을 점검하세요.`, icon: itemDef.icon });
            }
        });

        if (carData.settings.insuranceDate) {
            let insDate = new Date(carData.settings.insuranceDate);
            let today = new Date();
            let daysLeft = Math.ceil((insDate - today) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 30 && daysLeft >= 0) {
                alerts.push({ type: 'warning', text: `차량 보험 갱신 임박 (D-${daysLeft})`, icon: 'shield' });
            }
        }

        if (alerts.length === 0) {
            container.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">check_circle</span><p>현재 상태가 아주 좋습니다.</p></div>`;
        } else {
            alerts.forEach(a => {
                container.innerHTML += `
                    <div class="alert-item ${a.type}">
                        <span class="material-symbols-rounded alert-icon">${a.icon}</span>
                        <div class="alert-content">
                            <h4>${a.type === 'danger' ? '긴급' : '알림'}</h4>
                            <p>${a.text}</p>
                        </div>
                    </div>
                `;
            });
        }
    },

    renderLogs(filterType) {
        const list = document.getElementById('logs-timeline');
        list.innerHTML = '';
        
        let filtered = carData.logs.filter(l => filterType === 'all' || l.type === filterType);
        filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        if(filtered.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:var(--text-sub); margin-top:40px;">기록이 없습니다.</p>`;
            return;
        }

        filtered.forEach(l => {
            let title = '';
            let valStr = '';
            let valColor = '';
            let secondLine = '';
            
            if (l.type === 'fuel') { 
                title = '주유'; 
                valStr = Number(l.val1).toLocaleString() + '원';
                if(l.val2) secondLine = `<span class="log-memo">주유량: ${l.val2} L</span>`;
            }
            if (l.type === 'wash') { 
                title = '세차 (' + (l.val1 === 'auto' ? '자동' : l.val1 === 'hand' ? '손세차' : '노터치') + ')'; 
            }
            if (l.type === 'maint') { 
                const maintLabels = {
                    'oil': '엔진오일', 'filter': '에어컨 필터', 'wiper': '와이퍼',
                    'brake_pad': '브레이크 패드', 'brake_oil': '브레이크 오일', 'antifreeze': '냉각수/부동액',
                    'tire_rot': '타이어 위치교환', 'tire': '타이어 교체', 'mission': '미션 오일',
                    'spark': '점화플러그', 'battery': '배터리', 'etc': '기타 정비'
                };
                title = '정비 (' + (maintLabels[l.val1] || '기타') + ')'; 
                if(l.val2) valStr = Number(l.val2).toLocaleString() + '원';
            }
            
            list.innerHTML += `
                <div class="log-item ${l.type}">
                    <div class="log-left">
                        <span class="log-date">${l.date} | ODO: ${Number(l.odo).toLocaleString()}km</span>
                        <span class="log-title">${title}</span>
                        ${secondLine}
                        ${l.memo ? `<span class="log-memo">${l.memo}</span>` : ''}
                    </div>
                    <div class="log-right">
                        <span class="log-value">${valStr}</span>
                    </div>
                </div>
            `;
        });
    },

    renderStats() {
        const container = document.getElementById('chart-monthly-container');
        const summary = document.getElementById('stats-summary-list');
        container.innerHTML = '';
        summary.innerHTML = '';

        if(carData.logs.length === 0) {
            container.innerHTML = '<p class="sub-text" style="text-align:center;">기록이 충분하지 않습니다.</p>';
            return;
        }

        // Group by month (YYYY-MM)
        let monthlyTotal = {};
        let grandTotal = { fuel: 0, maint: 0 };
        
        carData.logs.forEach(l => {
            let ym = l.date.substring(0, 7); // '2026-04'
            if(!monthlyTotal[ym]) monthlyTotal[ym] = 0;
            
            let cost = 0;
            if(l.type === 'fuel' && l.val1) cost = Number(l.val1);
            if(l.type === 'maint' && l.val2) cost = Number(l.val2);
            
            monthlyTotal[ym] += cost;

            if(l.type === 'fuel') grandTotal.fuel += cost;
            if(l.type === 'maint') grandTotal.maint += cost;
        });

        // Convert to array and sort to show last 5 months
        let sortedMonths = Object.keys(monthlyTotal).sort();
        let last5 = sortedMonths.slice(-5);
        let maxMonth = Math.max(...last5.map(m => monthlyTotal[m]), 1);

        last5.forEach(ym => {
            let labelMonth = ym.substring(5, 7) + '월';
            let costWan = (monthlyTotal[ym] / 10000).toFixed(1);
            let heightPct = (monthlyTotal[ym] / maxMonth) * 100;

            container.innerHTML += `
                <div class="chart-bar-group">
                    <div class="chart-val">${costWan}</div>
                    <div class="chart-bar"><div class="chart-fill" style="height:${heightPct}%;"></div></div>
                    <div class="chart-label">${labelMonth}</div>
                </div>
            `;
        });

        summary.innerHTML = `
            <li style="display:flex; justify-content:space-between; margin-bottom: 8px;"><span>총 주유비:</span> <strong>${grandTotal.fuel.toLocaleString()} 원</strong></li>
            <li style="display:flex; justify-content:space-between;"><span>총 정비비:</span> <strong>${grandTotal.maint.toLocaleString()} 원</strong></li>
        `;
    },

    handleRecordSubmit(e) {
        e.preventDefault();
        const type = document.querySelector('#add-record-type .active').dataset.val;
        const date = document.getElementById('input-date').value;
        const odo = document.getElementById('input-odo').value;
        const memo = document.getElementById('input-memo').value;
        
        let val1 = '';
        let val2 = '';

        if (type === 'fuel') {
            val1 = document.getElementById('input-fuel-amount').value || '';
            val2 = document.getElementById('input-fuel-liters').value || '';
        }
        if (type === 'wash') {
            val1 = document.getElementById('input-wash-type').value;
        }
        if (type === 'maint') {
            val1 = document.getElementById('input-maint-type').value;
            val2 = document.getElementById('input-maint-cost').value || '';
        }

        carData.logs.push({
            id: Date.now(), type, date, odo: Number(odo), val1, val2, memo
        });
        
        if (Number(odo) > carData.currentOdo) {
            carData.currentOdo = Number(odo);
        }
        
        this.saveData();
        ui.modals.close('modal-add-record');
        document.getElementById('form-add-record').reset();
    },

    handleOdoSubmit(e) {
        e.preventDefault();
        const newOdo = document.getElementById('input-simple-odo').value;
        if (Number(newOdo) > carData.currentOdo) {
            carData.currentOdo = Number(newOdo);
            this.saveData();
        }
        ui.modals.close('modal-odo');
        document.getElementById('input-simple-odo').value = '';
    },
    
    renderSettings() {
        if(carData.settings.insuranceDate) {
            document.getElementById('st-insurance-date').value = carData.settings.insuranceDate;
        }

        const sp = carData.settings.specs;
        const specsContainer = document.getElementById('st-specs-container');
        specsContainer.innerHTML = `
            <div class="input-group"><label>와이퍼</label><input type="text" id="sp-wiper" class="form-input" value="${sp.wiper}"></div>
            <div class="input-group"><label>엔진오일</label><input type="text" id="sp-oil" class="form-input" value="${sp.oil}"></div>
            <div class="input-group"><label>에어컨 필터</label><input type="text" id="sp-filter" class="form-input" value="${sp.filter}"></div>
            <div class="input-group"><label>타이어 규격</label><input type="text" id="sp-tireSize" class="form-input" value="${sp.tireSize}"></div>
            <div class="input-group"><label>통상 공기압</label><input type="text" id="sp-tirePress" class="form-input" value="${sp.tirePress}"></div>
        `;
    },
    
    saveSettings() {
        carData.settings.insuranceDate = document.getElementById('st-insurance-date').value;
        
        carData.settings.specs = {
            wiper: document.getElementById('sp-wiper').value,
            oil: document.getElementById('sp-oil').value,
            filter: document.getElementById('sp-filter').value,
            tireSize: document.getElementById('sp-tireSize').value,
            tirePress: document.getElementById('sp-tirePress').value
        };

        this.saveData();
        alert('설정이 저장되었습니다.');
    },

    exportData() {
        const dataStr = JSON.stringify(carData);
        let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        let exportFileDefaultName = 'myCarLog_backup.json';
        
        let linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    },

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const parsed = JSON.parse(e.target.result);
                if(parsed && parsed.logs) {
                    carData = parsed;
                    app.saveData();
                    alert('데이터 복원이 완료되었습니다.');
                }
            } catch(err) {
                alert('파일 형식이 잘못되었습니다.');
            }
        };
        reader.readAsText(file);
    },

    resetAllData() {
        if (confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            localStorage.removeItem(STORAGE_KEY);
            carData = JSON.parse(JSON.stringify(defaultData));
            this.refreshDashboard();
            alert('데이터가 초기화 되었습니다.');
        }
    }
};

const ui = {
    init() {
        this.setupNavigation();
        this.setupModals();
        this.setupDynamicForms();
        
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('input-date').value = today;
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-links .nav-item[data-view]');
        const views = document.querySelectorAll('.view-section');
        const viewTitle = document.getElementById('view-title');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if(item.classList.contains('disabled-visually')) return;

                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                
                const targetViewId = item.getAttribute('data-view');
                views.forEach(v => {
                    v.classList.remove('active');
                    if(v.id === targetViewId) v.classList.add('active');
                });
                
                if (targetViewId === 'view-dashboard') viewTitle.innerText = 'Dashboard';
                if (targetViewId === 'view-logs') {
                    viewTitle.innerText = '기록부';
                    app.renderLogs(document.querySelector('.pill-btn.active').dataset.filter);
                }
                if (targetViewId === 'view-stats') {
                    viewTitle.innerText = '유지비 통계';
                    app.renderStats();
                }
                if (targetViewId === 'view-settings') viewTitle.innerText = '설정 (차량 제원)';
            });
        });

        const pills = document.querySelectorAll('.pill-btn');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                app.renderLogs(pill.dataset.filter);
            });
        });
    },

    setupModals() {
        window.addEventListener('click', (e) => {
            if(e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });
    },

    modals: {
        open(id) {
            document.getElementById(id).classList.add('active');
            if(id === 'modal-add-record') {
                document.getElementById('input-odo').value = carData.currentOdo || '';
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('input-date').value = today;
            }
        },
        close(id) {
            document.getElementById(id).classList.remove('active');
        }
    },

    setupDynamicForms() {
        const segments = document.querySelectorAll('#add-record-type .segment');
        const container = document.getElementById('dynamic-form-fields');
        
        const changeFormType = (type) => {
            segments.forEach(s => s.classList.remove('active'));
            document.querySelector(`.segment[data-val="${type}"]`).classList.add('active');
            
            let html = '';
            if (type === 'fuel') {
                html = `
                    <div class="input-group">
                        <label>결제 금액 (원)</label>
                        <input type="number" id="input-fuel-amount" class="form-input" placeholder="예: 50000">
                    </div>
                    <div class="input-group">
                        <label>주유량 (L) <span class="required" style="font-weight:normal; font-size:11px;">*연비 계산을 위해 필수!</span></label>
                        <input type="number" step="0.01" id="input-fuel-liters" class="form-input" required placeholder="예: 30.5">
                    </div>
                `;
            } else if (type === 'wash') {
                html = `
                    <div class="input-group">
                        <label>세차 종류</label>
                        <select id="input-wash-type" class="form-input" style="appearance:none;">
                            <option value="auto">자동 세차</option>
                            <option value="hand">손세차 / 셀프세차</option>
                            <option value="notouch">노터치 세차</option>
                        </select>
                    </div>
                `;
            } else if (type === 'maint') {
                html = `
                    <div class="input-group">
                        <label>항목 분류</label>
                        <select id="input-maint-type" class="form-input" style="appearance:none;">
                            <option value="oil">엔진오일 세트 (보통 1만km)</option>
                            <option value="filter">에어컨/히터 필터 (보통 1만km)</option>
                            <option value="wiper">와이퍼 교체 (보통 1년)</option>
                            <option value="brake_pad">브레이크 패드 (보통 4만km)</option>
                            <option value="brake_oil">브레이크 오일 (보통 4만km)</option>
                            <option value="antifreeze">냉각수/부동액 (보통 4만km)</option>
                            <option value="tire_rot">타이어 위치 교환 (보통 1만km)</option>
                            <option value="tire">타이어 일괄 교체 (보통 5만km)</option>
                            <option value="mission">미션 오일 (보통 8만km)</option>
                            <option value="spark">점화 플러그 (보통 4만km)</option>
                            <option value="battery">배터리 교체 (보통 3~4년)</option>
                            <option value="etc">기타 정비 (수리/부품 교환)</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>지출 금액 (원)</label>
                        <input type="number" id="input-maint-cost" class="form-input" placeholder="통계 반영용 (선택사항)">
                    </div>
                `;
            }
            container.innerHTML = html;
        };

        changeFormType('fuel');

        segments.forEach(seg => {
            seg.addEventListener('click', (e) => {
                e.preventDefault();
                changeFormType(seg.dataset.val);
            });
        });
    }
};

window.onload = () => {
    app.init();
};

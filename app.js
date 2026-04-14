const STORAGE_KEY = 'carLogApp_data_v1';

const defaultData = {
    currentOdo: 0,
    logs: [], // { id, type, date, odo, val1, memo }
    settings: {
        insuranceDate: ''
    }
};

let carData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData;
if (!carData.logs) carData.logs = [];

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
        
        // Compute last fuel & wash
        const fuels = carData.logs.filter(l => l.type === 'fuel').sort((a,b) => new Date(b.date) - new Date(a.date));
        const washes = carData.logs.filter(l => l.type === 'wash').sort((a,b) => new Date(b.date) - new Date(a.date));
        
        document.getElementById('dash-last-fuel').innerText = fuels.length ? fuels[0].date : '-';
        document.getElementById('dash-last-wash').innerText = washes.length ? washes[0].date : '-';

        this.checkMaintenanceAlerts();
        this.renderLogs('all');
    },

    checkMaintenanceAlerts() {
        const container = document.getElementById('dash-alerts');
        container.innerHTML = '';
        let alerts = [];

        // Engine Oil and other maintenance checks
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
                    alerts.push({ type: 'danger', text: `${itemDef.name} 교체 시기 지남 (초과됨!)`, icon: itemDef.icon });
                } else if (left <= itemDef.dist * 0.2) {
                    alerts.push({ type: 'warning', text: `${itemDef.name} 점검/교체 준비 (${left.toLocaleString()}km 남음)`, icon: itemDef.icon });
                }
            } else {
                if(key === 'oil') alerts.push({ type: 'warning', text: `기록이 없습니다. 누적 주행거리에 맞춰 ${itemDef.name}을 점검하세요.`, icon: itemDef.icon });
            }
        });

        // Insurance Check
        if (carData.settings.insuranceDate) {
            let insDate = new Date(carData.settings.insuranceDate);
            let today = new Date();
            let daysLeft = Math.ceil((insDate - today) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 30 && daysLeft >= 0) {
                alerts.push({ type: 'warning', text: `자동차 보험 갱신 임박 (D-${daysLeft})`, icon: 'shield' });
            }
        }

        // Render Alerts
        if (alerts.length === 0) {
            container.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">check_circle</span><p>현재 상태가 아주 좋습니다.</p></div>`;
        } else {
            alerts.forEach(a => {
                container.innerHTML += `
                    <div class="alert-item ${a.type}">
                        <span class="material-symbols-rounded alert-icon">${a.icon}</span>
                        <div class="alert-content">
                            <h4>${a.type === 'danger' ? '긴급' : '확인 요망'}</h4>
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
        filtered.sort((a,b) => new Date(b.date) - new Date(a.date)); // Descending by date
        
        if(filtered.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:var(--text-sub); margin-top:40px;">기록이 없습니다.</p>`;
            return;
        }

        filtered.forEach(l => {
            let title = '';
            let valStr = '';
            
            if (l.type === 'fuel') { 
                title = '주유'; 
                valStr = Number(l.val1).toLocaleString() + '원'; 
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
                valStr = ''; 
            }
            
            list.innerHTML += `
                <div class="log-item ${l.type}">
                    <div class="log-left">
                        <span class="log-date">${l.date} | ODO: ${Number(l.odo).toLocaleString()}km</span>
                        <span class="log-title">${title}</span>
                        ${l.memo ? `<span class="log-memo">${l.memo}</span>` : ''}
                    </div>
                    <div class="log-right">
                        <span class="log-value">${valStr}</span>
                    </div>
                </div>
            `;
        });
    },

    handleRecordSubmit(e) {
        e.preventDefault();
        const type = document.querySelector('#add-record-type .active').dataset.val;
        const date = document.getElementById('input-date').value;
        const odo = document.getElementById('input-odo').value;
        const memo = document.getElementById('input-memo').value;
        
        let val1 = '';
        if (type === 'fuel') val1 = document.getElementById('input-fuel-amount').value;
        if (type === 'wash') val1 = document.getElementById('input-wash-type').value;
        if (type === 'maint') val1 = document.getElementById('input-maint-type').value;

        carData.logs.push({
            id: Date.now(), type, date, odo: Number(odo), val1, memo
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
    },
    
    saveSettings() {
        carData.settings.insuranceDate = document.getElementById('st-insurance-date').value;
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
        
        // init dates to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('input-date').value = today;
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-links .nav-item[data-view]');
        const views = document.querySelectorAll('.view-section');
        const viewTitle = document.getElementById('view-title');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Ignore if it's the disabled placeholder
                if(item.classList.contains('disabled-visually')) return;

                // Update tab styles
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                
                // Update views
                const targetViewId = item.getAttribute('data-view');
                views.forEach(v => {
                    v.classList.remove('active');
                    if(v.id === targetViewId) v.classList.add('active');
                });
                
                // Update Header
                if (targetViewId === 'view-dashboard') viewTitle.innerText = 'Dashboard';
                if (targetViewId === 'view-logs') {
                    viewTitle.innerText = '기록부';
                    app.renderLogs(document.querySelector('.pill-btn.active').dataset.filter);
                }
                if (targetViewId === 'view-settings') viewTitle.innerText = '설정';
            });
        });

        // Pill Filters in Log View
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
        // Pre-fill ODO on add record modal open
        window.addEventListener('click', (e) => {
            if(e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });
    },

    modals: {
        open(id) {
            document.getElementById(id).classList.add('active');
            // Auto fill current odo when opening add modal
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
                        <label>결제 금액 (원) <span class="required">*</span></label>
                        <input type="number" id="input-fuel-amount" class="form-input" required placeholder="예: 50000">
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
                `;
            }
            container.innerHTML = html;
        };

        // Init with fuel
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

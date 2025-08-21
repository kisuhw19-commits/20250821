// 훈련 데이터 분석 및 Firebase 연동 클래스
class TrainingDataAnalyzer {
    constructor() {
        this.db = null;
        this.currentAnalysisData = null;
        this.excludeColumns = APP_CONFIG.excludeColumns;
        
        this.initializeFirebase();
        this.initializeEventListeners();
    }

    /**
     * Firebase 초기화
     */
    async initializeFirebase() {
        try {
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            
            // 연결 테스트
            await this.db.collection('test').limit(1).get();
            this.updateFirebaseStatus(true);
        } catch (error) {
            console.error('Firebase 초기화 실패:', error);
            this.updateFirebaseStatus(false, error.message);
        }
    }

    /**
     * Firebase 연결 상태 업데이트
     */
    updateFirebaseStatus(connected, errorMessage = '') {
        const statusDiv = document.getElementById('firebaseStatus');
        if (connected) {
            statusDiv.className = 'firebase-status firebase-connected';
            statusDiv.textContent = '✅ Firebase 연결됨';
        } else {
            statusDiv.className = 'firebase-status firebase-disconnected';
            statusDiv.textContent = `❌ Firebase 연결 실패: ${errorMessage}`;
        }
    }

    /**
     * 이벤트 리스너 초기화
     */
    initializeEventListeners() {
        const fileInput = document.getElementById('csvFile');
        const uploadBtn = document.getElementById('uploadBtn');
        const saveBtn = document.getElementById('saveBtn');
        const loadBtn = document.getElementById('loadBtn');
        const clearBtn = document.getElementById('clearBtn');

        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        uploadBtn.addEventListener('click', this.handleUpload.bind(this));
        saveBtn.addEventListener('click', this.handleSave.bind(this));
        loadBtn.addEventListener('click', this.handleLoad.bind(this));
        clearBtn.addEventListener('click', this.handleClear.bind(this));
    }

    /**
     * 파일 선택 처리
     */
    handleFileSelect(event) {
        console.log("File select event triggered!");
        const file = event.target.files[0];
        const fileNameDiv = document.getElementById('fileName');
        
        if (file) {
            fileNameDiv.textContent = `선택된 파일: ${file.name} (${this.formatFileSize(file.size)})`;
            fileNameDiv.style.color = '#48bb78';
        } else {
            fileNameDiv.textContent = '';
        }
    }

    /**
     * 파일 크기 포맷팅
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 업로드 처리
     */
    async handleUpload() {
        const fileInput = document.getElementById('csvFile');
        const file = fileInput.files[0];

        if (!file) {
            this.showAlert('CSV 파일을 먼저 선택해주세요.', 'error');
            return;
        }

        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showAlert('CSV 파일만 업로드 가능합니다.', 'error');
            return;
        }

        this.showLoading(true, '파일을 읽고 있습니다...');
        this.clearOutput();

        try {
            const text = await this.readFileAsync(file);
            await this.processCSV(text);
        } catch (error) {
            this.handleError('파일 처리 중 오류가 발생했습니다.', error);
        }
    }

    /**
     * 저장 처리
     */
    async handleSave() {
        if (!this.currentAnalysisData) {
            this.showAlert('저장할 분석 데이터가 없습니다. 먼저 CSV 파일을 분석해주세요.', 'warning');
            return;
        }

        if (!this.db) {
            this.showAlert('Firebase가 연결되지 않았습니다.', 'error');
            return;
        }

        this.showLoading(true, '데이터베이스에 저장하고 있습니다...');

        try {
            await this.saveToFirestore(this.currentAnalysisData);
            this.showAlert('데이터가 성공적으로 저장되었습니다!', 'success');
        } catch (error) {
            this.handleError('데이터 저장 중 오류가 발생했습니다.', error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 로드 처리
     */
    async handleLoad() {
        if (!this.db) {
            this.showAlert('Firebase가 연결되지 않았습니다.', 'error');
            return;
        }

        this.showLoading(true, '저장된 데이터를 불러오고 있습니다...');

        try {
            const savedData = await this.loadFromFirestore();
            this.displaySavedData(savedData);
            if (savedData.length > 0) {
                this.showAlert(`${savedData.length}개의 저장된 기록을 불러왔습니다.`, 'success');
            } else {
                this.showAlert('저장된 데이터가 없습니다.', 'info');
            }
        } catch (error) {
            this.handleError('데이터 로드 중 오류가 발생했습니다.', error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 초기화 처리
     */
    handleClear() {
        document.getElementById('csvFile').value = '';
        document.getElementById('fileName').textContent = '';
        this.currentAnalysisData = null;
        this.clearOutput();
        this.showAlert('화면이 초기화되었습니다.', 'info');
    }

    /**
     * 파일 비동기 읽기
     */
    readFileAsync(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * CSV 처리
     */
    async processCSV(csvText) {
        try {
            this.showLoading(true, 'CSV 데이터를 파싱하고 있습니다...');
            
            const parseResult = Papa.parse(csvText, CSV_PARSE_CONFIG);

            if (parseResult.errors.length > 0) {
                console.warn('CSV 파싱 경고:', parseResult.errors);
            }

            const data = parseResult.data;
            
            if (data.length === 0) {
                throw new Error('CSV 파일에 데이터가 없습니다.');
            }

            this.showLoading(true, '데이터를 분석하고 있습니다...');
            await this.analyzeData(data);
            
        } catch (error) {
            this.handleError('CSV 파일 파싱 중 오류가 발생했습니다.', error);
        }
    }

    /**
     * 데이터 분석
     */
    async analyzeData(data) {
        try {
            const sessionColumn = this.findSessionColumn(data);
            if (!sessionColumn) {
                throw new Error('세션 이름 컬럼을 찾을 수 없습니다.');
            }

            const filteredData = data.filter(row => 
                row[sessionColumn] && 
                String(row[sessionColumn]).trim() !== ''
            );

            if (filteredData.length === 0) {
                throw new Error('유효한 세션 데이터가 없습니다.');
            }

            const groupedData = this.groupBySession(filteredData, sessionColumn);
            
            // 현재 분석 데이터 저장
            this.currentAnalysisData = {
                sessionColumn,
                groupedData,
                analyzedAt: new Date(),
                totalSessions: Object.keys(groupedData).length,
                totalRecords: filteredData.length
            };
            
            this.displayResults(groupedData, sessionColumn);
            this.showAlert(`성공적으로 ${Object.keys(groupedData).length}개의 세션 데이터를 분석했습니다.`, 'success');
            
        } catch (error) {
            this.handleError('데이터 분석 중 오류가 발생했습니다.', error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 세션 컬럼 찾기
     */
    findSessionColumn(data) {
        const headers = Object.keys(data[0] || {});
        
        return APP_CONFIG.sessionColumnNames.find(col => headers.includes(col)) || 
               headers.find(header => header.includes('세션') || header.toLowerCase().includes('session'));
    }

    /**
     * 세션별 그룹화
     */
    groupBySession(data, sessionColumn) {
        const grouped = {};
        
        data.forEach(row => {
            const sessionName = String(row[sessionColumn]).trim();
            if (!grouped[sessionName]) {
                grouped[sessionName] = [];
            }
            grouped[sessionName].push(row);
        });

        return grouped;
    }

    /**
     * Firestore에 저장
     */
    async saveToFirestore(analysisData) {
        const batch = this.db.batch();
        const collectionRef = this.db.collection(APP_CONFIG.firestoreCollection);

        for (const [sessionName, sessionRows] of Object.entries(analysisData.groupedData)) {
            const sessionStats = this.calculateSessionStats(sessionRows);
            
            const docRef = collectionRef.doc();
            batch.set(docRef, {
                sessionName: sessionName,
                rowCount: sessionStats.rowCount,
                averages: sessionStats.averages,
                rawData: sessionRows,
                analyzedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();
    }

    /**
     * Firestore에서 로드
     */
    async loadFromFirestore() {
        const querySnapshot = await this.db.collection(APP_CONFIG.firestoreCollection)
            .orderBy('createdAt', 'desc')
            .limit(APP_CONFIG.maxLoadRecords)
            .get();

        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    /**
     * Firestore에서 삭제
     */
    async deleteFromFirestore(docId) {
        await this.db.collection(APP_CONFIG.firestoreCollection).doc(docId).delete();
    }

    /**
     * 결과 표시
     */
    displayResults(groupedData, sessionColumn) {
        let resultsHtml = '<div class="results-section"><h2>📈 실시간 분석 결과</h2>';

        for (const [sessionName, sessionRows] of Object.entries(groupedData)) {
            const analysis = this.calculateSessionStats(sessionRows);
            
            resultsHtml += `
                <div class="session-group">
                    <div class="session-header">
                        <span>${sessionName}</span>
                        <span class="session-meta">데이터 수: ${sessionRows.length}개</span>
                    </div>
                    <div class="session-content">
                        ${this.createStatsTable(analysis, sessionName)}
                    </div>
                </div>
            `;
        }

        resultsHtml += '</div>';
        document.getElementById('output').innerHTML = resultsHtml;
    }

    /**
     * 저장된 데이터 표시
     */
    displaySavedData(savedData) {
        if (savedData.length === 0) {
            document.getElementById('output').innerHTML = '<div class="alert alert-info">저장된 데이터가 없습니다.</div>';
            return;
        }

        let historyHtml = '<div class="data-history"><h2>💾 저장된 훈련 데이터</h2>';

        // 날짜별로 그룹화
        const groupedByDate = {};
        savedData.forEach(record => {
            const date = record.createdAt ? 
                record.createdAt.toDate().toLocaleDateString('ko-KR') : 
                '날짜 정보 없음';
            
            if (!groupedByDate[date]) {
                groupedByDate[date] = [];
            }
            groupedByDate[date].push(record);
        });

        for (const [date, records] of Object.entries(groupedByDate)) {
            historyHtml += `<h3>📅 ${date}</h3>`;
            
            records.forEach(record => {
                const createdTime = record.createdAt ? 
                    record.createdAt.toDate().toLocaleTimeString('ko-KR') : 
                    '시간 정보 없음';

                historyHtml += `
                    <div class="history-item">
                        <div class="history-header">
                            <strong>${record.sessionName}</strong>
                            <div>
                                <span class="history-date">${createdTime}</span>
                                <button class="delete-btn" onclick="analyzer.deleteSavedData('${record.id}')">삭제</button>
                            </div>
                        </div>
                        ${this.createStatsTable({ averages: record.averages, rowCount: record.rowCount }, record.sessionName)}
                    </div>
                `;
            });
        }

        historyHtml += '</div>';
        document.getElementById('output').innerHTML = historyHtml;
    }

    /**
     * 저장된 데이터 삭제
     */
    async deleteSavedData(docId) {
        if (!confirm('이 데이터를 삭제하시겠습니까?')) {
            return;
        }

        try {
            this.showLoading(true, '데이터를 삭제하고 있습니다...');
            await this.deleteFromFirestore(docId);
            await this.handleLoad(); // 목록 새로고침
            this.showAlert('데이터가 삭제되었습니다.', 'success');
        } catch (error) {
            this.handleError('데이터 삭제 중 오류가 발생했습니다.', error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 세션 통계 계산
     */
    calculateSessionStats(sessionRows) {
        const numericStats = {};
        const rowCount = sessionRows.length;

        sessionRows.forEach(row => {
            Object.entries(row).forEach(([key, value]) => {
                if (this.excludeColumns.includes(key)) return;

                const numValue = this.parseNumber(value);
                if (!isNaN(numValue)) {
                    if (!numericStats[key]) {
                        numericStats[key] = { sum: 0, count: 0 };
                    }
                    numericStats[key].sum += numValue;
                    numericStats[key].count++;
                }
            });
        });

        const averages = {};
        Object.entries(numericStats).forEach(([key, stats]) => {
            if (stats.count > 0) {
                averages[key] = stats.sum / stats.count;
            }
        });

        return { averages, rowCount };
    }

    /**
     * 숫자 파싱
     */
    parseNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const cleanValue = value.replace(/[,\s]/g, '');
            return parseFloat(cleanValue);
        }
        return NaN;
    }

    /**
     * 통계 테이블 생성
     */
    createStatsTable(analysis, sessionName) {
        const { averages, rowCount } = analysis;
        
        if (Object.keys(averages).length === 0) {
            return '<p class="alert alert-info">분석 가능한 숫자 데이터가 없습니다.</p>';
        }

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>지표</th>
                        <th>평균값</th>
                        <th>단위</th>
                    </tr>
                </thead>
                <tbody>
        `;

        Object.entries(averages).forEach(([metric, average]) => {
            const formattedValue = this.formatMetricValue(metric, average);
            const unit = this.getMetricUnit(metric);
            
            tableHtml += `
                <tr>
                    <td>${metric}</td>
                    <td>${formattedValue}</td>
                    <td>${unit}</td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        return tableHtml;
    }

    /**
     * 지표 값 포맷팅
     */
    formatMetricValue(metric, value) {
        const shouldUseDecimal = APP_CONFIG.decimalMetrics.some(m => metric.includes(m));
        
        if (shouldUseDecimal) {
            return value.toFixed(1);
        } else {
            return Math.round(value).toLocaleString();
        }
    }

    /**
     * 지표 단위 가져오기
     */
    getMetricUnit(metric) {
        for (const [key, unit] of Object.entries(APP_CONFIG.metricUnits)) {
            if (metric.includes(key)) {
                return unit;
            }
        }
        return '';
    }

    /**
     * 알림 표시
     */
    showAlert(message, type = 'info') {
        const alertHtml = `<div class="alert alert-${type}">${message}</div>`;
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        document.querySelector('.upload-section').insertAdjacentHTML('afterend', alertHtml);
        
        // 자동 제거
        setTimeout(() => {
            const alert = document.querySelector('.alert');
            if (alert) alert.remove();
        }, APP_CONFIG.alertAutoRemoveTime);
    }

    /**
     * 로딩 상태 표시
     */
    showLoading(show, message = '처리 중...') {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loadingText');
        const uploadBtn = document.getElementById('uploadBtn');
        const saveBtn = document.getElementById('saveBtn');
        const loadBtn = document.getElementById('loadBtn');
        
        loading.style.display = show ? 'block' : 'none';
        if (show) {
            loadingText.textContent = message;
        }
        
        uploadBtn.disabled = show;
        saveBtn.disabled = show;
        loadBtn.disabled = show;
    }

    /**
     * 출력 영역 초기화
     */
    clearOutput() {
        document.getElementById('output').innerHTML = '';
        const alert = document.querySelector('.alert');
        if (alert) alert.remove();
    }

    /**
     * 에러 처리
     */
    handleError(message, error = null) {
        console.error('Error:', error);
        this.showAlert(message, 'error');
        this.showLoading(false);
    }
}

// 전역 변수로 analyzer 인스턴스 생성 (삭제 버튼에서 접근하기 위해)
let analyzer;

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    analyzer = new TrainingDataAnalyzer();
});

// 전역 함수 (HTML onclick에서 호출)
window.deleteSavedData = function(docId) {
    if (analyzer) {
        analyzer.deleteSavedData(docId);
    }
};
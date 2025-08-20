document.getElementById('uploadBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();

        reader.onload = function(e) {
            const text = e.target.result;
            processCSV(text);
        };

        reader.readAsText(file);
    } else {
        alert('Please select a CSV file to upload.');
    }
});

const firebaseConfig = {
    apiKey: "AIzaSyBkGJcDi549PMqkYE9kCUxbwuEgyTSEmkM",
    authDomain: "project-6457837950128637752.firebaseapp.com",
    projectId: "project-6457837950128637752",
    storageBucket: "project-6457837950128637752.firebasestorage.app",
    messagingSenderId: "796576141612",
    appId: "1:796576141612:web:d05fcbaa99e2f840209c89"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function processCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== ''); // Remove empty lines
    if (lines.length === 0) {
        document.getElementById('output').innerHTML = '<p>No data found in the CSV file.</p>';
        return;
    }

    const headers = lines[0].split(',').map(header => header.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(value => value.trim());
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }
    }

    console.log('Parsed Data:', data);

    // Filter out rows with empty '세션 타입'
    const filteredData = data.filter(row => row['세션 타입'] && row['세션 타입'].trim() !== '');
    console.log('Filtered Data (empty session type removed):', filteredData);

    // Columns to exclude from display (excluding '세션 이름' as it will be the row header)
    const excludeColumns = ['날짜', '액티비티 이름', '시작시간', '종료시간', '등번호', '세션 타입'];

    // Group by '세션 이름' and calculate averages
    const groupedData = {};
    filteredData.forEach(row => {
        const sessionName = row['세션 이름'];
        if (sessionName) {
            if (!groupedData[sessionName]) {
                groupedData[sessionName] = [];
            }
            groupedData[sessionName].push(row);
        }
    });
    console.log('Grouped Data:', groupedData);

    let analysisResultHtml = '<h2>Analysis Results:</h2>';

    for (const sessionName in groupedData) {
        const sessionRows = groupedData[sessionName];
        const numericColumns = {};
        let rowCount = 0;

        sessionRows.forEach(row => {
            rowCount++;
            for (const key in row) {
                // Try to convert to number, if successful, add to sum
                const value = parseFloat(row[key]);
                if (!isNaN(value)) {
                    if (!numericColumns[key]) {
                        numericColumns[key] = 0;
                    }
                    numericColumns[key] += value;
                }
            }
        });

        analysisResultHtml += `<h3>${sessionName} (Count: ${rowCount})</h3>`;
        analysisResultHtml += '<table border="1">';
        analysisResultHtml += '<tr><th>세션 이름</th>';
        const metrics = Object.keys(numericColumns).filter(metric => !excludeColumns.includes(metric));
        metrics.forEach(metric => {
            analysisResultHtml += `<th>${metric} (Avg)</th>`;
        });
        analysisResultHtml += '</tr>';

        analysisResultHtml += '<tr>';
        analysisResultHtml += `<td>${sessionName}</td>`;
        metrics.forEach(metric => {
            const average = numericColumns[metric] / rowCount;
            let formattedAverage = '';
            if (metric === '분당 뛴거리' || metric === '최고 속도') {
                formattedAverage = average.toFixed(1);
            } else {
                formattedAverage = Math.round(average);
            }
            analysisResultHtml += `<td>${formattedAverage}</td>`;
        });
        analysisResultHtml += '</tr>';

        analysisResultHtml += '</table>';
    }

    document.getElementById('output').innerHTML = analysisResultHtml;

    // Save data to Firestore
    saveDataToFirestore(groupedData);
}

function saveDataToFirestore(data) {
    const statusDiv = document.getElementById('output');
    statusDiv.innerHTML += '<p class="status-message">Saving data to database...</p>';

    const batch = db.batch();
    const collectionRef = db.collection('training_reports');
    let documentCount = 0;

    for (const sessionName in data) {
        const sessionRows = data[sessionName];
        const numericColumns = {};
        let rowCount = 0;

        sessionRows.forEach(row => {
            rowCount++;
            for (const key in row) {
                const value = parseFloat(row[key]);
                if (!isNaN(value)) {
                    if (!numericColumns[key]) {
                        numericColumns[key] = 0;
                    }
                    numericColumns[key] += value;
                }
            }
        });

        const averages = {};
        const excludeColumns = ['날짜', '액티비티 이름', '시작시간', '종료시간', '등번호', '세션 타입'];
        for (const metric in numericColumns) {
            if (!excludeColumns.includes(metric)) {
                const average = numericColumns[metric] / rowCount;
                averages[metric] = average;
            }
        }
        
        const docRef = collectionRef.doc(); // Automatically generate ID
        batch.set(docRef, {
            sessionName: sessionName,
            rowCount: rowCount,
            averages: averages,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        documentCount++;
    }

    if (documentCount > 0) {
        batch.commit().then(() => {
            statusDiv.innerHTML += '<p class="success-message">Data successfully saved to Firestore!</p>';
            console.log('Data successfully saved!');
        }).catch((error) => {
            statusDiv.innerHTML += `<p class="error-message">Error saving data: ${error.message}</p>`;
            console.error('Error writing document: ', error);
        });
    } else {
        statusDiv.innerHTML += '<p class="info-message">No data to save.</p>';
    }
}

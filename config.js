const firebaseConfig = {
  apiKey: "AIzaSyBkGJcDi549PMqkYE9kCUxbwuEgyTSEmkM",
  authDomain: "project-6457837950128637752.firebaseapp.com",
  projectId: "project-6457837950128637752",
  storageBucket: "project-6457837950128637752.firebasestorage.app",
  messagingSenderId: "796576141612",
  appId: "1:796576141612:web:d05fcbaa99e2f840209c89"
};

const APP_CONFIG = {
    firestoreCollection: "training_data_reports",
    sessionColumnNames: ["세션이름", "Session Name", "Session"],
    excludeColumns: ["Timestamp", "Session", "Session Name", "세션이름"],
    decimalMetrics: ["Pace", "Distance", "Altitude"],
    metricUnits: {
        "Pace": "min/km",
        "Distance": "km",
        "Altitude": "m",
        "Heart Rate": "bpm",
        "Speed": "km/h"
    },
    maxLoadRecords: 20,
    alertAutoRemoveTime: 5000
};

const CSV_PARSE_CONFIG = {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: header => header.trim()
};

# MASTER_PROJECT_STRUCTURE — CivicPulse

```
civicpulse/
│
├── PROJECT_MEMORY.md
├── MASTER_PROJECT_STRUCTURE.md
├── README.md
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Footer.jsx
│   │   │   ├── map/
│   │   │   │   ├── MapView.jsx
│   │   │   │   ├── HeatmapLayer.jsx
│   │   │   │   └── ClusterMarkers.jsx
│   │   │   ├── complaints/
│   │   │   │   ├── ComplaintForm.jsx
│   │   │   │   ├── ComplaintCard.jsx
│   │   │   │   ├── ComplaintList.jsx
│   │   │   │   └── ComplaintDetail.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── StatsCards.jsx
│   │   │   │   ├── SeverityChart.jsx
│   │   │   │   ├── CategoryChart.jsx
│   │   │   │   ├── ResponseTimeChart.jsx
│   │   │   │   ├── RiskIndicators.jsx
│   │   │   │   └── DuplicateInsights.jsx
│   │   │   ├── departments/
│   │   │   │   ├── DepartmentCard.jsx
│   │   │   │   ├── AssignmentTracker.jsx
│   │   │   │   ├── WorkerAllocation.jsx
│   │   │   │   └── DeptPerformanceChart.jsx
│   │   │   ├── cctv/
│   │   │   │   ├── StreamViewer.jsx
│   │   │   │   └── HazardAlerts.jsx
│   │   │   └── common/
│   │   │       ├── Button.jsx
│   │   │       ├── Modal.jsx
│   │   │       ├── Loader.jsx
│   │   │       └── Badge.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── SubmitComplaint.jsx
│   │   │   ├── TrackComplaint.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── HeatmapPage.jsx
│   │   │   ├── CCTVMonitor.jsx
│   │   │   ├── DepartmentDashboard.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── supabase.js
│   │   │   └── auth.js
│   │   ├── hooks/
│   │   │   ├── useComplaints.js
│   │   │   ├── useAuth.js
│   │   │   └── useMap.js
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── utils/
│   │   │   ├── constants.js
│   │   │   └── helpers.js
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env
│
├── backend/
│   ├── routes/
│   │   ├── complaints.js
│   │   ├── analytics.js
│   │   ├── auth.js
│   │   ├── cctv.js
│   │   ├── departments.js
│   │   └── admin.js
│   ├── controllers/
│   │   ├── complaintController.js
│   │   ├── analyticsController.js
│   │   ├── authController.js
│   │   ├── cctvController.js
│   │   ├── departmentController.js
│   │   └── adminController.js
│   ├── services/
│   │   ├── complaintService.js
│   │   ├── aiService.js
│   │   ├── clusteringService.js
│   │   ├── duplicateService.js
│   │   ├── prioritizationService.js
│   │   ├── departmentRoutingService.js
│   │   └── cctvService.js
│   ├── models/
│   │   └── supabaseClient.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── uploadMiddleware.js
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── constants.js
│   │   └── helpers.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── ml/
│   ├── inference/
│   │   ├── app.py               (Flask inference server)
│   │   ├── hazard_detector.py
│   │   ├── text_classifier.py
│   │   ├── embedding_service.py
│   │   ├── duplicate_detector.py
│   │   └── severity_predictor.py
│   ├── models/
│   │   └── (ONNX model files — gitignored)
│   ├── scripts/
│   │   ├── download_models.py
│   │   ├── export_onnx.py
│   │   └── generate_demo_data.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── docs/
│   ├── system_architecture.md
│   ├── api_contracts.md
│   ├── database_schema.md
│   └── deployment_guide.md
│
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile.ml
│
└── .gitignore
```

## File Tracking Log

| Date | Files Added | Phase |
|------|------------|-------|
| 2026-03-11 | PROJECT_MEMORY.md, MASTER_PROJECT_STRUCTURE.md | Step 1 |

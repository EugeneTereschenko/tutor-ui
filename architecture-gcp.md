flowchart TB
  subgraph Client
    U[User]
    UI[tutor-ui Web App]
  end

  subgraph Google_Cloud
    CR[Cloud Run Service\n(ai-language-tutor)]
    LOG[Cloud Logging / Monitoring]
  end

  subgraph Firebase
    AUTH[Firebase Auth]
    DATA[Firestore / Realtime DB]
  end

  subgraph External
    AI[AI Model API]
  end

  U --> UI
  UI --> CR
  CR --> AUTH
  CR --> DATA
  CR --> AI
  CR --> LOG
  CR --> UI
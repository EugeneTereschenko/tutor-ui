import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  const [text, setText] = useState('')
  const [response, setResponse] = useState('')
  const [status, setStatus] = useState('Connecting...')
  const [backendMode, setBackendMode] = useState('Detecting...')
  const [micActive, setMicActive] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraFacingMode, setCameraFacingMode] = useState('user')
  const [speechLanguage, setSpeechLanguage] = useState('en-US')
  const [imageDebug, setImageDebug] = useState('Image idle')

  const wsRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const keepMicOnRef = useRef(false)
  const cameraActiveRef = useRef(false)
  const lastSpokenResponseRef = useRef('')
  const socketProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const socketHost = window.location.host
  const socketUrl = `${socketProtocol}://${socketHost}/ws`
  const speechLanguageOptions = [
    { code: 'en-US', label: 'English' },
    { code: 'uk-UA', label: 'Ukrainian' },
    { code: 'es-ES', label: 'Spanish' },
    { code: 'de-DE', label: 'German' },
    { code: 'fr-FR', label: 'French' },
  ]

  const parseSocketResponse = (rawMessage) => {
    try {
      const parsed = JSON.parse(rawMessage)
      if (parsed?.type === 'tutor.response' && typeof parsed?.payload?.text === 'string') {
        return parsed.payload.text
      }
      if (parsed?.type === 'tutor.error' && typeof parsed?.payload?.message === 'string') {
        return parsed.payload.message
      }
      return rawMessage
    } catch {
      return rawMessage
    }
  }

  const toSpeakableText = (messageText) => {
    return messageText
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/#{1,6}\s?/g, '')
      .replace(/`/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const isVisualIntentPrompt = (messageText) => {
    const normalized = messageText.trim().toLowerCase()
    if (!normalized) return false

    return (
      normalized.includes('what is this') ||
      normalized.includes('what is that') ||
      normalized.includes('what do you see') ||
      normalized.includes('identify this') ||
      normalized.includes('recognize this')
    )
  }

  const captureCurrentFrame = () => {
    const video = videoRef.current
    if (!video || !streamRef.current || video.videoWidth === 0 || video.videoHeight === 0) {
      return null
    }

    const maxWidth = 960
    const scale = Math.min(1, maxWidth / video.videoWidth)
    const width = Math.max(1, Math.round(video.videoWidth * scale))
    const height = Math.max(1, Math.round(video.videoHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    context.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    const marker = 'base64,'
    const markerIndex = dataUrl.indexOf(marker)
    if (markerIndex === -1) {
      return null
    }

    return {
      mimeType: 'image/jpeg',
      imageBase64: dataUrl.slice(markerIndex + marker.length),
    }
  }

  const detectBackendMode = (message) => {
    const normalized = message.toLowerCase()

    if (normalized.includes('local tutor mode') || normalized.includes('no ai credits used')) {
      return 'Local Mock'
    }

    if (
      normalized.includes('model request failed') ||
      normalized.includes('google_cloud_project') ||
      normalized.includes('vertex')
    ) {
      return 'Vertex AI (error)'
    }

    return 'Vertex AI'
  }

  useEffect(() => {
    cameraActiveRef.current = cameraActive
  }, [cameraActive])

  useEffect(() => {
    if (!response || !window.speechSynthesis) {
      return
    }

    const speakableText = toSpeakableText(response)
    if (!speakableText || speakableText === lastSpokenResponseRef.current) {
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(speakableText)
    utterance.lang = speechLanguage
    utterance.rate = 1
    utterance.pitch = 1
    lastSpokenResponseRef.current = speakableText
    window.speechSynthesis.speak(utterance)
  }, [response, speechLanguage])

  useEffect(() => {
    const ws = new WebSocket(socketUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('Connected to backend')
    }

    ws.onclose = () => {
      setStatus('Disconnected')
    }

    ws.onerror = () => {
      setStatus('Connection error')
    }

    ws.onmessage = (event) => {
      const data = String(event.data)
      const parsedResponse = parseSocketResponse(data)
      setResponse(parsedResponse)
      setBackendMode(detectBackendMode(parsedResponse))
    }

    return () => {
      keepMicOnRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      ws.close()
    }
  }, [socketUrl])

  const sendToSocket = (payload) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setResponse('WebSocket is not connected yet. Make sure frontend preview/dev server and backend are both running.')
      return
    }

    ws.send(payload)
  }

  const sendTutorRequest = (requestText) => {
    if (!requestText.trim()) {
      setResponse('Please type something first.')
      setImageDebug('Image idle')
      return
    }

    const needsImage = isVisualIntentPrompt(requestText)
    const hasLiveCamera = cameraActiveRef.current && Boolean(streamRef.current)

    if (needsImage && !hasLiveCamera) {
      setImageDebug('Image required (camera off)')
      setResponse('Please turn on camera first for visual questions like “what is this?”.')
      return
    }

    if (!hasLiveCamera) {
      setImageDebug('Image not sent (camera off)')
      sendToSocket(requestText)
      return
    }

    const frame = captureCurrentFrame()
    if (!frame) {
      setImageDebug('Image not sent (frame not ready)')
      setResponse('Camera frame is not ready yet. Keep camera on and try again in 1 second.')
      return
    }

    const approximateBytes = Math.floor((frame.imageBase64.length * 3) / 4)
    const approximateKilobytes = Math.round(approximateBytes / 1024)

    const request = {
      type: 'tutor.multimodal',
      requestId: null,
      payload: {
        text: requestText,
        mimeType: frame.mimeType,
        imageBase64: frame.imageBase64,
      },
      timestamp: new Date().toISOString(),
    }

    setImageDebug(`Image sent: ${approximateKilobytes} KB`)
    sendToSocket(JSON.stringify(request))
  }

  const sendMessage = () => {
    sendTutorRequest(text)
  }

  const getSecureContextMessage = () => {
    return 'Mic /Camera on phones requires HTTPS. Open this app over https:// (or localhost), then allow permissions.'
  }

  const startMic = () => {
    if (!window.isSecureContext) {
      setResponse(getSecureContextMessage())
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setResponse('Speech recognition is not supported in this browser.')
      return
    }

    if (recognitionRef.current) {
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = speechLanguage
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    keepMicOnRef.current = true
    recognitionRef.current = recognition
    setMicActive(true)

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (!event.results[index].isFinal) continue
        const transcript = event.results[index][0].transcript.trim()
        if (!transcript) continue
        setText(transcript)
        sendTutorRequest(transcript)
      }
    }

    recognition.onend = () => {
      if (keepMicOnRef.current) {
        recognition.start()
        return
      }

      setMicActive(false)
      recognitionRef.current = null
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        keepMicOnRef.current = false
        recognitionRef.current = null
        setMicActive(false)
        setResponse('Microphone blocked. Allow mic permission in browser settings and reload.')
        return
      }

      setResponse('Microphone error. Please allow mic access and try again.')
    }

    recognition.start()
  }

  const stopMic = () => {
    keepMicOnRef.current = false

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    setMicActive(false)
  }

  const startCamera = (facingMode = cameraFacingMode) => {
    const video = videoRef.current
    if (!video) return

    if (!window.isSecureContext) {
      setResponse(getSecureContextMessage())
      return
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setResponse('Camera is not supported in this browser.')
      return
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode,
        },
      })
      .then((stream) => {
        streamRef.current = stream
        cameraActiveRef.current = true
        video.srcObject = stream
        video.muted = true
        video.play().catch(() => {})
        setCameraActive(true)
      })
      .catch((error) => {
        if (error.name === 'NotAllowedError') {
          setResponse('Camera blocked. Allow camera permission in browser settings and reload.')
          return
        }

        if (error.name === 'NotFoundError') {
          setResponse('No camera device found on this phone.')
          return
        }

        setResponse('Camera access failed. Please allow camera permission.')
      })
  }

  const toggleCameraFacingMode = () => {
    const nextFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user'
    setCameraFacingMode(nextFacingMode)

    if (cameraActive) {
      startCamera(nextFacingMode)
    }
  }

  const handleVideoStageTap = () => {
    if (!cameraActive) {
      return
    }

    toggleCameraFacingMode()
  }

  const stopCamera = () => {
    const video = videoRef.current
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    cameraActiveRef.current = false
    if (video) {
      video.srcObject = null
    }
    setCameraActive(false)
  }

  const handlePrimaryAction = () => {
    if (cameraActive) {
      stopMic()
      stopCamera()
      return
    }

    if (text.trim()) {
      sendMessage()
      return
    }

    startMic()
    startCamera()
  }

  const getPrimaryLabel = () => {
    if (cameraActive) {
      return '⏹ Stop Live'
    }

    if (text.trim()) {
      return 'Send'
    }

    return '🎤📷 Start Live'
  }

  return (
    <div className="call-screen">
      <header className="call-header">
        <div>
          <p className="eyebrow">Gemini Live Tutor</p>
          <h2 className="title">Video Call Interface</h2>
        </div>
        <span className="mode-pill">{backendMode}</span>
      </header>

      <main className="video-stage" onClick={handleVideoStageTap}>
        <video ref={videoRef} autoPlay playsInline className="video-preview" />

        <div className="call-overlay">
          <span className="badge">{status}</span>
          <span className="badge">{socketUrl}</span>
          <span className="badge">Mic {micActive ? 'on' : 'off'}</span>
          <span className="badge">Cam {cameraActive ? 'on' : 'off'}</span>
          <span className="badge">{imageDebug}</span>
        </div>
      </main>

      <section className="control-sheet">
        <input
          id="text"
          className="text-input"
          placeholder="Message your tutor..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <button className="primary-btn" onClick={handlePrimaryAction}>
          {getPrimaryLabel()}
        </button>

        <label className="language-select-wrap" htmlFor="language-select">
          Language
          <select
            id="language-select"
            className="language-select"
            value={speechLanguage}
            onChange={(event) => setSpeechLanguage(event.target.value)}
          >
            {speechLanguageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="response-block">
          <p className="response-label">Tutor response</p>
          <p className="response">{response || 'Your AI response will appear here.'}</p>
        </div>
      </section>
    </div>
  )
}

export default App

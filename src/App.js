import { useState } from "react";

function App() {

  const [response, setResponse] = useState("");

  const ws = new WebSocket("ws://localhost:8080");

  const sendMessage = () => {

    const text = document.getElementById("text").value;

    ws.send(text);

    ws.onmessage = (event) => {
      setResponse(event.data);
    };
  };

  const startMic = () => {

    const recognition = new window.webkitSpeechRecognition();

    recognition.onresult = (event) => {

      const text = event.results[0][0].transcript;

      ws.send(text);

      ws.onmessage = (event) => {
        setResponse(event.data);
      };
    };

    recognition.start();
  };

  const startCamera = () => {

    const video = document.querySelector("video");

    navigator.mediaDevices.getUserMedia({
      video: true
    })
      .then(stream => {
        video.srcObject = stream;
      });
  };

  return (
    <div>

      <h2>Language Tutor</h2>

      <input id="text" placeholder="Speak or type..." />

      <button onClick={sendMessage}>
        Send
      </button>

      <button onClick={startMic}>
        🎤 Speak
      </button>

      <button onClick={startCamera}>
        📷 Camera
      </button>

      <video autoPlay playsInline width="320" />

      <p>AI: {response}</p>

    </div>
  );
}

export default App;

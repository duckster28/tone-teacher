import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const [transcription, setTranscription] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  // Start recording from microphone
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        processAudio(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Error accessing microphone: ' + err.message);
      console.error('Error accessing microphone:', err);
    }
  };

  // Stop recording if the recording button is clicked
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioURL(url);
      processAudio(file);
    }
  };

  // Process audio
  const processAudio = async (audioBlob) => {
    setIsLoading(true);
    setTranscription('');
    setFeedback(null);
    
    try {
      const transcriptionText = await transcribeAudio(audioBlob);
      setTranscription(transcriptionText);
      
      if (transcriptionText) {
        const sentimentFeedback = await analyzeSpeech(transcriptionText);
        setFeedback(sentimentFeedback);
      }
    } catch (err) {
      setError('Error processing audio: ' + err.message);
      console.error('Error processing audio:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Transcribe audio using OpenAI's API
  const transcribeAudio = async (audioBlob) => {
    if (!process.env.REACT_APP_OPENAI_API_KEY) {
      throw new Error("Missing OpenAI API Key. Please check your environment variables.");
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    formData.append('model', 'whisper-1');

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.text;
    } catch (err) {
      console.error('Transcription error:', err);
      throw err;
    }
  };

  // Analyze speech using OpenAI's API (without pacing)
  const analyzeSpeech = async (text) => {
    if (!text.trim()) {
      throw new Error("Error: Empty text provided for analysis.");
    }

    if (!process.env.REACT_APP_OPENAI_API_KEY) {
      throw new Error("Missing OpenAI API Key. Please check your environment variables.");
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
        {
          role: 'system',
          content: `You are analyzing speech from a Parkinson's patient. Provide feedback on:
          1. Clarity - unclear words & pronunciation improvement
          2. Tonality - monotone issues and emphasis suggestions
          3. Vocabulary - expressive alternatives
          4. Sentiment - overall sentiment of the speech (positive/neutral/negative)
          
          Respond in JSON format with the following structure:
          {
          "clarity": {
          "rating": "good/needs improvement/poor",
          "unclearWords": ["word1", "word2"],
          "pronunciationTips": "specific tips"
          },
          "tonality": {
          "rating": "expressive/somewhat monotone/very monotone",
          "emphasisSuggestions": "which words to emphasize"
          },
          "vocabulary": {
          "rating": "varied/limited/very limited",
          "suggestions": [{"original": "word", "alternative": "better word"}]
          },
          "sentiment": {
          "rating": "positive/neutral/negative",
          "comments": "specific comments on the sentiment"
          },
          "overallFeedback": "Kind, constructive, and encouraging advice with actionable tips, 
          specifically about which words to emphasize. Add a motivational quote at the end of 
          the advice to encourage the patient to continue improving their tone."
          }`
        },
        {
          role: 'user',
          content: text
        }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);

      const feedbackContent = data.choices[0].message.content.trim().replace(/```json|```/g, '').replace(/,\s*$/, '');
      const feedback = JSON.parse(feedbackContent);
      return feedback;
    } catch (err) {
      console.error('Analysis error:', err);
      throw err;
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Parkinson's Speech Therapy Assistant</h1>
        <p>Improve your speech clarity, tonality, and expression with real-time feedback</p>
      </header>

      <div className="main-content">
        <div className="recording-section">
          <h2>Record or Upload</h2>
          <div className="controls">
            {!isRecording ? (
              <button onClick={startRecording} disabled={isLoading}>
                Start Recording
              </button>
            ) : (
              <button onClick={stopRecording} disabled={isLoading}>
                Stop Recording
              </button>
            )}
            <input type="file" accept="audio/*" onChange={handleFileUpload} disabled={isLoading || isRecording} />
          </div>
          {audioURL && <audio ref={audioRef} src={audioURL} controls />}
          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="results-section">
          {isLoading ? (
            <p>Analyzing your speech...</p>
          ) : (
            <>
              {transcription && <p><strong>Transcription:</strong> {transcription}</p>}
              
              {feedback && feedback.clarity && feedback.tonality && feedback.vocabulary && (
                <div className="feedback">
                  <h3>Speech Analysis</h3>
                  <p><strong>Clarity:</strong> {feedback.clarity.rating}</p>
                  <p><strong>Tonality:</strong> {feedback.tonality.rating}</p>
                  <p><strong>Vocabulary:</strong> {feedback.vocabulary.rating}</p>
                  <p><strong>Sentiment:</strong> {feedback.sentiment.rating}</p>
                  <p><strong>Overall Feedback:</strong> {feedback.overallFeedback}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  X, 
  Sparkles, 
  ExternalLink,
  MessageSquare,
  Bot
} from "lucide-react";
import { askAssistant } from "../services/api";

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  allRegions = [],
  onVerifySource,
  darkMode = true,
}) {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hello! I am your Voice Study Assistant. Ask me any question about your notes by speaking or typing.",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        setIsListening(false);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        handleSendMessage(transcript);
      };

      recognitionRef.current = recognition;
    }
  }, [allRegions]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please type your question.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Could not start recognition:", err);
      }
    }
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    setInputText("");
    setMessages((prev) => [...prev, { sender: "user", text: query }]);
    setIsLoading(true);

    try {
      const res = await askAssistant(query, allRegions);
      const botMsg = {
        sender: "bot",
        text: res.answer,
        source_chunk_ids: res.source_chunk_ids,
        source_page: res.source_page,
        source_box: res.source_box,
      };

      setMessages((prev) => [...prev, botMsg]);
      speakText(res.answer);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `Error: ${err.message || "Failed to reach study assistant."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[540px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden bg-slate-900 border-slate-700 text-white backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Grounded Voice Assistant</h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Grounded in {allRegions.length} note regions</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="p-1.5 rounded-lg text-rose-400 hover:bg-slate-800"
              title="Mute voice"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                m.sender === "user"
                  ? "bg-indigo-600 text-white rounded-br-xs"
                  : "bg-slate-800 border border-slate-700/60 text-slate-200 rounded-bl-xs"
              }`}
            >
              {m.text}

              {/* Source Verification Link */}
              {m.source_chunk_ids && m.source_chunk_ids.length > 0 && m.source_chunk_ids[0] && (
                <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-amber-400 font-mono">
                    Chunk: {m.source_chunk_ids[0]} (Page {m.source_page || 1})
                  </span>
                  <button
                    onClick={() => onVerifySource(m.source_chunk_ids[0], m.source_page, m.source_box)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Verify
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <span>Checking notes...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Microphone Visualizer & Input Bar */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950/80">
        {isListening && (
          <div className="flex items-center justify-center gap-2 py-1.5 mb-2 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400 text-xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>Listening... Speak your question now</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              isListening
                ? "bg-red-500 text-white ring-4 ring-red-500/30 scale-105"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
            title={isListening ? "Stop listening" : "Start speaking"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask anything about notes..."}
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

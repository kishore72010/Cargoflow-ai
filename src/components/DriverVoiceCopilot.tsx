import React, { useState, useEffect, useRef } from "react";
import { Driver, Truck, Delivery } from "../types";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  Send,
  Radio,
  Clock,
  Snowflake,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  Activity,
  CornerDownLeft,
} from "lucide-react";

interface DriverVoiceCopilotProps {
  activeDriver: Driver;
  assignedTruck: Truck;
  driverDeliveries: Delivery[];
  currentStop: Delivery | null;
  showToast: (msg: string) => void;
}

export const DriverVoiceCopilot: React.FC<DriverVoiceCopilotProps> = ({
  activeDriver,
  assignedTruck,
  driverDeliveries,
  currentStop,
  showToast,
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>("");
  const [lastResponse, setLastResponse] = useState<{
    speechText: string;
    displayText: string;
    category?: string;
  } | null>(null);

  const [conversation, setConversation] = useState<
    Array<{ sender: "driver" | "ai"; text: string; time: string }>
  >([
    {
      sender: "ai",
      text: `Hello ${activeDriver.name.split(" ")[0]}! CargoFlow Audio Co-Pilot ready. Ask me anything hands-free while driving.`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition on Mount if available
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const spokenText = event.results[0][0].transcript;
          setIsListening(false);
          handleAskCopilot(spokenText);
        };

        recognition.onerror = (event: any) => {
          console.warn("[VoiceCopilot] Speech error:", event.error);
          setIsListening(false);
          if (event.error === "not-allowed") {
            showToast("Microphone access denied. You can tap quick command chips instead.");
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn("[VoiceCopilot] Init error:", e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeDriver, assignedTruck]);

  // Voice synthesis text-to-speech helper
  const speakText = (text: string) => {
    if (isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleToggleListening = () => {
    if (!recognitionRef.current) {
      showToast("Speech recognition is not supported in this browser. Use quick command chips below!");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("[VoiceCopilot] Start error:", err);
      }
    }
  };

  const handleAskCopilot = async (queryText: string) => {
    if (!queryText.trim()) return;

    const queryTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Add driver message to conversation
    setConversation((prev) => [...prev, { sender: "driver", text: queryText, time: queryTime }]);
    setManualInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          driver_id: activeDriver.driver_id,
          truck_id: assignedTruck.truck_id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const respTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastResponse({
          speechText: data.speechText,
          displayText: data.displayText,
          category: data.category,
        });

        setConversation((prev) => [
          ...prev,
          { sender: "ai", text: data.displayText, time: respTime },
        ]);

        // Speak aloud through speaker
        speakText(data.speechText);
      } else {
        showToast(data.error || "Co-Pilot could not process your query.");
      }
    } catch (err: any) {
      showToast("Connection error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const QUICK_COMMANDS = [
    { label: "Next Stop Details", query: "What is my next stop and delivery details?" },
    { label: "Cold-Chain Status", query: "Check my cold-chain cargo and temperatures" },
    { label: "Pending Stops Count", query: "How many deliveries do I have left today?" },
    { label: "Any Route Delays?", query: "Are there any at-risk or delayed packages?" },
    { label: "Vehicle Telemetry", query: "Report current vehicle speed and telemetry" },
  ];

  return (
    <div className="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col gap-4">
      {/* Background ambient glow */}
      <div className="absolute -top-16 -right-16 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/40">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase font-mono">
                Hands-Free Dispatch AI
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-300 font-mono">Gemini Voice</span>
            </div>
            <h2 className="text-base font-extrabold text-white">CargoFlow Audio Co-Pilot</h2>
          </div>
        </div>

        {/* Audio Mute / Unmute Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              if (nextMuted && typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
              }
              showToast(nextMuted ? "Audio speech output muted" : "Audio voice readout enabled");
            }}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isMuted
                ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                : "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30"
            }`}
            title={isMuted ? "Unmute Voice Readout" : "Mute Voice Readout"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="text-[11px] hidden sm:inline">{isMuted ? "Muted" : "Voice On"}</span>
          </button>
        </div>
      </div>

      {/* Interactive Microphone & Waveform Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Main Glowing Push-to-Talk Mic Button */}
          <button
            type="button"
            onClick={handleToggleListening}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition shadow-lg shrink-0 cursor-pointer ${
              isListening
                ? "bg-rose-500 text-white shadow-rose-900/60 ring-4 ring-rose-500/30 animate-pulse"
                : isSpeaking
                ? "bg-indigo-500 text-white shadow-indigo-900/60 ring-4 ring-indigo-500/30"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/50"
            }`}
            title="Push to speak with AI Co-Pilot"
          >
            {isListening ? <Mic className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isListening
                    ? "bg-rose-400 animate-ping"
                    : isSpeaking
                    ? "bg-indigo-400 animate-pulse"
                    : isLoading
                    ? "bg-amber-400 animate-spin"
                    : "bg-emerald-400"
                }`}
              />
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                {isListening
                  ? "Listening to voice..."
                  : isSpeaking
                  ? "Speaking response..."
                  : isLoading
                  ? "Analyzing tactical query..."
                  : "Tap Mic to Talk Hands-Free"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isListening
                ? "Speak your question now (e.g., 'What is my next stop?')"
                : "Driver safety mode active. Audio answers are read aloud."}
            </p>
          </div>
        </div>

        {/* Dynamic Audio Visualizer Bars */}
        <div className="flex items-center gap-1.5 h-8 px-3 py-1 bg-slate-900/80 rounded-xl border border-slate-800">
          {[1, 2, 3, 4, 5, 6].map((i) => {
            const active = isListening || isSpeaking || isLoading;
            return (
              <span
                key={i}
                className={`w-1.5 rounded-full transition-all duration-300 ${
                  active ? "bg-indigo-400 animate-bounce" : "bg-slate-700 h-2"
                }`}
                style={{
                  height: active ? `${Math.max(8, (i * 7) % 28)}px` : "6px",
                  animationDelay: `${i * 120}ms`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Recent Conversation Log (Compact & Spoken UI) */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 max-h-48 overflow-y-auto space-y-2.5 text-xs">
        {conversation.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col ${
              msg.sender === "driver" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5 px-1 font-mono">
              <span>{msg.sender === "driver" ? activeDriver.name : "Co-Pilot AI"}</span>
              <span>•</span>
              <span>{msg.time}</span>
            </div>
            <div
              className={`p-3 rounded-2xl max-w-[90%] leading-relaxed ${
                msg.sender === "driver"
                  ? "bg-indigo-600/30 border border-indigo-500/40 text-indigo-100 rounded-tr-none"
                  : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Prompt Command Chips for Rapid Testing */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
          One-Tap Driving Shortcuts:
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_COMMANDS.map((cmd, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading || isListening}
              onClick={() => handleAskCopilot(cmd.query)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{cmd.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Text fallback input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAskCopilot(manualInput);
        }}
        className="flex items-center gap-2 pt-1"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Or type a question for Co-Pilot..."
            disabled={isLoading || isListening}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={!manualInput.trim() || isLoading}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ask</span>
        </button>
      </form>
    </div>
  );
};

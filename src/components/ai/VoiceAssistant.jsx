
import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VoiceAssistant = ({ onCommand }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [feedback, setFeedback] = useState('');

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const startListening = () => {
        if (!SpeechRecognition) {
            alert("Voice features not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        setIsListening(true);
        setFeedback("Listening...");
        setTranscript("");

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            setTranscript(text);
            handleCommand(text);
        };

        recognition.onerror = (event) => {
            setFeedback("Error: " + event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const handleCommand = (text) => {
        const lower = text.toLowerCase();
        let response = "I didn't quite get that.";

        if (lower.includes('cheap') || lower.includes('lowest price')) {
            onCommand('filter:price');
            response = "Showing the lowest price spots first.";
        } else if (lower.includes('near') || lower.includes('closest')) {
            onCommand('filter:distance');
            response = "Finding the closest spots to you.";
        } else if (lower.includes('reset') || lower.includes('clear') || lower.includes('all')) {
            onCommand('filter:all');
            response = "Resetting all filters.";
        } else if (lower.includes('available') || lower.includes('free')) {
            onCommand('filter:available');
            response = "Showing only currently available spots.";
        } else {
            // Fallback
            response = `Searching for "${text}"...`;
            onCommand(`search:${text}`);
        }

        setFeedback(response);
        speak(response);
    };

    const speak = (text) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    return (
        <>
            {/* Floating Trigger Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={startListening}
                className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg flex items-center justify-center text-white z-40 border-2 border-white/20"
                style={{ boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)' }}
            >
                <Mic size={24} />
            </motion.button>

            {/* AI Interaction Overlay */}
            <AnimatePresence>
                {(isListening || transcript) && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-40 right-6 w-80 glass-card rounded-2xl p-4 z-40 border border-indigo-500/30"
                        style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            backdropFilter: 'blur(12px)',
                            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
                        }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <Zap className="text-yellow-400 fill-current" size={16} />
                                <span className="text-xs font-bold text-indigo-300 tracking-wider">PARK.AI</span>
                            </div>
                            <button onClick={() => { setTranscript(''); setIsListening(false); }} className="text-gray-400 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="min-h-[60px] flex flex-col justify-center">
                            {isListening ? (
                                <div className="flex items-center gap-1 justify-center h-10">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <motion.div
                                            key={i}
                                            animate={{ height: [10, 24, 10] }}
                                            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                                            className="w-1 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-full"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-white text-lg font-medium leading-tight">
                                    "{transcript}"
                                </p>
                            )}
                        </div>

                        {feedback && (
                            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-indigo-300 flex items-center gap-2">
                                {/* <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div> */}
                                {feedback}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default VoiceAssistant;

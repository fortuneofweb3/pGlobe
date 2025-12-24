import { useState, useEffect } from 'react';

interface TypewriterTextProps {
    text: string;
    speed?: number; // milliseconds per word
    onComplete?: () => void;
}

/**
 * Typewriter effect component that displays text WORD-BY-WORD
 * Creates a smooth animation effect for streaming AI responses
 */
export function TypewriterText({ text, speed = 50, onComplete }: TypewriterTextProps) {
    const [displayedWords, setDisplayedWords] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Split text into words (keeping whitespace/newlines as separate items)
    const words = text.split(/(\s+)/);

    useEffect(() => {
        if (currentIndex < words.length) {
            const timeout = setTimeout(() => {
                setDisplayedWords(words.slice(0, currentIndex + 1));
                setCurrentIndex(currentIndex + 1);
            }, speed);

            return () => clearTimeout(timeout);
        } else if (currentIndex === words.length && onComplete) {
            onComplete();
        }
    }, [currentIndex, words.length, speed, onComplete]);

    // Reset when text changes
    useEffect(() => {
        setDisplayedWords([]);
        setCurrentIndex(0);
    }, [text]);

    const isComplete = currentIndex >= words.length;

    return (
        <span>
            {displayedWords.join('')}
            {!isComplete && <span className="animate-pulse text-[#F0A741]">▌</span>}
        </span>
    );
}

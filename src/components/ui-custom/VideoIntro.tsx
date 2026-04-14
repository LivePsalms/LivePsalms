import { useState, useRef, useEffect } from "react";

interface VideoIntroProps {
  onComplete: () => void;
}

export function VideoIntro({ onComplete }: VideoIntroProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeDuration = 2.5; // Start fading 2.5 seconds before video ends for gradual, smooth transition

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure video plays
    const playVideo = async () => {
      try {
        await video.play();
      } catch (error) {
        console.log("Autoplay prevented, waiting for interaction");
      }
    };

    playVideo();

    // Track video progress and fade out gradually
    const handleTimeUpdate = () => {
      if (!video) return;
      
      const remainingTime = video.duration - video.currentTime;
      
      // Start fading when we're within the fadeDuration of the end
      if (remainingTime <= fadeDuration && remainingTime > 0) {
        const fadeProgress = remainingTime / fadeDuration;
        setOpacity(fadeProgress);
      }
    };

    // Handle video end
    const handleEnded = () => {
      setOpacity(0);
      setTimeout(() => {
        setIsPlaying(false);
        onComplete();
      }, 300);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [onComplete]);

  // Fallback: if video doesn't play within 3.5 seconds, fade out anyway
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (videoRef.current && videoRef.current.paused) {
        setOpacity(0);
        setTimeout(() => {
          setIsPlaying(false);
          onComplete();
        }, 800);
      }
    }, 3500);

    return () => clearTimeout(fallbackTimer);
  }, [onComplete]);

  if (!isPlaying) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      style={{ opacity }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{ objectFit: "cover" }}
      >
        <source src="/intro-video.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

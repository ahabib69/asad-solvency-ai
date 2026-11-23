import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Info,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import './MysteryBox.css';

/*
 * The old Mystery Box used Google's retired GTV sample bucket. Those URLs can
 * return 403, which caused the rapid chain of failed clips. This pool uses
 * alternative direct MP4 hosts and multiple fallbacks per film where available.
 *
 * No external host can be guaranteed on every network. If all remote streams
 * are blocked, the built-in CSS portal keeps the experience alive instead of
 * leaving a black player or cycling through errors forever.
 */
const CLIPS = [
  {
    id: 'sintel-trailer',
    title: 'Sintel',
    mood: 'cinematic',
    sources: [
      '/assets/mystery/sintel.mp4',
      'https://media.w3.org/2010/05/sintel/trailer.mp4',
      'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4',
    ],
    credit: '© Blender Foundation · Sintel / durian.blender.org · CC BY 3.0',
    license: 'https://creativecommons.org/licenses/by/3.0/',
  },
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    mood: 'animated',
    sources: [
      '/assets/mystery/big-buck-bunny.mp4',
      'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
      'https://www.w3schools.com/html/mov_bbb.mp4',
    ],
    credit: '© copyright 2008, Blender Foundation / www.bigbuckbunny.org · CC BY 3.0',
    license: 'https://creativecommons.org/licenses/by/3.0/',
  },
  {
    id: 'jellyfish',
    title: 'Jellyfish',
    mood: 'fluid',
    sources: [
      '/assets/mystery/jellyfish.mp4',
      'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_2MB.mp4',
      'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
    ],
    credit: 'Jellyfish H.264 sample · Test Videos',
    license: 'https://test-videos.co.uk/home',
  },
  {
    id: 'flower',
    title: 'Flower',
    mood: 'macro',
    sources: [
      '/assets/mystery/flower.mp4',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
    ],
    credit: 'MDN flower sample · CC0 public-domain dedication',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
];

const PORTAL_HUES = [0, 34, 72, 128, 188, 232, 278, 318];
const STALL_TIMEOUT_MS = 18000;
const LOAD_TIMEOUT_MS = 22000;

function pickRandom(items, excludeId) {
  const choices = items.filter((item) => item.id !== excludeId);
  const pool = choices.length ? choices : items;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function makeSelection(clip, sourceIndex, sequence) {
  return clip ? { clip, sourceIndex, key: sequence } : null;
}

export default function MysteryBox() {
  const location = useLocation();
  const videoRef = useRef(null);
  const selectionRef = useRef(null);
  const failedClipsRef = useRef(new Set());
  const sequenceRef = useRef(1);
  const failureHandledRef = useRef(0);
  const mutedRef = useRef(true);
  const wasPlayingRef = useRef(false);
  const loadTimerRef = useRef(null);
  const stallTimerRef = useRef(null);
  const lastRollRef = useRef(location.search);

  const [selection, setSelection] = useState(() => {
    const clip = CLIPS[Math.floor(Math.random() * CLIPS.length)];
    const initial = makeSelection(clip, 0, 1);
    selectionRef.current = initial;
    return initial;
  });
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [portalOnly, setPortalOnly] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [grade, setGrade] = useState(0);
  const [portalHue, setPortalHue] = useState(() => PORTAL_HUES[Math.floor(Math.random() * PORTAL_HUES.length)]);

  const clearTimers = useCallback(() => {
    if (loadTimerRef.current) window.clearTimeout(loadTimerRef.current);
    if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
    loadTimerRef.current = null;
    stallTimerRef.current = null;
  }, []);

  const applySelection = useCallback((next) => {
    clearTimers();
    selectionRef.current = next;
    setSelection(next);
    setPlaying(false);
    setNeedsTap(false);
    setPortalOnly(!next);
    setGrade(Math.floor(Math.random() * 4));
    setPortalHue(PORTAL_HUES[Math.floor(Math.random() * PORTAL_HUES.length)]);
  }, [clearTimers]);

  const rollNext = useCallback((resetFailures = false) => {
    if (resetFailures) failedClipsRef.current.clear();
    const currentId = selectionRef.current?.clip?.id;
    const available = CLIPS.filter((clip) => !failedClipsRef.current.has(clip.id));
    const nextClip = pickRandom(available, currentId);

    if (!nextClip) {
      applySelection(null);
      return;
    }

    applySelection(makeSelection(nextClip, 0, ++sequenceRef.current));
  }, [applySelection]);

  const failCurrentSource = useCallback((selectionKey) => {
    const current = selectionRef.current;
    if (!current || current.key !== selectionKey || failureHandledRef.current === selectionKey) return;
    failureHandledRef.current = selectionKey;
    clearTimers();
    setPlaying(false);
    setNeedsTap(false);

    if (current.sourceIndex + 1 < current.clip.sources.length) {
      applySelection(makeSelection(current.clip, current.sourceIndex + 1, ++sequenceRef.current));
      return;
    }

    failedClipsRef.current.add(current.clip.id);
    const remaining = CLIPS.filter((clip) => !failedClipsRef.current.has(clip.id));
    const nextClip = pickRandom(remaining, current.clip.id);
    if (nextClip) {
      applySelection(makeSelection(nextClip, 0, ++sequenceRef.current));
    } else {
      // Always leave a moving, locally-rendered portal on screen if all CDNs fail.
      applySelection(null);
    }
  }, [applySelection, clearTimers]);

  const playCurrent = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = mutedRef.current;
    try {
      await video.play();
      setNeedsTap(false);
      setPlaying(true);
      wasPlayingRef.current = true;
    } catch (error) {
      setPlaying(false);
      if (error?.name === 'NotAllowedError') {
        // Autoplay policy is not a bad source. Wait for a real user gesture.
        setNeedsTap(true);
      } else if (error?.name !== 'AbortError') {
        const current = selectionRef.current;
        if (current) failCurrentSource(current.key);
      }
    }
  }, [failCurrentSource]);

  const handleManualRoll = useCallback(() => {
    rollNext(true);
  }, [rollNext]);

  // Every chosen source gets a bounded load window and a stalled-stream watchdog.
  // Failed sources are skipped; autoplay denial is handled separately from a media error.
  useEffect(() => {
    const video = videoRef.current;
    const current = selection;
    if (!video || !current) return undefined;
    let active = true;
    let playRequested = false;
    const key = current.key;

    const tryAutoplay = () => {
      if (!active || playRequested || video.readyState < 3) return;
      playRequested = true;
      if (loadTimerRef.current) window.clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
      playCurrent();
    };

    const onCanPlay = () => tryAutoplay();
    const onPlaying = () => {
      if (!active) return;
      clearTimers();
      setPlaying(true);
      setNeedsTap(false);
      wasPlayingRef.current = true;
    };
    const onError = () => {
      if (active) failCurrentSource(key);
    };
    const onEnded = () => {
      if (active) rollNext(false);
    };
    const onWaiting = () => {
      if (!active || !wasPlayingRef.current) return;
      if (stallTimerRef.current) window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = window.setTimeout(() => {
        if (active && video.readyState < 3) failCurrentSource(key);
      }, STALL_TIMEOUT_MS);
    };
    const onTimeUpdate = () => {
      if (stallTimerRef.current && video.readyState >= 3) {
        window.clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };

    video.muted = mutedRef.current;
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('timeupdate', onTimeUpdate);

    loadTimerRef.current = window.setTimeout(() => {
      if (active && video.readyState < 3) failCurrentSource(key);
    }, LOAD_TIMEOUT_MS);

    if (video.readyState >= 3) tryAutoplay();
    else video.load();

    return () => {
      active = false;
      clearTimers();
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [selection?.key, clearTimers, failCurrentSource, playCurrent, rollNext]);

  // Re-opening Mystery Box in the sidebar creates a fresh roll token.
  useEffect(() => {
    if (lastRollRef.current === location.search) return;
    lastRollRef.current = location.search;
    rollNext(true);
  }, [location.search, rollNext]);

  useEffect(() => {
    mutedRef.current = muted;
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) {
        wasPlayingRef.current = !video.paused;
        video.pause();
      } else if (wasPlayingRef.current && !portalOnly) {
        playCurrent();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [playCurrent, portalOnly]);

  const toggleMute = () => {
    const nextMuted = !muted;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted && videoRef.current.paused) playCurrent();
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) {
      rollNext(true);
      return;
    }
    if (video.paused) playCurrent();
    else {
      video.pause();
      wasPlayingRef.current = false;
    }
  };

  const requestFullscreen = () => {
    const stage = document.querySelector('.mbx-cinema');
    if (stage?.requestFullscreen) stage.requestFullscreen().catch(() => {});
  };

  const currentSource = selection?.clip?.sources?.[selection.sourceIndex] || '';
  const gradeClass = ['mbx-grade-original', 'mbx-grade-dream', 'mbx-grade-chrome', 'mbx-grade-ether'][grade];

  return (
    <section className="mbx-page" aria-label="Mystery Box">
      <div className={`mbx-cinema ${gradeClass} ${playing ? 'is-playing' : ''} ${portalOnly ? 'is-portal-only' : ''}`} style={{ '--mbx-hue': `${portalHue}deg` }} onDoubleClick={requestFullscreen}>
        <div className="mbx-backdrop" aria-hidden="true">
          <div className="mbx-backdrop-grid" />
          <div className="mbx-portal-core">
            <span className="mbx-ring mbx-ring-a" />
            <span className="mbx-ring mbx-ring-b" />
            <span className="mbx-ring mbx-ring-c" />
            <span className="mbx-ring mbx-ring-d" />
            <span className="mbx-core-light" />
            <span className="mbx-core-star">✦</span>
          </div>
          <span className="mbx-orbit-dot mbx-orbit-dot-a" />
          <span className="mbx-orbit-dot mbx-orbit-dot-b" />
          <span className="mbx-orbit-dot mbx-orbit-dot-c" />
          <span className="mbx-scanline" />
        </div>

        {selection && (
          <video
            key={selection.key}
            ref={videoRef}
            className="mbx-video"
            src={currentSource}
            poster="/assets/banner-moon.jpg"
            autoPlay
            muted={muted}
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-label="Mystery Box surprise video"
          />
        )}

        <div className="mbx-vignette" aria-hidden="true" />
        <div className="mbx-top-hud" aria-hidden="true">
          <span className="mbx-live-dot" />
          <span>UNKNOWN SIGNAL</span>
          <i />
          <span>ASAD / MYSTERY</span>
        </div>

        {needsTap && (
          <button className="mbx-big-play" onClick={playCurrent} aria-label="Play surprise video">
            <span><Play size={23} fill="currentColor" /></span>
          </button>
        )}

        <div className="mbx-controls" aria-label="Mystery Box controls">
          <button className="mbx-control" onClick={handleManualRoll} aria-label="Open another mystery video" title="Another universe">
            <Shuffle size={19} />
          </button>
          <button className="mbx-control" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'} title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="mbx-control" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Mute video'} title={muted ? 'Sound on' : 'Mute'}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button className="mbx-control" onClick={() => setGrade((value) => (value + 1) % 4)} aria-label="Change visual atmosphere" title="Change atmosphere">
            <Sparkles size={18} />
          </button>
          <button className="mbx-control" onClick={() => setShowCredits(true)} aria-label="Video credits" title="Credits">
            <Info size={18} />
          </button>
          <button className="mbx-control" onClick={requestFullscreen} aria-label="Fullscreen" title="Fullscreen">
            <Maximize2 size={18} />
          </button>
        </div>

        <button className="mbx-reseal" onClick={handleManualRoll} aria-label="Reshuffle the Mystery Box" title="Reshuffle">
          <RotateCcw size={15} />
          <span>RESHUFFLE REALITY</span>
        </button>

        {showCredits && (
          <div className="mbx-credits-backdrop" role="presentation" onClick={() => setShowCredits(false)}>
            <div className="mbx-credits" role="dialog" aria-modal="true" aria-label="Mystery Box video credits" onClick={(event) => event.stopPropagation()}>
              <button className="mbx-credits-close" onClick={() => setShowCredits(false)} aria-label="Close credits"><X size={18} /></button>
              <div className="mbx-credits-kicker">THE SIGNAL ARCHIVE</div>
              <h2>Open-film transmissions</h2>
              <p>Some surprise clips are community test samples and open-film excerpts. Credits and license links are collected here.</p>
              <div className="mbx-credit-list">
                {CLIPS.map((clip) => (
                  <div className="mbx-credit-row" key={clip.id}>
                    <strong>{clip.title}</strong>
                    <span>{clip.credit}</span>
                    <a href={clip.license} target="_blank" rel="noreferrer">License / source <ExternalLink size={12} /></a>
                  </div>
                ))}
              </div>
              <small>External video hosts can be unavailable on some networks. The portal animation is built in and needs no third-party stream.</small>
            </div>
          </div>
        )}
      </div>
      <div className="mbx-underbar" aria-hidden="true">
        <span className="mbx-underbar-line" />
        <span className="mbx-underbar-glyph">✦</span>
        <span className="mbx-underbar-line" />
      </div>
      <p className="mbx-sr-status" role="status" aria-live="polite">
        {portalOnly ? 'The local Mystery Portal is active.' : playing ? `Playing ${selection?.clip?.title || 'mystery video'}.` : 'Finding a mystery video.'}
      </p>
    </section>
  );
}

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const NEAR_BOTTOM_PX = 80;

// Refreshing messages must not move somebody who is reading earlier replies.
// Keep following only while near the bottom, or after an explicit send/jump.
export function useChatScroll(scrollRef, { messages, sending, recording, pendingVoiceBlob }) {
  const followingRef = useRef(true);
  const lastPositionRef = useRef(0);
  const [showLatest, setShowLatest] = useState(false);
  const scrollToLatest = useCallback(() => {
    const box = scrollRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
      lastPositionRef.current = box.scrollTop;
    }
  }, [scrollRef]);
  const followLatest = useCallback(() => {
    followingRef.current = true;
    setShowLatest(false);
    scrollToLatest();
  }, [scrollToLatest]);
  const onScroll = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    const following = box.scrollHeight - box.clientHeight - box.scrollTop <= NEAR_BOTTOM_PX;
    followingRef.current = following;
    lastPositionRef.current = box.scrollTop;
    setShowLatest(!following);
  }, [scrollRef]);

  const followIfPinned = useCallback(() => {
    const box = scrollRef.current;
    if (!box || !followingRef.current) return;
    // A user scroll may precede its queued scroll event. Do not let a resize
    // or a refresh win that race and undo the movement before the event runs.
    if (box.scrollTop < lastPositionRef.current - 1
        && box.scrollHeight - box.clientHeight - box.scrollTop > NEAR_BOTTOM_PX) {
      followingRef.current = false;
      // The queued scroll handler updates the button without a second render
      // inside the layout effect.
      return;
    }
    scrollToLatest();
  }, [scrollRef, scrollToLatest]);

  useLayoutEffect(() => {
    followIfPinned();
  }, [messages, sending, recording, pendingVoiceBlob, followIfPinned]);

  // Keyboard/composer resizing and late media loads also follow this policy.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        followIfPinned();
      });
    });
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [scrollRef, followIfPinned]);

  return { followingRef, showLatest, onScroll, followLatest };
}

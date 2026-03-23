// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CAPTCHA Relay Modal
 * Shows a screenshot of the blocked page. User clicks on the screenshot
 * to relay their actions to the headless Puppeteer browser solving the CAPTCHA.
 *
 * Supports: click, press-and-hold (Walmart), and text input CAPTCHAs.
 */
import { useState, useRef, useCallback } from 'react';
import * as captchaApi from '../../api/captcha';

interface CaptchaModalProps {
  sessionId: string;
  initialScreenshot: string;
  domain: string;
  onSolved: () => void;
  onDismiss: () => void;
}

export default function CaptchaModal({ sessionId, initialScreenshot, domain, onSolved, onDismiss }: CaptchaModalProps) {
  const [screenshot, setScreenshot] = useState(initialScreenshot);
  const [status, setStatus] = useState('Click on the security challenge to solve it');
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // Calculate real coordinates relative to the original page size (1920x1080 or viewport)
  const getPageCoords = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.naturalWidth / rect.width;
    const scaleY = imgRef.current.naturalHeight / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }, []);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLImageElement>) => {
    const { x, y } = getPageCoords(e);
    setLoading(true);
    setStatus(`Clicking at (${x}, ${y})...`);
    try {
      const result = await captchaApi.sendClick(sessionId, x, y);
      if (result.screenshot) setScreenshot(result.screenshot);
      setActions(a => a + 1);
      setStatus('Click registered. Click again or press "Done" when solved.');
    } catch (err) {
      setStatus('Click failed. Try again.');
    }
    setLoading(false);
  }, [sessionId, getPageCoords]);

  const handleHold = useCallback(async () => {
    if (!imgRef.current) return;
    // For "PRESS & HOLD" CAPTCHAs — hold the center of the button
    const x = Math.round(imgRef.current.naturalWidth / 2);
    const y = Math.round(imgRef.current.naturalHeight / 2);
    setLoading(true);
    setStatus(`Pressing and holding at center for 5 seconds...`);
    try {
      const result = await captchaApi.sendHold(sessionId, x, y, 5000);
      if (result.screenshot) setScreenshot(result.screenshot);
      setActions(a => a + 1);
      setStatus('Hold complete. Check if solved, then click "Done".');
    } catch (err) {
      setStatus('Hold failed. Try clicking directly on the button.');
    }
    setLoading(false);
  }, [sessionId]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await captchaApi.getScreenshot(sessionId);
      setScreenshot(result.screenshot);
      if (result.solved) {
        setStatus('CAPTCHA appears solved!');
        onSolved();
      } else {
        setStatus('Screenshot refreshed.');
      }
    } catch {
      setStatus('Could not refresh screenshot.');
    }
    setLoading(false);
  }, [sessionId, onSolved]);

  const handleDone = useCallback(async () => {
    setLoading(true);
    try {
      await captchaApi.markDone(sessionId);
      onSolved();
    } catch {
      setStatus('Error marking as done.');
    }
    setLoading(false);
  }, [sessionId, onSolved]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Security Check Required</h2>
            <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-medium text-indigo-600">{domain}</span> requires verification.
            Click on the challenge below to solve it.
          </p>
        </div>

        <div className="p-4">
          {/* Screenshot — clickable */}
          <div className="relative border-2 border-indigo-200 rounded-lg overflow-hidden">
            <img
              ref={imgRef}
              src={`data:image/png;base64,${screenshot}`}
              alt="Security challenge"
              className={`w-full cursor-crosshair ${loading ? 'opacity-50' : ''}`}
              onClick={handleClick}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-indigo-500" />
              </div>
            )}
          </div>

          {/* Status */}
          <p className="mt-3 text-sm text-slate-600 text-center">{status}</p>
          {actions > 0 && <p className="text-xs text-slate-400 text-center">{actions} action(s) sent</p>}

          {/* Action buttons */}
          <div className="mt-4 flex gap-2">
            <button onClick={handleHold} disabled={loading}
              className="flex-1 rounded-lg border-2 border-indigo-300 bg-indigo-50 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
              Press &amp; Hold (Walmart)
            </button>
            <button onClick={handleRefresh} disabled={loading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Refresh
            </button>
            <button onClick={handleDone} disabled={loading}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              Done ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

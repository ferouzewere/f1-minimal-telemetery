import { useEffect, useRef } from 'react';
import { useRaceStore } from '../store/useRaceStore';

export const LiveDataSynchronizer = () => {
    const isLive = useRaceStore(state => state.isLive);
    const sessionKey = useRaceStore(state => state.openF1SessionKey);
    const lastDate = useRaceStore(state => state.lastLiveDate);
    const appendLiveData = useRaceStore(state => state.appendLiveData);

    const pollInterval = useRef<any>(null);

    const lastDateRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isLive || !sessionKey) {
            if (pollInterval.current) clearInterval(pollInterval.current);
            return;
        }

        lastDateRef.current = lastDate;

        // 1. Initial Sync: Catch-up context (Last 5 mins of history)
        const initCatchup = async () => {
            try {
                console.log(`[LiveSync] Fetching catchup data for session ${sessionKey}...`);
                const cResp = await fetch(`http://localhost:3001/openf1/catchup?session_key=${sessionKey}`);
                const catchupData = await cResp.json();
                console.log(`[LiveSync] Catchup received:`, {
                    telemetry: catchupData.telemetry?.length || 0,
                    location: catchupData.location?.length || 0,
                    weather: catchupData.weather?.length || 0
                });
                appendLiveData(catchupData);
                console.log(`[LiveSync] Catchup appended to store.`);
            } catch (err) {
                console.error("Failed to sync live catchup history:", err);
            }
        };

        if (!lastDate) initCatchup();

        // 2. Start Polling
        let emptyPollCount = 0;
        const MAX_EMPTY_POLLS = 5; // Stop polling after 5 consecutive empty responses (historical session)

        pollInterval.current = setInterval(async () => {
            try {
                const currentLastDate = lastDateRef.current;
                const url = `http://localhost:3001/openf1/live?session_key=${sessionKey}${currentLastDate ? `&last_date=${currentLastDate}` : ''}`;
                console.log(`[LiveSync] Polling: ${url}`);
                const resp = await fetch(url);
                if (!resp.ok) throw new Error("Bridge failed");
                const data = await resp.json();

                const hasData = (
                    (Array.isArray(data.telemetry) && data.telemetry.length > 0) ||
                    (Array.isArray(data.location) && data.location.length > 0) ||
                    (Array.isArray(data.weather) && data.weather.length > 0)
                );

                if (hasData) {
                    const statusText = data.is_ingesting ? `[INGESTING: ${data.buffer_size}]` : "[BUFFERED]";
                    console.log(`[LiveSync] Received data: tel=${data.telemetry?.length || 0}, loc=${data.location?.length || 0} ${statusText}`);
                    emptyPollCount = 0; // Reset counter
                    appendLiveData(data);
                } else {
                    emptyPollCount++;
                    if (emptyPollCount >= MAX_EMPTY_POLLS) {
                        console.log('[LiveSync] Detected historical session (no new data). Stopping poll.');
                        if (pollInterval.current) clearInterval(pollInterval.current);
                    }
                }
            } catch (err) {
                console.warn("Polling error:", err);
            }
        }, 1000); // Poll every second

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [isLive, sessionKey, appendLiveData]);

    // Update the ref whenever lastDate changes from the store
    useEffect(() => {
        lastDateRef.current = lastDate;
    }, [lastDate]);

    return null; // Side-effect only component
};

"use client";

import { useEffect } from "react";
import { useBoardStore } from "@/store/board-store";
import type { Snapshot, WsMessage } from "@/lib/types";

function wsUrl() {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

export function useLiveFeed() {
  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { hydrate, applyBatch, setConnection } = useBoardStore.getState();

    async function loadSnapshot() {
      setConnection("connecting");
      const res = await fetch("/api/props", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Snapshot;
      if (cancelled) return;
      hydrate(data.props, data.seq, data.memory);
    }

    function connect() {
      if (cancelled) return;
      setConnection(attempts === 0 ? "connecting" : "reconnecting");
      const ws = new WebSocket(wsUrl());
      socket = ws;

      ws.onopen = () => {
        attempts = 0;
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(String(event.data)) as WsMessage;
        if (msg.type === "hello") {
          hydrate(msg.props, msg.seq, msg.memory);
          setConnection("live");
        } else if (msg.type === "batch") {
          applyBatch(msg.seq, msg.updates);
          setConnection("live");
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        attempts += 1;
        if (attempts > 8) {
          setConnection("offline", "Live feed dropped. Refresh to try again.");
          return;
        }
        setConnection("reconnecting");
        timer = setTimeout(connect, Math.min(8000, 400 * 2 ** attempts));
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    void loadSnapshot()
      .then(connect)
      .catch((err: Error) => {
        if (!cancelled) setConnection("offline", err.message);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);
}

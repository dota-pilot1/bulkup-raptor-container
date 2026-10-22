"use client";

import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

export type AppUpdateStatus = "idle" | "checking" | "uptodate" | "available" | "downloading" | "error";

export type AppUpdateState = {
  status: AppUpdateStatus;
  currentVersion: string;
  availableVersion: string;
  notes: string;
  progress: number;
  message: string;
};

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "업데이트 확인에 실패했습니다.";
  }
};

export function useAppUpdate(fallbackVersion: string) {
  const [state, setState] = useState<AppUpdateState>({
    status: "idle",
    currentVersion: fallbackVersion,
    availableVersion: "",
    notes: "",
    progress: 0,
    message: "",
  });
  const updateRef = useRef<Update | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    void getVersion()
      .then((version) => {
        if (!cancelled) setState((current) => ({ ...current, currentVersion: version }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!isTauri) {
      setState((current) => ({
        ...current,
        status: "error",
        message: "업데이트 확인은 설치된 데스크톱 앱에서만 사용할 수 있습니다.",
      }));
      return;
    }

    setState((current) => ({ ...current, status: "checking", message: "", progress: 0 }));
    try {
      const update = await check();
      updateRef.current = update;
      if (!update) {
        setState((current) => ({
          ...current,
          status: "uptodate",
          availableVersion: "",
          notes: "",
          progress: 0,
        }));
        return;
      }
      setState((current) => ({
        ...current,
        status: "available",
        availableVersion: update.version,
        notes: update.body ?? "",
        progress: 0,
        message: "",
      }));
    } catch (error) {
      updateRef.current = null;
      setState((current) => ({ ...current, status: "error", message: errorMessage(error) }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update || state.status === "downloading") return;
    setState((current) => ({ ...current, status: "downloading", message: "", progress: 0 }));
    try {
      let total = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) {
            setState((current) => ({
              ...current,
              progress: Math.min(100, Math.round((downloaded / total) * 100)),
            }));
          }
        } else if (event.event === "Finished") {
          setState((current) => ({ ...current, progress: 100 }));
        }
      });
      await relaunch();
    } catch (error) {
      setState((current) => ({ ...current, status: "error", message: errorMessage(error) }));
    }
  }, [state.status]);

  return {
    state,
    checkForUpdate,
    installUpdate,
    busy: state.status === "checking" || state.status === "downloading",
  };
}

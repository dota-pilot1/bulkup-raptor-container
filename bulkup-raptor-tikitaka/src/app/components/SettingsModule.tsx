"use client";

import { CircleAlert, CircleCheck, Database, Download, Info, Loader2, MonitorCog, RefreshCw, Settings2 } from "lucide-react";
import { useState } from "react";
import PageHeader from "@/shared/ui/PageHeader";
import { useAppUpdate } from "@/shared/lib/useAppUpdate";
import { BackupPanel } from "./BackupPanel";
import packageJson from "../../../package.json";

const APP_VERSION = packageJson.version;
const isAppStoreBuild = process.env.NEXT_PUBLIC_APP_STORE_BUILD === "1";

const tabs = [
  { id: "general", label: "일반 설정", icon: Settings2 },
  { id: "device", label: "장치", icon: MonitorCog },
  { id: "update", label: "업데이트", icon: RefreshCw },
  { id: "data", label: "데이터", icon: Database },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function SettingsModule() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const appUpdate = useAppUpdate(APP_VERSION);
  const visibleTabs = isAppStoreBuild ? tabs.filter(({ id }) => id !== "update") : tabs;

  return (
    <>
      <PageHeader>
        <Settings2 className="size-4 text-brand-primary" />
        <span className="text-[14px] font-bold tracking-tight text-text-primary">환경 설정</span>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted">
        <div className="mx-auto w-full max-w-3xl px-5 py-6">
          <header>
            <h1 className="text-[18px] font-bold tracking-tight text-text-primary">환경 설정</h1>
            <p className="mt-1 text-[12px] text-text-secondary">앱 실행 환경과 로컬 학습 데이터를 확인합니다.</p>
          </header>

          <div role="tablist" aria-label="환경 설정 메뉴" className="mt-5 flex gap-1 overflow-x-auto border-b border-surface-border-soft">
            {visibleTabs.map(({ id, label, icon: Icon }) => {
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(id)}
                  className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[12px] font-bold transition-colors ${selected ? "text-brand-primary" : "text-text-muted hover:text-text-primary"}`}
                >
                  <Icon className="size-3.5" />
                  {label}
                  {selected && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-primary" />}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-3">
            {activeTab === "general" && <GeneralSettings />}
            {activeTab === "device" && <DeviceSettings />}
            {activeTab === "update" && <UpdateSettings appUpdate={appUpdate} />}
            {activeTab === "data" && <BackupPanel />}
          </div>
        </div>
      </div>
    </>
  );
}

function GeneralSettings() {
  return (
    <>
      <SettingRow label="앱 이름" value="Bulkup Raptor" />
      <SettingRow label="실행 방식" value="Next.js + Tauri" />
      <SettingRow label="API 대상" value="현재 앱의 로컬 API (/api)" mono />
      <SettingNote>
        이 앱은 별도 외부 API 서버 대신 Next.js Route Handler를 사용합니다. 환경 변수는 서버 실행 시 적용되며,
        브라우저에서 임의로 변경할 수 없습니다.
      </SettingNote>
    </>
  );
}

function DeviceSettings() {
  return (
    <>
      <SettingRow label="장치 모드" value="직원 학습 콘솔 (STAFF)" />
      <SettingRow label="창 크기" value="1280 × 900 (최소 1024 × 700)" />
      <SettingNote>
        데스크톱 앱은 Tauri 창으로 실행됩니다. 창 크기와 리사이즈는 앱 설정에 정의되어 있으며, 장치 등록이나 KIOSK 전환은 아직 제공하지 않습니다.
      </SettingNote>
    </>
  );
}

function UpdateSettings({ appUpdate }: { appUpdate: ReturnType<typeof useAppUpdate> }) {
  const { state, busy } = appUpdate;
  const hasUpdate = state.status === "available" || state.status === "downloading";

  return (
    <>
      <div className="rounded-md border border-surface-border-soft bg-surface-raised px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-text-primary">현재 버전</p>
            <p className="mt-1 text-[13px] font-semibold tabular-nums text-text-secondary">v{state.currentVersion}</p>
          </div>
          <button type="button" disabled={busy} onClick={() => void appUpdate.checkForUpdate()} className="ui-icon-button h-9 shrink-0 gap-2 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
            {state.status === "checking" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {state.status === "checking" ? "확인 중..." : "업데이트 확인"}
          </button>
        </div>
      </div>
      {state.status === "uptodate" && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-[12px] font-semibold text-emerald-900">
          <CircleCheck className="size-4 shrink-0" />최신 버전을 사용 중입니다.
        </div>
      )}
      {state.status === "error" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-[12px] font-semibold leading-5 text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /><span>{state.message || "업데이트를 확인하지 못했습니다."}</span>
        </div>
      )}
      {hasUpdate && (
        <div className="rounded-md border border-brand-border bg-brand-glass px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[14px] font-black text-text-primary">새 버전 v{state.availableVersion}</p>
              <p className="mt-1 text-[12px] font-semibold text-text-secondary">설치 후 앱이 자동으로 재시작됩니다.</p>
            </div>
            <button type="button" disabled={busy} onClick={() => void appUpdate.installUpdate()} className="ui-icon-button-brand h-9 shrink-0 gap-2 px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
              {state.status === "downloading" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {state.status === "downloading" ? (state.progress > 0 ? `설치 중 ${state.progress}%` : "다운로드 중...") : "지금 업데이트"}
            </button>
          </div>
          {state.notes && <p className="mt-3 whitespace-pre-line rounded-md bg-surface-raised/70 px-3 py-2 text-[12px] font-semibold leading-5 text-text-secondary">{state.notes}</p>}
          {state.status === "downloading" && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-strong" role="progressbar" aria-label="업데이트 다운로드 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress}>
              <div className="h-full rounded-full bg-brand-primary transition-[width]" style={{ width: `${state.progress}%` }} />
            </div>
          )}
        </div>
      )}
      <SettingNote>업데이트는 GitHub Release의 서명된 Tauri 산출물을 사용합니다. 설치 중에는 앱을 종료하지 마세요.</SettingNote>
    </>
  );
}

function SettingRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-surface-border-soft bg-surface-raised px-4 py-3">
      <span className="text-[13px] font-bold text-text-primary">{label}</span>
      <span className={`min-w-0 truncate text-right text-[13px] font-semibold text-text-secondary ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function SettingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-md border border-surface-border-soft bg-surface-raised px-4 py-3 text-[12px] font-semibold leading-5 text-text-muted">
      <Info className="mt-0.5 size-4 shrink-0 text-brand-primary" />
      <span>{children}</span>
    </p>
  );
}

export default SettingsModule;

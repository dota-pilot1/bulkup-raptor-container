# Bulkup Raptor 릴리즈

## 릴리즈 방식

`v*` 태그를 푸시한 뒤 macOS와 Windows 워크플로를 각각 수동 실행해 GitHub Release에 산출물을 게시합니다. macOS는 로컬에서 수동 빌드·업로드하는 방식도 허용하지만, 어느 경우든 macOS DMG를 릴리즈에 포함해야 합니다.

```bash
npm ci
npm run build
npm run tauri build
```

릴리즈 태그는 `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`의 버전과 일치시킵니다.

```bash
git tag v0.1.1
git push origin v0.1.1
```

```bash
gh workflow run tauri-macos-release.yml --ref main -f release_tag=v1.0.0
gh workflow run tauri-release.yml --ref main -f release_tag=v1.0.0
```

현재 릴리즈는 로컬 SQLite/Next standalone 서버를 포함하는 독립형 데스크톱 앱입니다. 원본 `pkt-study-tauri`의 updater 설정은 이 프로젝트에 아직 서명 키와 updater 플러그인이 없으므로 추가하지 않았습니다.

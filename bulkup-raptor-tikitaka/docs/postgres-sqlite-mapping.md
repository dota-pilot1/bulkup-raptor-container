# PostgreSQL → SQLite 마이그레이션

## 사용 순서

원본 PostgreSQL 연결 정보는 `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` 환경 변수로 전달한다. `export`는 public 스키마의 모든 테이블을 읽어 JSON으로 저장하며 원본 DB를 변경하지 않는다.

```bash
cd /Users/terecal/pilot-project/sample-pkt-project/tikitaka-note/pkt-study-fullstack
PGHOST=127.0.0.1 PGPORT=5454 PGDATABASE=sk_pkt_mes PGUSER=postgres PGPASSWORD=postgres \
  node scripts/migrate-postgres-to-sqlite.mjs export --output .data/postgres-export.json
node scripts/migrate-postgres-to-sqlite.mjs import \
  --input .data/postgres-export.json --target .data/postgres-import-check.db
node scripts/migrate-postgres-to-sqlite.mjs verify \
  --input .data/postgres-export.json --target .data/postgres-import-check.db
```

import 기본 대상은 개발 DB가 아닌 별도 검증 DB이며, 대상 파일이 이미 있으면 중단한다. `--replace`는 지정한 검증 대상 파일에만 사용한다. PostgreSQL 세션은 앱 전환 시 재사용하지 않으므로 이전하지 않지만, refresh token을 포함한 원본 public 테이블 데이터는 검증 DB에 보존한다.

## 현재 매핑

계정·권한·플레이북 10개 테이블은 앱 스키마에 맞춰 명시적으로 이전한다. `boms`, `bom_lines`, `inventories`, `items`, `lots`, `menus`, `production_plans`, `work_orders`, `work_order_processes`, `kiosk_*`, `site_settings`, `refresh_tokens` 등 나머지 public 테이블도 PostgreSQL 컬럼 메타데이터를 이용해 SQLite 테이블로 생성하고 원본 컬럼·값을 보존한다. ID와 외래 키 값은 유지되며, 플레이북 문서의 `share_token`, `ai_edit_token_hash`, 만료·사용 시각도 보존한다.

generic으로 생성된 MES 테이블은 데이터 보존을 위한 1차 마이그레이션 대상이다. 이후 해당 기능을 화면·API로 이전할 때 Drizzle 타입과 외래 키 제약을 도메인별로 정식화한다.

## 검증 기준

- 지원 테이블별 source/export row count와 SQLite row count가 일치한다.
- SQLite `PRAGMA foreign_key_check` 결과가 비어 있다.
- PostgreSQL public 테이블 전체가 export JSON과 별도 SQLite 검증 DB에 존재한다.

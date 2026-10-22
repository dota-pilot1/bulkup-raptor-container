package com.bulkup.raptor.auth.infrastructure.session;

// 로그인 당시 역할 하나의 코드와 권한 버전을 보관한다.
public record RoleState(String code, long permissionVersion) {}

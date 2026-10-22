package com.bulkup.raptor.auth.infrastructure.session;

import java.util.Map;

// 로그인 당시 회원의 세션 버전과 역할별 정보를 보관한다.
// version과 roles는 이 record의 구성 요소이며, version()과 roles()로 읽는다.
public record MemberSessionDetails(long version, Map<Long, RoleState> roles) {

    // record의 축약 생성자이다. 객체를 만들 때 전달받은 roles를 아래에서 처리한다.
    public MemberSessionDetails {
        // roles는 이미 Map이다. Map.copyOf()는 같은 키와 값을 가진 수정 불가능한 Map을 반환한다.
        // 원본 Map의 항목을 나중에 바꿔도 로그인 당시 보관한 역할 정보는 바뀌지 않는다.
        // RoleState 객체 자체를 새로 복사하지는 않는다. RoleState는 String과 long을 담은 record이다.
        roles = Map.copyOf(roles);
        // 본문이 끝나면 Java가 version과 처리한 roles를 record의 필드에 자동으로 저장한다.
    }
}
